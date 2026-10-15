import type { Order } from '@/types/database';
import { isTaxDocumentValid } from '@/services/checkout';

export function toOlistOrder(
  order: Order,
  taxDocument: string,
  skus: { sku: string; remote_id: string; unit: string }[],
) {
  if (order.is_demo || order.payment_test_mode || order.payment_status !== 'approved')
    throw new Error('Pedido não elegível.');
  if (!isTaxDocumentValid(taxDocument)) throw new Error('Documento fiscal ausente ou inválido.');
  const sum = order.items.reduce((total, item) => total + item.qty * item.price_cents, 0);
  if (
    sum !== order.subtotal_cents ||
    sum +
      order.shipping_cents +
      order.gift_cents -
      order.discount_cents -
      order.pix_discount_cents !==
      order.total_cents
  )
    throw new Error('Valores do pedido não conciliados.');
  const money = (cents: number) => (cents / 100).toFixed(2);
  const delivery = order.delivery;
  // Refuse truncation of fiscal addresses and identities.
  for (const [value, max] of [
    [order.customer_name, 30],
    [order.customer_email, 50],
    [delivery.street, 50],
    [delivery.number, 10],
    [delivery.complemento ?? delivery.complement ?? '', 50],
    [delivery.district, 30],
    [delivery.city, 30],
  ] as const)
    if (typeof value !== 'string' || value.length > max)
      throw new Error('Cadastro do cliente excede os limites da API Olist; revisão necessária.');
  return {
    numero_pedido_ecommerce: order.number,
    cliente: {
      nome: order.customer_name,
      tipo_pessoa: taxDocument.length === 11 ? 'F' : 'J',
      cpf_cnpj: taxDocument,
      endereco: delivery.street,
      numero: delivery.number,
      complemento: delivery.complement,
      bairro: delivery.district,
      cep: delivery.postalCode,
      cidade: delivery.city,
      uf: delivery.state,
      fone: delivery.phone,
      email: order.customer_email,
      atualizar_cliente: 'N',
    },
    endereco_entrega: {
      endereco: delivery.street,
      numero: delivery.number,
      complemento: delivery.complement,
      bairro: delivery.district,
      cep: delivery.postalCode,
      cidade: delivery.city,
      uf: delivery.state,
      nome_destinatario: order.customer_name,
    },
    itens: order.items.map((item) => {
      const link = skus.find((link) => link.sku === item.sku);
      if (!link) throw new Error('Um SKU do pedido ainda não foi vinculado à Olist.');
      if (!link.unit || link.unit.length > 3)
        throw new Error('Unidade fiscal do SKU não configurada.');
      return {
        item: {
          id_produto: link.remote_id,
          codigo: item.sku,
          descricao: item.title,
          unidade: link.unit,
          quantidade: item.qty,
          valor_unitario: money(item.price_cents),
        },
      };
    }),
    valor_frete: money(order.shipping_cents),
    outras_despesas: money(order.gift_cents),
    valor_desconto: money(order.discount_cents + order.pix_discount_cents),
    obs_internas:
      'Pagamento aprovado no Mercado Pago. Conferir faturamento e conciliação antes de emitir NF.',
  };
}
