import { NextResponse, type NextRequest } from 'next/server'
import { create_client } from '@/lib/supabase/server'

// Google sends the user back here with a one-time code. Exchanging it sets
// the session cookies, after which the dashboard can identify them.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (!code)
    return NextResponse.redirect(`${origin}/login?error=missing_code`)

  const supabase = await create_client()
  if (!supabase)
    return NextResponse.redirect(`${origin}/login?error=not_configured`)

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error)
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)

  return NextResponse.redirect(`${origin}${next}`)
}
