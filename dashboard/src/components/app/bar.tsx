import Link from 'next/link'

// The app bar.
//
// A top bar rather than a sidebar, deliberately: sidebar + cards + charts is
// the shape every admin template ships with, and it is the fastest way to make
// a product look like something you have already seen.
//
// The rule underneath is a web strand. It goes out of register when a scraper
// is broken, so the page carries its own status in a element that was going to
// be there anyway and costs no space at all.

interface BarProps {
  alert?: boolean
  email?: string | null
  readonly_notice?: string
}

const LINKS = [
  { href: '/app', label: 'Overview' },
  { href: '/app/repairs', label: 'Repairs' },
  { href: '/app/settings', label: 'Settings' },
]

export function Bar({ alert = false, email, readonly_notice }: BarProps) {
  return (
    <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-page items-center justify-between gap-6 px-6">
        <Link
          href={readonly_notice ? '/' : '/app'}
          className="flex items-center gap-2.5"
        >
          {/* The mark: a small web, drawn rather than imported. */}
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
            <g stroke="currentColor" strokeWidth="1" fill="none">
              <path d="M8 1 8 15 M1 8 15 8 M3 3 13 13 M13 3 3 13" />
              <path d="M8 4.2 11.8 8 8 11.8 4.2 8Z" />
            </g>
          </svg>
          <span className="font-display text-read font-[800] tracking-[-0.02em]">
            Studio
          </span>
        </Link>

        {readonly_notice ? (
          <span className="font-mono text-micro text-faint">
            {readonly_notice}
          </span>
        ) : (
          <nav className="flex items-center gap-1 text-body">
            {LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-sm px-3 py-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            {email && (
              <span className="ml-2 hidden font-mono text-micro text-faint sm:inline">
                {email}
              </span>
            )}
          </nav>
        )}
      </div>

      <div className={alert ? 'web-strand-alert' : 'web-strand'} />
    </header>
  )
}
