import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* The one connection to Supabase (logins now, data later).

   It is made from two environment variables, which Vite copies into the
   site's files when it builds them (npm run dev / npm run build):
   - VITE_SUPABASE_URL: the project URL, https://<project>.supabase.co
   - VITE_SUPABASE_PUBLISHABLE_KEY: the publishable key (sb_publishable_...)
     or the older anon key. Both are public by design; the database's Row
     Level Security decides what each person may read or change.

   Never put the secret (service-role) key here or in any VITE_ variable:
   everything named VITE_... ends up readable in the browser.

   On Cloudflare Pages they're set in the project's settings (Production and
   Preview). On a PC they go in a .env.local file (see .env.example), which
   git never commits.

   When they're missing, `supabase` is null: the public pages still work and
   the login screens say the configuration is missing. */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null
