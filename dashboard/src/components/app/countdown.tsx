'use client'

import { useEffect, useState } from 'react'

// A live countdown to the next cron run.
//
// Client-side because a server-rendered "in 2h 14m" is wrong the second after
// it renders, and this is the one number on the page whose whole job is to
// prove something is still scheduled. The target is passed in as an epoch so
// the server and the browser cannot disagree about which run is next.

function remaining(target: number): string {
  const ms = target - Date.now()
  if (ms <= 0)
    return 'due now'

  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`
}

export function Countdown({ target }: { target: number }) {
  // Rendered empty on the server and filled on mount, so the markup the server
  // sends can never disagree with the browser's clock and trip hydration.
  const [label, set_label] = useState<string | null>(null)

  useEffect(() => {
    set_label(remaining(target))
    const id = setInterval(() => set_label(remaining(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  return (
    <span className="tabular" suppressHydrationWarning>
      {label ?? '—'}
    </span>
  )
}
