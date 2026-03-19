'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function getLinkClassName(isActive: boolean): string {
  return [
    'font-mono text-xs uppercase tracking-widest transition-colors duration-150',
    isActive ? 'text-[#F0F0F0]' : 'text-[#6B6B7B] hover:text-[#F0F0F0]',
  ].join(' ')
}

export default function NavLinks() {
  const pathname = usePathname()
  const convictionsActive =
    pathname.startsWith('/app/dashboard') || pathname.startsWith('/app/thesis')
  const accountActive = pathname === '/app/account'

  return (
    <div className="flex items-center gap-6">
      <Link href="/app/dashboard" className={getLinkClassName(convictionsActive)}>
        CONVICTIONS
      </Link>
      <Link href="/app/account" className={getLinkClassName(accountActive)}>
        ACCOUNT
      </Link>
    </div>
  )
}
