'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'

type SignOutButtonProps = {
  className?: string
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async (): Promise<void> => {
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
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
