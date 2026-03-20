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
          background: 'transparent',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            background: '#0A0A0C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #2A2A32',
          }}
        >
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1,
              marginTop: 1,
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
