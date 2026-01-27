import { useEffect, useRef } from 'react'

interface WaveformDisplayProps {
  waveformData: number[]
  className?: string
}

export function WaveformDisplay({ waveformData, className = '' }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
  }, [waveformData])

  return (
    <div className={`card ${className}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-4">Waveform</h3>
      <canvas
        ref={canvasRef}
        className="w-full h-32 rounded-lg bg-gray-800/50"
        style={{ display: 'block' }}
      />
    </div>
  )
}
