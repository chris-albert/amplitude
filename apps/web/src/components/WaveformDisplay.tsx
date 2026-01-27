import { useEffect, useRef, useCallback } from 'react'

interface WaveformDisplayProps {
  waveformData: number[]
  className?: string
  onSeek?: (normalizedPosition: number) => void
  onStop?: () => void
  playbackPosition?: number
  isPlaying?: boolean
}

export function WaveformDisplay({
  waveformData,
  className = '',
  onSeek,
  onStop,
  playbackPosition = 0,
  isPlaying = false
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || waveformData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const centerY = height / 2

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, 0)
    gradient.addColorStop(0, '#8b5cf6')
    gradient.addColorStop(0.5, '#6366f1')
    gradient.addColorStop(1, '#3b82f6')

    // Draw waveform
    const barWidth = width / waveformData.length
    const maxAmplitude = Math.max(...waveformData, 0.01)

    ctx.fillStyle = gradient

    waveformData.forEach((amplitude, i) => {
      const normalizedAmplitude = amplitude / maxAmplitude
      const barHeight = normalizedAmplitude * (height * 0.8)
      const x = i * barWidth
      const y = centerY - barHeight / 2

      // Draw rounded rectangle
      const radius = Math.min(barWidth / 2, 2)
      ctx.beginPath()
      ctx.roundRect(x, y, Math.max(barWidth - 1, 1), barHeight, radius)
      ctx.fill()
    })

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()

    // Draw playhead if playing
    if (playbackPosition > 0 || isPlaying) {
      const playheadX = playbackPosition * width
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }
  }, [waveformData, playbackPosition, isPlaying])

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const normalizedPosition = Math.max(0, Math.min(1, x / rect.width))
    onSeek(normalizedPosition)
  }, [onSeek])

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Waveform</h3>
        {isPlaying && onStop && (
          <button
            onClick={onStop}
            className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Stop playback"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`relative ${onSeek ? 'cursor-pointer' : ''}`}
        style={{ marginLeft: '54px' }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-32 rounded-lg bg-gray-800/50"
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}
