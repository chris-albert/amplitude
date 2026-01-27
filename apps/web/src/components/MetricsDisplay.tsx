import type { AudioMetrics } from '../lib/audio-analyzer'

interface MetricsDisplayProps {
  metrics: AudioMetrics
  className?: string
}

interface MetricCardProps {
  label: string
  value: string
  unit: string
  description?: string
  highlight?: boolean
}

function MetricCard({ label, value, unit, description, highlight }: MetricCardProps) {
  return (
    <div className={`
      card flex flex-col
      ${highlight ? 'ring-1 ring-purple-500/50 bg-purple-900/20' : ''}
    `}>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`
          text-3xl font-bold tracking-tight
          ${highlight ? 'gradient-text' : 'text-white'}
        `}>
          {value}
        </span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      {description && (
        <span className="mt-2 text-xs text-gray-600">{description}</span>
      )}
    </div>
  )
}

export function MetricsDisplay({ metrics, className = '' }: MetricsDisplayProps) {
  const formatNumber = (num: number, decimals: number = 1) => {
    if (!isFinite(num)) return '-\u221E'
    return num.toFixed(decimals)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-medium text-gray-400 mb-4">Analysis Results</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Integrated LUFS"
          value={formatNumber(metrics.integratedLUFS)}
          unit="LUFS"
          description="Overall loudness"
          highlight
        />
        <MetricCard
          label="Peak Level"
          value={formatNumber(metrics.peakDB)}
          unit="dB"
          description="Maximum amplitude"
        />
        <MetricCard
          label="Average Level"
          value={formatNumber(metrics.averageDB)}
          unit="dB"
          description="RMS average"
        />
        <MetricCard
          label="Dynamic Range"
          value={formatNumber(metrics.standardDeviation)}
          unit="dB"
          description="Level variation"
        />
        <MetricCard
          label="Duration"
          value={formatDuration(metrics.duration)}
          unit=""
          description={`${metrics.duration.toFixed(1)} seconds`}
        />
        <MetricCard
          label="Sample Rate"
          value={(metrics.sampleRate / 1000).toFixed(1)}
          unit="kHz"
        />
        <MetricCard
          label="Channels"
          value={metrics.channels.toString()}
          unit={metrics.channels === 1 ? 'Mono' : 'Stereo'}
        />
        <MetricCard
          label="Min Level"
          value={formatNumber(metrics.minDB)}
          unit="dB"
          description="Quietest segment"
        />
      </div>
    </div>
  )
}
