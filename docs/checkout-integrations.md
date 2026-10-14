# Checkout: Melhor Envio e Mercado Pago

O checkout consulta fretes no Melhor Envio e recebe Pix/cartão dentro da STUW.
O cartão usa o Card Payment Brick oficial; PAN e CVV não passam pelo servidor da
STUW. Pix mostra QR Code, código copia e cola e validade. Um pedido pendente é
criado antes de solicitar o pagamento, para permitir idempotência e recuperação.
O pedido só é marcado como pago após confirmação autenticada do Mercado Pago.

## Configuração e ativação

### Teste local do pagamento

Para testar em `http://localhost:3000`, configure `COMMERCE_ENABLED=true`,
`ALLOW_LOCAL_CHECKOUT_TEST=true`, Mercado Pago `test` e Melhor Envio `sandbox`.
O prefixo `TEST-` ou `APP_USR-` sozinho não determina o ambiente da credencial;
por isso, o checkout não bloqueia o teste local com base nesse prefixo.
Confira no painel o ambiente e a compatibilidade das credenciais com o produto.
`MERCADO_PAGO_ENVIRONMENT=test` não transforma credenciais de produção em teste.
No Card Payment Brick, use as **credenciais de teste da aplicação da conta real**;
credenciais de produção de uma conta fictícia não são o fluxo de teste indicado
para esse Brick. Use cartão de teste e e-mail de cliente diferente do vendedor.

Execute `npm run checkout:check` para verificar os bloqueios de configuração sem
expor chaves. Reinicie o servidor após modificar o ambiente. Localmente, não se
envia `notification_url`: a confirmação vem da resposta e das consultas autenticadas
à API. Isso permite testar pedido/pagamento, mas não homologa entrega de webhooks.
O webhook cadastrado no painel ainda pode notificar a URL pública da aplicação.
Para homologar notificações, use um deploy atualizado ou túnel HTTPS e desative
`ALLOW_LOCAL_CHECKOUT_TEST`. Produção continua exigindo HTTPS.

Falhas de configuração registram `[checkout.configuration]` no servidor com código
e nomes de variáveis, nunca seus valores, dados do cartão ou dados do cliente.
Falhas HTTP do pagamento registram `[checkout.payment]` com operação, status HTTP
e códigos filtrados do provedor. O corpo bruto da resposta não é registrado.
No ambiente de teste, esses códigos também aparecem no resultado da tentativa.
HTTP 401/403 indica rejeição da operação por autenticação/autorização; uma consulta
bem-sucedida a `/users/me` não comprova permissão para criar pagamentos.
Tentativas rejeitadas antes da criação mostram “Não foi possível iniciar o pagamento”,
em vez de confundir falha da integração com recusa do cartão. Ao recarregar um pedido
antigo, o tipo de falha continua visível; o código detalhado fica no log da tentativa.

### Ambiente público e ativação completa

1. Aplicar as migrações anteriores, incluindo categorias, e então
   `supabase/migrations/20261012180829_checkout_integrations.sql`.
2. Configurar as variáveis de `.env.example` no servidor. Manter
   `COMMERCE_ENABLED=false` até finalizar a configuração.
3. Usar `MERCADO_PAGO_ENVIRONMENT=test` e `MELHOR_ENVIO_ENVIRONMENT=sandbox`
   para homologação. Credenciais de Mercado Pago devem pertencer à mesma aplicação
   e conta; `MERCADO_PAGO_COLLECTOR_ID` é o ID da conta recebedora. Configurar
   `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, access token e segredo de webhook.
   `SUPABASE_SERVICE_ROLE_KEY` fica exclusivamente no servidor.
4. `NEXT_PUBLIC_SITE_URL` deve ser a origem HTTPS pública da STUW. Em desenvolvimento,
   usar uma URL HTTPS acessível ao gateway. Configurar o webhook de **Pagamentos**
   em `/api/webhooks/mercado-pago` na aplicação do Mercado Pago, com a assinatura
   secreta correspondente. A integração usa Checkout Bricks e `/v1/payments`,
   não os eventos da API `/v1/orders`.
5. Configurar token Melhor Envio, e-mail técnico (`User-Agent`) e CEP de origem.
   O token deve permitir cotação e consulta/rastreamento de etiquetas da loja.
6. Preparar e publicar os produtos no admin, com estoque por SKU, peso embalado em
   gramas e dimensões em centímetros. Produtos estáticos/de demonstração não podem
   ser vendidos por este fluxo. Preencher os dados reais antes de ativar vendas.
7. Agendar `GET /api/jobs/commerce`, preferencialmente a cada minuto, com
   `Authorization: Bearer <CRON_SECRET>`. O job processa até dez registros por chamada,
   com tomada de posse por registro, timeout e reagendamento. Aumentar trabalhadores
   e frequência conforme a fila crescer e os limites dos provedores permitirem.
8. Ativar `COMMERCE_ENABLED=true` no sandbox e testar os cenários abaixo. Só depois
   mudar ambos os ambientes para `production`, trocar todas as credenciais e
   configurar o webhook de produção. Rebuild é necessário ao trocar a chave pública.

Os testes automatizados usam provedores simulados e Postgres local/PGlite.
A cotação sandbox do Melhor Envio e consultas de leitura de credenciais foram
verificadas na API. Não foram realizadas cobranças ou compras de etiquetas.
A homologação integrada de pagamentos e notificações ainda precisa ser executada
antes de liberar vendas.

## Frete e valores

### Diagnóstico local e embalagem de teste

`npm run shipping:check` verifica o ambiente sem imprimir segredos. Para validar
o token com uma cotação sandbox de 300 g e 30 × 20 × 5 cm, execute
`npm run shipping:check -- 01001000` (ou outro CEP de destino). O comando não
compra etiquetas nem cria pedidos. Uma variável preenchida não prova token válido;
a confirmação depende da resposta da API.

Em **Admin → Produtos → Frete e embalagem**, é possível editar peso embalado (g)
e dimensões (cm) e testar o frete para um CEP sem salvar o cadastro. Esse teste exige
permissão de administrador e somente as quatro variáveis `MELHOR_ENVIO_*`, sem
depender de pagamento, HTTPS público, migração do checkout ou chave de serviço.
A seção mostra os nomes das variáveis ausentes/inválidas e distingue erros 401/403/422.

No sandbox, abrir um cadastro preenche apenas peso/dimensões vazios com a embalagem
de teste acima; medidas existentes são preservadas. O cadastro recebe a marcação
“Medidas de teste”. Salvar o produto persiste esses valores para o checkout.
Para produção, informar as medidas reais e desmarcar a embalagem de teste; produtos
marcados não podem ser publicados ou cotados em produção.

A cotação do checkout também independe de `COMMERCE_ENABLED`, Mercado Pago e HTTPS
público, mas exige chave de servidor Supabase, migrações e produtos publicados.
O pagamento continua exigindo todas as configurações, ativação explícita e HTTPS.
As cotações são vinculadas ao ambiente para não reutilizar preços sandbox em produção.

As cotações duram 15 minutos, pertencem ao usuário e são vinculadas ao endereço,
itens e quantidades. O navegador envia apenas a opção e o ID da cotação; o servidor
confere o contexto e o banco reconfirma preços, medidas e estoque na criação.
Não há substituição silenciosa por frete fixo se o provedor estiver indisponível.
A política existente de frete cortesia a partir de R$ 499 foi preservada para a
opção mais econômica. O custo original da transportadora fica na cotação.

Totais são calculados em centavos, incluindo cupom, presente e desconto Pix.
Parcelas e eventuais juros são exibidos pelo Mercado Pago, sem prometer condições
comerciais que não estejam configuradas na conta recebedora. A seleção de frete
é invalidada quando o endereço ou a sacola muda. Recalcular consulta novamente a API.

## Pedidos, estoque e pagamento

- Chave de tentativa por checkout, identificação do mesmo pedido pendente por
  usuário e conteúdo, e `X-Idempotency-Key` estável por pedido no Mercado Pago.
- Reserva por baixa transacional do estoque, com atualização da versão pública,
  documento administrativo e revisão. Valores divergentes revertem toda a transação.
- Pagamento recusado/cancelado devolve estoque e uso de cupom exatamente uma vez.
  Reembolso de pedido pago não repõe estoque automaticamente: exige conferência da
  devolução física. Durante um pagamento pendente, a substituição de SKUs pelo editor
  fica bloqueada para preservar a capacidade de devolver a reserva.
- Timeout não é tratado como recusa. O pedido fica pendente e é reconciliado pelo
  ID do pagamento ou `external_reference`, sem nova cobrança automática. Falhas
  definitivas HTTP 400/401/403/404/422 encerram a tentativa e devolvem a reserva.
- O webhook verifica HMAC, ID e timestamp; consulta o pagamento na API e confere
  conta recebedora, modo teste/produção, moeda, valor, método e referência do pedido.
  Eventos repetidos e fora de ordem não duplicam movimentos nem desfazem confirmações.
- O cliente acompanha o resultado na própria página. A URL contém apenas o UUID
  do pedido; recarregar recupera o acompanhamento com verificação de propriedade.
  Pix pendente também pode ser recuperado em Minha conta → Compras.
- Nenhum token de cartão, PAN, CVV ou CPF/CNPJ é persistido no banco. O documento
  é enviado ao Mercado Pago para a transação; emissão de nota fiscal não está incluída.
- Pedidos novos só recebem atualizações de pagamento/entrega pelas integrações.
  A ferramenta antiga de atualização manual continua disponível apenas para demos.

Pedidos cuja criação de pagamento permaneça inconclusiva exigem acompanhamento
operacional. Não liberar o estoque nem repetir a cobrança sem conferir a conta do
Mercado Pago. O job mantém `sync_error` em `order_integrations`; monitorar falhas e
pedidos retidos em `initializing`. A geração de alertas externos e a liberação manual
de reservas inconclusivas não estão automatizadas.

## Preparação e acompanhamento do envio

A compra e geração da etiqueta são realizadas no painel do Melhor Envio. Não há
compra automática de frete ou débito no saldo da loja nesta implementação.
Em Admin → Pedidos, informar o UUID da etiqueta após conferir o destinatário e
usar **Sincronizar pagamento e entrega**. A etiqueta é consultada na conta
configurada, só pode ser vinculada a um pedido e exige pagamento aprovado.
Uma etiqueta já vinculada continua sendo acompanhada se ocorrer estorno ou
contestação do pagamento; o estorno pode ser total ou parcial.

O cliente vê: **Envio pendente → Etiqueta gerada → Produto enviado → Produto a
caminho → Produto entregue**, além de ocorrências/cancelamento e histórico.
`released` sem rastreio ou geração confirmada ainda é envio pendente. `posted`
confirma a postagem e o estado em transporte; a API de ciclo de vida não fornece
necessariamente eventos distintos para cada uma dessas duas etapas visuais.
O job consulta o rastreamento; o botão do admin permite sincronização imediata.
Eventos antigos não fazem uma entrega concluída retroceder.

## Verificação

O [roteiro de homologação](homologacao-pagamentos.md) reúne a matriz de cenários,
evidências, diagnóstico `checkout:preflight`, testes `test:payments` e reenvio
controlado `checkout:replay` de pagamentos existentes de sandbox. Testes locais
aprovados não significam homologação do gateway concluída.

`npm test` cobre banco/RLS, reserva e devolução de estoque, alterações concorrentes,
idempotência, cotação vinculada ao usuário, valores adulterados, assinatura de
webhooks, conta/moeda/ambiente divergentes e monotonicidade dos eventos. Executar
também `npm run build`, `npm run lint` e `npm run test:smoke`.

No sandbox, homologar cartão aprovado/recusado/em análise, Pix pago/expirado,
duplo clique, atualização de página, timeout, webhook repetido/atrasado, estoque
insuficiente, cupom esgotado, CEP sem cobertura, token expirado e ciclo de etiqueta.
Confirmar que o agendamento do job funciona no ambiente de hospedagem escolhido.

Referências: [Card Payment Brick](https://github.com/mercadopago/sdk-js/blob/main/docs/bricks/card-payment.md),
[envio de pagamento por cartão](https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/payment-brick/payment-submission/cards),
[webhooks do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks),
[cotação Melhor Envio](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos),
[rastreamento Melhor Envio](https://docs.melhorenvio.com.br/reference/rastreio-de-envios).
