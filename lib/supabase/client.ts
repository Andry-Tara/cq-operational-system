import {
  createBrowserClient,
} from "@supabase/ssr";

type BrowserClient =
  ReturnType<
    typeof createBrowserClient
  >;

let browserClient:
  BrowserClient |
  null = null;

/*
 * Keep exactly one browser Supabase client.
 *
 * This avoids creating multiple auth listeners /
 * refresh schedulers when several client components
 * ask for Supabase during the same browser session.
 */
export function createClient() {
  if (
    browserClient
  ) {
    return browserClient;
  }

  browserClient =
    createBrowserClient(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL!,
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

  return browserClient;
}
