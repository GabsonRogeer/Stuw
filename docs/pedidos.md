# Pedidos

## Ativar

Execute `supabase/migrations/20260928154600_orders_management.sql` no SQL Editor, depois das migrações anteriores. Ela já inclui os preços e variantes atuais do catálogo. Execute `supabase/tests/orders.sql` para verificar permissões, cálculos e transições; os dados desse teste são descartados por rollback.

## Fluxo

- Checkout exige login; após autenticar, retorna para informações. A sacola é mantida no navegador.
- Finalizar registra um pedido **de teste**, vinculado ao `auth.uid()`, em uma transação. O carrinho só é limpo após confirmação do registro. Repetir a tentativa com a mesma chave retorna o mesmo pedido.
- `/conta/compras` lista compras e abre os detalhes. RLS isola pedidos e histórico entre usuários.
- `/admin/pedidos` tem busca, filtros por status/tipo e paginação. Detalhes incluem itens, cliente, endereço, descontos, frete, rastreio e histórico.
- Administradores podem simular pagamento, enviar e concluir pedidos de teste. Pedidos reais exigirão confirmação por provedor de pagamento. Enviar requer transportadora e rastreio. Pedidos entregues/cancelados ficam encerrados. Revisão impede sobrescrever alterações concorrentes.

## Valores e cupons

O banco calcula valores em centavos, com preços/variantes da tabela privada `checkout_products`. Desconto do cupom aplica-se a produtos + frete + embalagem; PIX dá 5% sobre produtos após desconto proporcional do cupom. O total deve coincidir com o revisado no checkout; divergência desfaz toda a transação.

Cupons são consumidos ao registrar o pedido, inclusive os pedidos de teste. Cancelamento não restitui utilizações; use cupons específicos para testes. Retentativas não consomem novamente. Limite/expiração são verificados sob bloqueio da linha. Antes de pagamentos reais, implementar reserva/expiração de pedidos, estornos e política de liberação de cupons.

Ao alterar preços ou variantes em `src/data/products.ts`, rode `node scripts/export-checkout-catalog.cjs` e execute `supabase/setup/checkout-catalog.sql` no SQL Editor. O script atualiza o catálogo confiável e desativa produtos removidos. Alterações no catálogo não mudam o snapshot de pedidos existentes. Essa etapa será substituída pelo catálogo integrado ao Supabase/Olist.

## Limites desta etapa

Não há cobrança, nota fiscal, reserva de estoque, despacho, e-mail transacional nem conexão com Olist. CPF/CNPJ é validado na ação do servidor e não é armazenado em pedidos de teste. O e-mail do pedido é o da conta autenticada; o endereço é o informado no checkout. Nenhuma chave privilegiada adicional é necessária.

Testes: `npm test` executa também PostgreSQL em memória (PGlite), com primitivas de Auth simuladas, aplicando as migrações reais de identidade/conta/cupons/pedidos. Isso não substitui validar a migração no projeto Supabase e testar o fluxo autenticado no navegador.
