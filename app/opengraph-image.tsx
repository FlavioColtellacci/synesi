import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'SYNESI — Your Conviction, Tracked.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0C',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px 100px',
          fontFamily: 'monospace',
        }}
      >
        {/* Sigma mark */}
        <div
          style={{
            fontSize: 72,
            color: '#FFFFFF',
            fontWeight: 700,
            marginBottom: 36,
            letterSpacing: '-1px',
          }}
        >
          Σ SYNESI
        </div>

        {/* Hero headline */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 500,
            color: '#F0F0F0',
            lineHeight: 1.1,
            marginBottom: 36,
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}
        >
          YOUR CONVICTION
          <br />
          TRACKED.
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 26,
            color: '#6B6B7B',
            lineHeight: 1.6,
            maxWidth: 720,
          }}
        >
          The app that answers why you own a stock — and tells you when the answer has changed.
        </div>

        {/* Bottom domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 100,
            fontSize: 20,
            color: '#2A2A32',
            letterSpacing: '5px',
          }}
        >
          SYNESI.APP
        </div>
      </div>
    ),
    { ...size }
  )
}
