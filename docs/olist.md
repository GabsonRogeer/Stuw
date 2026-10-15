# Integração Olist V2

O cadastro usa a categoria principal **Stuw** na Olist, confirmada no painel (ID 363795784). A consulta V2 retorna a lista diretamente em `retorno`, sem o envelope de status descrito na documentação. Exportações param com `category_missing` se a categoria não existir. A importação aceita Stuw e descendentes (por exemplo, `Stuw >> Tops`), ignorando os demais produtos e cadastros com variações.

## Comportamento implementado

- Cada SKU do site corresponde a um cadastro independente na Olist, sem variações: peças avulsas usam classe S e conjuntos usam classe K com os IDs dos componentes. A seleção de tamanho continua agrupada no site. Nome inclui cor e tamanho; descrição, marca, preço, origem, NCM/CEST, unidade, peso, dimensões e imagens são enviados.
- Nos 21 modelos iniciais existem 84 SKUs: 56 peças avulsas e 28 conjuntos em P/M/G/GG. GG começa com zero. Cada conjunto consome um top e um short da mesma cor/tamanho; o saldo é o mínimo dos componentes. Não há estoque independente para conjuntos.
- Reserva, compra mista (peça avulsa + conjunto) e devolução por cancelamento usam transação no banco e trava comum antes das travas de linhas. O cancelamento repetido não devolve os componentes duas vezes. Alterações administrativas recalculam os saldos dos kits; componentes não podem referenciar outros kits.
- Novos produtos elegíveis da Olist entram como **rascunhos**, com texto, fotos suportadas e grade. Publicação exige revisão no painel do site. SKUs incompatíveis, kits e tamanhos não suportados geram pendência; não são renomeados automaticamente.
- O formulário prioriza os campos compartilhados. Opções adicionais da loja continuam disponíveis, preservando valores existentes; identificadores da integração são somente leitura.
- Edições posteriores nos cadastros vinculados sinalizam conflito para revisão; ainda não há resolução automática de alterações concorrentes.
- Inclusão de peça simples envia o saldo inicial atual do site uma única vez; kits não recebem saldo independente. Produtos importados começam com saldo zero (kits derivam dos componentes). A conciliação contínua entre reservas do checkout, saldo Olist e movimentos externos ainda precisa ser implementada antes da operação real integrada. Nunca enviar `estoque_atual` em alterações de cadastro.
- Pedidos reais aprovados são preparados para inclusão com SKU vinculado, CPF/CNPJ validado e total conferido em centavos. Pedidos de teste não são enviados. O CPF/CNPJ fica em tabela restrita ao servidor.
- A consulta de pedidos registra o ID da nota gerada na Olist. **Não emite NF automaticamente**, não lança pagamento financeiro nem compra etiqueta. Falta a validação ponta a ponta da compra real.
- Tentativas de inclusão incertas não são repetidas cegamente: primeiro procuram a identidade existente. Pendências ficam em `/admin/olist`.

## Configuração e execução

No servidor: `OLIST_API_TOKEN`, `OLIST_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL` (HTTPS público com fotos acessíveis) e `CRON_SECRET`. Nunca use prefixo `NEXT_PUBLIC_` para tokens ou segredos.

```sh
npm run olist:check
npm run olist:preflight
node scripts/sync-olist.cjs export
node scripts/sync-olist.cjs import
node scripts/sync-olist.cjs orders
```

Cada execução processa no máximo um registro. O endpoint `GET /api/jobs/olist?direction=export|import|orders` exige `Authorization: Bearer <CRON_SECRET>`. Há uma trava global com expiração para evitar execução concorrente. Configure um agendador no ambiente hospedado, alternando as três direções e respeitando o limite da conta Olist; um comando manual não comprova agendamento. O código e os novos endpoints ainda precisam de deploy.

`OLIST_ENABLED=false` permanece no ambiente local; a carga assistida usa a flag apenas no processo. O domínio `stuw.com.br` respondeu HTML para uma URL de foto; a mesma foto foi confirmada em `https://stuw.vercel.app`. Por isso a carga inicial usa o endereço publicado da Vercel, sem alterar a URL local do desenvolvimento.

## Validação inicial de 14/10/2026

- Migrações `20261014215041_olist_catalog_sync.sql` e `20261014234221_olist_simple_products_and_kits.sql` aplicadas ao Supabase Stuw pela CLI, em transação. O histórico remoto não registra as migrações antigas; não executar `db push` indiscriminadamente.
- Origem fiscal **0** aplicada aos 21 produtos atuais (IDs 1000000–1000020), conforme confirmação do usuário, com auditoria. Script idempotente e restrito: `scripts/sql/olist-initial-origin.sql`. NCM continua dependendo dos dados fiscais corretos.
- `scripts/sql/olist-initial-simple-skus.sql` adicionou GG sem substituir as linhas existentes nem perder a reserva do short azul M. Conferência real: 84 SKUs, 21 GG zerados e 28 kits. Conjunto azul M = mínimo de top 5 / short 3 = 3.
- O primeiro cadastro com variações (363782837) foi inativado e renomeado para `OLD-STUW-MODELO-1000002`. Seus filhos 363782839, 363782847 e 363782853 receberam prefixo `OLD-`; a API ainda os devolve como ativos apesar do pai inativo. Não estão vinculados ao site e são ignorados na importação. A inativação individual deles permanece pendente.
- O primeiro SKU simples `STUW-TOP-AZUL-P` (363797584) teve a categoria Stuw confirmada em duas consultas depois de salva pelo painel. Pre?o 70 e quatro imagens preservados. O worker reconciliou o cadastro sem nova inclus?o; v?nculo no Supabase confirmado como `linked`, sem erro. A classifica??o autom?tica pela API continua sem solu??o confirmada. Posteriormente, o usu?rio autorizou a carga dos demais SKUs com classifica??o manual; veja a se??o de carga assistida abaixo. Diagn?stico em `docs/olist-category-diagnostic.md`; nenhum contato externo foi enviado.
- Uma alteração parcial anterior removeu campos omitidos e exigiu restauração completa. Nunca tratar `produto.alterar` como PATCH; o worker não tenta corrigir categorias por sobrescrita automática.
- Verificação de segurança remota não apontou alertas nas novas tabelas/funções. Permanecem avisos anteriores sobre `public.is_admin()` e proteção contra senhas vazadas.
- Validação local: 131 testes aprovados, lint, checagem de tipos e build de produção concluídos. Testes exercitam 7 tops + 10 shorts = 7 kits, compra mista com falta de saldo, rollback, cancelamento repetido, venda avulsa reduzindo kits e atualização idempotente dos 84 SKUs.

Referências: [incluir produto](https://tiny.com.br/api-docs/api2-produtos-incluir), [alterar produto](https://tiny.com.br/api-docs/api2-produtos-alterar), [consultar produto](https://tiny.com.br/api-docs/api2-produtos-obter), [árvore de categorias](https://tiny.com.br/api-docs/api2-produtos-categorias-arvore), [incluir pedido](https://tiny.com.br/api-docs/api2-pedidos-incluir).

## Carga com classifica??o manual autorizada

O usu?rio autorizou continuar a carga e atribuir Stuw posteriormente pelo painel da Olist. Para essa execu??o assistida, `OLIST_MANUAL_CATEGORY=true` permite vincular um cadastro de categoria vazia; outra categoria continua sendo diverg?ncia. A importa??o permanece restrita a Stuw e descendentes. A flag n?o foi gravada no ambiente nem habilitada em produ??o.

O v?nculo ? salvo com aviso em `olist_skus.last_error`, vis?vel por SKU no painel local da integra??o. `scripts/olist-assisted-load.cjs` limita a execu??o a 84 passos e interrompe em qualquer resultado diferente de v?nculo confirmado ou fila vazia. O intervalo foi aumentado para 12 segundos ap?s uma rejei??o API_6 (limite por minuto); o SKU rejeitado foi consultado duas vezes, confirmado ausente e liberado para nova tentativa. N?o houve repeti??o cega.

Use `node scripts/olist-load-report.cjs` para conferir identidades e gerar `docs/olist-initial-load-report.md`. A confer?ncia tamb?m consulta uma amostra de imagens, composi??o e saldos na Olist. A classifica??o manual posterior ainda exige reconcilia??o da pend?ncia; n?o considerar um aviso antigo como leitura atual da categoria.

Resultado da carga assistida: os 84 SKUs foram vinculados (56 pe?as simples e 28 conjuntos), e a fila terminou em `idle`. Um SKU j? tinha categoria Stuw; os outros 83 receberam pend?ncia de classifica??o manual. Nenhum pedido ou nota foi gerado durante essa carga. Consulte `docs/olist-initial-load-report.md` para a confer?ncia independente e a lista de IDs.

## Atualiza??o: estoque cont?nuo

A rotina de estoque foi implementada, publicada e agendada no Supabase a cada minuto. Os 56 componentes est?o ativos e os 28 conjuntos s?o derivados. A concilia??o de baixa de pedidos ainda exige evid?ncia do movimento no ERP; o envio autom?tico de pedidos n?o foi ativado. O fluxo completo de compra real ainda n?o foi validado. Estado atual e procedimentos em [olist-inventory.md](olist-inventory.md), que substitui as limita??es hist?ricas de estoque descritas acima.
