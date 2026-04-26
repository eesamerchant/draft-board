/**
 * Server-side Supabase client
 * Use this in Server Components and API routes
 */

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase server client with cookie-based session management
 * @returns Supabase server client
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Check .env.local file.'
    );
  }

  return createSSRClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // This error can happen with certain middleware
        }
      },
    },
  });
}
