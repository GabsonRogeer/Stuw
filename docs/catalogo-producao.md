# Catálogo de produção STUW

Cadastro inicial preparado em 13/10/2026 a partir do documento fornecido e das confirmações do responsável.

| Tipo     | Categoria     | Cores | Preço     |
| -------- | ------------- | ----- | --------- |
| Top      | Tops/Croppeds | 7     | R$ 70,00  |
| Short    | Shorts        | 7     | R$ 80,00  |
| Conjunto | Conjuntos     | 7     | R$ 150,00 |

- Cores: Azul, Preto, Branco, Grafite, Rosa, Vermelho e Azul Marinho.
- Linha de uso: Training (`Activewear / Training`).
- Grade confirmada: P, M e G.
- Estrutura: 21 produtos separados, uma cor por produto, 63 SKUs.
- Estoque inicial: zero; estoque dos conjuntos independente das peças avulsas.
- Status: rascunho. Nenhum dos novos produtos é publicado automaticamente.
- Ocasião removida do cadastro, filtros, links e recomendações.

## Fotos

As 42 imagens das sete pastas `public/products/stuw-{cor}` foram conferidas visualmente. O mapeamento explícito está em [production-products.ts](../src/data/production-products.ts).

Top usa close frontal quando disponível; Short usa foto frontal da peça ou corpo inteiro quando não há imagem isolada; Conjunto usa a vista de corpo inteiro. Imagens com duas peças não significam que ambas estejam incluídas na compra do Top ou do Short.

Os arquivos `detalhe1.jpg` e `detalhe2.jpg` têm conteúdos diferentes conforme a cor. No Azul Marinho, nenhum deles mostra o bolso; nenhum texto alternativo afirma que essa foto exista. Os hexadecimais sugeridos no anexo foram mantidos como referências visuais provisórias.

## Dados pendentes

Antes de publicar, preencher peso em gramas e dimensões da peça embalada em centímetros. Antes de disponibilizar para compra, informar o estoque real por SKU. Composição, tecnologia, compressão, suporte, cuidados, tabela de medidas, EAN/GTIN, NCM e CEST permanecem vazios quando não confirmados. Nenhum dado de embalagem de teste foi usado na importação.

Os textos comerciais não incluem os marcadores internos `A CONFIRMAR`.

## Substituição do catálogo

O catálogo estático foi esvaziado para impedir o retorno de produtos antigos e a exposição de rascunhos. O catálogo público passa a depender dos produtos efetivamente publicados no banco.

A operação pontual [replace-catalog.sql](../supabase/operations/replace-catalog.sql) remove produtos, pedidos, cotações de atacado e frete e seus registros dependentes. Preserva contas, perfis, endereços, cupons, configurações de atacado e banners. Os contadores de cupons são ajustados apenas pelos usos removidos. As sequências de IDs não são reiniciadas.

Essa operação não é uma migração de esquema e **não deve ser repetida**. A presença de qualquer slug novo aborta a execução. O arquivo efetivamente aplicado inclui comparação com o backup, dentro da transação, para abortar se registros tiverem mudado.

O backup com dados de clientes fica em `.local-backups/catalog-reset/before.json`, ignorado pelo Git e pelo deploy. Não publicar esse diretório. A operação foi testada em Postgres/PGlite, incluindo rollback por falha, proteção contra repetição, integridade referencial e preservação das contas.

## Manutenção

Usar `/admin/produtos` para revisar e publicar os cadastros. Não editar o catálogo estático e não reaplicar a operação inicial para alterar preços ou estoque.

O módulo `production-products.ts` registra os dados aprovados da importação, não é uma fonte pública alternativa. Os produtos antigos usados em testes ficam isolados em `tests/fixtures/products.ts`.

## Execução e publicação

A substituição foi aplicada ao projeto Supabase STUW: 4 pedidos e 2 cotações de atacado anteriores foram removidos, com seus registros dependentes. Foram criados os 21 rascunhos e 63 SKUs.

O site foi publicado em [stuw.vercel.app](https://stuw.vercel.app), no deploy `dpl_CscCY1xmdLeFLkrDc9A6EgMwpHph`. Validação: 99 testes, lint, checagem de tipos, build local e remoto e testes HTTP do site online.

Edições posteriores no painel são preservadas. Durante a conferência final, o Top Stuw Azul já havia sido ativado com estoque 5 por tamanho e embalagem marcada como teste; a importação não foi reaplicada sobre essa edição. O backup e a verificação local registram o estado da operação, não substituem a consulta ao painel para acompanhar alterações futuras.

### Ativação posterior — 13/10/2026

Por solicitação do responsável, os 21 produtos foram ativados com estoque de 5 unidades para cada tamanho P, M e G: 63 SKUs e 315 unidades no total. O responsável confirmou repetir a embalagem de teste de 300 g e 30 × 20 × 5 cm nos campos vazios, mantendo sua identificação como teste. Preços, descrições, fotos e demais edições existentes foram preservados.

A atualização foi transacional, com conferência de revisão, registro de auditoria e sincronização entre cadastro, SKUs e catálogo público. Backup e resultado da verificação ficam em `.local-backups/activate-products/`. Não foi necessário outro deploy para essa alteração de dados. O módulo de importação continua registrando os rascunhos originais e não deve ser reaplicado.
