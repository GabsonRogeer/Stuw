# Autenticação STUW

Rotas: `/cadastro`, `/login`, `/conta`, `/admin`, `/auth/callback`, `/auth/confirm`,
`/auth/verificar`, `/esqueci-senha`, `/reenviar-confirmacao` e `/redefinir-senha`.
O cadastro solicita nome, e-mail, senha (8–128 caracteres) e confirmação de senha.
As Server Actions validam os dados novamente, não retornam senhas e não atribuem
papéis administrativos. Supabase Auth gerencia as credenciais e a sessão usa
cookies SSR. O nome fica nos metadados da conta e no perfil após a migração abaixo.

## Configuração no Supabase

1. Execute `supabase/migrations/202609280001_profile_name.sql` no SQL Editor,
   depois da migração de identidade já aplicada. Ela copia somente o nome para o
   perfil, preserva nomes já preenchidos e não altera permissões.
2. Em Authentication → URL Configuration, use `http://localhost:3000` como Site
   URL no desenvolvimento e adicione `http://localhost:3000/auth/callback` e
   `http://localhost:3000/auth/confirm` às Redirect URLs. Em produção, use o domínio
   real com HTTPS e cadastre as duas URLs equivalentes.
3. Configure `NEXT_PUBLIC_SITE_URL` com a origem do site, também na Vercel antes
   do novo deploy. Localmente já está configurado como `http://localhost:3000`.
4. Mantenha o provedor Email habilitado. Com Confirm email ativo, o cadastro pede
   confirmação antes do login; se desativado, entra diretamente em Minha conta.
   Recomenda-se manter a confirmação habilitada em produção.
5. Instale os templates completos descritos em [SMTP e templates](smtp.md).
   Eles usam `/auth/verificar` e funcionam também em outro navegador/dispositivo.
   O link de confirmação de cadastro é:

```html
<a href="{{ .SiteURL }}/auth/verificar?token_hash={{ .TokenHash }}&type=email"
  >Confirmar meu e-mail</a
>
```

Nesse template, Site URL precisa apontar para o ambiente em que deseja confirmar.
O token é validado somente após pressionar Continuar, para evitar consumo por
leitores automáticos. `type=email` leva para `/conta`; `type=recovery` leva para
`/redefinir-senha`. A rota antiga `/auth/confirm` permanece compatível com links
de confirmação já enviados. Parâmetros de redirecionamento externos não são aceitos.
O callback PKCE aceita apenas `next=recovery` como destino alternativo fixo.

O envio de e-mail depende do Supabase e do SMTP configurado no projeto. Para envio
real a clientes, configure um provedor SMTP próprio e confira os limites de envio.
O site mostra erros e limites sem expor detalhes internos nem confirmar a existência
prévia de uma conta. Links expirados/usados direcionam a uma página de orientação.
Recuperação e reenvio apresentam respostas genéricas sobre existência da conta.
A nova senha é validada no servidor, exige um usuário verificado pelo Auth e
encerra as sessões de atualização dos outros dispositivos. Tokens de acesso já
emitidos podem permanecer válidos até expirar. Nenhum identificador de usuário
enviado pelo formulário é usado para escolher a conta a atualizar.

## Primeiro administrador

Cadastre e confirme sua conta. Em Authentication → Users, copie seu UUID e execute
no SQL Editor (substituindo o texto abaixo):

```sql
insert into private.admin_users (user_id)
values ('UUID-DA-SUA-CONTA'::uuid)
on conflict (user_id) do nothing;
```

O próximo login direciona administradores para `/admin`; clientes vão para `/conta`.
O painel já valida identidade e permissão no servidor; cupons, banners e pedidos
são módulos futuros. Cada nova operação administrativa deve chamar `requireAdmin`
e ter sua própria política RLS. Não basta proteger apenas o layout ou o menu.

`/conta` consulta o usuário validado pelo Auth, lê seu próprio perfil e permite sair.
O ícone do header continua levando ao login; quem já tem sessão vai para a conta.
Não há cadastro automático de administrador nem uso de service_role no site.

## Verificação

- `npm test`: valida cadastro, erros, rotas após login, logout e controle de acesso
  com respostas simuladas do Auth, sem enviar e-mails ou criar contas reais.
- `npm run test:smoke`: com o servidor iniciado, verifica páginas públicas e
  redirecionamento de visitantes em `/conta` e `/admin`.
- Teste integrado manual: cadastrar um e-mail seu, confirmar o link, entrar,
  recarregar `/conta`, verificar bloqueio de `/admin` como cliente e sair. Após
  conceder permissão no SQL Editor, entrar novamente e verificar `/admin`.

Referências: [Auth por senha](https://supabase.com/docs/guides/auth/passwords) e
[Next.js com confirmação](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).
