import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/supabase/admin-page';
import { isUuid } from '@/services/orders';
import { QuoteDetails } from '@/components/wholesale/QuoteDetails';
import { QuoteEditor } from '@/components/admin/WholesaleEditor';
export default async function QuoteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [quote, events] = await Promise.all([
    supabase.from('wholesale_quotes').select('*').eq('id', id).maybeSingle(),
    supabase.from('wholesale_quote_events').select('*').eq('quote_id', id).order('created_at'),
  ]);
  if (quote.error || events.error) return <p role="alert">Não foi possível carregar a cotação.</p>;
  if (!quote.data) notFound();
  return (
    <div className="space-y-7">
      <Link href="/admin/atacado" className="underline text-sm">
        Voltar às cotações
      </Link>
      <QuoteDetails quote={quote.data} events={events.data ?? []} />
      <QuoteEditor key={quote.data.revision} quote={quote.data} />
    </div>
  );
}
