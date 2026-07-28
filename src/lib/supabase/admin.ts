import { createClient as createAdminClient } from '@supabase/supabase-js';

/** Cliente com service role — bypassa RLS. Só usar em rotas de servidor que já
 * verificaram autorização (gerente, rate limit, etc.) antes de chamar isso. */
export function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
