import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import { ShellTransition } from '@/components/layout/ShellTransition'
import { SITE_ORIGIN } from '@/lib/marketing/site-origin'
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

const defaultDescription =
  'The narrative keeper for thesis-driven investors and traders, powered by Sigma. Document your thesis, track how conviction evolves, and know when reality challenges your story.'

const ogDescription =
  'The narrative keeper for investors. Track how your conviction evolves and know when reality challenges your story.'

const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
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
  description: defaultDescription,
  openGraph: {
    type: 'website',
    url: SITE_ORIGIN,
    locale: 'en_US',
    siteName: 'SYNESI',
    title: 'SYNESI, Your Conviction, Tracked.',
    description: ogDescription,
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
    description: ogDescription,
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
        {googleAnalyticsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        ) : null}
        <ShellTransition>{children}</ShellTransition>
        <Analytics />
      </body>
    </html>
  )
}
