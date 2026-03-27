type TrialEmailPayload = {
  to: string
  fullName?: string | null
  trialEndsAtIso: string
}

function formatDateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getGreetingName(fullName?: string | null) {
  if (!fullName) {
    return 'there'
  }

  const trimmed = fullName.trim()
  if (!trimmed) {
    return 'there'
  }

  return trimmed.split(' ')[0] ?? 'there'
}

export async function sendTrialStartedEmail({
  to,
  fullName,
  trialEndsAtIso,
}: TrialEmailPayload) {
  const resendApiKey = process.env.RESEND_API_KEY
  const from = process.env.TRIAL_EMAIL_FROM

  if (!resendApiKey || !from) {
    console.warn(
      '[TrialEmail] Missing RESEND_API_KEY or TRIAL_EMAIL_FROM. Skipping trial email for',
      to
    )
    return
  }

  const trialEndsAtLabel = formatDateLabel(trialEndsAtIso)
  const greetingName = getGreetingName(fullName)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.synesi.app'

  const subject = 'Your 7-day SYNESI trial is active'
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <p>Hi ${greetingName},</p>
      <p>Your 7-day free trial is now active.</p>
      <p>Your trial ends on <strong>${trialEndsAtLabel}</strong>.</p>
      <p>You can choose a plan anytime from your account or pricing page to keep access uninterrupted.</p>
      <p><a href="${appUrl}/pricing">Choose a plan</a></p>
      <p>- SYNESI</p>
    </div>
  `
  const text = [
    `Hi ${greetingName},`,
    '',
    'Your 7-day free trial is now active.',
    `Your trial ends on ${trialEndsAtLabel}.`,
    'Choose a plan anytime to keep access uninterrupted.',
    `${appUrl}/pricing`,
    '',
    '- SYNESI',
  ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(
      `[TrialEmail] Failed to send trial email (${response.status}): ${responseText}`
    )
  }
}
