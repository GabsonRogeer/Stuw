# SMTP

O diagnóstico lê as variáveis SMTP de `.env.local`. Não imprime senha, corpo ou resposta bruta do servidor.

- `SMTP_HOST`: servidor SMTP.
- `SMTP_PORT=465` e `SMTP_SECURE=true`: TLS desde a conexão.
- Para STARTTLS obrigatório: `SMTP_PORT=587` e `SMTP_SECURE=false`.
- `SMTP_USER` e `SMTP_PASSWORD`: credenciais da caixa remetente.
- `SMTP_FROM_EMAIL` e `SMTP_FROM_NAME`: remetente.
- `SMTP_TEST_TO`: um único destinatário de teste.

Execute `npm run smtp:check` para verificar conexão TLS e autenticação sem enviar mensagem.
Execute `npm run smtp:check -- --send` para verificar e enviar uma mensagem de teste ao destinatário configurado.
Cada execução com `--send` envia uma nova mensagem. A aceitação SMTP não comprova recebimento na caixa de entrada; confirme com o destinatário.

As variáveis locais não configuram o SMTP do Supabase Auth. Configure host, porta, usuário, senha e remetente também no painel de autenticação do projeto, além dos templates e URLs de redirecionamento.

## Publicar os templates no Supabase

Em Authentication → Email → Templates, copie o HTML completo dos arquivos abaixo:

| Template no painel | Arquivo                             | Assunto                    |
| ------------------ | ----------------------------------- | -------------------------- |
| Confirm signup     | `emails/supabase/confirmation.html` | Confirme seu e-mail — STUW |
| Reset password     | `emails/supabase/recovery.html`     | Redefina sua senha — STUW  |

O reenvio usa o mesmo template de Confirm signup. Preserve `{{ .SiteURL }}` e
`{{ .TokenHash }}`. As prévias em `emails/previews/` contêm links fictícios e não
devem ser instaladas no painel.

Em URL Configuration, defina Site URL com a origem pública HTTPS da loja e
adicione às Redirect URLs a origem seguida de `/auth/callback` e
`/auth/callback?next=recovery`. Configure `NEXT_PUBLIC_SITE_URL` com a mesma origem.
Para desenvolvimento, use um projeto de homologação com `http://localhost:3000`.
Os templates usam Site URL do painel; a variável local não altera esse valor.

Os HTMLs levam a `/auth/verificar`. O cliente pressiona Continuar para validar
o token, evitando seu consumo por leitores automáticos. O servidor só aceita
`email` e `recovery`, sem redirecionamentos externos. Mantenha confirmação de
cadastro habilitada. Confira limites de envio e SPF, DKIM e DMARC no provedor.

No `.env.local`, escape `$` na senha como `\$`, pois o Next.js expande variáveis.
Em campos de senha de painéis, use a senha original. O SMTP usa Hostinger na porta
465, TLS, nome STUW e remetente `contato@stuw.com.br`.

## Ativar a confirmação de pagamento

1. Aplique `supabase/migrations/20261014212138_transactional_email_outbox.sql`
   após as migrações de checkout. Ela não envia mensagens nem inclui compras antigas.
2. Publique o código e configure as variáveis SMTP, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL` com HTTPS e um `CRON_SECRET` forte no ambiente hospedado.
3. Configure um agendamento para chamar `GET /api/jobs/email` a cada minuto,
   enviando `Authorization: Bearer <CRON_SECRET>`. O agendamento é independente
   de `/api/jobs/commerce`.
4. Ative `TRANSACTIONAL_EMAIL_ENABLED=true` quando o ambiente estiver pronto.
   Ausente ou false deixa o envio desativado.

O pagamento aprovado pela integração grava uma entrada na fila na mesma
transação do pedido. Pedidos demo e pagamentos sandbox não geram e-mails.
A chave única por pedido/tipo evita duplicação por webhooks repetidos. O job
reserva cada entrada com atualização condicional e processa até três por chamada.
Falha de autenticação SMTP deixa a fila intacta. Falhas antes de iniciar o envio
têm até cinco tentativas, com intervalo de cinco minutos.

O template usa valores persistidos em centavos: produtos, frete, embalagem,
descontos e total. Nome e produtos são escapados para HTML. A mensagem não declara
emissão de NF nem postagem e inclui um link autenticado para os detalhes do pedido.

### Conferência operacional

A tabela `email_outbox` só é acessível ao servidor e ao operador do banco:

- `pending`: aguarda envio; verifique o job e SMTP se a fila crescer.
- `sending`: reservado por uma execução.
- `sent`: o SMTP aceitou a mensagem; não comprova chegada à caixa de entrada.
- `uncertain`: resultado do envio ou gravação após o envio requer conferência.
- `failed`: cinco falhas de preparação; corrigir antes de repetir.
- `cancelled`: pedido deixou de ser elegível antes do envio, por exemplo, reembolso.

Registros em `sending` há mais de dez minutos passam a `uncertain`. Não há reenvio
automático de resultados incertos. Consulte os registros do provedor e o
destinatário antes de repetir. SMTP não garante entrega exatamente uma vez;
o Message-ID estável auxilia a conferência, mas não garante deduplicação.
O job retorna contagens e erros genéricos, sem credenciais ou dados dos pedidos.

## Manutenção e homologação

`src/services/email-templates.ts` é a fonte dos HTMLs. Execute
`npm run email:templates` após alterá-la. Abra `emails/previews/confirmation.html`,
`recovery.html` e `purchase.html` no navegador para revisar as prévias.

Testes automatizados cobrem validação de senha e sessão, tokens, redirecionamentos,
escape HTML, valores, permissões, fila transacional, concorrência e envio incerto.
A homologação no ambiente publicado ainda deve verificar:

1. Cadastro, recebimento e confirmação do e-mail em endereço controlado.
2. Reenvio para cadastro pendente e tratamento de link expirado/usado.
3. Recuperação em outro navegador, nova senha e login com ela.
4. Apresentação no Gmail e em cliente móvel.
5. Compra controlada com valores conciliados e apenas um envio, mesmo ao repetir
   a notificação de pagamento.

A integração com a Olist para cadastro de pedidos e emissão de NF foi adiada pelo responsável. O aceite completo de compra real, estoque, NF, etiqueta, postagem, e-mail e conciliação permanece pendente dessa etapa e da homologação operacional.

Referências: [Templates Supabase](https://supabase.com/docs/guides/auth/auth-email-templates),
[recuperação de senha](https://supabase.com/docs/guides/auth/passwords) e
[SMTP Nodemailer](https://nodemailer.com/smtp).
