# Agendador condicionado às filas

O Supabase mantém os mesmos cinco agendamentos. Antes de chamar os workers na Vercel, consulta a existência de trabalho dentro do banco. Fila sem trabalho disponível retorna `NULL`, sem HTTP, leitura de segredo ou registro de execução externa. O cron continua executando a verificação interna; não representa um sistema sem consultas ao banco.

| Rotina        | Quando chama a aplicação                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pagamentos    | `next_sync_at` vencido em pedido real de produção, inclusive pagamentos aprovados que precisam de conferência posterior de estornos                                   |
| E-mails       | Mensagem pendente disponível, envio interrompido há mais de dez minutos ou NF autorizada sem documentos arquivados e com tentativa disponível                         |
| Pedidos Olist | Pedido pendente/incerto ou vínculo cuja última consulta ocorreu há pelo menos cinco minutos                                                                           |
| Notas fiscais | Automação habilitada e trabalho fiscal disponível: nova compra elegível ainda sem job ou job automático não terminal, com tentativa disponível e lease livre/expirado |
| Estoque       | Consulta vencida ou novo SKU físico vinculado que ainda precisa entrar na fila                                                                                        |

Pedidos e notas fiscais também deixam de chamar o worker quando a trava global da Olist já está ocupada. Essa verificação é uma otimização: o worker preserva sua própria trava, pois o estado pode mudar entre o agendamento e a execução. A próxima execução agendada tenta novamente. O estoque mantém a verificação periódica e o prazo de validade exigido pelo checkout. O webhook de estoque continua priorizando uma consulta autenticada do SKU informado.

O worker de pedidos prioriza `pending`/`uncertain` e, na ausência deles, consulta apenas vínculos com mais de cinco minutos. Os horários de retentativa de documentos/e-mail, as tentativas fiscais imutáveis, os IDs da NF, a data de corte da automação e as regras contra duplicidade permanecem preservados. Nenhum status de pedido ou saldo é alterado pela verificação das filas.

As três funções ficam em `private`, com `SECURITY INVOKER`, `search_path` vazio e execução revogada de `PUBLIC`, `anon`, `authenticated` e `service_role`. Os agendamentos existentes executam como `postgres`. Os destinos HTTP e o segredo do Vault continuam fixos. Não são criadas permissões adicionais nem outro cron.

Publicação: implantar primeiro o worker atualizado na Vercel; aplicar somente a migração `conditional_commerce_scheduler` no Supabase original; conferir o predicado de cada fila, as execuções reais do cron e suas respostas HTTP. O domínio da loja na Hostinger não precisa mudar para essa otimização, pois os workers agendados continuam na Vercel.

Os testes executam o SQL em Postgres local embarcado, com transporte HTTP simulado. Cobrem filas vazias, recuperação, candidatos fiscais ainda sem job, data de corte, leases, pedidos já vinculados, bootstrap de estoque, trava ocupada, destinos e isolamento de permissões. A validação em produção consulta os registros do agendador sem criar uma nova compra ou nota fiscal.

## Publicação em 16/10/2026

Worker publicado e promovido na Vercel: `dpl_2Jqp1PvPuyGH2E4bPn549vGGb3DT`. Catálogo HTTP 200 e worker sem credenciais HTTP 401. Migração `20261016155539_conditional_commerce_scheduler.sql` aplicada somente ao Supabase original; nome do arquivo alinhado à versão registrada pelo servidor. Não reexecutar as migrações históricas: o registro remoto contém somente essa migração, enquanto as alterações anteriores já existem no banco.

Às 12:55:51 de Brasília, a verificação real mostrou estoque com trabalho e filas de pagamentos, e-mails, pedidos e NFs sem trabalho disponível. Os cinco agendamentos permaneceram ativos com os mesmos intervalos. As três funções privadas foram conferidas como invoker e sem execução para clientes ou `service_role`. Os dois registros fiscais e os dois conjuntos de documentos existentes permaneceram preservados. Os avisos de segurança anteriores não foram alterados por esta publicação.

Entre 12:56:00 e 12:58:00 de Brasília, os cinco crons concluíram **14 verificações internas**, sem falhas. Houve somente **duas chamadas HTTP externas**, ambas de estoque, concluídas com HTTP 200 e sem timeout. Nenhuma chamada de pagamentos, e-mail, pedidos ou NF foi disparada nessa janela sem pendências. A redução de 14 para duas chamadas refere-se aos disparos dos workers nessa janela; não mede o total de requisições do API Gateway nem representa uma porcentagem fixa para períodos com compras. Às 12:57:30, 19 SKUs já tinham sido consultados após a ativação, confirmando a continuidade da sincronização de estoque.

Validação local: 193 testes aprovados, TypeScript, lint e build Webpack aprovados. Cópia anterior das funções e SQL para reversão operacional ficam em `.local-backups/conditional-scheduler-before-20261016.json` e `.local-backups/conditional-scheduler-rollback-20261016.sql`, fora do deploy.
