# Área do cliente e super admin

`/conta` tem cabeçalho compacto, navegação lateral responsiva e páginas separadas:

- `/conta`: nome completo, data de nascimento e telefone. E-mail somente leitura.
- `/conta/enderecos`: adicionar, editar e excluir vários endereços brasileiros.
- `/conta/compras`: últimos 50 pedidos do cliente, com data, número, status e total.
- `/conta/wishlist`: favoritos existentes do navegador, compartilhados com a vitrine.

## Aplicação no Supabase

Após as migrações anteriores, execute no SQL Editor, nesta ordem:

1. `supabase/migrations/20260928135940_account_area.sql` (uma vez).
2. `supabase/tests/account.sql` (termina em ROLLBACK, sem manter dados de teste).
3. `supabase/setup/super-admin.sql` (concessão à conta solicitada pelo proprietário).

O último script exige que a conta já exista e tenha e-mail confirmado. A permissão
é vinculada ao UUID, não a uma comparação de e-mail no frontend. Faça login e abra
`/admin` para verificar a identificação de super admin. O SQL pode ser reaplicado
para a mesma conta sem duplicá-la.

Não há chave administrativa configurada no workspace; estes scripts precisam ser
aplicados pelo proprietário no SQL Editor. A geração da migração não aplica o SQL
ao projeto remoto. Execute também os testes e consulte os Security Advisors no
painel após aplicar. Não exponha o schema `private` na Data API.

## Permissões e manutenção

As páginas e Server Actions verificam a identidade no Auth. Atualizações usam o
UUID da sessão, nunca um ID de usuário recebido do formulário. RLS e grants por
coluna impedem leitura cruzada, transferência de endereços e alteração de pedidos
por clientes. `requireSuperAdmin()` permite restringir futuras operações de gestão
de administradores; o painel atual é a entrada para os módulos ainda em construção.

Os papéis `admin` e `super_admin` ficam em `private.admin_users`. Nenhum dos dois
pode promover usuários pela API nesta etapa. Promoção e revogação são feitas pelo
SQL Editor. O papel é consultado no banco a cada operação protegida.

Pedidos são um modelo de leitura preparado para a integração futura. Não há
gravação pelo checkout demonstrativo, cobrança ou integração Olist nesta entrega.
Integrações confiáveis deverão associar `orders.user_id` ao comprador autenticado,
gravar valores em centavos e manter um número único. As compras existentes não são
inventadas nem importadas automaticamente. Itens, rastreio e paginação serão
adicionados junto à integração de pedidos.

A wishlist ainda usa o armazenamento local já existente. Não sincroniza entre
dispositivos ou contas; isso está indicado na página. Endereços ficam no Supabase,
mas sua seleção no checkout será uma integração separada.

Se a migração não foi aplicada ou uma consulta falhar, as páginas mostram erro,
sem apresentar falha de consulta como uma lista vazia ou uma gravação bem-sucedida.
