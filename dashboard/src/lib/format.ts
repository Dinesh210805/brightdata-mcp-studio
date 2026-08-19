// Time is shown as distance from now, because the only question a reader has
// is whether this is still running — not what o'clock it was.

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function on_date(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US',
    { month: 'short', day: 'numeric' })
}

export function stamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16)
}
