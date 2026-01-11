import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // Define public paths that don't require authentication
  // Note: API routes are excluded by the matcher, but we can double check
  const isLoginPage = pathname === '/login'
  
  // If user is not authenticated and path is not login, redirect to login
  if (!token && !isLoginPage) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // If user is authenticated and tries to access login, redirect to home
  if (token && isLoginPage) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (manifest file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)',
  ],
}
