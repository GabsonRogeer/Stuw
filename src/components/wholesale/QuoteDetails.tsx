import type { WholesaleQuote, QuoteEvent } from '@/types/database';
import { QUOTE_LABELS, quoteWhatsAppUrl } from '@/services/wholesale';
import { currency } from '@/lib/commerce';
export function QuoteDetails({
  quote,
  events,
  whatsappNumber,
}: {
  quote: WholesaleQuote;
  events: QuoteEvent[];
  whatsappNumber?: string;
}) {
  const url = quoteWhatsAppUrl(whatsappNumber ?? '', quote);
  return (
    <div className="space-y-7">
      <header>
        <h2 className="font-serif text-2xl break-all">Cotação {quote.number}</h2>
        <p className="text-sm mt-3">
          {QUOTE_LABELS[quote.status]} ·{' '}
          {new Date(quote.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
        <p className="text-sm text-stuw-slate mt-3">
          Valores e disponibilidade a negociar. Esta cotação não é um pedido de compra e não reserva
          estoque.
        </p>
      </header>
      {whatsappNumber !== undefined && (
        <section className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5">
          {url ? (
            <>
              <a
                className="inline-block rounded-md bg-stuw-sage text-white px-5 py-3 text-sm"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                Enviar cotação pelo WhatsApp
              </a>
              <p className="text-xs text-stuw-slate mt-3">
                Sua cotação já está salva. O WhatsApp abrirá com a mensagem pronta; confirme o envio
                por lá.
              </p>
            </>
          ) : (
            <p className="text-sm">
              Sua cotação está salva. O WhatsApp está temporariamente indisponível; acompanhe as
              atualizações nesta página.
            </p>
          )}
        </section>
      )}
      <section>
        <h3 className="font-serif text-xl mb-4">Peças solicitadas · {quote.quantity} unidades</h3>
        <ul className="divide-y divide-stuw-border dark:divide-stuw-borderDark">
          {quote.items.map((i, index) => (
            <li className="py-4 text-sm" key={index}>
              <p>{i.title}</p>
              <p className="text-xs text-stuw-slate mt-1">
                {i.color} · {i.size} · {i.qty} unidade(s)
              </p>
              {i.wholesale_price_cents != null && (
                <p className="text-xs mt-2">
                  Referência de atacado: {currency(i.wholesale_price_cents / 100)} por unidade,
                  sujeita à negociação.
                </p>
              )}
              {i.wholesale_pack && (
                <p className="text-xs mt-1">Grade / cartela: {i.wholesale_pack}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="text-sm space-y-2">
        <h3 className="font-serif text-xl mb-3">Contato</h3>
        <p>{quote.customer_name}</p>
        <p className="break-all">{quote.customer_email}</p>
        <p>{quote.phone}</p>
        {quote.company && <p>Empresa: {quote.company}</p>}
        {quote.cnpj && <p>CNPJ: {quote.cnpj}</p>}
        {quote.notes && (
          <p className="whitespace-pre-wrap break-words">Observações: {quote.notes}</p>
        )}
      </section>
      <section>
        <h3 className="font-serif text-xl mb-4">Histórico</h3>
        <ol className="space-y-4 border-l border-stuw-border dark:border-stuw-borderDark pl-4">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p>
                {QUOTE_LABELS[event.status]} · {event.note}
              </p>
              <time className="text-xs text-stuw-slate">
                {new Date(event.created_at).toLocaleString('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
