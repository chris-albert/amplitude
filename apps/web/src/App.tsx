import { useState, useCallback, useRef, useMemo } from 'react'
import { FileUploader } from './components/FileUploader'
import { WaveformDisplay, type Marker } from './components/WaveformDisplay'
import { LoudnessChart } from './components/LoudnessChart'
import { DBChart } from './components/DBChart'
import { MetricsDisplay } from './components/MetricsDisplay'
import { analyzeAudio, loadAudioFile, getWaveformData, type AudioMetrics, type AnalysisProgress } from './lib/audio-analyzer'

function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<AnalysisProgress | null>(null)
  const [metrics, setMetrics] = useState<AudioMetrics | null>(null)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackPosition, setPlaybackPosition] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const startOffsetRef = useRef<number>(0)
  const animationFrameRef = useRef<number | null>(null)

  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop()
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const updatePlaybackPosition = useCallback(() => {
    if (!audioContextRef.current || !audioBuffer) return

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    const position = startOffsetRef.current + elapsed

    if (position >= audioBuffer.duration) {
      stopPlayback()
      setPlaybackPosition(0)
      return
    }

    setPlaybackPosition(position)
    animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition)
  }, [audioBuffer, stopPlayback])

  const playFromPosition = useCallback((position: number) => {
    if (!audioBuffer) return

    // Stop any current playback
    stopPlayback()

    // Create or resume audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    // Create source node
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)

    // Handle playback end
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        stopPlayback()
        setPlaybackPosition(0)
      }
    }

    sourceNodeRef.current = source
    startTimeRef.current = ctx.currentTime
    startOffsetRef.current = position

    source.start(0, position)
    setIsPlaying(true)
    setPlaybackPosition(position)
    updatePlaybackPosition()
  }, [audioBuffer, stopPlayback, updatePlaybackPosition])

  const handleSeek = useCallback((normalizedPosition: number) => {
    if (!audioBuffer) return
    const position = normalizedPosition * audioBuffer.duration
    playFromPosition(position)
  }, [audioBuffer, playFromPosition])

  const handlePlay = useCallback(() => {
    playFromPosition(0)
  }, [playFromPosition])

  // Create markers for min/max LUFS and dB positions
  const markers: Marker[] = useMemo(() => {
    if (!metrics) return []
    return [
      { position: metrics.maxLUFSPosition, color: '#22c55e', label: 'Max LUFS' },
      { position: metrics.minLUFSPosition, color: '#ef4444', label: 'Min LUFS' },
      { position: metrics.peakDBPosition, color: '#3b82f6', label: 'Peak dB' },
      { position: metrics.minDBPosition, color: '#f97316', label: 'Min dB' },
    ]
  }, [metrics])

  const handleFileSelect = useCallback(async (file: File) => {
    stopPlayback()
    setIsLoading(true)
    setError(null)
    setMetrics(null)
    setWaveformData([])
    setAudioBuffer(null)
    setPlaybackPosition(0)
    setFileName(file.name)
    setProgress({ stage: 'loading', progress: 0 })

    try {
      setProgress({ stage: 'decoding', progress: 10 })
      // Get waveform data
      const buffer = await loadAudioFile(file)
      setAudioBuffer(buffer)
      setProgress({ stage: 'decoding', progress: 40 })
      const waveform = getWaveformData(buffer, 200)
      setWaveformData(waveform)

      // Analyze audio
      const results = await analyzeAudio(file, setProgress)
      setMetrics(results)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze audio file')
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [stopPlayback])

  const handleReset = useCallback(() => {
    stopPlayback()
    setMetrics(null)
    setWaveformData([])
    setAudioBuffer(null)
    setPlaybackPosition(0)
    setFileName('')
    setError(null)
    setProgress(null)
  }, [stopPlayback])

  const handleLoadExample = useCallback(async () => {
    stopPlayback()
    setIsLoading(true)
    setError(null)
    setMetrics(null)
    setWaveformData([])
    setAudioBuffer(null)
    setPlaybackPosition(0)
    setFileName('Abyss-Duality.mp3')
    setProgress({ stage: 'loading', progress: 0 })

    try {
      const response = await fetch(import.meta.env.BASE_URL + 'Abyss-Duality.mp3')

      // Track download progress if possible
      const contentLength = response.headers.get('content-length')
      let file: File
      if (contentLength && response.body) {
        const total = parseInt(contentLength, 10)
        let loaded = 0
        const reader = response.body.getReader()
        const chunks: Uint8Array[] = []

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          loaded += value.length
          setProgress({ stage: 'loading', progress: Math.round((loaded / total) * 30) })
        }

        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' })
        file = new File([blob], 'Abyss-Duality.mp3', { type: 'audio/mpeg' })
      } else {
        setProgress({ stage: 'loading', progress: 15 })
        const blob = await response.blob()
        file = new File([blob], 'Abyss-Duality.mp3', { type: 'audio/mpeg' })
      }

      setProgress({ stage: 'decoding', progress: 35 })
      // Get waveform data
      const buffer = await loadAudioFile(file)
      setAudioBuffer(buffer)
      setProgress({ stage: 'decoding', progress: 50 })
      const waveform = getWaveformData(buffer, 200)
      setWaveformData(waveform)

      // Analyze audio
      const results = await analyzeAudio(file, setProgress)
      setMetrics(results)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load example file')
    } finally {
      setIsLoading(false)
      setProgress(null)
    }
  }, [stopPlayback])

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20 pointer-events-none" />

      <header className="relative border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <a href="#" onClick={(e) => { e.preventDefault(); handleReset(); }} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Amplitude</h1>
              <p className="text-xs text-gray-500">Audio Loudness Analyzer</p>
            </div>
          </a>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {!metrics && !isLoading && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                  Analyze Your Audio
                </h2>
                <p className="text-gray-400">
                  Get detailed loudness metrics including LUFS, peak levels, and dynamic range
                </p>
              </div>
              <FileUploader onFileSelect={handleFileSelect} isLoading={isLoading} />
              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm mb-3">or</p>
                <button
                  onClick={handleLoadExample}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400
                             bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30
                             rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Try Example: Abyss-Duality.mp3
                </button>
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {isLoading && (
            <div className="max-w-md mx-auto text-center">
              <div className="card">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-300 font-medium">
                    {!progress || progress.stage === 'loading'
                      ? 'Loading file...'
                      : progress.stage === 'decoding'
                        ? 'Decoding audio...'
                        : 'Analyzing loudness...'}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${progress?.progress ?? 0}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{fileName}</span>
                  <span className="text-purple-400 font-medium">{progress?.progress ?? 0}%</span>
                </div>
              </div>
            </div>
          )}

          {metrics && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">{fileName}</h2>
                  <p className="text-gray-500 text-sm">Analysis complete</p>
                </div>
                <button onClick={handleReset} className="btn-primary">
                  Analyze Another
                </button>
              </div>

              <MetricsDisplay metrics={metrics} />

              {waveformData.length > 0 && (
                <WaveformDisplay
                  waveformData={waveformData}
                  onSeek={handleSeek}
                  onPlay={handlePlay}
                  onStop={stopPlayback}
                  playbackPosition={audioBuffer ? playbackPosition / audioBuffer.duration : 0}
                  isPlaying={isPlaying}
                  markers={markers}
                />
              )}

              {metrics.shortTermLUFS.length > 0 && (
                <LoudnessChart
                  values={metrics.shortTermLUFS}
                  times={metrics.shortTermLUFSTimes}
                  integratedLUFS={metrics.integratedLUFS}
                  onSeek={handleSeek}
                  onPlay={handlePlay}
                  onStop={stopPlayback}
                  playbackPosition={audioBuffer ? playbackPosition / audioBuffer.duration : 0}
                  isPlaying={isPlaying}
                  markers={markers}
                />
              )}

              {metrics.peakDBOverTime.length > 0 && (
                <DBChart
                  peakDBValues={metrics.peakDBOverTime}
                  rmsDBValues={metrics.rmsDBOverTime}
                  times={metrics.dbTimes}
                  averageDB={metrics.averageDB}
                  onSeek={handleSeek}
                  onPlay={handlePlay}
                  onStop={stopPlayback}
                  playbackPosition={audioBuffer ? playbackPosition / audioBuffer.duration : 0}
                  isPlaying={isPlaying}
                  markers={markers}
                />
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="relative border-t border-gray-800/50 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
          <p>Analyze audio loudness with LUFS (ITU-R BS.1770) measurements</p>
          <p className="mt-1">All processing happens locally in your browser</p>
          <a
            href="https://github.com/chris-albert/amplitude"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-3 text-gray-500 hover:text-purple-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span>View on GitHub</span>
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
