import Link from 'next/link'

// The public marketing chrome — the landing page, /login, /submission, and
// /tools when nobody is signed in. The signed-in app uses its own bar
// (components/app/bar.tsx) instead: two identities, on purpose, so a viewer
// always knows which world they are in.
export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-gutter bg-paper/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5 text-lead font-semibold tracking-tight">
          <span className="h-4 w-4 rounded-[5px] bg-web" />
          <span>Bright Data MCP Studio</span>
        </Link>

        <nav className="flex items-center gap-1 text-read">
          <Link
            href="/tools"
            className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            Tools
          </Link>
          <Link
            href="/submission"
            className="rounded-full px-3.5 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            Submission
          </Link>
          <Link
            href="/login"
            className="ml-1 rounded-full bg-ink px-4 py-1.5 font-medium text-paper transition-opacity hover:opacity-85"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  )
}
