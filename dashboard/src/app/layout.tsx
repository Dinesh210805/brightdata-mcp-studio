import type { Metadata } from 'next'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Two families, not three. Archivo is variable across weight, so the whole
// page is one voice with an enormous range inside it — 900 at -0.04em for a
// verdict that has to be read from across a room, 400 for the paragraph under
// it. A superfamily used this way reads as designed; three unrelated faces
// read as chosen from a list.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

// Machine truth stays monospaced: collector ids, timestamps, field names, row
// counts. If a value came from a machine it is set in this.
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
        className={`${archivo.variable} ${mono_data.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
