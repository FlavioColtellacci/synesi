import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const viewport: Viewport = {
  themeColor: '#0A0A0C',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://synesi.app'),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    shortcut: '/favicon.svg',
  },
  title: {
    default: 'SYNESI, Your Conviction, Tracked.',
    template: '%s | SYNESI',
  },
  description:
    'SYNESI is an investment and trading journal for thesis-driven investors. Track conviction over time, stress-test ideas with Sigma AI, and monitor your thesis with Sigma Monitor.',
  openGraph: {
    type: 'website',
    url: 'https://synesi.app',
    siteName: 'SYNESI',
    title: 'SYNESI, Your Conviction, Tracked.',
    description:
      'Investment and trading journal for thesis tracking, Sigma AI stress-tests, and Sigma Monitor alerts that keep your conviction grounded in evidence.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'SYNESI, Your Conviction, Tracked.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SYNESI, Your Conviction, Tracked.',
    description:
      'Track your investment thesis, stress-test decisions with Sigma AI, and use Sigma Monitor to catch drift before conviction breaks.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} [scrollbar-gutter:stable]`}
    >
      <body className="bg-synesi-bg text-synesi-text antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
