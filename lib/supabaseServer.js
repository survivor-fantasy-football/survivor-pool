import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used in Server Components, Route Handlers, and Server Actions.
// Reads/writes the session via cookies so login persists across requests.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
            // Called from a Server Component that can't set cookies directly —
            // safe to ignore as long as middleware refreshes the session.
          }
        },
      },
    }
  );
}

// A separate client for admin-only server tasks (cron jobs, elevated writes).
// Uses the service_role key, which bypasses row-level security — only ever
// import this in server-only files, never in anything shipped to the browser.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
