import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
            width: 22,
            height: 22,
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
              fontSize: 20,
              fontWeight: 700,
              color: 'rgba(255, 50, 50, 0.8)',
              lineHeight: 1,
              transform: 'translateX(-1px)',
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
              fontSize: 20,
              fontWeight: 700,
              color: 'rgba(0, 200, 200, 0.8)',
              lineHeight: 1,
              transform: 'translateX(1px)',
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
              fontSize: 20,
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
