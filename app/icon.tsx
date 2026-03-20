import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0A0A0C',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 4,
            top: 3,
            fontSize: 22,
            fontWeight: 700,
            color: 'rgba(255, 50, 50, 0.8)',
          }}
        >
          Σ
        </span>
        <span
          style={{
            position: 'absolute',
            left: 8,
            top: 3,
            fontSize: 22,
            fontWeight: 700,
            color: 'rgba(0, 200, 200, 0.8)',
          }}
        >
          Σ
        </span>
        <span
          style={{
            position: 'absolute',
            left: 6,
            top: 3,
            fontSize: 22,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          Σ
        </span>
      </div>
    ),
    { ...size }
  )
}
