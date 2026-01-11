import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // Skip internal Next.js paths, API routes, and static files
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/static') ||
      pathname.includes('.') // Simple check for file extensions (images, etc)
    ) {
      return NextResponse.next()
    }

    const token = request.cookies.get('token')?.value
    const isLoginPage = pathname === '/login'

    // If user is not authenticated and path is not login, redirect to login
    if (!token && !isLoginPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // If user is authenticated and tries to access login, redirect to home
    if (token && isLoginPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware execution error:', error)
    return NextResponse.next()
  }
}
