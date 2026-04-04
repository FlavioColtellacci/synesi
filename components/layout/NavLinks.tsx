'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function getLinkClassName(isActive: boolean): string {
  return [
    'whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 md:text-xs md:tracking-widest',
    isActive ? 'text-[#F0F0F0]' : 'text-[#6B6B7B] hover:text-[#F0F0F0]',
  ].join(' ')
}

export default function NavLinks() {
  const pathname = usePathname()
  const convictionsActive =
    pathname.startsWith('/app/dashboard') || pathname.startsWith('/app/thesis')
  const sigmaGuideActive = pathname.startsWith('/app/sigma-guide')
  const accountActive = pathname === '/app/account'

  return (
    <div className="flex items-center gap-4 md:gap-6">
      <Link href="/app/dashboard" className={getLinkClassName(convictionsActive)}>
        CONVICTIONS
      </Link>
      <Link href="/app/sigma-guide" className={getLinkClassName(sigmaGuideActive)}>
        SIGMA GUIDE
      </Link>
      <Link href="/app/account" className={getLinkClassName(accountActive)}>
        ACCOUNT
      </Link>
    </div>
  )
}
