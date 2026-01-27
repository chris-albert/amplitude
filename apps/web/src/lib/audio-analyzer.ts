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
}

export interface AnalysisProgress {
  stage: 'decoding' | 'analyzing' | 'complete'
  progress: number
}

type ProgressCallback = (progress: AnalysisProgress) => void

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
export function calculateIntegratedLUFS(filteredChannels: Float32Array[], sampleRate: number): number {
  const blockSize = Math.floor(0.4 * sampleRate) // 400ms blocks
  const hopSize = Math.floor(0.1 * sampleRate) // 75% overlap
  const length = filteredChannels[0].length

  const blockLoudnesses: number[] = []

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
export function calculateShortTermLUFS(
  filteredChannels: Float32Array[],
  sampleRate: number
): { values: number[], times: number[] } {
  const windowSize = Math.floor(3 * sampleRate) // 3 seconds
  const hopSize = Math.floor(0.1 * sampleRate) // 100ms hop
  const length = filteredChannels[0].length

  const values: number[] = []
  const times: number[] = []

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
  }

  return { values, times }
}

// Calculate dB metrics from raw audio buffer
export function calculateDBMetrics(buffer: AudioBuffer): {
  peakDB: number
  averageDB: number
  minDB: number
  standardDeviation: number
} {
  const allSamples: number[] = []
  let maxSample = 0

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      const absValue = Math.abs(data[i])
      allSamples.push(absValue)
      if (absValue > maxSample) maxSample = absValue
    }
  }

  // Peak dB
  const peakDB = maxSample > 0 ? 20 * Math.log10(maxSample) : -Infinity

  // RMS for average dB
  const sumSquares = allSamples.reduce((sum, val) => sum + val * val, 0)
  const rms = Math.sqrt(sumSquares / allSamples.length)
  const averageDB = rms > 0 ? 20 * Math.log10(rms) : -Infinity

  // Min dB (using RMS of quietest 10% of non-silent samples)
  const nonSilent = allSamples.filter(v => v > 0.0001).sort((a, b) => a - b)
  const quietest = nonSilent.slice(0, Math.floor(nonSilent.length * 0.1))
  const quietestRMS = quietest.length > 0
    ? Math.sqrt(quietest.reduce((sum, val) => sum + val * val, 0) / quietest.length)
    : 0
  const minDB = quietestRMS > 0 ? 20 * Math.log10(quietestRMS) : -Infinity

  // Standard deviation of dB values
  const dbValues = allSamples
    .filter(v => v > 0.0001)
    .map(v => 20 * Math.log10(v))

  const meanDB = dbValues.reduce((a, b) => a + b, 0) / dbValues.length
  const variance = dbValues.reduce((sum, val) => sum + Math.pow(val - meanDB, 2), 0) / dbValues.length
  const standardDeviation = Math.sqrt(variance)

  return { peakDB, averageDB, minDB, standardDeviation }
}

// Main analysis function
export async function analyzeAudio(
  file: File,
  onProgress?: ProgressCallback
): Promise<AudioMetrics> {
  onProgress?.({ stage: 'decoding', progress: 0 })

  const buffer = await loadAudioFile(file)

  onProgress?.({ stage: 'decoding', progress: 100 })
  onProgress?.({ stage: 'analyzing', progress: 0 })

  // Apply K-weighting filter
  const filteredChannels = await applyKWeighting(buffer)

  onProgress?.({ stage: 'analyzing', progress: 30 })

  // Calculate integrated LUFS
  const integratedLUFS = calculateIntegratedLUFS(filteredChannels, buffer.sampleRate)

  onProgress?.({ stage: 'analyzing', progress: 50 })

  // Calculate short-term LUFS
  const shortTerm = calculateShortTermLUFS(filteredChannels, buffer.sampleRate)

  onProgress?.({ stage: 'analyzing', progress: 70 })

  // Calculate dB metrics
  const dbMetrics = calculateDBMetrics(buffer)

  onProgress?.({ stage: 'analyzing', progress: 100 })
  onProgress?.({ stage: 'complete', progress: 100 })

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
