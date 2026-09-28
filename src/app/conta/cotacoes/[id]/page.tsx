import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAccount } from '@/lib/supabase/account';
import { getWholesaleSettings } from '@/lib/supabase/wholesale';
import { isUuid } from '@/services/orders';
import { QuoteDetails } from '@/components/wholesale/QuoteDetails';
export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAccount();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { data: quote, error } = await supabase
    .from('wholesale_quotes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return <p role="alert">Não foi possível carregar a cotação.</p>;
  if (!quote) notFound();
  const [events, settings] = await Promise.all([
    supabase.from('wholesale_quote_events').select('*').eq('quote_id', id).order('created_at'),
    getWholesaleSettings(),
  ]);
  return (
    <div className="space-y-6">
      <Link className="underline text-sm" href="/conta/cotacoes">
        Voltar às cotações
      </Link>
      <QuoteDetails
        quote={quote}
        events={events.data ?? []}
        whatsappNumber={settings?.whatsapp_number ?? ''}
      />
      {events.error && <p role="alert">Histórico temporariamente indisponível.</p>}
    </div>
  );
}
