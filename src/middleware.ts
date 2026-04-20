import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 简单的session检查 - 检查next-auth的session cookie
function hasSessionCookie(request: NextRequest): boolean {
  const sessionToken =
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value
  return !!sessionToken
}

export async function middleware(request: NextRequest) {
  const isLoggedIn = hasSessionCookie(request)
  const { pathname } = request.nextUrl

  // 已登录用户访问登录/注册页面，重定向到首页
  if (isLoggedIn && (pathname.startsWith('/login') || pathname.startsWith('/register'))) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 未登录用户访问受保护页面，重定向到登录页
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/register')

  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
