import { useRef } from 'react'
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

interface LoudnessChartProps {
  values: number[]
  times: number[]
  integratedLUFS: number
  className?: string
}

export function LoudnessChart({ values, times, integratedLUFS, className = '' }: LoudnessChartProps) {
  const chartRef = useRef(null)

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
        min: Math.min(...displayValues, integratedLUFS) - 5,
        max: Math.max(...displayValues, integratedLUFS) + 5,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          callback: (value: any) => `${value} LUFS`,
        },
      },
    },
  }

  return (
    <div className={`card ${className}`}>
      <h3 className="text-sm font-medium text-gray-400 mb-4">Loudness Over Time</h3>
      <div className="h-64">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  )
}
