import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
            left: 28,
            top: 30,
            fontSize: 120,
            fontWeight: 700,
            color: 'rgba(255, 50, 50, 0.75)',
          }}
        >
          Σ
        </span>
        <span
          style={{
            position: 'absolute',
            left: 36,
            top: 30,
            fontSize: 120,
            fontWeight: 700,
            color: 'rgba(0, 200, 200, 0.75)',
          }}
        >
          Σ
        </span>
        <span
          style={{
            position: 'absolute',
            left: 32,
            top: 30,
            fontSize: 120,
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
