import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0C',
        }}
      >
        <div
          style={{
            width: 130,
            height: 130,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 118,
              fontWeight: 700,
              color: 'rgba(255, 50, 50, 0.75)',
              lineHeight: 1,
              transform: 'translateX(-4px)',
            }}
          >
            Σ
          </span>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 118,
              fontWeight: 700,
              color: 'rgba(0, 200, 200, 0.75)',
              lineHeight: 1,
              transform: 'translateX(4px)',
            }}
          >
            Σ
          </span>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 118,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            Σ
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
