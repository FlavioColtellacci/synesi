"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

const APP_SHELL_KEY = "/__app__"

function shellTransitionKey(pathname: string): string {
  if (pathname.startsWith("/app")) return APP_SHELL_KEY
  const trimmed = pathname.replace(/\/+$/, "") || "/"
  return trimmed
}

type ShellTransitionProps = {
  children: ReactNode
}

export function ShellTransition({ children }: ShellTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const key = shellTransitionKey(pathname)

  if (reduceMotion) {
    return children
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
