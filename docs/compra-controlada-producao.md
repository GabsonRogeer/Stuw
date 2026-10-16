# Compra controlada com Pix real

Preparação de 15/10/2026. Usa o banco e o projeto Vercel existentes. Nenhuma migração de ambiente para o novo projeto Supabase STUW faz parte desta execução.

## Produto preparado

- Cadastro no site: `1000021`, slug `top-azul-stuw-teste`, nome **Top Azul STUW Teste**. Publicado no ambiente existente após a validação.
- Total combinado pelo responsável: **R$ 1,00**, com a opção de frete padrão grátis e sem desconto Pix neste produto. Selecionar uma unidade, sem embalagem de presente. As demais opções de entrega continuam com seus preços reais. O preço da etiqueta continua sendo custo da loja.
- NCM informado pelo responsável: `61062000`; origem `0`; unidade `UN`.
- Embalagem informada: 100 g; largura 10 cm, comprimento 10 cm, altura 2 cm.
- Tamanhos P/M/G/GG, fotos e descrição copiados do top azul. Cada SKU de teste é uma composição de uma unidade do top original da mesma cor/tamanho. Não foi acrescentado saldo físico nem alterado o preço do top original.

| SKU de teste           | ID Olist  | Componente de estoque |
| ---------------------- | --------- | --------------------- |
| STUW-TOP-AZUL-TESTE-P  | 364076458 | STUW-TOP-AZUL-P       |
| STUW-TOP-AZUL-TESTE-M  | 364076483 | STUW-TOP-AZUL-M       |
| STUW-TOP-AZUL-TESTE-G  | 364076488 | STUW-TOP-AZUL-G       |
| STUW-TOP-AZUL-TESTE-GG | 364076492 | STUW-TOP-AZUL-GG      |

Os quatro cadastros foram confirmados por leitura após a inclusão. A classificação manual na categoria Stuw permanece pendente, conforme a exceção autorizada para a API V2.

## Proteções implementadas

`CONTROLLED_PRODUCT_IDS` recebe os IDs dos produtos reservados ao teste; `CONTROLLED_BUYER_IDS`, os UUIDs das contas autorizadas. As listas usam vírgulas. A verificação ocorre no frete, antes de reservar o pedido e antes de criar o pagamento. Com produto configurado e nenhuma conta autorizada, a compra é recusada. O ID da conta conferida está somente no arquivo operacional ignorado pelo Git.

`OLIST_INVOICE_ENABLED=true` é necessário, junto de `OLIST_ENABLED=true` e Mercado Pago em `production`, para liberar o faturamento administrativo. O padrão é desativado.

**Admin → Integração Olist → Faturamento de pedidos reais** oferece três operações separadas: gerar a nota, consultar a situação e solicitar autorização. Somente administrador verificado pode executar. O pagamento deve ser real e aprovado; totais, CPF/CNPJ, referência do pedido e SKUs/quantidades são conferidos. Pedidos com reembolso registrado exigem revisão.

A tabela `olist_invoice_jobs` guarda pedido, nota, estado, administrador e momento de cada tentativa. A migração `20261015234201_olist_invoice_workflow.sql` foi aplicada somente ao banco existente. RLS limita leitura a administradores; clientes não escrevem. Identidade da nota e tentativas já registradas não podem ser substituídas ou apagadas pela aplicação.

Não há repetição automática de geração ou emissão. Se a resposta for perdida, consultar a Olist e recuperar o vínculo existente. Uma tentativa sem vínculo confirmado permanece bloqueada para nova emissão. Rejeições fiscais devem ser revisadas na Olist; não zerar tentativas para forçar repetição.

O cadastro do cliente ocorre ao incluir o pedido, se ainda não existir na Olist. Não criar um login fictício no ERP nem copiar dados fiscais para logs. A autorização fiscal é solicitada sem envio automático de e-mail pela Olist; a confirmação da compra continua no fluxo transacional do site. O envio de DANFE/XML ao cliente precisa ser conferido separadamente no aceite.

## Roteiro operacional

1. Concluído: token Melhor Envio de produção aceito; cotação real e embalagem conferidas.
2. Concluído: responsável confirmou o segredo do webhook de **Pagamentos** de produção para `https://stuw.vercel.app/api/webhooks/mercado-pago`. A entrega real do evento ainda precisa ser observada.
3. Concluído: variáveis aplicadas somente em Production, com o banco existente, os ambientes compatíveis, o escopo da compra controlada e SMTP.
4. Concluído: código validado e publicado no projeto existente.
5. Produto publicado: entrar com a conta autorizada, escolher uma unidade P/M/G e a opção de frete grátis; conferir total R$ 1,00 antes de gerar Pix. O pagamento é feito pelo responsável no aplicativo bancário.
6. Confirmar `live_mode=true`, recebedor, BRL, valor e referência pela API do Mercado Pago e observar o webhook originado pelo provedor.
7. Incluir e conferir pedido/cliente na Olist; gerar NF, revisar tributação e ambiente fiscal na Olist, solicitar autorização e conferir chave, XML e protocolo de produção. O responsável confirmou que a empresa já emite NF pela Olist. Não inferir autorização a partir da simples existência de um ID de nota.
8. Conferir a baixa automática do componente original e a liberação da reserva ERP, registrar a evidência no admin e solicitar nova leitura. Não lançar estoque uma segunda vez.
9. Concluir etiqueta, postagem, rastreio e e-mail. Conciliar mercadoria, desconto Pix, frete, total pago e total fiscal. Taxas do gateway são registradas separadamente do valor pago pelo cliente.
10. Arquivar o produto ao encerrar. Preservar pedido, vínculos e nota fiscal; não apagar o histórico para limpar o teste.

## Validação do deploy

- Deploy `dpl_2bJNCDKBTjoVtWSn3ofPuFFf1JPL` concluído e promovido ao endereço existente `https://stuw.vercel.app`.
- Novo token Melhor Envio aceito em produção (HTTP 200). Conta Mercado Pago consultada e compatível com o recebedor informado; não é conta fictícia de teste. O responsável confirmou a configuração do webhook de produção.
- SMTP: conexão TLS e autenticação verificadas localmente; o job publicado também verificou SMTP sem falhas.
- Home e produto retornaram HTTP 200. Jobs publicados de pagamentos e e-mail responderam HTTP 200; chamadas não autenticadas e webhook sem assinatura retornaram HTTP 401.
- A cotação real para o endereço já salvo da conta autorizada ofereceu Loggi Express a R$ 10,30; a opção padrão foi subsidiada para preço ao cliente R$ 0,00, preservando `carrierPrice`. O cálculo do carrinho confirmou total Pix de R$ 1,00.
- `freeShipping` e `pixDiscountEligible` são configurações por produto no admin. A migração `20261016001356_product_checkout_benefits.sql` mantém o desconto Pix autoritativo no banco, inclusive em sacolas mistas, e preserva as regras normais dos demais produtos. O produto de teste usa `freeShipping=true` e `pixDiscountEligible=false`.
- O job de pagamentos filtra pedidos pelo ambiente configurado. Pedidos antigos de teste não são consultados com as credenciais reais.
- Agendamentos duráveis instalados pela migração `20261016002431_commerce_background_jobs.sql`, com destinos fixos e segredo no Vault: pagamentos e e-mail a cada minuto; pedidos Olist a cada 30 segundos para reduzir disputa com a leitura de estoque. As três chamadas feitas pelo Supabase receberam HTTP 200 antes da ativação. Os agendamentos estão ativos e registram requisições em `private.commerce_job_runs`; o estoque mantém seu agendamento anterior. Gerar ou autorizar NF continua sendo uma ação administrativa separada.
- 150 testes passaram após os benefícios por produto; TypeScript, lint e build aprovados. O agendamento durável tem teste próprio adicional.
- A compra, o webhook, o pedido/cliente, a autorização fiscal e o envio dos documentos foram conferidos na execução real abaixo. O envio físico continua pendente. Os diagnósticos não criaram outra cobrança.

## Execução real conferida em 16/10/2026

- Pedido do site **STUW-1NLLAX**, uma unidade P do produto de teste. Pagamento Mercado Pago `183387908763`: `approved`, `live_mode=true`, BRL, recebedor e referência do pedido conferidos pela API autenticada, sem reembolso.
- Conciliação: mercadoria R$ 1,00; frete ao cliente R$ 0,00; desconto Pix R$ 0,00; total pago R$ 1,00. Taxa efetiva Mercado Pago R$ 0,01; líquido R$ 0,99. O custo logístico da loja ainda depende da compra da etiqueta.
- Logs da Vercel registram notificações do agente Mercado Pago com HTTP 200 às 00:57:54 e 00:58:17 UTC. Há também chamadas desse agente recusadas com HTTP 401; não se deve desativar a validação de assinatura para aceitá-las.
- Confirmação da compra: outbox `purchase_confirmation`, estado `sent`, uma tentativa, enviada às 00:59:02 UTC. Isso comprova aceite do servidor SMTP; leitura/entrega na caixa de entrada depende da conferência do destinatário.
- Pedido Olist **76**, ID `364085176`, referência e total R$ 1,00 conferidos. Consulta de contatos pelo documento do checkout encontrou exatamente um cadastro, ID `896722067`, com o e-mail correto. Nenhum dado pessoal foi copiado para este relatório.
- Uma única geração fiscal foi solicitada. Nota **75, série 1**, ID `364101593`, vinculada ao pedido. A primeira resposta omitiu o ID esperado; o vínculo foi recuperado consultando o pedido, sem repetir a geração.
- **NF autorizada:** após o responsável corrigir o NCM na própria nota, uma única solicitação de emissão foi concluída. O XML confirmou `tpAmb=1` tanto na nota quanto no protocolo, `cStat=100`, protocolo presente, modelo 55, número 75, série 1, destinatário, componente `STUW-TOP-AZUL-P`, NCM `61062000`, quantidade 1 e total R$ 1,00. Chave e XML completos ficam no armazenamento privado.
- A correção aceita itens desmembrados somente quando SKUs e quantidades coincidem exatamente com os componentes registrados na reserva original do checkout. Não consulta a composição atual para substituir o histórico. NCM e CFOP ausentes bloqueiam a conferência fiscal. A função de leitura foi aplicada apenas ao banco existente, com acesso exclusivo do servidor, pela migração `20261016031440_olist_invoice_component_validation.sql`.
- Estoque original P conciliado após lançamento único autorizado da nota 75: físico Olist **4**, reservado **0**, disponível no site **4**. A evidência foi registrada na reserva original e uma leitura posterior à confirmação foi aplicada. Nenhuma segunda unidade foi descontada no site.
- DANFE de uma página e XML autorizado foram vinculados ao pedido no bucket privado `order-invoices`, com hashes SHA-256 conferidos. A tabela `order_invoice_documents` oferece ao cliente somente os metadados de seu pedido; caminhos e chave não são expostos. Downloads exigem sessão verificada e titularidade do pedido antes de ler os arquivos com acesso do servidor. As consultas de produção confirmaram leitura pelo titular e nenhuma linha visível a outro cliente.
- E-mail `invoice_available` aceito pelo SMTP em uma tentativa, às **03:55:54 UTC de 16/10/2026**, com DANFE PDF (122.276 bytes) e XML (7.304 bytes). Assunto **Sua nota fiscal chegou · Pedido STUW-1NLLAX | STUW**. HTML no padrão STUW; prévia em `emails/previews/invoice.html`. O aceite SMTP não comprova leitura na caixa de entrada.
- O vínculo dos documentos enfileira uma única notificação por pedido e tipo. O job de e-mail prepara documentos de notas já autorizadas, com conferência de identidade, ambiente, destinatário, itens e valor. Falhas antes do SMTP podem tentar novamente; resultado SMTP incerto exige conciliação manual. Nunca repetir emissão fiscal para recuperar documentos.
- Baixa física e estoque conciliados. Etiqueta, postagem e rastreio foram adiados pelo responsável; o critério de aceite que inclui envio físico permanece aberto.
- Correção fiscal publicada em `dpl_Qc5CbtV1wHdozcKnLTXLG52HgoMH`, produção `https://stuw.vercel.app`. Seis testes fiscais passaram, incluindo composição, NCM/CFOP, recuperação da resposta incompleta e proteção de acesso; TypeScript, lint e build da Vercel aprovados.

## Entrega dos documentos fiscais

A migração `20261016033746_order_invoice_delivery.sql` foi aplicada apenas ao banco existente. Documentos ficam em bucket privado, sem acesso direto de clientes ao Storage. Metadados têm RLS por titularidade; clientes não inserem, alteram ou apagam os vínculos. O servidor confere hashes antes de baixar ou anexar arquivos ao e-mail. O XML original é preservado e o PDF é uma impressão do HTML oficial da Olist, sem JavaScript e com requisições externas restritas ao CSS oficial.

Fluxo publicado em **`dpl_FmSQcuaWu8vw7bWjnEbnbfnrdJcD`**, no domínio existente. A primeira preparação foi concluída pelo fluxo operacional; a função de produção recebeu inclusão explícita dos binários Chromium. A verificação somente de leitura da Vercel retornou **HTTP 200**, `status=verified`, PDF de 76.947 bytes, sem reenviar e-mail ou criar outra nota. O arquivo já enviado ao cliente permanece íntegro, com 122.276 bytes.

A suíte completa passou com **158 testes**. Os testes relevantes foram repetidos após o diagnóstico de PDF. TypeScript, lint e build aprovados; DANFE de uma página e HTML STUW revisados visualmente. Download sem sessão respondeu 401 e `Cache-Control: private, no-store`; RLS de produção confirmou acesso do titular e zero documentos para outra identidade. O envio fiscal permanece registrado como `sent`, uma tentativa, sem erro.

O diagnóstico operacional `GET /api/jobs/email?verifyInvoice=<order_uuid>` exige o mesmo segredo de cron. Ele reconfirma vínculo, XML e PDF, sem gravar arquivos ou enviar mensagens. O job normal prepara no máximo uma nota autorizada por execução e segue enviando as confirmações de compra mesmo se um documento fiscal estiver indisponível.

## Conferência de estoque após a compra

Em 16/10/2026, após a autorização fiscal, os **56 SKUs físicos** estavam com conciliação ativa e leituras recentes, sem saldos ativos vencidos há mais de dez minutos. A única pendência era `STUW-TOP-AZUL-P`: a API da Olist ainda retornava físico **5** e reservado **1**, enquanto o catálogo público do site já apresentava **4**. O histórico registra uma reserva 5 → 4 vinculada ao pedido, com atualização derivada do conjunto azul P e do produto de teste para o mesmo saldo 4. Não houve lançamento de estoque pela integração.

A proteção de novas compras desses SKUs foi mantida durante a conferência. A confirmação exigiu o lançamento específico da nota, reconhecido pela Olist, e a mudança dos saldos físicos e reservados; não foi inferida apenas da autorização da NF ou de um saldo agregado.

O responsável confirmou que a regra estava **Manual** e foi alterada para **Automático ao autorizar a nota fiscal**. A Olist documenta que essa configuração vale para notas geradas após a ativação. Para a nota 75, anterior à mudança, o responsável autorizou expressamente um único lançamento de estoque. Em **16/10/2026 às 04:21 UTC**, a operação `nota.fiscal.lancar.estoque.php`, vinculada exclusivamente à NF 75/1, foi reconhecida pela API. A conferência comprovou físico **5 → 4**, reservado **1 → 0**; evidência registrada e reserva local conciliada. A leitura posterior retornou `synced`, sem erro. Top azul P, conjunto azul P e produto de teste permaneceram com **4 disponíveis**. O histórico registrou apenas a redução física e a liberação da reserva ERP, sem segunda redução local. O bloqueio desse componente foi removido e não restaram pendências nos SKUs com conciliação ativa.

**Etiqueta e postagem adiadas pelo responsável**, enquanto a conta Melhor Envio é validada. Não comprar etiqueta nem marcar o pedido como enviado para provocar baixa de estoque.

O checkout local foi desabilitado (`COMMERCE_ENABLED=false`) enquanto o arquivo local contém credenciais reais. Restabelecer credenciais de teste antes de reativá-lo para desenvolvimento.

## Diagnóstico

`node scripts/production-preflight.cjs <project-ref> [--online]` valida o ambiente fornecido ao processo e não cria pedidos, pagamentos, clientes ou notas. O script não carrega `.env.local`. Ao usar `vercel env run`, executar a CLI em diretório isolado: a própria CLI carrega `.env.local` quando iniciada no diretório do projeto, mesmo que o script não o faça. Segredos ocultados pela Vercel não comprovam configuração válida. Para esta operação, o projeto esperado é o banco existente, não o novo projeto STUW.

Referências: [pedido e cadastro de cliente](https://tiny.com.br/api-docs/api2-pedidos-incluir), [gerar nota do pedido](https://tiny.com.br/api-docs/api2-pedidos-gerar-nota-fiscal), [solicitar emissão](https://tiny.com.br/api-docs/api2-notas-fiscais-emitir), [situações fiscais](https://tiny.com.br/api-docs/api2-tabelas-notas-fiscais).
