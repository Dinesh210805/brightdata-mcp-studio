'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancel_device_flow,
  poll_device_flow,
  start_device_flow,
  type FlowState,
} from '@/lib/brightdata-auth'

// "Sign in with Bright Data" panel. Starts Bright Data's device flow, shows the
// one-time code the user has to approve, and polls until the key is handed
// back. Survives a page refresh: on mount it checks whether a flow is already
// in flight and resumes polling it.
export function DeviceFlowPanel({ has_key }: { has_key: boolean }) {
  const [state, set_state] = useState<FlowState | null>(null)
  const [busy, set_busy] = useState(false)
  const active = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear_timer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const poll = useCallback(async () => {
    if (!active.current)
      return
    const res = await poll_device_flow()
    if (!active.current)
      return
    set_state(res)
    if (res.status === 'pending')
      timer.current = setTimeout(poll, res.interval * 1000)
  }, [])

  useEffect(() => {
    active.current = true
    poll()
    return () => {
      active.current = false
      clear_timer()
    }
  }, [poll, clear_timer])

  async function begin() {
    set_busy(true)
    clear_timer()
    const res = await start_device_flow()
    set_busy(false)
    set_state(res)
    if (res.status === 'pending')
      timer.current = setTimeout(poll, res.interval * 1000)
  }

  async function cancel() {
    clear_timer()
    set_state(null)
    await cancel_device_flow()
  }

  const pending = state?.status === 'pending'

  return (
    <div className="mt-3">
      {!pending && state?.status !== 'done' && (
        <button
          type="button"
          onClick={begin}
          disabled={busy}
          className="rounded-full border border-line px-4 py-2 text-[13.5px] font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
        >
          {busy ? 'Starting…' : has_key ? 'Sign in to replace your key' : 'Sign in with Bright Data'}
        </button>
      )}

      {pending && (
        <div className="rounded-xl border border-line bg-raised p-5">
          <p className="text-[14px] leading-relaxed text-muted">
            Open the link below in a new tab, sign in, and approve the code.
          </p>

          <div className="mt-3 flex items-center gap-3">
            <span className="font-mono text-[13px] tracking-wider text-ink">
              {state.user_code}
            </span>
            <span className="h-px flex-1 bg-line" />
            <a
              href={state.verification_uri}
              target="_blank"
              rel="noreferrer"
              className="text-[13.5px] text-blue underline"
            >
              Open Bright Data
            </a>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="breathe inline-block h-1.5 w-1.5 rounded-full bg-blue" />
            <span className="text-[13px] text-muted">Waiting for you to approve…</span>
            <button
              type="button"
              onClick={cancel}
              className="ml-auto text-[13px] text-faint underline hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state?.status === 'done' && (
        <p className="text-[13.5px] text-good">
          Connected. Your key is saved — the config below is ready to paste.
        </p>
      )}

      {(state?.status === 'failed' || state?.status === 'expired') && (
        <p className="text-[13.5px] text-ember">{state.message}</p>
      )}
    </div>
  )
}