# AGENTS.md - AI Assistant Guide

This document provides context for AI assistants working on the Amplitude codebase.

## Project Overview

Amplitude is a browser-based audio loudness analyzer. It processes audio files entirely client-side using the Web Audio API and displays LUFS (Loudness Units Full Scale) measurements along with other audio metrics.

**Key Principle**: All processing is local. No server-side audio processing exists.

## Directory Structure

```
amplitude/
├── apps/
│   └── web/                    # Main web application
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── lib/            # Core logic (audio analysis)
│       │   └── App.tsx         # Main application component
│       ├── public/             # Static assets
│       └── index.html          # HTML entry point
├── packages/                   # Shared packages (if any)
├── pnpm-workspace.yaml         # pnpm monorepo config
└── package.json                # Root package.json
```

## Key Files

### Application Core
- `apps/web/src/App.tsx` - Main React component, orchestrates all state and renders UI
- `apps/web/src/main.tsx` - React entry point
- `apps/web/src/index.css` - Global styles including Tailwind and custom CSS

### Audio Analysis
- `apps/web/src/lib/audio-analyzer.ts` - Core audio analysis logic including:
  - LUFS calculation (ITU-R BS.1770)
  - K-weighting filters
  - Peak/RMS measurements
  - Waveform data extraction

### Components
- `apps/web/src/components/FileUploader.tsx` - Drag-and-drop file upload
- `apps/web/src/components/WaveformDisplay.tsx` - Audio waveform visualization
- `apps/web/src/components/LoudnessChart.tsx` - LUFS over time chart
- `apps/web/src/components/DBChart.tsx` - Decibels over time chart
- `apps/web/src/components/MetricsDisplay.tsx` - Metric cards display

### Configuration
- `apps/web/vite.config.ts` - Vite configuration
- `apps/web/tailwind.config.js` - Tailwind CSS configuration
- `apps/web/tsconfig.json` - TypeScript configuration

## Architecture Notes

### State Management
- Uses React's built-in useState/useCallback hooks
- No external state management library
- All state lives in App.tsx and flows down via props

### Audio Processing Flow
1. User uploads file via FileUploader
2. File is decoded using Web Audio API (`AudioContext.decodeAudioData`)
3. Waveform data extracted for visualization
4. LUFS analysis performed in `analyzeAudio()`
5. Results stored in state and rendered

### Playback System
- Uses Web Audio API's `AudioBufferSourceNode` for playback
- Playback position tracked via `requestAnimationFrame`
- Click-to-seek implemented on all visualization components

### Markers System
- Vertical markers indicate min/max positions for LUFS and dB
- Markers passed from App.tsx to visualization components
- Each marker has position (0-1 normalized), color, and label

## Coding Conventions

### TypeScript
- Strict mode enabled
- Explicit types for component props
- Type definitions in the files where they're used

### React
- Functional components only
- Custom hooks for reusable logic
- useCallback for event handlers passed as props
- useMemo for expensive computations

### Styling
- Tailwind CSS for styling
- Custom gradient classes defined in index.css
- Dark theme with purple/blue accent colors
- Card components use glass-morphism effect

### File Naming
- Components: PascalCase (`WaveformDisplay.tsx`)
- Utilities: kebab-case (`audio-analyzer.ts`)

## Testing

Currently no automated tests. When adding tests:
- Use Vitest (compatible with Vite)
- Focus on audio-analyzer.ts for unit tests
- Consider Playwright for E2E tests

## Common Tasks

### Adding a New Metric
1. Add calculation in `apps/web/src/lib/audio-analyzer.ts`
2. Add to `AudioMetrics` type
3. Display in `MetricsDisplay.tsx`

### Adding a New Visualization
1. Create component in `apps/web/src/components/`
2. Accept `onSeek`, `onPlay`, `onStop`, `playbackPosition`, `isPlaying`, `markers` props
3. Implement click-to-seek behavior
4. Add to App.tsx results section

### Modifying the LUFS Algorithm
- All LUFS logic is in `audio-analyzer.ts`
- K-weighting filter coefficients are defined there
- Follow ITU-R BS.1770 specification

## Development Commands

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (localhost:5173)
pnpm build        # Production build
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
```

## Deployment

The app is deployed to GitHub Pages via GitHub Actions. The workflow:
1. Triggers on push to main
2. Builds the app with `pnpm build`
3. Deploys `apps/web/dist` to gh-pages branch

Base URL is configured in `vite.config.ts` for GitHub Pages compatibility.
