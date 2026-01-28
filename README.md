# Amplitude

A browser-based audio loudness analyzer that provides professional-grade LUFS measurements and visualizations.

## Features

### Loudness Metrics
- **Integrated LUFS** - Overall loudness measurement per ITU-R BS.1770 standard
- **Short-term LUFS** - 3-second sliding window measurements
- **Loudness Range (LRA)** - Dynamic range of loudness variation
- **True Peak** - Maximum sample value in dBTP
- **Peak dB & RMS dB** - Traditional peak and average level measurements

### Visualizations
- **Waveform Display** - Visual representation of the audio with playback controls
- **Loudness Over Time Chart** - Short-term LUFS graphed against time
- **Decibels Over Time Chart** - Peak and RMS dB levels over time
- **Vertical Markers** - Indicators for min/max LUFS and dB positions

### Playback
- Click anywhere on visualizations to seek and play
- Stop/play controls
- Visual playback position indicator

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Web Audio API** - Audio decoding and playback
- **pnpm** - Package manager (monorepo)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/chris-albert/amplitude.git
cd amplitude

# Install dependencies
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
# Build for production
pnpm build

# Preview the production build
pnpm preview
```

## How It Works

### Local Processing
All audio analysis happens entirely in your browser. No audio data is uploaded to any server. The app uses the Web Audio API to decode audio files and performs loudness calculations using JavaScript.

### LUFS Standard
Amplitude implements the ITU-R BS.1770 standard for loudness measurement:
1. **K-weighting filter** - Applies frequency weighting to match human perception
2. **Mean square calculation** - Computes power for each channel
3. **Channel summing** - Combines channels with appropriate weights (surround channels get +1.5 dB)
4. **Gating** - Applies absolute (-70 LUFS) and relative (-10 LU) gates to exclude silence and quiet passages
5. **Integration** - Calculates the final integrated loudness value

## Supported Formats

The app supports any audio format that your browser can decode, typically including:
- MP3
- WAV
- AAC/M4A
- OGG
- FLAC (in supported browsers)

## License

MIT
