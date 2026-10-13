'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { syncOrderIntegration } from '@/app/admin/pedidos/integrations';
import type { Order } from '@/types/database';
export function OrderIntegrationEditor({ order }: { order: Order }) {
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section className="border border-stuw-border dark:border-stuw-borderDark rounded-lg p-5 space-y-4">
      <h3 className="font-serif text-xl">Pagamento e envio</h3>
      <p className="text-sm text-stuw-slate">
        O pagamento é confirmado pelo Mercado Pago. Prepare e gere a etiqueta na sua conta do Melhor
        Envio, depois informe o ID abaixo para vincular o rastreamento ao pedido.
      </p>
      <a
        href="https://melhorenvio.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-sm underline"
      >
        Abrir Melhor Envio
      </a>
      <label className="block text-sm">
        ID da etiqueta do Melhor Envio
        <input
          className="field mt-2"
          value={label}
          maxLength={36}
          disabled={pending || order.payment_status !== 'approved'}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          onChange={(e) => setLabel(e.target.value.trim())}
        />
      </label>
      <p className="text-xs text-stuw-slate">
        Deixe em branco para atualizar a etiqueta já vinculada. Confira o destinatário antes de
        vincular; uma etiqueta não pode pertencer a dois pedidos.
      </p>
      <button
        disabled={pending}
        className="border rounded px-4 py-3 text-sm disabled:opacity-50"
        onClick={() => {
          setError('');
          setMessage('');
          start(async () => {
            const result = await syncOrderIntegration(order.id, label || undefined);
            setError(result.error ?? '');
            setMessage(result.message ?? '');
            router.refresh();
          });
        }}
      >
        {pending ? 'Atualizando…' : 'Sincronizar pagamento e entrega'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
