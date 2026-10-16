# Faturamento automático Olist

Regra aprovada: gerar a NF-e e solicitar sua autorização depois do pagamento aprovado. O job fiscal usa o mesmo banco e os vínculos Olist existentes. Não cria pagamentos, não relança estoque e não inclui pedidos anteriores à ativação.

## Fluxo

1. O webhook ou a conciliação confirma o pagamento real. O job de pedidos cadastra/vincula o pedido na Olist.
2. A fila admite somente pedidos criados a partir de `olist_invoice_automation.activated_at`, reais, aprovados e vinculados. Registros fiscais manuais existentes são preservados.
3. O worker valida NCM, origem, unidade e código dos componentes reservados na Olist. Valida até três SKUs por execução e persiste o progresso para carrinhos maiores.
4. Gera a nota uma única vez, confirma cliente, itens, NCM, CFOP e valores. Na execução seguinte, reconfirma pagamento e ausência de reembolso antes de solicitar autorização.
5. Depois da autorização confirmada, o job de documentos valida o XML de produção, armazena PDF/XML privados, vincula a nota à compra e enfileira o e-mail STUW com anexos. O envio direto da Olist fica desligado nessa solicitação para evitar dois e-mails.

O estoque segue a configuração da Olist, **Automático ao autorizar a nota fiscal**. Este worker não chama lançamento de estoque nem confirma uma baixa sem evidência do movimento.

## Segurança e revisão

- A fila usa lease de três minutos e `FOR UPDATE SKIP LOCKED`, além do bloqueio global já usado pelas integrações Olist.
- As tentativas fiscais e o ID da NF são imutáveis. Uma resposta perdida permite apenas consultas posteriores; não repete geração ou emissão.
- Falhas transitórias de conexão/HTTP 429/5xx são consultadas novamente após dois minutos. Divergências fiscais/financeiras interrompem o fluxo e aparecem em **Admin → Olist**.
- O limite é de 60 execuções por ciclo de revisão. Após corrigir a pendência na Olist, usar **Retomar fila após corrigir pendência**. A retomada não limpa tentativas fiscais: uma emissão já solicitada precisa ser concluída/conferida na Olist, enquanto o site consulta seu resultado.
- Ações automáticas têm ator nulo (sistema); não usam a identidade de um administrador fictício. O admin continua podendo consultar e tratar pedidos anteriores manualmente.
- Clientes e usuários anônimos não podem ler a fila/configuração ou executar a função de claim. Administradores têm leitura; apenas o backend privilegiado altera a fila.

## Publicação e operação

A migração `20261016135108_automatic_olist_invoicing.sql` cria a fila e o cron **desativados**. Aplicar somente essa migração no banco existente, preservando o histórico operacional. Não executar todas as migrações novamente.

Configurações necessárias no worker: `MERCADO_PAGO_ENVIRONMENT=production`, `OLIST_ENABLED=true`, `OLIST_INVOICE_ENABLED=true` e token Olist válido. Documentos/e-mail também dependem da configuração SMTP, Chromium e `TRANSACTIONAL_EMAIL_ENABLED=true` já usada pela rotina de e-mail.

Antes de ativar, publicar o código, verificar com o segredo de cron o GET `/api/jobs/olist?direction=invoices&verify=1`. Esperar `ready: true` e `automaticEnabled: false`. Essa consulta não acessa a Olist nem processa pedidos.

Ativar uma única vez, após verificar o destino:

```sql
begin;
update public.olist_invoice_automation
set enabled=true,activated_at=clock_timestamp()
where id and not enabled and activated_at is null;
select cron.alter_job(jobid,active:=true)
from cron.job where jobname='stuw-olist-invoices';
commit;
```

Conferir o diagnóstico autenticado, o registro `private.commerce_job_runs` de tipo `invoices` e a resposta HTTP correspondente no `pg_net`. A rotina usa `/api/jobs/olist?direction=invoices`, a cada 30 segundos, e compartilha o bloqueio global com estoque/pedidos. Execuções ocupadas aguardam o próximo ciclo.

Os workers continuam na Vercel durante a transição da loja para a Hostinger, usando o mesmo Supabase. O novo admin precisa ser publicado por ZIP na Hostinger para mostrar essa fila no domínio oficial. Preservar a Vercel e não duplicar o cron. Para migrar as rotinas, validar antes autenticação, variáveis, SMTP e Chromium/PDF na Hostinger e então trocar o único destino no banco.

Pausar novas execuções:

```sql
begin;
update public.olist_invoice_automation set enabled=false where id;
select cron.alter_job(jobid,active:=false)
from cron.job where jobname='stuw-olist-invoices';
commit;
```

Essa pausa não cancela notas nem desfaz uma solicitação fiscal em andamento. Para retomar, preservar `activated_at` e alterar somente `enabled=true` e o cron; não trocar a data de corte.

Referências oficiais: [gerar NF a partir do pedido](https://tiny.com.br/api-docs/api2-pedidos-gerar-nota-fiscal), [emitir NF](https://tiny.com.br/api-docs/api2-notas-fiscais-emitir).

## Registro de ativação — 16/10/2026

- Migração aplicada ao Supabase existente, sem reexecutar o histórico.
- Deploy de produção `dpl_EKWy62mxuXWF3mYXi9FKgLNzK1r4`, promovido para `stuw.vercel.app`. A URL pública dos e-mails passou a `https://www.stuw.com.br`.
- Ativação às **11:10:29 de Brasília** (`2026-10-16T14:10:29.300722Z`). Os três pedidos reais já aprovados ficaram fora da fila automática.
- Diagnóstico autenticado HTTP 200 com `ready=true`, `automaticEnabled=true`; execução agendada real registrada pelo Supabase com HTTP 200, `result=idle`. Nenhuma compra ou nova NF foi gerada para essa verificação.
- 168 testes passaram, incluindo isolamento de acesso, data de corte, leases, retomada, respostas perdidas e não repetição de solicitações fiscais. Lint e build Webpack passaram localmente; o deploy final também compilou com TypeScript na Vercel (Node de build 24.21.0 fornecido pela plataforma; versão local declarada 24.19.0).
- O fluxo de documentos existente mantém uma NF autorizada com PDF/XML armazenados e e-mail registrado como enviado. O próximo pedido elegível validará a automação fiscal completa com dados reais; as verificações desta ativação não substituem essa evidência.
- ZIP dos fontes para atualizar o admin na Hostinger: `.local-backups/stuw-hostinger-nf-automatica-20261016.zip`, 305 arquivos, sem `.env`, `.vercel`, banco, documentos fiscais ou dependências compiladas. O envio desse ZIP ao hPanel permanece a cargo do usuário.
