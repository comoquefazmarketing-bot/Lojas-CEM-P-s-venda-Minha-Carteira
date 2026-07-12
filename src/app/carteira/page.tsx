import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CarteiraApp from '@/components/CarteiraApp';

export default async function CarteiraPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <CarteiraApp userEmail={user.email ?? ''} />;
}
