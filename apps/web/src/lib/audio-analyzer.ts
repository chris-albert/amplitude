export interface AudioMetrics {
  integratedLUFS: number
  shortTermLUFS: number[]
  shortTermLUFSTimes: number[]
  peakDB: number
  averageDB: number
  minDB: number
  standardDeviation: number
  duration: number
  sampleRate: number
  channels: number
  // Time positions for markers (normalized 0-1)
  minLUFSPosition: number
  maxLUFSPosition: number
  peakDBPosition: number
  minDBPosition: number
}

export interface AnalysisProgress {
  stage: 'loading' | 'decoding' | 'analyzing' | 'complete'
  progress: number
}

type ProgressCallback = (progress: AnalysisProgress) => void

// Helper to yield to main thread and prevent "page unresponsive"
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new AudioContext()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()
  return audioBuffer
}

// Apply K-weighting filter to audio data
async function applyKWeighting(buffer: AudioBuffer): Promise<Float32Array[]> {
  const { sampleRate, numberOfChannels, length } = buffer
  const filteredChannels: Float32Array[] = []

  for (let channel = 0; channel < numberOfChannels; channel++) {
    const offlineContext = new OfflineAudioContext(1, length, sampleRate)
    const source = offlineContext.createBufferSource()

    // Create a new buffer with just this channel
    const monoBuffer = offlineContext.createBuffer(1, length, sampleRate)
    monoBuffer.copyToChannel(buffer.getChannelData(channel), 0)
    source.buffer = monoBuffer

    // Create K-weighting filters
    const preFilter = offlineContext.createBiquadFilter()
    preFilter.type = 'highshelf'
    preFilter.frequency.value = 1681.97
    preFilter.gain.value = 4

    const rlbFilter = offlineContext.createBiquadFilter()
    rlbFilter.type = 'highpass'
    rlbFilter.frequency.value = 38.13
    rlbFilter.Q.value = 0.5

    // Connect the filter chain
    source.connect(preFilter)
    preFilter.connect(rlbFilter)
    rlbFilter.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()
    filteredChannels.push(renderedBuffer.getChannelData(0))
  }

  return filteredChannels
}

// Calculate mean square for a segment of audio
function calculateMeanSquare(data: Float32Array, start: number, end: number): number {
  let sum = 0
  const length = end - start
  for (let i = start; i < end && i < data.length; i++) {
    sum += data[i] * data[i]
  }
  return sum / length
}

// Convert mean square to LUFS
function meanSquareToLUFS(meanSquare: number): number {
  if (meanSquare <= 0) return -Infinity
  return -0.691 + 10 * Math.log10(meanSquare)
}

// Calculate integrated LUFS (ITU-R BS.1770)
export async function calculateIntegratedLUFS(filteredChannels: Float32Array[], sampleRate: number): Promise<number> {
  const blockSize = Math.floor(0.4 * sampleRate) // 400ms blocks
  const hopSize = Math.floor(0.1 * sampleRate) // 75% overlap
  const length = filteredChannels[0].length

  const blockLoudnesses: number[] = []
  let iterCount = 0

  for (let start = 0; start + blockSize <= length; start += hopSize) {
    let sumMeanSquare = 0

    for (let ch = 0; ch < filteredChannels.length; ch++) {
      const channelWeight = getChannelWeight(ch, filteredChannels.length)
      const meanSquare = calculateMeanSquare(filteredChannels[ch], start, start + blockSize)
      sumMeanSquare += channelWeight * meanSquare
    }

    const blockLoudness = meanSquareToLUFS(sumMeanSquare)
    if (isFinite(blockLoudness)) {
      blockLoudnesses.push(blockLoudness)
    }

    // Yield every 1000 iterations to keep UI responsive
    if (++iterCount % 1000 === 0) {
      await yieldToMain()
    }
  }

  if (blockLoudnesses.length === 0) return -Infinity

  // Gating: First pass - absolute threshold (-70 LUFS)
  const absoluteThreshold = -70
  const aboveAbsolute = blockLoudnesses.filter(l => l > absoluteThreshold)

  if (aboveAbsolute.length === 0) return -Infinity

  // Calculate mean of blocks above absolute threshold
  const meanAboveAbsolute = aboveAbsolute.reduce((a, b) => a + Math.pow(10, b / 10), 0) / aboveAbsolute.length
  const relativeThreshold = 10 * Math.log10(meanAboveAbsolute) - 10

  // Second pass - relative threshold
  const aboveRelative = aboveAbsolute.filter(l => l > relativeThreshold)

  if (aboveRelative.length === 0) return -Infinity

  // Calculate final integrated loudness
  const meanAboveRelative = aboveRelative.reduce((a, b) => a + Math.pow(10, b / 10), 0) / aboveRelative.length
  return 10 * Math.log10(meanAboveRelative)
}

// Get channel weight for LUFS calculation
function getChannelWeight(channel: number, totalChannels: number): number {
  // Standard channel weights per ITU-R BS.1770
  // For stereo: both channels have weight 1.0
  // For 5.1: L, R, C = 1.0; Ls, Rs = 1.41 (~+1.5 dB)
  if (totalChannels <= 2) return 1.0
  if (channel === 0 || channel === 1 || channel === 2) return 1.0
  if (channel === 3 || channel === 4) return 1.41
  return 1.0
}

// Calculate short-term LUFS (3-second window)
export async function calculateShortTermLUFS(
  filteredChannels: Float32Array[],
  sampleRate: number
): Promise<{ values: number[], times: number[] }> {
  const windowSize = Math.floor(3 * sampleRate) // 3 seconds
  const hopSize = Math.floor(0.1 * sampleRate) // 100ms hop
  const length = filteredChannels[0].length

  const values: number[] = []
  const times: number[] = []
  let iterCount = 0

  for (let start = 0; start + windowSize <= length; start += hopSize) {
    let sumMeanSquare = 0

    for (let ch = 0; ch < filteredChannels.length; ch++) {
      const channelWeight = getChannelWeight(ch, filteredChannels.length)
      const meanSquare = calculateMeanSquare(filteredChannels[ch], start, start + windowSize)
      sumMeanSquare += channelWeight * meanSquare
    }

    const loudness = meanSquareToLUFS(sumMeanSquare)
    values.push(isFinite(loudness) ? loudness : -70)
    times.push((start + windowSize / 2) / sampleRate)

    // Yield every 500 iterations to keep UI responsive
    if (++iterCount % 500 === 0) {
      await yieldToMain()
    }
  }

  return { values, times }
}

// Calculate dB metrics from raw audio buffer (memory-efficient streaming approach)
export async function calculateDBMetrics(buffer: AudioBuffer): Promise<{
  peakDB: number
  averageDB: number
  minDB: number
  standardDeviation: number
  peakDBPosition: number
  minDBPosition: number
}> {
  let maxSample = 0
  let maxSampleIndex = 0
  let sumSquares = 0
  let count = 0

  // First pass: calculate peak and RMS (streaming, no large arrays)
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const absValue = Math.abs(data[i])
      if (absValue > maxSample) {
        maxSample = absValue
        maxSampleIndex = i
      }
      sumSquares += absValue * absValue
      count++
      // Yield every 1M samples to keep UI responsive
      if (count % 1000000 === 0) {
        await yieldToMain()
      }
    }
  }

  // Peak dB
  const peakDB = maxSample > 0 ? 20 * Math.log10(maxSample) : -Infinity
  const peakDBPosition = buffer.length > 0 ? maxSampleIndex / buffer.length : 0

  // RMS for average dB
  const rms = Math.sqrt(sumSquares / count)
  const averageDB = rms > 0 ? 20 * Math.log10(rms) : -Infinity

  // For min dB and standard deviation, use sampling to avoid memory issues
  // Sample every Nth value to get a representative subset
  const sampleRateDiv = Math.max(1, Math.floor(count / 100000)) // Max 100k samples
  const sampledDB: { db: number, index: number }[] = []

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i += sampleRateDiv) {
      const absValue = Math.abs(data[i])
      if (absValue > 0.0001) {
        sampledDB.push({ db: 20 * Math.log10(absValue), index: i })
      }
    }
  }

  // Sort sampled values to find quietest 10%
  sampledDB.sort((a, b) => a.db - b.db)
  const quietestCount = Math.floor(sampledDB.length * 0.1)
  const quietestSamples = sampledDB.slice(0, quietestCount)

  // Min dB from quietest samples (convert back from dB to calculate RMS properly)
  let quietestSumSquares = 0
  for (const sample of quietestSamples) {
    const linear = Math.pow(10, sample.db / 20)
    quietestSumSquares += linear * linear
  }
  const quietestRMS = quietestSamples.length > 0
    ? Math.sqrt(quietestSumSquares / quietestSamples.length)
    : 0
  const minDB = quietestRMS > 0 ? 20 * Math.log10(quietestRMS) : -Infinity

  // Find the position of the quietest sample (middle of quietest region)
  const minDBPosition = quietestSamples.length > 0
    ? quietestSamples[Math.floor(quietestSamples.length / 2)].index / buffer.length
    : 0

  // Standard deviation of dB values
  const dbValues = sampledDB.map(s => s.db)
  const meanDB = dbValues.reduce((a, b) => a + b, 0) / dbValues.length
  const variance = dbValues.reduce((sum, val) => sum + Math.pow(val - meanDB, 2), 0) / dbValues.length
  const standardDeviation = Math.sqrt(variance)

  return { peakDB, averageDB, minDB, standardDeviation, peakDBPosition, minDBPosition }
}

// Main analysis function
export async function analyzeAudio(
  file: File,
  onProgress?: ProgressCallback
): Promise<AudioMetrics> {
  onProgress?.({ stage: 'decoding', progress: 50 })

  const buffer = await loadAudioFile(file)

  onProgress?.({ stage: 'analyzing', progress: 60 })

  // Apply K-weighting filter
  const filteredChannels = await applyKWeighting(buffer)

  onProgress?.({ stage: 'analyzing', progress: 70 })

  // Calculate integrated LUFS
  const integratedLUFS = await calculateIntegratedLUFS(filteredChannels, buffer.sampleRate)

  onProgress?.({ stage: 'analyzing', progress: 80 })

  // Calculate short-term LUFS
  const shortTerm = await calculateShortTermLUFS(filteredChannels, buffer.sampleRate)

  onProgress?.({ stage: 'analyzing', progress: 90 })

  // Calculate dB metrics
  const dbMetrics = await calculateDBMetrics(buffer)

  onProgress?.({ stage: 'analyzing', progress: 100 })
  onProgress?.({ stage: 'complete', progress: 100 })

  // Calculate min/max LUFS positions (normalized 0-1)
  let minLUFSIndex = 0
  let maxLUFSIndex = 0
  let minLUFS = Infinity
  let maxLUFS = -Infinity

  for (let i = 0; i < shortTerm.values.length; i++) {
    if (shortTerm.values[i] < minLUFS) {
      minLUFS = shortTerm.values[i]
      minLUFSIndex = i
    }
    if (shortTerm.values[i] > maxLUFS) {
      maxLUFS = shortTerm.values[i]
      maxLUFSIndex = i
    }
  }

  const minLUFSPosition = shortTerm.times.length > 0
    ? shortTerm.times[minLUFSIndex] / buffer.duration
    : 0
  const maxLUFSPosition = shortTerm.times.length > 0
    ? shortTerm.times[maxLUFSIndex] / buffer.duration
    : 0

  return {
    integratedLUFS,
    shortTermLUFS: shortTerm.values,
    shortTermLUFSTimes: shortTerm.times,
    peakDB: dbMetrics.peakDB,
    averageDB: dbMetrics.averageDB,
    minDB: dbMetrics.minDB,
    standardDeviation: dbMetrics.standardDeviation,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    channels: buffer.numberOfChannels,
    minLUFSPosition,
    maxLUFSPosition,
    peakDBPosition: dbMetrics.peakDBPosition,
    minDBPosition: dbMetrics.minDBPosition,
  }
}

// Get waveform data for visualization
export function getWaveformData(buffer: AudioBuffer, samples: number = 1000): number[] {
  const data = buffer.getChannelData(0)
  const blockSize = Math.floor(data.length / samples)
  const waveform: number[] = []

  for (let i = 0; i < samples; i++) {
    const start = i * blockSize
    let max = 0
    for (let j = 0; j < blockSize && start + j < data.length; j++) {
      const abs = Math.abs(data[start + j])
      if (abs > max) max = abs
    }
    waveform.push(max)
  }

  return waveform
}
