import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Supabase edge config missing: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set.')
}

// Service-role client: bypasses RLS. Every query built on top of this must
// filter by an explicitly verified user_id — never trust a client-supplied one.
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

/**
 * Verifies the bearer token against Supabase Auth (signature + expiry checked
 * server-side) and returns the authenticated user id, or null if missing/invalid.
 * Unlike a manual JWT payload decode, this cannot be spoofed with a forged token.
 */
export async function getUserIdFromToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
