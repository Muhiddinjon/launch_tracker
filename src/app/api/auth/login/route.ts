import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;
    const secret = process.env.AUTH_SECRET;

    if (!validUsername || !validPassword || !secret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (username !== validUsername || password !== validPassword) {
      return NextResponse.json({ error: 'Login yoki parol noto\'g\'ri' }, { status: 401 });
    }

    // Create signed token
    const payload = `${username}:${Date.now()}`;
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${payload}:${signature}`;

    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
  }
}
