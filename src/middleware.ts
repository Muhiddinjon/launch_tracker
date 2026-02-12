import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret) {
    return redirectToLogin(request, pathname);
  }

  // Verify token: "username:timestamp:signature"
  const parts = token.split(':');
  if (parts.length !== 3) {
    return redirectToLogin(request, pathname);
  }

  const [username, timestamp, signature] = parts;
  const payload = `${username}:${timestamp}`;
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

  if (signature !== expectedSignature) {
    return redirectToLogin(request, pathname);
  }

  // Check expiry (1 hour)
  const tokenAge = Date.now() - parseInt(timestamp);
  if (tokenAge > 60 * 60 * 1000) {
    return redirectToLogin(request, pathname);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, pathname: string) {
  // API routes get 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pages redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
