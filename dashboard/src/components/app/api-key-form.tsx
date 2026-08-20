'use client'

import { useActionState } from 'react'
import { save_api_key } from '@/lib/profile'

export function ApiKeyForm({ has_key }: { has_key: boolean }) {
  const [state, action, pending] = useActionState(save_api_key, null)

  return (
    <form action={action} className="mt-5">
      <label
        htmlFor="api_key"
        className="block text-body font-medium text-muted"
      >
        {has_key ? 'Replace your Bright Data API key' : 'Bright Data API key'}
      </label>

      <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
        <input
          id="api_key"
          name="api_key"
          type="password"
          autoComplete="off"
          placeholder={has_key ? '••••••••••••••••' : 'Paste your key'}
          className="min-w-0 flex-1 rounded-full border border-gutter bg-surface px-4 py-2.5 font-mono text-body outline-none transition-colors focus:border-web"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-ink px-5 py-2.5 text-read font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {pending ? 'Saving…' : has_key ? 'Replace' : 'Save key'}
        </button>
      </div>

      {state?.error && (
        <p className="mt-2.5 text-body text-venom">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-2.5 text-body text-verified">
          Saved. Your config below is ready to paste.
        </p>
      )}

      <p className="mt-3 text-body leading-relaxed text-faint">
        Get one at Bright Data → Account settings → Add API key. It is stored
        against your account with row-level security and is sent only to Bright
        Data.
      </p>
    </form>
  )
}
