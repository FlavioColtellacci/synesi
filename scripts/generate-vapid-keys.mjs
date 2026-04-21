#!/usr/bin/env node
/**
 * Prints VAPID key pairs for Web Push. Add to .env.local and Vercel:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 * Optional:
 *   VAPID_SUBJECT=mailto:support@synesi.app
 */
import webpush from "web-push"

const keys = webpush.generateVAPIDKeys()
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey)
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey)
