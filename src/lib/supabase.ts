/**
 * Browser-side Supabase client
 * Use this client in React components and client-side logic
 */

import { createBrowserClient } from '@supabase/ssr';

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Creates or returns a singleton Supabase browser client instance
 * @returns Supabase browser client
 */
export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Check .env.local file.'
    );
  }

  supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

/**
 * Get the current Supabase client instance
 * Must call createClient() first
 */
export function getClient() {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call createClient() first.');
  }
  return supabaseClient;
}
