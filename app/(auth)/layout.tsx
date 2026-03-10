import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-synesi-bg">
      <div className="flex min-h-screen items-center justify-center px-4 py-8">{children}</div>
    </main>
  )
}
