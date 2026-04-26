/**
 * Middleware for protecting routes and managing authentication
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/draft'];

export async function middleware(request: NextRequest) {
  // Check if the current path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  try {
    // Create a Supabase server client
    const response = NextResponse.next();
    const supabase = await createServerSupabaseClient();

    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If user is not authenticated, redirect to home
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, redirect to home for safety
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
