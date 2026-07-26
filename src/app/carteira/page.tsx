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

  const { data: profile } = await supabase.from('profiles').select('role, nome').eq('user_id', user.id).maybeSingle();
  const userNome = profile?.nome || user.email || '';

  if (profile?.role === 'gerente') {
    return <GerenteApp userEmail={user.email ?? ''} userNome={userNome} />;
  }

  return <CarteiraApp userEmail={user.email ?? ''} userNome={userNome} />;
}
