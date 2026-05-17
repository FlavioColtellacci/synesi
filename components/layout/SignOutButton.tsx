'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { isFirebaseBackend } from '@/lib/data/backend'
import { getFirebaseClientAuth } from '@/lib/firebase/client'
import { createClient } from '@/lib/supabase/client'

type SignOutButtonProps = {
  className?: string
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async (): Promise<void> => {
    if (isFirebaseBackend()) {
      await signOut(getFirebaseClientAuth())
      await fetch('/api/auth/signout', { method: 'POST' })
    } else {
      const supabase = createClient()
      await supabase.auth.signOut()
    }
    router.push('/login')
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleSignOut()
      }}
      className={`cursor-pointer border-none bg-transparent p-0 font-mono text-xs uppercase tracking-widest text-[#6B6B7B] transition-colors duration-150 hover:text-[#F0F0F0] ${className ?? ''}`}
    >
      SIGN OUT
    </button>
  )
}
