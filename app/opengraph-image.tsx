import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const alt = 'SYNESI, Your Conviction, Tracked.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** JetBrains Mono TTF from Google Fonts (stable gstatic URLs). */
const JB_MONO = {
  w400:
    'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf',
  w500:
    'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf',
  w700:
    'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf',
} as const

const mono = 'JetBrains Mono'

function GlitchedSigma({
  sizePx,
  bold = true,
  fontFamily = mono,
}: {
  sizePx: number
  bold?: boolean
  /** Falls back to system stack when custom fonts did not load. */
  fontFamily?: string
}) {
  const offset = Math.max(2, Math.round(sizePx * 0.04))
  return (
    <div
      style={{
        width: sizePx * 1.2,
        height: sizePx * 1.1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: sizePx,
          fontWeight: bold ? 700 : 500,
          fontFamily,
          color: 'rgba(255, 50, 50, 0.7)',
          lineHeight: 1,
          transform: `translateX(-${offset}px) scaleY(0.86)`,
        }}
      >
        Σ
      </span>
      <span
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: sizePx,
          fontWeight: bold ? 700 : 500,
          fontFamily,
          color: 'rgba(0, 210, 255, 0.72)',
          lineHeight: 1,
          transform: `translateX(${offset}px) scaleY(0.86)`,
        }}
      >
        Σ
      </span>
      <span
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: sizePx,
          fontWeight: bold ? 700 : 500,
          fontFamily,
          color: '#FFFFFF',
          lineHeight: 1,
          transform: 'scaleY(0.86)',
          textShadow: '0 0 10px rgba(255,255,255,0.06)',
        }}
      >
        Σ
      </span>
    </div>
  )
}

async function loadMonoFonts(): Promise<
  Array<{
    name: string
    data: ArrayBuffer
    style: 'normal'
    weight: 400 | 500 | 700
  }>
> {
  try {
    const [data400, data500, data700] = await Promise.all([
      fetch(JB_MONO.w400).then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch(JB_MONO.w500).then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`)
        return r.arrayBuffer()
      }),
      fetch(JB_MONO.w700).then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${r.status}`)
        return r.arrayBuffer()
      }),
    ])
    return [
      { name: mono, data: data400, style: 'normal' as const, weight: 400 as const },
      { name: mono, data: data500, style: 'normal' as const, weight: 500 as const },
      { name: mono, data: data700, style: 'normal' as const, weight: 700 as const },
    ]
  } catch {
    return []
  }
}

export default async function Image() {
  const fonts = await loadMonoFonts()
  const fontFamily =
    fonts.length === 3 ? mono : 'ui-monospace, SFMono-Regular, Menlo, monospace'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          position: 'relative',
          backgroundColor: '#0A0A0C',
          backgroundImage:
            'radial-gradient(ellipse 90% 70% at 92% 42%, rgba(28, 32, 44, 0.95) 0%, transparent 52%), radial-gradient(ellipse 55% 45% at 78% 88%, rgba(150, 160, 185, 0.14) 0%, transparent 60%), linear-gradient(118deg, #0A0A0C 0%, #0d0d12 38%, #0A0A0C 72%)',
        }}
      >
        {/* Panel echo (thesis card column) */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '46%',
            backgroundColor: 'rgba(20, 20, 24, 0.55)',
            borderLeft: '1px solid #2A2A32',
          }}
        />

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 56px 64px 72px',
            zIndex: 1,
            maxWidth: '54%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <GlitchedSigma sizePx={44} fontFamily={fontFamily} />
            <span
              style={{
                fontSize: 17,
                fontWeight: 500,
                fontFamily,
                color: '#6B6B7B',
                letterSpacing: 10,
              }}
            >
              SYNESI
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              style={{
                fontSize: 68,
                fontWeight: 500,
                fontFamily,
                color: '#F0F0F0',
                letterSpacing: 5,
                lineHeight: 1.02,
                textTransform: 'uppercase',
              }}
            >
              YOUR CONVICTION
            </span>
            <span
              style={{
                fontSize: 68,
                fontWeight: 500,
                fontFamily,
                color: '#F0F0F0',
                letterSpacing: 5,
                lineHeight: 1.02,
                textTransform: 'uppercase',
              }}
            >
              TRACKED.
            </span>
          </div>

          <span
            style={{
              fontSize: 22,
              fontWeight: 400,
              fontFamily,
              color: '#6B6B7B',
              lineHeight: 1.45,
            }}
          >
            Where your investment story lives, grows, and gets tested against
            reality.
          </span>
        </div>

        <div
          style={{
            width: '46%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            position: 'relative',
          }}
        >
          {/* Ambient glow under sigma (hero column) */}
          <div
            style={{
              position: 'absolute',
              bottom: 120,
              width: 200,
              height: 36,
              borderRadius: 999,
              background:
                'radial-gradient(ellipse, rgba(150,160,185,0.22) 0%, transparent 72%)',
            }}
          />
          <GlitchedSigma sizePx={240} fontFamily={fontFamily} />
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length ? { fonts } : {}),
    }
  )
}
