# Conciliação de estoque Olist

## Estado da entrega

Migrações `20261015003758_olist_inventory_reconciliation.sql` e `20261015005019_olist_stock_scheduler.sql` aplicadas no Supabase Stuw. Após observar os 56 componentes sem erros e conciliar o saldo inicial confirmado pelo usuário, `scripts/sql/olist-enable-inventory.sql` ativou a atualização dos 56 componentes. Os 28 conjuntos são recalculados a partir deles.

Deploy de produção concluído em `https://stuw.vercel.app`, ID `dpl_21NnxrYySwEK9JnvCnun3ENGXBzM`. O cron Supabase `stuw-olist-stock` está ativo a cada minuto, com segredo armazenado no Vault. Chamadas reais retornaram HTTP 200, sem timeout. O plano Vercel Hobby não permite cron nativo nessa frequência.

Produção usa `OLIST_STOCK_ENABLED=true` para habilitar somente o estoque. A habilitação geral `OLIST_ENABLED` e o envio automático de pedidos não foram ativados. O webhook foi publicado com segredo exclusivo, mas sua configuração no painel Olist ainda não foi realizada.

O usuário confirmou 5 unidades físicas de short azul M. A leitura da Olist confirmou físico 5 e reserva ERP zero. O ajuste assistido não confirmou o retorno do lançamento; não foi repetido, e duas leituras posteriores confirmaram o saldo 5. Há duas unidades reservadas em pedidos de teste no site. Após ativação: top azul M disponível 5, short azul M disponível 3, conjunto azul M disponível 3. Os pedidos de teste não foram cancelados artificialmente.

O usuário confirmou baixa automática na Olist. O código não chama `pedido.lancar.estoque` nem envia ajustes de estoque ao ERP.

## Cálculo e limites

Disponibilidade de uma peça = máximo entre zero e (saldo físico Olist − reserva Olist − reservas locais ainda não refletidas). A composição do pedido fica registrada ao reservar, incluindo componentes dos conjuntos. Cancelamentos repetidos não devolvem estoque duas vezes. Conjuntos usam o mínimo dos componentes locais; não se importa um saldo independente de kit.

A API V2 de estoque expõe saldos agregados, e o webhook documentado não identifica o pedido que causou um movimento. Portanto, queda de saldo, pagamento aprovado ou NF emitida não comprovam isoladamente a baixa de um pedido. Após uma tentativa de envio do pedido à Olist, os SKUs envolvidos exigem conferência: a rotina não aplica um segundo desconto e o checkout bloqueia novas reservas desses SKUs quando a conciliação está ativa.

O administrador confere a saída **e a liberação da reserva do pedido no ERP**, registra a referência em `/admin/olist`, e uma leitura posterior da Olist substitui o saldo. A evidência e o administrador ficam registrados. A confirmação não lança estoque nem adiciona unidades. Sem confirmação confiável de movimento por pedido, essa etapa ainda é assistida, e não uma conciliação completamente automática de vendas.

Leituras repetidas/mais antigas são descartadas. Erros e snapshots com mais de dez minutos bloqueiam novos checkouts dos componentes gerenciados. O painel mostra modo, saldo físico, reserva do ERP, última leitura e pendências. Editar estoque gerenciado pelo formulário de produto é bloqueado; os ajustes devem ocorrer na Olist.

## Operação

- Servidor: `OLIST_STOCK_ENABLED=true`, token Olist, credenciais Supabase e `CRON_SECRET`. A flag geral `OLIST_ENABLED=true` também habilita leitura, mas não é necessária para este agendamento.
- Execução manual: `node scripts/sync-olist.cjs stock`.
- Rotina agendada: `GET /api/jobs/olist?direction=stock`, com `Authorization: Bearer <CRON_SECRET>`.
- Cada execução atende até 12 peças, com intervalo de quatro segundos entre chamadas e limite interno de tempo. Há uma trava compartilhada com as demais rotinas Olist. Planejar chamadas a cada minuto, sem sobrepor trabalhos longos de catálogo/pedidos.
- Varredura dos 56 componentes: aproximadamente cinco minutos em condições normais com esse agendamento; dois minutos **não são um SLA validado**. Avisos podem reduzir a espera de SKUs alterados.
- Webhook: `POST /api/webhooks/olist/stock?key=<segredo exclusivo>`, com `OLIST_STOCK_WEBHOOK_SECRET` aleatório de no mínimo 32 caracteres. Manter URL/segredo fora de logs e relatórios. Requer configuração de integração/mapeamentos na Olist; os vínculos locais por token V2, sozinhos, não comprovam que webhooks serão enviados.
- O webhook valida segredo, tipo e identidade, limita o corpo a 16 KiB e apenas prioriza uma consulta autenticada. Nunca confia no saldo recebido. A varredura periódica continua necessária para recuperar notificações perdidas.

## Ativação e aceite pendentes

1. Concluído: endpoints e painel publicados, credenciais no servidor, agendamento durável no Supabase.
2. Concluído: snapshots conferidos, saldo físico inicial do short azul M confirmado e conciliação ativada. Novos componentes não são ativados automaticamente: sua origem de saldo/reservas precisa ser conferida antes de mudar `enabled`.
3. Configurar o webhook na Olist e verificar recebimento real; se indisponível no plano, medir o prazo da varredura.
4. Fazer alteração controlada na Olist, confirmar site/kit e reverter o movimento pelo fluxo normal.
5. Fazer compra real controlada: reserva, pagamento, pedido Olist, conferência da baixa automática, nova leitura e eventual cancelamento/estorno. Conferir números dos movimentos e centavos. Não há compra real validada nesta entrega.

Testes locais exercitam reserva de kit, cancelamento repetido, reservas externas, resposta antiga, disputa da última unidade, estoque atrasado, divergência de identidade e movimento automático sem confirmação. A disputa é exercitada como duas tentativas consecutivas no banco de teste; teste de carga concorrente em produção ainda não foi realizado.

Referências oficiais: [consulta de estoque](https://tiny.com.br/api-docs/api2-produtos-estoque), [webhook de estoque](https://tiny.com.br/api-docs/api2-webhooks-atualizacao-estoque), [consulta de pedido](https://tiny.com.br/api-docs/api2-pedidos-obter).
