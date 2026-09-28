# Supabase — primeira etapa

Esta base fornece a conexão e o esquema de identidade. Login, cadastro, conta e
entrada administrativa estão conectados ao Auth; veja `docs/authentication.md`.
O catálogo e o checkout continuam demonstrativos.

## Configuração

Em `.env.local`, informe `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. O arquivo é ignorado pelo Git. Reinicie o
servidor Next após alterar as variáveis. Na Vercel, configure as mesmas variáveis
nos ambientes desejados e faça um novo deploy. Não coloque secret/service_role em
variáveis públicas. Nenhuma chave privilegiada é necessária nesta etapa.

## Aplicar o banco

1. No projeto correto do Supabase, abra **SQL Editor → New query**.
2. Execute o arquivo completo `supabase/migrations/202609250001_identity.sql`.
   Execute uma única vez: é uma migração transacional, não um script de reset.
3. Execute `supabase/tests/identity.sql` em outra consulta. Se passar, termina em
   ROLLBACK: as contas de teste não ficam no banco. Se ocorrer erro, execute
   ROLLBACK antes de repetir e investigue a mensagem.
4. Na pasta do site execute `npm run db:check`. Ele consulta a API sem gravar dados,
   confirma que visitantes não veem perfis e que não podem chamar `is_admin`.

A publishable key não permite executar DDL ou migrações. Sem conexão administrativa
autorizada, aplicar os arquivos no SQL Editor é uma etapa manual. O sucesso de
`db:check` não substitui os testes autenticados de isolamento em SQL.

## Modelo e permissões

- `auth.users`: contas e credenciais administradas pelo Supabase Auth.
- `public.profiles`: nome e timestamps, vinculados à conta. Um trigger cria o
  perfil vazio no cadastro; contas existentes recebem perfil na migração.
- `private.admin_users`: lista de administradores, fora do schema exposto pela API.
  Nenhum cliente pode escrever nesta tabela, nem alterar seu próprio papel.
- `public.is_admin()`: retorna apenas se o usuário autenticado atual é administrador.
  A função usa `search_path` vazio, consulta uma tabela protegida e não aceita ID.

RLS está habilitado nas duas tabelas. Visitantes não leem perfis. Clientes leem
apenas seu perfil e atualizam somente `full_name`. Administradores podem ler perfis.
Não há permissão de excluir contas ou promover administradores pela aplicação.
Papéis não são derivados de e-mail, localStorage ou metadados editáveis do usuário.

## Primeiro administrador

Crie a conta em **Authentication → Users** e copie seu UUID. Somente no SQL Editor,
substitua o UUID abaixo pelo da conta escolhida:

```sql
insert into private.admin_users (user_id)
values ('UUID-DA-CONTA'::uuid)
on conflict (user_id) do nothing;
```

Para revogar, remova a linha correspondente em `private.admin_users` pelo SQL
Editor. A autorização é consultada no banco a cada operação, sem papel obsoleto
armazenado no JWT. Não adicione `private` aos schemas expostos na Data API.

## Código

- `src/lib/supabase/client.ts`: cliente para componentes no navegador.
- `src/lib/supabase/server.ts`: cliente por requisição no servidor, usando cookies.
- `src/proxy.ts`: renovação de sessão nas rotas de conta/login/admin/auth. Ao
  integrar autenticação ao checkout, inclua suas rotas no matcher.
- `src/lib/supabase/admin.ts`: `requireAdmin()` verifica o usuário no Auth e a
  permissão no banco; deverá ser chamado em cada operação administrativa futura.
- `src/types/database.ts`: tipos do esquema desta migração. Regenerar via CLI
  após alterações do banco, sem expor o schema privado ao cliente.

Os clientes usam a publishable key e a sessão do usuário, preservando RLS. Não há
cliente com bypass de permissões. Cookies de autenticação só entram em uso com o
login real; são separados da personalização opcional da vitrine.

Cupons, banners/Storage, produtos e pedidos receberão migrações próprias. Ainda não
há bucket nem gravação de informações do checkout nesta etapa.

Referências oficiais: [SSR no Next.js](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[perfis de usuários](https://supabase.com/docs/guides/auth/managing-user-data) e
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
