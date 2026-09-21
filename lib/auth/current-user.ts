import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

async function getCurrentUserUncached() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Request-scoped authenticated user.
 *
 * Protected layout, active outlet and nested pages all need
 * the same authenticated user. Keep auth.getUser() to one
 * network call for the current server render.
 */
export const getCurrentUser = cache(getCurrentUserUncached);
