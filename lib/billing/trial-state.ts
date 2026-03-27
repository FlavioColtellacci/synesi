const DAY_IN_MS = 24 * 60 * 60 * 1000

export type TrialStatus = 'active' | 'expiresSoon' | 'expired' | 'none'

type TrialStateOptions = {
  now?: Date
  expiresSoonThresholdDays?: number
}

export type TrialState = {
  status: TrialStatus
  daysRemaining: number | null
  endsAtLabel: string
}

function parseTrialDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function formatTrialDate(value: string | null | undefined) {
  const trialEndDate = parseTrialDate(value)
  if (!trialEndDate) {
    return 'N/A'
  }

  return trialEndDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function getTrialState(
  trialEndsAt: string | null | undefined,
  options: TrialStateOptions = {}
): TrialState {
  const trialEndDate = parseTrialDate(trialEndsAt)
  if (!trialEndDate) {
    return {
      status: 'none',
      daysRemaining: null,
      endsAtLabel: 'N/A',
    }
  }

  const now = options.now ?? new Date()
  const expiresSoonThresholdDays = options.expiresSoonThresholdDays ?? 2
  const timeDifference = trialEndDate.getTime() - now.getTime()

  if (timeDifference <= 0) {
    return {
      status: 'expired',
      daysRemaining: 0,
      endsAtLabel: formatTrialDate(trialEndsAt),
    }
  }

  const daysRemaining = Math.ceil(timeDifference / DAY_IN_MS)
  const status = daysRemaining <= expiresSoonThresholdDays ? 'expiresSoon' : 'active'

  return {
    status,
    daysRemaining,
    endsAtLabel: formatTrialDate(trialEndsAt),
  }
}
