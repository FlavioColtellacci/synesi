"use client"

import { motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

function appMainTransitionKey(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/"
}

type AppMainTransitionProps = {
  children: ReactNode
}

export function AppMainTransition({ children }: AppMainTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const key = appMainTransitionKey(pathname)

  if (reduceMotion) {
    return children
  }

  return (
    <motion.div
      key={key}
      data-transition="app-main"
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="min-h-0 w-full"
    >
      {children}
    </motion.div>
  )
}
