'use client'

import { usePathname } from 'next/navigation'
import ChatWidget from '@/components/chat/ChatWidget'

/** Hides the global FAB on Sigma full-page routes (workspace mounts its own chat). */
export default function AppChatWidgetGate() {
  const pathname = usePathname()
  if (pathname?.startsWith('/app/sigma')) return null
  return <ChatWidget />
}
