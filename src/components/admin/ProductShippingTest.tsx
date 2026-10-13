'use client';
import { useState, useTransition } from 'react';
import { testProductShipping } from '@/app/admin/produtos/shipping';
import { currency } from '@/lib/commerce';
import type { ProductDraft } from '@/services/product-admin';

export function ProductShippingTest({ product }: { product: ProductDraft }) {
  const [postalCode, setPostalCode] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    context: string;
    data: Awaited<ReturnType<typeof testProductShipping>>;
  } | null>(null);
  const input = {
    postalCode,
    weight: product.weight,
    length: product.length,
    width: product.width,
    height: product.height,
    price: product.price ?? 100,
    isTestPackage: product.shippingPackageIsTest === true,
  };
  const context = JSON.stringify(input);
  const visible = result?.context === context ? result.data : null;
  return (
    <div className="mt-5 border-t pt-5 space-y-3">
      <h3 className="text-sm font-medium">Testar cotação no Melhor Envio</h3>
      <p className="text-xs text-stuw-slate">
        Consulta uma unidade com as medidas acima, sem criar pedido ou comprar etiqueta. Não é
        necessário salvar o produto para testar.
        {product.price === null &&
          ' Produto sem preço: a simulação usa valor declarado de R$ 100,00.'}
      </p>
      <label className="block text-sm">
        CEP de destino
        <input
          className="field mt-2 max-w-xs"
          value={postalCode}
          maxLength={9}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => setPostalCode(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={pending}
        className="text-sm border rounded px-4 py-2 disabled:opacity-50"
        onClick={() =>
          start(async () => {
            try {
              setResult({ context, data: await testProductShipping(input) });
            } catch {
              setResult({
                context,
                data: { error: 'Não foi possível consultar agora. Tente novamente.' },
              });
            }
          })
        }
      >
        {pending ? 'Consultando…' : 'Testar frete'}
      </button>
      {visible?.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {visible.error}
        </p>
      )}
      {visible?.options && (
        <div role="status" className="text-sm space-y-2">
          <p>Credenciais aceitas pelo Melhor Envio · {visible.sandbox ? 'Sandbox' : 'Produção'}</p>
          <ul>
            {visible.options.map((o) => (
              <li key={o.id}>
                {o.name}: {currency(o.price)} · {o.deliveryEstimate}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
