'use client';
import { useState } from 'react';
import { changeInvoice } from '@/app/admin/olist/actions';

export function OlistInvoiceForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return (
    <form
      className="space-y-4 text-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError('');
        setMessage('');
        try {
          const result = await changeInvoice(form);
          setError(result.error ?? '');
          setMessage(result.message ?? '');
        } catch {
          setError('Falha de comunicação. Consulte a situação antes de continuar.');
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-4">
        <label className="block">
          ID do pedido no site
          <input
            name="orderId"
            required
            className="block border rounded p-2 w-full bg-transparent mt-2"
          />
        </label>
        <label className="block">
          Operação
          <select
            name="operation"
            className="block border rounded p-2 w-full bg-white dark:bg-stone-900 mt-2"
          >
            <option value="refresh">Consultar situação da nota</option>
            <option value="retry">Retomar fila após corrigir pendência na Olist</option>
            <option value="generate">Gerar nota a partir do pedido pago</option>
            <option value="emit">Solicitar autorização da NF em produção</option>
          </select>
        </label>
        <label className="flex gap-2 items-start">
          <input type="checkbox" name="reviewed" className="mt-1" />
          Conferi cliente, itens, valores e configuração fiscal na Olist. Para emitir, confirmei que
          a empresa está no ambiente fiscal de produção.
        </label>
        <button className="border rounded px-4 py-2 disabled:opacity-50" type="submit">
          {pending ? 'Processando…' : 'Executar operação'}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
