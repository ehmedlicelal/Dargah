import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Browser-side client (used in Client Components)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// TODO: replace anon key with user session token for full RLS enforcement on sensitive operations
