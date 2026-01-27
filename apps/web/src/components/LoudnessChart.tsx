import { useRef, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export interface Marker {
  position: number // normalized 0-1
  color: string
  label: string
}

interface LoudnessChartProps {
  values: number[]
  times: number[]
  integratedLUFS: number
  className?: string
  onSeek?: (normalizedPosition: number) => void
  onPlay?: () => void
  onStop?: () => void
  playbackPosition?: number
  isPlaying?: boolean
  markers?: Marker[]
}

// Fixed width to match waveform alignment
const Y_AXIS_WIDTH = 70

export function LoudnessChart({
  values,
  times,
  integratedLUFS,
  className = '',
  onSeek,
  onPlay,
  onStop,
  playbackPosition = 0,
  isPlaying = false,
  markers = []
}: LoudnessChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Downsample if too many points
  const maxPoints = 200
  let displayValues = values
  let displayTimes = times
  if (values.length > maxPoints) {
    const step = Math.ceil(values.length / maxPoints)
    displayValues = values.filter((_, i) => i % step === 0)
    displayTimes = times.filter((_, i) => i % step === 0)
  }

  const data = {
    labels: displayTimes.map(t => formatTime(t)),
    datasets: [
      {
        label: 'Short-term LUFS',
        data: displayValues,
        borderColor: 'rgb(139, 92, 246)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: 'rgb(139, 92, 246)',
      },
      {
        label: 'Integrated LUFS',
        data: displayValues.map(() => integratedLUFS),
        borderColor: 'rgba(251, 191, 36, 0.8)',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ],
  }

  const handleChartClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !chartRef.current) return

    const chart = chartRef.current
    const chartArea = chart.chartArea
    if (!chartArea) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left

    // Check if click is within chart area
    if (x < chartArea.left || x > chartArea.right) return

    const normalizedPosition = (x - chartArea.left) / (chartArea.right - chartArea.left)
    onSeek(Math.max(0, Math.min(1, normalizedPosition)))
  }, [onSeek])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.7)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} LUFS`
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          maxTicksLimit: 10,
        },
      },
      y: {
        display: true,
        min: Math.floor((Math.min(...displayValues, integratedLUFS) - 5) * 10) / 10,
        max: Math.ceil((Math.max(...displayValues, integratedLUFS) + 5) * 10) / 10,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value: any) => `${Number(value).toFixed(1)} LUFS`,
        },
        afterFit: (scale: any) => {
          scale.width = Y_AXIS_WIDTH
        },
      },
    },
  }

  // Calculate playhead position as percentage of chart area
  const getPlayheadStyle = () => {
    if (!chartRef.current || (playbackPosition === 0 && !isPlaying)) return { display: 'none' as const }

    const chart = chartRef.current
    const chartArea = chart.chartArea
    if (!chartArea) return { display: 'none' as const }

    const left = chartArea.left + playbackPosition * (chartArea.right - chartArea.left)
    return {
      left: `${left}px`,
      top: `${chartArea.top}px`,
      height: `${chartArea.bottom - chartArea.top}px`,
    }
  }

  // Calculate marker position style
  const getMarkerStyle = (position: number) => {
    if (!chartRef.current) return { display: 'none' as const }

    const chart = chartRef.current
    const chartArea = chart.chartArea
    if (!chartArea) return { display: 'none' as const }

    const left = chartArea.left + position * (chartArea.right - chartArea.left)
    return {
      left: `${left}px`,
      top: `${chartArea.top}px`,
      height: `${chartArea.bottom - chartArea.top}px`,
    }
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Loudness Over Time</h3>
        {(onPlay || onStop) && (
          <button
            onClick={isPlaying ? onStop : onPlay}
            className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title={isPlaying ? "Stop playback" : "Play from beginning"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
      <div
        className={`h-64 relative ${onSeek ? 'cursor-pointer' : ''}`}
        onClick={handleChartClick}
      >
        <Line ref={chartRef} data={data} options={options} />
        {/* Markers */}
        {markers.map((marker, i) => (
          <div
            key={i}
            className="absolute w-0.5 pointer-events-none"
            style={{
              ...getMarkerStyle(marker.position),
              backgroundImage: `repeating-linear-gradient(to bottom, ${marker.color} 0px, ${marker.color} 4px, transparent 4px, transparent 8px)`,
            }}
          />
        ))}
        {/* Playhead on top */}
        {(playbackPosition > 0 || isPlaying) && (
          <div
            className="absolute w-0.5 bg-amber-400 pointer-events-none"
            style={getPlayheadStyle()}
          />
        )}
      </div>
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ marginLeft: `${Y_AXIS_WIDTH}px` }}>
          {markers.map((marker, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="w-3 h-0.5"
                style={{ backgroundColor: marker.color }}
              />
              <span className="text-gray-400">{marker.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
