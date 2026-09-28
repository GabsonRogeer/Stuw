'use client';
import { useActionState } from 'react';
import { saveWholesaleSettings, updateQuote } from '@/app/admin/atacado/actions';
import { QUOTE_LABELS, QUOTE_TRANSITIONS } from '@/services/wholesale';
import type { WholesaleQuote, WholesaleSettings } from '@/types/database';
const button =
  'px-5 py-3 rounded-md bg-stuw-obsidian text-white dark:bg-stuw-canvas dark:text-stuw-obsidian text-sm disabled:opacity-50';
export function WholesaleSettingsForm({ settings }: { settings: WholesaleSettings }) {
  const [state, action, pending] = useActionState(saveWholesaleSettings, {});
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={pending} className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          Quantidade mínima total
          <input
            name="minimum"
            className="field mt-2"
            type="number"
            min={1}
            max={100000}
            required
            defaultValue={settings.minimum_quantity}
          />
          <span className="block text-xs text-stuw-slate mt-2">
            Soma de todas as peças da cotação. Não altera cotações já registradas.
          </span>
        </label>
        <label className="text-sm">
          WhatsApp da STUW
          <input
            name="whatsapp"
            className="field mt-2"
            type="tel"
            maxLength={25}
            placeholder="55 + DDD + número"
            defaultValue={settings.whatsapp_number}
          />
          <span className="block text-xs text-stuw-slate mt-2">
            Inclua o código do país. Vazio desabilita o botão de envio.
          </span>
        </label>
      </fieldset>
      <button className={button} disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar configurações'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
export function QuoteEditor({ quote }: { quote: WholesaleQuote }) {
  const [state, action, pending] = useActionState(updateQuote, {});
  const statuses = QUOTE_TRANSITIONS[quote.status] ?? [];
  if (!statuses.length)
    return (
      <p className="text-sm text-stuw-slate">
        Cotação encerrada. A aprovação não gera cobrança ou pedido automaticamente.
      </p>
    );
  return (
    <form
      action={action}
      className="border rounded-lg border-stuw-border dark:border-stuw-borderDark p-5 space-y-4"
    >
      <h3 className="font-serif text-xl">Atualizar negociação</h3>
      <input type="hidden" name="id" value={quote.id} />
      <input type="hidden" name="revision" value={quote.revision} />
      <fieldset disabled={pending} className="space-y-4">
        <label className="block text-sm">
          Novo status
          <select className="field mt-2" name="status" required defaultValue="">
            <option value="" disabled>
              Selecione
            </option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {QUOTE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Mensagem para o cliente (opcional)
          <textarea className="field mt-2 !h-24" name="note" maxLength={500} />
        </label>
        <p className="text-xs text-stuw-slate">
          A mensagem aparece no histórico da conta. Aprovar registra o resultado da negociação; não
          cria cobrança ou pedido.
        </p>
      </fieldset>
      <button className={button} disabled={pending}>
        {pending ? 'Salvando…' : 'Atualizar cotação'}
      </button>
      {state.error && (
        <p role="alert" className="text-sm">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
