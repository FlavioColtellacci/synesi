/**
 * Shared Sigma “thinking / typing” indicator (bouncing dots + optional label).
 * Styles live in globals.css (`.sigma-thinking-dots`, `.sigma-thinking-dot`).
 */
export function SigmaThinkingIndicator({
  label,
  compact,
  className,
  labelClassName,
}: {
  label?: string
  compact?: boolean
  className?: string
  /** Override label color/size (e.g. light text on dark buttons). */
  labelClassName?: string
}) {
  const dotsClass = compact
    ? "sigma-thinking-dots sigma-thinking-dots--compact"
    : "sigma-thinking-dots"

  const labelClasses = ["font-mono text-xs text-[#6B6B7B]", labelClassName].filter(Boolean).join(" ")

  return (
    <span className={["inline-flex items-center gap-2", className].filter(Boolean).join(" ")}>
      {label ? <span className={labelClasses}>{label}</span> : null}
      <span className={dotsClass} aria-hidden="true">
        <span className="sigma-thinking-dot" />
        <span className="sigma-thinking-dot" />
        <span className="sigma-thinking-dot" />
      </span>
    </span>
  )
}
