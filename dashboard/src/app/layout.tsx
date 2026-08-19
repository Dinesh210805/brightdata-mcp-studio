import type { Metadata } from 'next'
import { Instrument_Serif, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// A designed trio rather than one neutral face: the serif carries the
// headlines, the sans carries everything you read, and the mono carries
// machine truth — collector ids, timestamps, field names.
const serif_display = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-serif-display',
  display: 'swap',
})

const sans_ui = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans-ui',
  display: 'swap',
})

const mono_data = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-data',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bright Data MCP Studio — scrapers that repair themselves',
  description:
    'Build a scraper for any public site from your coding agent, catch it '
    + 'when the site changes underneath it, repair it, and verify the repair.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${serif_display.variable} ${sans_ui.variable} ${mono_data.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
