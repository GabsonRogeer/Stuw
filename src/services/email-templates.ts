import type { Order } from '@/types/database';

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

export function emailLayout({
  title,
  preview,
  content,
  action,
  url,
  footer,
}: {
  title: string;
  preview: string;
  content: string;
  action: string;
  url: string;
  footer: string;
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)} | STUW</title></head>
<body style="margin:0;padding:0;background-color:#FBF9F5;color:#131413;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FBF9F5;"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td align="center" style="padding:16px 0 32px;font-size:36px;letter-spacing:10px;font-weight:400;">STUW</td></tr>
<tr><td style="background-color:#FFFFFF;border:1px solid #E5E0D7;padding:32px 24px;">
<p style="margin:0 0 20px;font-size:11px;letter-spacing:2px;color:#586255;text-transform:uppercase;">Sua conta STUW</p>
<h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.2;font-weight:400;">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.7;">${content}</div>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px;"><tr><td bgcolor="#131413" style="border-radius:4px;text-align:center;mso-padding-alt:16px 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;">${escapeHtml(action)}</a></td></tr></table>
<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#586255;">${escapeHtml(footer)}</p>
<p style="margin:20px 0 0;font-size:12px;line-height:1.6;">Se o botão não abrir, <a href="${escapeHtml(url)}" style="color:#586255;text-decoration:underline;">acesse por este link</a>.</p>
</td></tr>
<tr><td align="center" style="padding:28px 16px;font-size:12px;line-height:1.8;color:#586255;">STUW<br>Precisa de ajuda? <a href="mailto:contato@stuw.com.br" style="color:#586255;text-decoration:underline;">contato@stuw.com.br</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

export function authEmail(kind: 'confirmation' | 'recovery') {
  const recovery = kind === 'recovery';
  return {
    subject: recovery ? 'Redefina sua senha | STUW' : 'Confirme seu e-mail | STUW',
    html: emailLayout({
      title: recovery ? 'Uma nova senha para você.' : 'Confirme seu e-mail.',
      preview: recovery
        ? 'Acesse o link para redefinir sua senha STUW.'
        : 'Falta um passo para acessar sua conta STUW.',
      content: recovery
        ? '<p style="margin:0 0 16px;">Recebemos uma solicitação para redefinir a senha da sua conta STUW.</p><p style="margin:0;">Use o botão abaixo para continuar e escolher uma nova senha.</p>'
        : '<p style="margin:0 0 16px;">Confirme seu endereço de e-mail para concluir o cadastro e acessar sua conta.</p><p style="margin:0;">Depois da confirmação, você poderá acompanhar seus pedidos e gerenciar seus dados.</p>',
      action: recovery ? 'Redefinir minha senha' : 'Confirmar meu e-mail',
      url: `{{ .SiteURL }}/auth/verificar?token_hash={{ .TokenHash }}&type=${recovery ? 'recovery' : 'email'}`,
      footer: recovery
        ? 'Se você não solicitou esta alteração, ignore este e-mail. Sua senha continuará a mesma. Este link é pessoal e só pode ser usado uma vez.'
        : 'Se você não criou uma conta STUW, ignore este e-mail. Este link é pessoal e só pode ser usado uma vez.',
    }),
  };
}

export function purchaseEmail(order: Order, siteUrl: string) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:' && !(site.protocol === 'http:' && site.hostname === 'localhost'))
    throw new Error('Invalid site URL');
  const money = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const url = new URL(`/conta/compras/${encodeURIComponent(order.id)}`, site).href;
  const totals = [
    ['Produtos', order.subtotal_cents],
    ['Frete', order.shipping_cents],
    ['Embalagem para presente', order.gift_cents],
    ['Descontos', -(order.discount_cents + order.pix_discount_cents)],
    ['Total pago', order.total_cents],
  ] as const;
  const rows = order.items
    .map(
      (item) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #E5E0D7;font-size:14px;">${escapeHtml(item.title)}<br><span style="color:#586255;font-size:12px;">${escapeHtml(item.color)} · ${escapeHtml(item.size)} · ${item.qty} un.</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #E5E0D7;font-size:14px;">${money(item.price_cents * item.qty)}</td></tr>`,
    )
    .join('');
  return {
    subject: `Pagamento confirmado · Pedido ${order.number} | STUW`,
    text: `Olá, ${order.customer_name}.\n\nO pagamento do pedido ${order.number} foi confirmado.\n\n${order.items.map((item) => `${item.qty} × ${item.title} (${item.color}, ${item.size}): ${money(item.price_cents * item.qty)}`).join('\n')}\n\n${totals.map(([label, cents]) => `${label}: ${money(cents)}`).join('\n')}\n\nAcompanhe seu pedido: ${url}\n\nEsta confirmação não é uma nota fiscal nem um aviso de postagem.\nSTUW · contato@stuw.com.br`,
    html: emailLayout({
      title: 'Pagamento confirmado.',
      preview: `Pedido ${order.number}: recebemos seu pagamento.`,
      action: 'Acompanhar meu pedido',
      url,
      content: `<p style="margin:0 0 16px;">Olá, ${escapeHtml(order.customer_name)}.</p><p style="margin:0 0 20px;">Recebemos o pagamento do seu pedido <strong>${escapeHtml(order.number)}</strong>. Os detalhes da sua compra estão abaixo.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}${totals.map(([label, cents]) => `<tr><td style="padding:8px 0;font-size:14px;${label === 'Total pago' ? 'font-weight:bold;' : ''}">${label}</td><td align="right" style="padding:8px 0;font-size:14px;${label === 'Total pago' ? 'font-weight:bold;' : ''}">${money(cents)}</td></tr>`).join('')}</table>`,
      footer:
        'Esta confirmação não substitui a nota fiscal e não indica que o pedido já foi postado. Você pode acompanhar as atualizações na sua conta.',
    }),
  };
}

export function invoiceEmail(
  order: Order,
  invoice: { number: string; series: string; total_cents: number },
  siteUrl: string,
) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:' || site.username || site.password)
    throw new Error('Invalid site URL');
  const url = new URL(`/conta/compras/${encodeURIComponent(order.id)}`, site).href;
  const total = (invoice.total_cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  return {
    subject: `Sua nota fiscal chegou · Pedido ${order.number} | STUW`,
    text: `Olá, ${order.customer_name}.\n\nA nota fiscal do pedido ${order.number} foi emitida e autorizada.\nNF-e nº ${invoice.number} · Série ${invoice.series}\nValor: ${total}\n\nO DANFE em PDF e o XML autorizado estão anexados a este e-mail. Você também pode consultá-los nos detalhes do pedido:\n${url}\n\nObrigada por escolher a STUW.\nSTUW · contato@stuw.com.br`,
    html: emailLayout({
      title: 'Sua nota fiscal chegou.',
      preview: `A nota fiscal do pedido ${order.number} já está disponível.`,
      action: 'Consultar meu pedido',
      url,
      content: `<p style="margin:0 0 16px;">Olá, ${escapeHtml(order.customer_name)}.</p><p style="margin:0 0 24px;">A nota fiscal do seu pedido <strong>${escapeHtml(order.number)}</strong> foi emitida e autorizada.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FBF9F5;"><tr><td style="padding:20px;font-size:14px;line-height:1.8;">NF-e <strong>nº ${escapeHtml(invoice.number)}</strong> · Série ${escapeHtml(invoice.series)}<br>Valor da nota: <strong>${total}</strong></td></tr></table><p style="margin:24px 0 16px;">O DANFE em PDF e o XML autorizado estão anexados a este e-mail. Eles também ficam disponíveis nos detalhes do pedido, na sua conta.</p><p style="margin:0;">Obrigada por escolher a STUW.</p>`,
      footer:
        'Guarde os arquivos anexos para consultar quando precisar. Este e-mail informa a emissão da nota fiscal; o acompanhamento da entrega está disponível na sua conta.',
    }),
  };
}
