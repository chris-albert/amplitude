import { useState, useCallback, useRef } from 'react'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  isLoading: boolean
}

export function FileUploader({ onFileSelect, isLoading }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && isValidAudioFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidAudioFile(file)) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
        transition-all duration-300 ease-out
        ${isDragging
          ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
          : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30'
        }
        ${isLoading ? 'pointer-events-none opacity-50' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        onChange={handleFileInput}
        className="hidden"
      />

      <div className="flex flex-col items-center gap-4">
        <div className={`
          w-16 h-16 rounded-full flex items-center justify-center
          ${isDragging
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-gray-800 text-gray-400'
          }
          transition-all duration-300
        `}>
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>

        <div>
          <p className="text-lg font-medium text-gray-200">
            {isDragging ? 'Drop your audio file here' : 'Drag & drop your audio file'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or click to browse
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="px-2 py-1 bg-gray-800 rounded">MP3</span>
          <span className="px-2 py-1 bg-gray-800 rounded">WAV</span>
        </div>
      </div>
    </div>
  )
}

function isValidAudioFile(file: File): boolean {
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/wave', 'audio/x-wav']
  const validExtensions = ['.mp3', '.wav']

  const hasValidType = validTypes.includes(file.type)
  const hasValidExtension = validExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  )

  return hasValidType || hasValidExtension
}
