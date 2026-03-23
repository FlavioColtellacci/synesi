import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  metadataBase: new URL('https://synesi.app'),
  title: {
    default: 'SYNESI, Your Conviction, Tracked.',
    template: '%s | SYNESI',
  },
  description:
    'The app that answers why you own a stock, and tells you when the answer has changed. Document, track, and get AI-powered alerts on your investment theses.',
  openGraph: {
    type: 'website',
    url: 'https://synesi.app',
    siteName: 'SYNESI',
    title: 'SYNESI, Your Conviction, Tracked.',
    description:
      'The app that answers why you own a stock, and tells you when the answer has changed.',
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
      'The app that answers why you own a stock, and tells you when the answer has changed.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-synesi-bg text-synesi-text antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
