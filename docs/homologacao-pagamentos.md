# Homologação de pagamentos STUW

O ambiente atual continua sendo de testes. A criação do ambiente de produção fica
para uma etapa posterior. Este roteiro distingue testes locais com provedores
simulados de evidências coletadas nas APIs e no site publicado.

## Situação verificada em 13/10/2026

| Verificação                               | Resultado                                                                                                        | Limite da evidência                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Configuração local do checkout            | Mercado Pago `test`, Melhor Envio `sandbox`, comércio habilitado                                                 | Variáveis locais não comprovam ambiente das credenciais nem configuração do deploy |
| Origem local                              | `http://localhost:3000`, teste local habilitado                                                                  | Não recebe webhooks públicos; servidor não estava acessível durante o diagnóstico  |
| Agendamento                               | Vercel Hobby, sem cron cadastrado; segredo do job configurado no deploy                                          | Execução manual disponível; agendamento contínuo pendente                          |
| Mercado Pago `GET /users/me`              | Token aceito e recebedor correspondente                                                                          | Não comprova permissão para criar pagamentos                                       |
| Supabase                                  | `orders`, `order_integrations`, `checkout_shipping_quotes` e `catalog_products` acessíveis com chave de servidor | Não substitui compra autenticada nem auditoria completa de RLS                     |
| `https://stuw.vercel.app`                 | HTTP 200 na página inicial                                                                                       | Disponibilidade no momento da consulta                                             |
| Webhook e job publicados                  | Chamadas sem autenticação retornaram HTTP 401 com as mensagens esperadas                                         | Não comprova segredo correto, entrega assinada nem cron agendado                   |
| Testes direcionados                       | 29 testes passaram                                                                                               | Incluem simulações de gateway e Postgres/PGlite, sem compra real ou teste de carga |
| Cartão/Pix na API, via checkout publicado | Pendente                                                                                                         | Nenhuma cobrança criada nesta rodada                                               |

### Verificação autenticada da Vercel e do site

- Projeto existente `pulsik/stuw`, plano Hobby. O destino denominado `Production`
  pela Vercel atende `https://stuw.vercel.app`; o modo comercial continua sendo
  de homologação. Nenhum ambiente novo foi criado.
- Fixados `MERCADO_PAGO_ENVIRONMENT=test`, `MELHOR_ENVIO_ENVIRONMENT=sandbox` e
  `ALLOW_LOCAL_CHECKOUT_TEST=false`. A origem pública já estava correta; a chave
  pública de teste e a URL Supabase correspondem às locais. Tokens existentes
  foram preservados; a exportação da Vercel oculta seus valores.
- Criado `CRON_SECRET` aleatório de 256 bits como Secret. A cópia para execução
  manual fica em `.vercel/.env.commerce-job`, ignorada pelo Git, sem exposição
  em argumentos ou relatórios.
- Republicado o código anteriormente publicado: deploy
  `dpl_DcJTVEyVzjakRR8qGjAAAdsZcbJF`, Ready, em 13/10/2026. As mudanças locais
  nos scripts e testes não foram publicadas por esse redeploy.
- Job autenticado: lote de **2 integrações, 0 falhas**. Isto comprova acesso e
  execução da rota; não demonstra recuperação de resposta perdida nem execução
  periódica. Antes do teste, a consulta não encontrou pedidos comerciais com
  `payment_test_mode=false` no banco correspondente.
- Pagamento existente de cartão validado na API: `live_mode=false`, status
  `approved`, recebedor, valor e referência correspondentes ao pedido. Cinco
  webhooks assinados concorrentes foram aceitos pelo site (**5/5**). O pedido
  permaneceu aprovado, o histórico permaneceu com **2 eventos** e as projeções
  de estoque do admin e catálogo permaneceram iguais. Esse pedido não usa cupom.
  Evidência restrita: `.vercel/replay-evidence.json` (ignorada pelo Git).
- Esse reenvio usa assinatura gerada localmente com o segredo configurado.
  Ainda falta observar a entrega originada pelo Mercado Pago e testar transições
  novas, recusas e expiração no checkout publicado.

## Comandos disponíveis

A verificação final desta rodada também passou na suíte completa (`npm test`:
113 testes), no lint, no build (incluindo TypeScript) e na checagem de diferenças
de whitespace. Além dos scripts e testes, foi corrigida a tela de pagamento e
aplicada a migração `20261013212513_pix_expiration_margin.sql` no banco de teste.
Não houve criação de cobrança nem criação de ambiente de produção.

### Preparação do Pix em 13/10/2026

- Tela publicada em `https://stuw.vercel.app`, deploy
  `dpl_9cTtLgq1qKzqT7zXYiZZk3Ga1cPe`, com build remoto concluído (Ready).
- API de meios de pagamento retornou Pix ativo para a credencial de teste.
  Isto ainda não comprova criação de pagamento Pix.
- Novos pedidos Pix persistem vencimento de 35 minutos, com cinco minutos de
  margem para transporte. `clock_timestamp()` é avaliado na inserção, após
  eventuais esperas por locks. Retentativas mantêm o mesmo prazo e payload.
- Migração aplicada isoladamente via `supabase db query --file` no projeto
  correspondente ao checkout. A função remota anterior foi comparada com a
  original antes da alteração. Após aplicar, corpo e permissões foram conferidos:
  `SECURITY INVOKER`, search path vazio, execução restrita a `service_role`.
  A contagem e o hash das validades dos dois pedidos existentes não mudaram.
- O banco remoto não possui `supabase_migrations.schema_migrations`. Nenhuma
  migração antiga foi reaplicada ou marcada como executada por suposição. Antes
  de adotar `db push`, estabelecer uma linha de base validada do schema e histórico.
- Advisors antes/depois mantiveram os mesmos dois avisos anteriores: execução
  autenticada de `is_admin()` como SECURITY DEFINER e proteção de senhas vazadas
  desativada. A alteração do Pix não acrescentou avisos.
- A interface oculta QR Code e copia e cola ao vencer, informa que aguarda a
  confirmação do provedor e continua consultando. Uma aprovação posterior ainda
  é exibida normalmente. O clique em copiar também verifica o relógio, cobrindo
  abas suspensas que ainda não processaram o timer.
- A expiração visual não altera status financeiro nem libera estoque/cupom.
  O teste com relógio simulado cobre a transição da tela e a continuidade da
  consulta; o teste SQL cobre cancelamento e devolução sem duplicidade.
- Ainda pendentes: geração pela conta de cliente no site, recuperação do mesmo
  QR após recarregar e expiração real acompanhada na API.

### Primeira tentativa Pix: correção do formato de vencimento

- Pedido `STUW-850A799F27C24D45A7B08579A58A481A`, R$ 88,98, em
  13/10/2026 às 21:40:52 UTC: solicitação recusada com HTTP 400, códigos
  `bad_request, 23`. O código 23 identifica formato inválido de
  `date_of_expiration` na documentação oficial de Payments.
- O banco retornou `2026-10-13T22:15:52.536076+00:00`, com microssegundos.
  O adaptador enviava a string sem conversão. Corrigido para serializar o mesmo
  instante em milissegundos e fuso explícito: `2026-10-13T22:15:52.536+00:00`.
  Não se calcula um novo vencimento nas retentativas; não houve nova alteração SQL.
- Consulta posterior: pedido `cancelled`, pagamento `rejected`, reserva marcada
  como liberada, conciliação encerrada, dois eventos (criação e recusa). A busca
  no Mercado Pago pela referência não encontrou pagamentos. Nenhuma cobrança
  foi recriada para esse pedido encerrado.
- Teste de regressão usa o timestamp exato do incidente, também cobre fuso -03:00,
  entrada UTC, estabilidade do payload e bloqueio de data inválida/ausente antes
  da chamada ao provedor. Suíte direcionada: **29 testes passaram**; lint passou.
- Correção publicada no deploy `dpl_ESN3zzPzAKWDmqLLZfyspXGrfGRX` (Ready),
  vinculado a `https://stuw.vercel.app`. Builds local e remoto passaram; site HTTP 200.
- Próximo passo: nova tentativa pelo checkout para validar a geração do QR na API.

Executar na raiz do projeto:

```bash
npm run checkout:check
npm run checkout:preflight
npm run checkout:preflight -- --online
npm run test:payments
```

`checkout:check` verifica a configuração já usada pelo checkout.
`checkout:preflight` acrescenta pendências de HTTPS público e cron. Retorna código
1 enquanto houver pendências. Com `--online`, realiza apenas consultas à conta
Mercado Pago, às tabelas Supabase e sondagens sem autenticação aos endpoints da
origem configurada. Não cria pedidos, cobranças, etiquetas ou execuções do job.
Credenciais e respostas brutas dos provedores não são impressas.

Os scripts carregam o ambiente de desenvolvimento com `@next/env`, como os outros
diagnósticos do projeto. Variáveis já definidas no processo prevalecem sobre os
arquivos. Rodar localmente não consulta as variáveis da Vercel. Para homologar o
deploy, conferir também suas configurações e usar os dados correspondentes ao
mesmo ambiente; não mudar a origem local e presumir que o deploy foi atualizado.

`checkout:preflight -- --process-env` evita carregar arquivos locais. Atenção:
`vercel env run` também carrega `.env.local` por conta própria, portanto essa
combinação não isola a configuração remota. Exportações com `[SENSITIVE]` são
recusadas explicitamente: os placeholders não são credenciais válidas.

Para executar **um lote** do job no site atual, usando o arquivo restrito criado
nesta configuração:

```bash
node --env-file=.vercel/.env.commerce-job scripts/run-commerce-job.cjs --process-env
```

O script exige os indicadores test/sandbox, recusa redirecionamentos e retorna
código 1 em falha, resposta inesperada ou `failed > 0`. Não repete automaticamente
em timeout, pois o servidor pode ter continuado. Os indicadores locais não provam
o ambiente remoto: neste caso ele foi configurado e verificado separadamente.
`npm run checkout:job` também existe, mas usa `.env.local` por padrão e exige que
origem e segredo correspondam ao servidor escolhido.

## Preparar o ambiente publicado

1. Conferir os valores do deploy: `COMMERCE_ENABLED=true`,
   `MERCADO_PAGO_ENVIRONMENT=test`, `MELHOR_ENVIO_ENVIRONMENT=sandbox`,
   `ALLOW_LOCAL_CHECKOUT_TEST=false` e origem HTTPS pública em
   `NEXT_PUBLIC_SITE_URL`.
2. Conferir Public Key e Access Token de teste da mesma aplicação/conta, ID do
   recebedor e segredo de assinatura obtido na configuração do webhook. A variável
   de ambiente não transforma uma credencial produtiva em credencial de teste.
3. No Mercado Pago, configurar o evento **Pagamentos** (`payment`) na URL
   `/api/webhooks/mercado-pago`. O código atual utiliza `/v1/payments` e Card Payment
   Brick; instruções da API `/v1/orders` não se aplicam automaticamente.
4. Configurar um `CRON_SECRET` forte no servidor e no agendador; chamar
   `GET /api/jobs/commerce` com `Authorization: Bearer <CRON_SECRET>`, a cada minuto.
   Conferir execução e o contador `failed`, não somente o HTTP 200.
   O segredo já está configurado no site atual. O cron nativo do plano Hobby só
   permite execução diária, inadequada para essa frequência. Durante a
   homologação, usar execuções manuais acompanhadas; antes da operação contínua,
   escolher um agendador compatível. Nenhuma contratação foi realizada.
5. Fazer redeploy quando alterar as variáveis, especialmente a chave pública
   incorporada ao JavaScript. Manter as chaves privilegiadas somente no servidor.
6. Usar cliente, SKU e cupom dedicados à homologação. Registrar estoque inicial e
   usos de cupom antes de cada cenário. Não apagar pedidos para repetir testes.

Para Card Payment Brick, usar credenciais de teste da conta real e e-mail de
pagador diferente do vendedor. A documentação orienta não usar e-mail de usuário
fictício Mercado Pago no Brick. O e-mail enviado pela STUW é o da conta autenticada.

## Matriz de execução

| ID      | Cenário e procedimento                                          | Critério de aceite                                                                                | Evidência disponível                                                                                            |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CARD-01 | Checkout com cartão de teste e titular `APRO`                   | Pagamento aprovado, pedido pago, um único desconto de estoque                                     | Validação de status/valores automatizada; compra no navegador pendente                                          |
| CARD-02 | Nova tentativa com `OTHE` e depois `FUND`                       | Recusa exibida; estoque e cupom devolvidos uma vez                                                | Transição de recusa no banco e ação testadas; resposta real do gateway pendente                                 |
| CARD-03 | Nova tentativa com `CONT`                                       | Permanece pendente/em análise, sem expedição                                                      | Homologação no provedor pendente                                                                                |
| PIX-01  | Criar Pix e recarregar; abrir em Minha conta                    | Mesmo pedido, QR/copia e cola, valor e validade recuperáveis                                      | Homologação no navegador pendente                                                                               |
| PIX-02  | Confirmar Pix pelo provedor                                     | Pedido pago somente após consulta autenticada; valor/conta/ambiente corretos                      | Aprovação simulada coberta; liquidação bancária não executada                                                   |
| PIX-03  | Deixar Pix vencer, consultar provedor e conciliar               | Código vencido distinguido de encerramento confirmado; cancelamento devolve estoque/cupom uma vez | Cancelamento e devolução após validade simulada cobertos; comportamento temporal real pendente                  |
| NET-01  | Interromper chamada ao gateway antes de obter resultado         | Pedido inconclusivo preservado, sem afirmar recusa, sem devolver estoque                          | Timeout/rede cobertos nas ações e adaptador HTTP                                                                |
| NET-02  | Gateway cria pagamento, mas resposta é perdida                  | Conciliação por `external_reference` recupera pagamento sem nova cobrança                         | Recuperação simulada coberta                                                                                    |
| NET-03  | Nenhum pagamento encontrado na conciliação                      | Mantém pendência e reagenda; operador revisa caso persistente                                     | Ausência simulada coberta; alerta operacional externo ainda não existe                                          |
| WH-01   | Repetir cinco notificações válidas simultâneas                  | Um evento de mudança de status; nenhuma movimentação duplicada                                    | PGlite cobre transição; site aceitou 5/5 reenvios de cartão já aprovado, sem novo evento/estoque; cupom ausente |
| WH-02   | Alterar assinatura ou ID                                        | HTTP 401, sem consultar pagamento; divergência entre corpo e ID retorna 400                       | Coberto                                                                                                         |
| WH-03   | Falha de consulta ao gateway, depois reenviar                   | HTTP 503 na falha; nova entrega válida processada após recuperação                                | Coberto com timeout simulado                                                                                    |
| WH-04   | Notificação atrasada/após falha do endpoint                     | Estado converge; pedido pago não volta a pendente                                                 | Ordem de eventos testada no banco; retentativa assinada real pendente                                           |
| JOB-01  | Fechar checkout e impedir somente a entrega de webhook no teste | Job recupera pagamento sem navegador aberto                                                       | Execução manual publicada: 2 integrações, 0 falhas; recuperação isolada e agendamento pendentes                 |
| DUP-01  | Duplo clique, recarregar e repetir tentativa                    | Mesmo pedido pendente e chave idempotente; sem nova cobrança                                      | Idempotência do banco/chave coberta; navegador/provedor pendentes                                               |

PGlite verifica as funções SQL reais, mas serializa o acesso em uma instância;
os reenvios concorrentes neste teste não substituem teste de concorrência entre
conexões PostgreSQL no ambiente publicado. Os testes não usam as credenciais de
`.env.local` para criar pagamentos.

### Cartões de teste

Consultar a tabela oficial na execução. Em 13/10/2026, Mastercard:
`5480 8328 0103 3311`, CVV `123`, validade `11/30`. Para `APRO` e `OTHE`, CPF
`12345678909`. Manter o documento do checkout igual ao informado no Brick.
`EXPI` testa cartão vencido, não expiração de Pix. Nunca usar cartão real neste
ambiente.

### Reenvio de webhook de pagamento existente

Após obter um ID numérico de pagamento criado pelo checkout em teste:

```bash
npm run checkout:replay -- ID_PAGAMENTO 5
```

O script consulta o pagamento e o pedido; exige `live_mode=false`, pedido de
sandbox, recebedor, referência, moeda, método e valor correspondentes. Usa apenas
a origem de `NEXT_PUBLIC_SITE_URL`, recusa ambiente de produção e não segue
redirecionamentos. Envia de 1 a 10 cópias concorrentes com a mesma assinatura,
timestamp, request ID e corpo. Pode atualizar o estado do pedido por conciliação;
não cria nem altera pagamentos no Mercado Pago.

Conferir antes/depois: `orders`, `order_events`, `order_integrations`, estoque
no admin e usos do cupom. Cinco respostas HTTP 200 não bastam para provar
idempotência. A assinatura é gerada pelo script com o segredo configurado: isto
não prova a entrega real pelo provedor. Segredos não entram em argumentos de
linha de comando nem devem ser anexados ao relatório.

## Pendências técnicas a observar

- **Validade Pix:** novos pedidos receberam margem persistida de cinco minutos.
  Medir o prazo retornado pelo provedor na primeira emissão e observar tentativas
  muito atrasadas. Pedidos antigos mantêm seu vencimento original.
- **Validade na interface:** transição de código vencido implementada e testada
  com relógio simulado. Ainda verificar no navegador com tempo real; a referência
  visual usa o relógio do dispositivo e não decide o status financeiro.
- **Retentativa assinada:** a validação local aceita timestamps com até 10 minutos.
  O Mercado Pago documenta retentativas em intervalos de 15 minutos. Verificar se
  o provedor renova a assinatura/timestamp por tentativa; não remover a validação
  para fazer o teste passar. Manter conciliação independente pelo job.
- **Pix sandbox:** a documentação de Bricks garante geração pendente; não assumir
  aprovação automática descrita para Orders API. Registrar quais transições a
  conta/API utilizada permite simular. Liquidação real fica para a etapa posterior
  de produção controlada, com autorização do responsável.
- **Pedidos inconclusivos:** não liberar reserva nem repetir cobrança sem conferir
  o provedor. Procedimento e alerta operacional precisam acompanhar a homologação.

## Registro de evidência

Para cada cenário, registrar em local restrito:

```text
Cenário:
Data/hora e ambiente:
Commit/deploy:
Pedido STUW / Payment ID:
Estoque inicial / final:
Usos do cupom inicial / final:
Status inicial / final:
Entrega: resposta de criação / webhook / job / consulta do cliente:
Resultado: aprovado / falhou / bloqueado:
Capturas e logs sanitizados:
Observação ou defeito associado:
```

Para isolar webhook, fechar a tela e suspender temporariamente o job apenas no
ambiente de homologação. Para isolar o job, bloquear temporariamente a entrega do
webhook de teste e fechar o navegador. Restaurar as configurações ao concluir.
Não deixar hooks de simulação ou endpoints para forçar status na aplicação.

## Referências

- [Fluxo de teste do Checkout Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-test/test-payment-flow)
- [Cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards)
- [Pix via Payments e validade](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix)
- [Código 23 de Payments: formato de expiração](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders)
- [Webhooks e retentativas](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Integrações do checkout STUW](checkout-integrations.md)
- [Limites de cron da Vercel por plano](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Variáveis sensíveis da Vercel](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
