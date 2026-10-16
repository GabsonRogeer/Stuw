# Checkout e conta — 16/10/2026

## Pix

- Cartão com o visual STUW, barra em três etapas de dez minutos, prazo restante, QR Code e botão de copiar. A contagem usa a expiração persistida pelo provedor; não reinicia ao recarregar ou voltar à aba.
- O pagamento existente inclui margem de transporte de cinco minutos sobre os trinta mínimos do Mercado Pago. Essa validade foi preservada. Antes dos trinta minutos finais, as três barras permanecem completas e o prazo real continua visível; depois, as etapas acompanham os trinta minutos finais. Nenhuma etapa renova o Pix.
- Confirmação consultada a cada cinco segundos enquanto a aba está visível e ao retornar a ela. A sincronização com o provedor mantém seu limite de quinze segundos; o webhook continua sendo processado normalmente.
- Ao aprovar, o QR Code e o contador desaparecem. A tela informa pagamento concluído, confirmação da compra por e-mail e envio da NF quando emitida. Não afirma emissão fiscal antes da autorização.
- Códigos vencidos ficam indisponíveis, mas a conciliação continua para reconhecer pagamentos confirmados com atraso.

## Conta e checkout

- Conta usa cartões, campos, navegação e fundo em vidro do admin; inclui acesso superior à loja e mantém as verificações de sessão e permissão existentes.
- Checkout mantém o cabeçalho padrão fixo, sem remover os passos, resumo, recuperação de pedido ou proteção contra novas tentativas indevidas.
- Prévia local renderizada com componentes reais e dados fictícios, sem gerar cobrança: desktop e celular, claro e escuro, pendente e aprovado. Corrigida a largura mínima do menu da conta para evitar rolagem horizontal da página no celular.

## Protocolo de pedido

Migrações `20261016044039_dated_order_protocol.sql` e `20261016045944_numeric_order_protocol.sql` aplicadas somente ao banco existente em 16/10/2026. A segunda atende à revisão do responsável: números após o prefixo e permissão para ultrapassar vinte caracteres.

Formato atual: `STW-` + data `DDMMAAAA` + hora `HHMM` de Brasília + identificação numérica estável do cliente (mínimo seis dígitos) + sequência diária de quatro dígitos. Exemplo: `STW-1610202601370001230001`, normalmente **26 caracteres**. Identificações de clientes com mais de seis dígitos crescem sem truncamento. A sequência permite até 9.999 pedidos por cliente/dia; a restrição impede reutilizar o sufixo ao atingir o limite.

O identificador numérico está associado internamente ao UUID do cliente; não divulga seu UUID, documento ou e-mail e não serve como credencial de acesso. A sequência distingue compras do mesmo cliente na mesma data, com incremento atômico, inclusive no mesmo minuto. Pedidos históricos, protocolos alfanuméricos anteriores, referências importadas, UUIDs e números de demonstração permanecem inalterados. O pedido real STUW-1NLLAX foi conferido após a migração e conserva seu número. Sequências de identidade podem ter lacunas quando uma transação é revertida; esses números não representam contagem de clientes.

Tabelas de associação e contadores ficam no schema privado, com RLS e sem leitura ou execução direta por clientes. A função só é executada pelo trigger interno. Verificação remota confirmou essas permissões e a ordem dos triggers.

## Validação

- 160 testes passaram; TypeScript e lint aprovados.
- Testes cobrem limites das etapas, validade real, suspensão da aba, aprovação tardia, limpeza dos timers, calendário de Brasília, compras repetidas, sequência base 36, preservação histórica e acesso negado às tabelas privadas.
- Auditoria do Supabase sem novas advertências: os avisos existentes de [`is_admin`](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção de senha vazada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) permanecem anteriores à alteração; ausência de políticas nas novas tabelas privadas é intencional, pois clientes não têm acesso.
- Nenhuma nova cobrança, nota fiscal, mensagem ao cliente ou baixa de estoque foi gerada para validar estes ajustes.
- Revisão numérica: dois testes de banco passaram (protocolo anterior e migração para o protocolo decimal), incluindo calendário e hora de Brasília, repetição no mesmo minuto, crescimento do ID, referências importadas, preservação histórica e restrições de acesso. Como a regra é executada pelo trigger já existente, ela entra em vigor no banco sem novo deploy da aplicação.
- Deploy final `dpl_8seGJuDUd5Pcs5nS79poFX584agq`, Next.js 16.3.6, build e TypeScript aprovados. Promovido ao endereço existente `https://stuw.vercel.app`.
- Conferência após a promoção: home, catálogo e login HTTP 200; conta e checkout sem sessão redirecionam ao login (307); job de e-mail sem segredo continua recusado (401). A conferência visual utilizou dados fictícios e não substitui uma nova compra real ponta a ponta, que não foi executada nesta alteração.

## Diagnóstico de cotação local

Após relato de “Melhor Envio temporariamente indisponível”, a configuração local foi conferida: `MELHOR_ENVIO_ENVIRONMENT=sandbox` com token aceito apenas em produção. A API de conta retornou HTTP 401 no sandbox e HTTP 200 em produção; a cotação de produção retornou HTTP 200 com onze serviços, usando embalagem de 100 g e 10 × 10 × 2 cm e CEP público de diagnóstico.

Alterado somente `MELHOR_ENVIO_ENVIRONMENT=production` no arquivo local ignorado pelo Git. A função `calculateShipping` usada pelo checkout retornou onze serviços após o ajuste. `COMMERCE_ENABLED=false` foi preservado: nenhuma cobrança local foi habilitada. A Vercel já informa ambiente de frete `production`; seu token não pôde ser exportado por ser sensível. O local exato do erro relatado ainda depende da confirmação solicitada ao responsável; não se concluiu falha nem correção da cotação publicada com base apenas no teste local.

## Medidas reais do catálogo

O responsável esclareceu que o bloqueio exibido era de embalagem de teste e forneceu as medidas reais para todas as cores. Em 16/10/2026, o script operacional `scripts/sql/production-shipping-packages.sql` foi aplicado ao banco existente:

| Tipo | Produtos | Comprimento | Largura | Altura | Peso embalado |
| --- | --- | --- | --- | --- | --- |
| Top/cropped | 7 | 25 cm | 20 cm | 3 cm | 150 g |
| Short | 7 | 25 cm | 22 cm | 3 cm | 170 g |
| Conjunto | 7 | 25 cm | 22 cm | 6 cm | 270 g |

O conjunto utiliza os **270 g explicitamente fornecidos**, sem derivar 320 g da soma do top e do short. O produto de R$ 1 manteve sua embalagem específica de 100 g e 10 × 10 × 2 cm.

A correção alterou apenas peso, comprimento, largura, altura e a marca de embalagem de teste. Cada um dos 21 produtos recebeu nova revisão e snapshot no histórico privado. A transação verifica que os demais campos do documento permanecem idênticos. Estoques, SKUs, preços, projeções públicas, pedidos e cotações anteriores não foram regravados. A primeira tentativa foi revertida integralmente por ambiguidade de alias na verificação SQL; após correção, a transação foi concluída e a leitura posterior conferida.

Verificação: zero produtos ativos com embalagem de teste, 21 snapshots atuais de auditoria e os 84 vínculos de SKUs originais ainda `linked`. O trigger normal de catálogo registra divergência de conteúdo no vínculo do produto com a Olist para revisão; nenhum cadastro remoto completo foi sobrescrito, e a conciliação de estoque continua usando os vínculos dos SKUs. Esta correção aplica a embalagem do checkout do site, sem afirmar que as medidas foram atualizadas na Olist.

Validação usando a função real `quoteCheckout`, catálogo atual e API de produção do Melhor Envio, com CEP público de diagnóstico: top, short e conjunto retornaram **dez opções de frete cada**. Os produtos enviados à cotação foram conferidos contra as novas medidas. A persistência de cotações foi substituída por memória no diagnóstico: nenhum cliente, pedido, cobrança ou etiqueta foi criado. A alteração é de dados e entra em vigor sem deploy; um checkout que já mostra a mensagem deve usar **Recalcular frete**.
