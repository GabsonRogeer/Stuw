# Credenciais por ambiente

O arquivo `.env.local` contém somente as credenciais do ambiente de testes.
As credenciais de produção da Stuw ficam nas variáveis de ambiente da Vercel.
Arquivos com segredos não devem ser versionados.

| Ambiente                         | Supabase e Mercado Pago         | Melhor Envio e SMTP |
| -------------------------------- | ------------------------------- | ------------------- |
| Local (`.env.local`)             | Credenciais atuais de testes    | Credenciais atuais  |
| Vercel Preview, branch `teste`   | Credenciais atuais de testes    | Credenciais atuais  |
| Vercel Production, branch `main` | Credenciais de produção da Stuw | Credenciais atuais  |

## Desenvolvimento local

- Mantenha `MERCADO_PAGO_ENVIRONMENT=test` e `MELHOR_ENVIO_ENVIRONMENT=sandbox`.
- Use `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, ajustando a porta se necessário.
- `ALLOW_LOCAL_CHECKOUT_TEST=true` permite homologar o checkout HTTP em localhost.
- As chaves do Supabase devem pertencer ao mesmo projeto de testes; as chaves,
  o collector ID e o segredo de webhook do Mercado Pago devem corresponder à
  integração de testes.
- Trocar a branch não altera o `.env.local`. Não copie credenciais de produção
  para esse arquivo, mesmo ao trabalhar na `main`.
- Reinicie o servidor depois de alterar variáveis locais.

## Configuração na Vercel

1. Defina `main` como a branch de produção do projeto.
2. Em **Settings → Environment Variables**, cadastre as credenciais da Stuw
   somente em **Production**. Elas ainda precisam ser fornecidas e configuradas.
3. Cadastre as credenciais atuais de testes em **Preview**, com escopo para a
   branch `teste`. Confira também variáveis Preview gerais que possam ser herdadas.
4. Mantenha Melhor Envio e SMTP conforme combinado, cadastrando-os nos ambientes
   correspondentes. O código exige Melhor Envio em `production` quando Mercado
   Pago estiver em `production`; confirme o ambiente e a compatibilidade do token
   antes de ativar pagamentos de produção.
5. Configure `NEXT_PUBLIC_SITE_URL` com a URL HTTPS de cada ambiente e
   `ALLOW_LOCAL_CHECKOUT_TEST=false` nos ambientes publicados.
6. Configure as URLs de retorno do Supabase Auth e o webhook do Mercado Pago
   para o respectivo ambiente. Projetos Supabase separados precisam também do
   esquema e da configuração de Auth/SMTP correspondentes.
7. Faça um novo deploy após alterar variáveis. Valores `NEXT_PUBLIC_*` são
   incorporados durante o build.

Use os mesmos nomes de variáveis em todos os ambientes, alterando apenas os
valores e seus escopos. `SUPABASE_SERVICE_ROLE_KEY`, tokens privados e senhas
permanecem exclusivamente no servidor, sem prefixo `NEXT_PUBLIC_`.

A separação de branches não duplica o banco nem os serviços externos. O isolamento
de dados depende de configurar o projeto Supabase correto em cada ambiente.

Referências: [variáveis por ambiente na Vercel](https://vercel.com/docs/environment-variables/manage-across-environments)
e [variáveis de ambiente do Next.js](https://nextjs.org/docs/app/guides/environment-variables).
