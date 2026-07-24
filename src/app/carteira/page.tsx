import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CarteiraApp from '@/components/CarteiraApp';
import GerenteApp from '@/components/GerenteApp';

export default async function CarteiraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle();

  if (profile?.role === 'gerente') {
    return <GerenteApp userEmail={user.email ?? ''} />;
  }

  return <CarteiraApp userEmail={user.email ?? ''} />;
}
