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
        }}
      >
        {/* Glitched Σ — three layers offset to simulate chromatic aberration */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            width: 110,
            height: 100,
            marginBottom: 36,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              fontSize: 88,
              fontWeight: 700,
              color: 'rgba(255, 50, 50, 0.75)',
            }}
          >
            Σ
          </span>
          <span
            style={{
              position: 'absolute',
              left: 8,
              top: 0,
              fontSize: 88,
              fontWeight: 700,
              color: 'rgba(0, 200, 200, 0.75)',
            }}
          >
            Σ
          </span>
          <span
            style={{
              position: 'absolute',
              left: 4,
              top: 0,
              fontSize: 88,
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            Σ
          </span>
        </div>

        {/* SYNESI wordmark */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: '#6B6B7B',
            letterSpacing: '8px',
            marginBottom: 44,
          }}
        >
          SYNESI
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 70,
            fontWeight: 500,
            color: '#F0F0F0',
            lineHeight: 1.1,
            marginBottom: 32,
            letterSpacing: '3px',
          }}
        >
          YOUR CONVICTION{'\n'}TRACKED.
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 26,
            color: '#6B6B7B',
            lineHeight: 1.6,
            maxWidth: 700,
          }}
        >
          The app that answers why you own a stock — and tells you when the answer has changed.
        </div>

        {/* Domain watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            right: 100,
            fontSize: 18,
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
