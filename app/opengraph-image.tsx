import { ImageResponse } from 'next/og'

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
          justifyContent: 'space-between',
          padding: '72px 96px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: '#FFFFFF' }}>
            Σ
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 400,
              color: '#6B6B7B',
              letterSpacing: 8,
            }}
          >
            SYNESI
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontSize: 84,
              fontWeight: 500,
              color: '#F0F0F0',
              letterSpacing: 4,
              lineHeight: 1,
            }}
          >
            YOUR CONVICTION
          </span>
          <span
            style={{
              fontSize: 84,
              fontWeight: 500,
              color: '#F0F0F0',
              letterSpacing: 4,
              lineHeight: 1,
            }}
          >
            TRACKED.
          </span>
        </div>

        <span style={{ fontSize: 26, color: '#6B6B7B', lineHeight: 1.5 }}>
          The app that answers why you own a stock — and tells you when the answer has changed.
        </span>
      </div>
    ),
    { ...size }
  )
}
