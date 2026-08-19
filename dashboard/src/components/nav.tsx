import Link from 'next/link'

export function Nav({ variant = 'public' }: { variant?: 'public' | 'app' }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-paper/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-[5px] bg-blue" />
          <span>Bright Data MCP Studio</span>
        </Link>

        <nav className="flex items-center gap-1 text-[14px]">
          {variant === 'public' ? (
            <>
              <Link
                href="/submission"
                className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                Submission
              </Link>
              <Link
                href="/login"
                className="ml-1 rounded-full bg-ink px-4 py-1.5 font-medium text-white transition-opacity hover:opacity-85"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                Scrapers
              </Link>
              <Link
                href="/dashboard/connect"
                className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                Connect
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
