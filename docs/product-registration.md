# Cadastro de produtos — STUW

## Stack e operação

Next.js 16.3 (App Router), React 19, TypeScript e Tailwind. Supabase/PostgreSQL,
Supabase Auth e `@supabase/ssr`; acesso pelo cliente Supabase, sem ORM. Imagens
existentes continuam em `public/products/`; novos uploads usam o bucket público
`product-images`, limitado a administradores para escrita.

Entrada: **Administração → Produtos** (`/admin/produtos`). Há busca, filtro de
status, paginação, criação, edição e arquivamento. O formulário agrupa os dados em
seções expansíveis. Cores e imagens podem ser reordenadas; a grade gera SKUs editáveis.

**Obrigatório:** “Sim” vale para salvar; “Publicar” vale para ativar; “Condicional”
depende de outro campo. Valores comerciais, fiscais, estoques e medidas existentes
não são presumidos reais. A importação de um produto estático começa em rascunho,
com estoque zero e identidade preservada.

## 1. Identificação e conteúdo

| Campo                              | Tipo de dado     | Obrigatório | Validação / regra                                                            | Exemplo                      | Observação                                            |
| ---------------------------------- | ---------------- | ----------- | ---------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- |
| ID                                 | integer          | Automático  | Imutável; novos IDs a partir de 1.000.000                                    | 1000000                      | IDs legados são preservados                           |
| Nome do modelo (`name`)            | texto            | Sim         | 1–160 caracteres; cadastrar o modelo sem sufixo de cor                       | STUW Sculpt Set              | Não se remove cor automaticamente de nomes existentes |
| Slug (`slug`)                      | texto            | Sim         | Até 160; minúsculas, números e hífens; único inclusive entre URLs históricas | stuw-sculpt-set              | Não muda automaticamente após a criação               |
| Descrição curta (`summary`)        | texto            | Não         | Até 300 caracteres                                                           | Conjunto de compressão média | Fallback da descrição SEO                             |
| Descrição completa (`description`) | texto            | Publicar    | Até 10.000 caracteres; texto simples                                         | Legging e top…               | Sem HTML executável                                   |
| Destaques (`highlights`)           | texto multilinha | Não         | Até 10.000; um destaque por linha                                            | Secagem rápida               | Conteúdo editorial armazenado                         |
| Marca (`brand`)                    | texto            | Publicar    | Até 80; padrão STUW                                                          | STUW                         | Usada no Product estruturado                          |

## 2. Classificação

| Campo                             | Tipo de dado | Obrigatório | Validação / regra                                                                 | Exemplo               | Observação                            |
| --------------------------------- | ------------ | ----------- | --------------------------------------------------------------------------------- | --------------------- | ------------------------------------- |
| Tipo de peça (`category`)         | enum textual | Publicar    | Uma opção do vocabulário existente                                                | Conjuntos             | Preserva filtro `categoria`           |
| Linha de uso (`activityCategory`) | enum textual | Publicar    | Training, Running, Studio, Lifestyle, Tennis ou Recovery com seus prefixos atuais | Activewear / Training | Também aceita pelo filtro `categoria` |
| Ocasião (`occasion`)              | enum textual | Não         | Vocabulário existente, incluindo High Impact e Recovery & Lounge                  | Studio & Mindful      | Preserva `ocasiao`                    |
| Gênero (`gender`)                 | enum textual | Não         | Feminino, Masculino ou Unissex                                                    | Feminino              | Não inferido pela imagem              |
| Coleção (`collection`)            | texto        | Não         | Até 1.000 caracteres                                                              | Sculpt                | Preserva filtro `colecao`             |
| Tags (`tags`)                     | texto        | Não         | Até 1.000; separadas por vírgula                                                  | yoga, básico          | Armazenadas; sem novo filtro público  |

Tipos de peça: Conjuntos; Leggings & Calças; Tops & Sutiãs; Macacões & Bodies;
Alfaiataria Esportiva; Tennis & Saias; Acessórios & Wellness.

## 3. Tecido e atributos de moda

| Campo                       | Tipo de dado      | Obrigatório | Validação / regra                                           | Exemplo                     | Observação                               |
| --------------------------- | ----------------- | ----------- | ----------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| Tecnologia (`fabric`)       | enum textual      | Não         | SilkAir, SculptHold, VelvetNulu ou ShieldAir                | SculptHold                  | `™` é apresentação; preserva `tecido`   |
| Composição (`composition`)  | texto estruturado | Não         | `Material: percentual`; partes separadas por `;`; soma 100% | Poliamida: 80; Elastano: 20 | Até 1.000 caracteres; exibida no produto |
| Modelagem (`fit`)           | texto             | Não         | Até 1.000                                                   | Ajustada                    | Mapeia `feelTag` atual                   |
| Cintura (`waist`)           | enum textual      | Não         | Alta, Média, Baixa, Não se aplica                           | Alta                        | Não inventar para acessórios             |
| Compressão (`compression`)  | enum textual      | Não         | Leve, Média, Alta, Não se aplica                            | Média                       | Não equivale a suporte                   |
| Suporte (`support`)         | enum textual      | Não         | Leve, Médio, Alto, Não se aplica                            | Alto                        | Especialmente tops                       |
| Cuidados (`care`)           | texto multilinha  | Não         | Até 10.000                                                  | Lavar à mão                 | Exibidos no produto                      |
| Ficha técnica (`technical`) | texto chave/valor | Não         | Uma linha `chave: valor`; até 10.000                        | Forro: duplo                | Não substitui campos estruturados        |

## 4. Cores

A hierarquia é **Produto → Cor → Tamanho/SKU**. Uma combinação bicolor vendida
como conjunto é uma única cor comercial; Beige / Black não vira dois produtos.
A identidade da cor é `(product_id, slug)`; não há catálogo global compartilhado
de cores nesta implementação.

| Campo                       | Tipo de dado               | Obrigatório  | Validação / regra                                    | Exemplo                       | Observação                                    |
| --------------------------- | -------------------------- | ------------ | ---------------------------------------------------- | ----------------------------- | --------------------------------------------- |
| Vínculo com produto         | FK integer                 | Automático   | Cor pertence a um único produto                      | 1000000                       | Integridade referencial no banco              |
| Nome (`colors[].name`)      | texto                      | Sim, por cor | 1–80; único no produto sem diferenciar maiúsculas    | Mocha                         | Valor público do filtro de cor                |
| Slug (`colors[].slug`)      | texto                      | Sim, por cor | 1–80; minúsculas, números e hífens; único no produto | mocha                         | Identidade da variação                        |
| Hex (`colors[].hex`)        | texto                      | Condicional  | `#` e seis dígitos hexadecimais                      | #8B6B55                       | Obrigatório se não houver imagem de amostra   |
| Amostra (`colors[].swatch`) | caminho de imagem          | Não          | Mesmo conjunto de caminhos permitido às imagens      | /products/sculpt/amostra.webp | Alternativa ao hex; exibida no seletor        |
| Ordem                       | integer / posição no array | Automático   | A partir de zero; controlada por “Mover acima”       | 0                             | Persistida na entidade Cor                    |
| Cor padrão                  | derivado                   | Publicar     | Primeira cor ativa da ordem                          | Mocha                         | Evita dois indicadores de padrão conflitantes |
| Status (`colors[].active`)  | boolean                    | Sim, por cor | Apenas cores ativas vão à publicação                 | true                          | Inativar preserva o cadastro                  |

## 5. Tamanhos e SKUs

| Campo                    | Tipo de dado   | Obrigatório  | Validação / regra                                                      | Exemplo             | Observação                                       |
| ------------------------ | -------------- | ------------ | ---------------------------------------------------------------------- | ------------------- | ------------------------------------------------ |
| Grade (`sizes`)          | array de enum  | Publicar     | Subconjunto único de PP, P, M, G, GG e Único                           | P, M, G             | Não cria combinações vendáveis até gerar SKUs    |
| Produto + cor + tamanho  | chave composta | Sim, por SKU | Combinação única no banco                                              | Sculpt / Mocha / P  | Apenas combinações cadastradas são vendáveis     |
| Tamanho (`skus[].size`)  | enum           | Sim, por SKU | Deve pertencer à grade do produto                                      | P                   | Até seis SKUs por cor; Único preserva acessórios |
| Código (`skus[].code`)   | texto          | Sim, por SKU | 1–64; letras maiúsculas, números, `_`, `-`; único global               | STUW-SCULPT-MOCHA-P | Sugestão gerada pode ser editada antes de salvar |
| EAN/GTIN (`skus[].gtin`) | texto          | Não          | 8, 12, 13 ou 14 dígitos; dígito verificador válido; único se informado | 7894900011517       | Preserva zeros iniciais                          |
| Estoque (`skus[].stock`) | integer        | Sim, por SKU | 0–1.000.000; não negativo                                              | 12                  | Zero desabilita compra; estoque não é estimado   |
| Ativo (`skus[].active`)  | boolean        | Sim, por SKU | Ao menos um ativo por cor para publicar                                | true                | Pode estar ativo e sem estoque                   |

O checkout existente é demonstrativo: confere variante, preço e quantidade no
servidor, mas **não reserva nem baixa estoque**. Venda real exige integração com
pagamento/reservas. Não confundir estoque cadastrado com uma reserva transacional.

## 6. Preços, promoções e atacado

| Campo                                  | Tipo de dado         | Obrigatório | Validação / regra                                             | Exemplo              | Observação                                                                  |
| -------------------------------------- | -------------------- | ----------- | ------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------- |
| Moeda                                  | constante            | Automático  | BRL                                                           | BRL                  | Sem edição                                                                  |
| Preço base (`price`)                   | decimal BRL          | Publicar    | Maior que zero para publicar; até R$ 1.000.000,00; duas casas | 650,00               | Checkout converte para centavos inteiros                                    |
| Preço anterior (`comparePrice`)        | decimal BRL          | Não         | Maior que o preço base                                        | 749,00               | Exibido riscado quando maior que o preço selecionado                        |
| Sobrescrita por cor (`colors[].price`) | decimal BRL nullable | Não         | Não negativo; duas casas; vazio herda                         | 670,00               | Nunca usar zero para representar ausência                                   |
| Sobrescrita por SKU (`skus[].price`)   | decimal BRL nullable | Não         | Não negativo; duas casas; vazio herda                         | 690,00               | Tem precedência sobre cor e produto                                         |
| Custo (`cost`)                         | decimal BRL nullable | Não         | Não negativo; duas casas                                      | 210,00               | Privado; não enviado à vitrine                                              |
| Promoção (`salePrice`)                 | decimal BRL nullable | Condicional | Menor que preço base; exige vigência completa                 | 599,00               | Vale no nível do produto; sobrescritas continuam prevalecendo               |
| Início (`saleStart`)                   | ISO datetime         | Condicional | Obrigatório com promoção                                      | 2026-10-10T12:00:00Z | Início inclusivo                                                            |
| Fim (`saleEnd`)                        | ISO datetime         | Condicional | Posterior ao início                                           | 2026-10-20T12:00:00Z | Fim exclusivo; volta ao preço regular                                       |
| Preço atacado (`wholesalePrice`)       | decimal BRL nullable | Não         | Não negativo; duas casas                                      | 390,00               | Referência gravada na cotação; negociação permanece                         |
| Quantidade mínima (`wholesaleMinimum`) | integer              | Sim         | Positivo; padrão 1                                            | 6                    | Validado por modelo na cotação; mínimo global também se aplica              |
| Grade/cartela (`wholesalePack`)        | texto multilinha     | Não         | Até 10.000                                                    | 2P + 2M + 2G         | Condição para negociação; não gera kit nem força proporções automaticamente |

Precedência: **SKU → cor → promoção vigente do produto → preço base**. O frete
grátis a partir de R$ 499 continua global e não integra o cadastro.

## 7. Mídia por cor

| Campo                              | Tipo de dado     | Obrigatório     | Validação / regra                                    | Exemplo                              | Observação                                                 |
| ---------------------------------- | ---------------- | --------------- | ---------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Vínculo com cor                    | chave composta   | Sim, por imagem | Imagens pertencem à cor, não a outro produto         | Sculpt / Mocha                       | Trocar cor troca galeria                                   |
| Arquivo (`images[].src`)           | caminho          | Sim, por imagem | `/products/...` ou `/api/product-images/UUID.ext`    | /products/sculpt/frente.webp         | Novos arquivos armazenados no Supabase                     |
| Papel (`images[].role`)            | enum             | Sim, por imagem | frente, costas, detalhe, lifestyle                   | frente                               | Uma frente por cor ativa é obrigatória; costas recomendada |
| Ordem                              | posição no array | Automático      | Controlada por “Mover acima”; até 20 imagens por cor | 0                                    | Sem apagar arquivos ao remover vínculo                     |
| Texto alternativo (`images[].alt`) | texto            | Sim, por imagem | 1–200; descrição útil                                | Conjunto Sculpt Mocha, vista frontal | Sem repetir lista de palavras-chave                        |
| Formato                            | MIME/extensão    | Upload          | JPG/JPEG, PNG, WebP, AVIF                            | image/webp                           | SVG e URLs externas arbitrárias não são aceitos            |
| Tamanho                            | bytes            | Upload          | Máximo 5 MiB por arquivo                             | 5242880                              | Limite também configurado no bucket                        |

Uploads são imutáveis: novo UUID a cada envio. Remover do formulário não exclui o
arquivo que pode estar sendo usado pela versão publicada. Fotos não publicadas
no bucket público não devem conter conteúdo confidencial. Limpeza de órfãos é
operação futura, mediante conferência das referências.

## 8. Medidas e guia

| Campo                   | Tipo de dado     | Obrigatório | Validação / regra                              | Exemplo                       | Observação                                                           |
| ----------------------- | ---------------- | ----------- | ---------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| Tabela (`measurements`) | texto multilinha | Não         | Até 10.000; informar tamanho, medida e unidade | P: busto 84–88; cintura 64–68 | Exibida preservando linhas; sem recomendação automática              |
| Unidade das medidas     | convenção        | Com tabela  | cm                                             | cm                            | Não confundir com dimensões da embalagem                             |
| Guia (`sizeGuide`)      | caminho/URL      | Não         | Caminho interno seguro ou HTTPS                | /guia-de-tamanhos             | Cadastrar apenas destino existente; modal atual permanece disponível |

## 9. Dados fiscais

| Campo             | Tipo de dado | Obrigatório | Validação / regra                        | Exemplo  | Observação                                                                 |
| ----------------- | ------------ | ----------- | ---------------------------------------- | -------- | -------------------------------------------------------------------------- |
| NCM (`ncm`)       | texto        | Não         | Exatamente oito dígitos quando informado | 61046300 | Exemplo de formato; classificação deve ser confirmada pela operação fiscal |
| CEST (`cest`)     | texto        | Não         | Exatamente sete dígitos quando informado | 2805900  | Não inferir aplicabilidade                                                 |
| Origem (`origin`) | enum textual | Não         | Código 0–8                               | 0        | Confirmar origem real com responsável fiscal                               |
| Unidade (`unit`)  | enum textual | Não         | UN, PC, CJ, PAR; padrão UN               | CJ       | Metadado para futura integração fiscal                                     |

O módulo valida formato; não calcula impostos nem emite documento fiscal.

## 10. Logística

| Campo                  | Tipo de dado | Obrigatório | Validação / regra           | Exemplo | Observação                                       |
| ---------------------- | ------------ | ----------- | --------------------------- | ------- | ------------------------------------------------ |
| Peso (`weight`)        | decimal, g   | Não         | Maior que zero se informado | 450     | Peso embalado                                    |
| Comprimento (`length`) | decimal, cm  | Não         | Maior que zero se informado | 30      | Embalagem                                        |
| Largura (`width`)      | decimal, cm  | Não         | Maior que zero se informado | 20      | Embalagem                                        |
| Altura (`height`)      | decimal, cm  | Não         | Maior que zero se informado | 5       | Cadastro não substitui cotação de transportadora |

## 11. SEO

| Campo                               | Tipo de dado           | Obrigatório | Validação / regra                                    | Exemplo                                          | Observação                                                            |
| ----------------------------------- | ---------------------- | ----------- | ---------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Título (`seoTitle`)                 | texto                  | Não         | Até 70; fallback nome                                | Sculpt Set — STUW                                | Metadata do Next.js                                                   |
| Meta description (`seoDescription`) | texto                  | Não         | Até 160; fallback descrição curta/completa           | Conheça o conjunto Sculpt…                       | Sem HTML                                                              |
| Slug                                | referência             | Sim         | Campo único da identificação                         | stuw-sculpt-set                                  | Não duplicado no formulário                                           |
| Canonical (`canonical`)             | URL HTTPS              | Não         | URL de produto em stuw.vercel.app                    | https://stuw.vercel.app/produtos/stuw-sculpt-set | Fallback URL atual; atualizar validação se houver domínio próprio     |
| Product / Offer                     | JSON-LD gerado         | Automático  | Nome, marca, imagem e uma oferta por SKU ativo       | priceCurrency: BRL                               | Preço, cor, tamanho, SKU e disponibilidade; `<` escapado              |
| URLs anteriores                     | array / registro único | Automático  | Slugs reservados; não reutilizados por outro produto | stuw-sculpt-set-mocha                            | Redirecionamento permanente HTTP 308, equivalente permanente para SEO |

## 12. Publicação

| Campo                     | Tipo de dado          | Obrigatório | Validação / regra                              | Exemplo              | Observação                                                       |
| ------------------------- | --------------------- | ----------- | ---------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| Status (`status`)         | enum                  | Sim         | draft, active, inactive                        | draft                | Rascunho não altera versão pública já existente                  |
| Agendamento (`publishAt`) | ISO datetime nullable | Não         | Data válida; campo vazio publica imediatamente | 2026-10-10T12:00:00Z | Horário do navegador convertido para UTC; leitura por requisição |
| Destaque (`featured`)     | boolean               | Sim         | Padrão false                                   | true                 | Home continua limitada a oito cards                              |
| Versão publicada          | projeção JSON         | Automático  | Inclui somente dados comerciais públicos       | regular / promotion  | Custos, fiscal, ERP e auditoria ficam fora                       |

Agendar um produto já publicado substitui sua publicação atual e o oculta até o
novo horário. Use rascunho enquanto prepara uma revisão que deve manter a versão
atual no ar. O agendamento controla a vitrine e o checkout; a projeção comercial
agendada não é um documento privado na Data API.

## 13. Integração

| Campo                             | Tipo de dado         | Obrigatório       | Validação / regra                           | Exemplo     | Observação                               |
| --------------------------------- | -------------------- | ----------------- | ------------------------------------------- | ----------- | ---------------------------------------- |
| ID ERP (`externalId`)             | texto                | Não               | Até 1.000; não presumir formato numérico    | OLIST-12345 | Não é a identidade interna               |
| Origem (`source`)                 | enum                 | Sim no formulário | manual, olist, importacao                   | manual      | Metadado; não ativa conexão              |
| Última sincronização (`lastSync`) | ISO datetime / vazio | Automático        | Preservado pelo servidor; sem edição manual | vazio       | Nenhuma sincronização Olist implementada |

O ERP não está configurado no repositório. Conector, credenciais, resolução de
conflitos e sincronização de estoque continuam dependendo dessa integração.

## 14. Auditoria

| Campo                       | Tipo de dado           | Obrigatório | Validação / regra                                 | Exemplo              | Observação                       |
| --------------------------- | ---------------------- | ----------- | ------------------------------------------------- | -------------------- | -------------------------------- |
| Criado por (`created_by`)   | UUID/FK                | Automático  | Usuário autenticado; nunca recebido do formulário | UUID do admin        | Nulo se usuário for removido     |
| Alterado por (`updated_by`) | UUID/FK                | Automático  | Usuário da gravação atual                         | UUID do admin        | Permissão consultada no banco    |
| Criado em (`created_at`)    | timestamptz            | Automático  | Relógio do banco                                  | 2026-10-05T12:00:00Z | Imutável                         |
| Alterado em (`updated_at`)  | timestamptz            | Automático  | Atualizado na transação                           | 2026-10-05T13:00:00Z | Sem confiar no navegador         |
| Revisão (`revision`)        | integer                | Automático  | Crescente; gravação exige revisão esperada        | 3                    | Conflito exige recarregar        |
| Arquivado em (`deleted_at`) | timestamptz nullable   | Automático  | Soft delete; histórico e identidade preservados   | null                 | Não há exclusão física no painel |
| Histórico (`product_audit`) | snapshots JSON + autor | Automático  | Um evento por revisão; privado                    | revisão 3            | Não exposto a clientes da loja   |

## Persistência, ativação e compatibilidade

Aplicar `supabase/migrations/20261005172919_product_catalog.sql` **depois das
migrações existentes** no ambiente desejado, antes do deploy. O arquivo foi
validado em PostgreSQL local via PGlite com primitivas de Auth e Storage simuladas.
Esta entrega não aplica migrações remotas nem faz deploy na Vercel.

`admin_products` guarda o documento editorial; `private.product_colors` e
`private.product_skus` materializam a hierarquia com FKs e unicidade de SKUs/GTIN.
`private.product_slugs` reserva URLs históricas. `catalog_products` contém apenas
a projeção pública. RLS e grants restringem documentos a administradores; RPCs
checadas gravam documento, variantes, URLs, publicação e auditoria na mesma
transação. Server Actions repetem autenticação e validação antes da RPC.

A consulta da loja combina o catálogo local com as versões gerenciadas pelo ID.
Rascunhos não substituem publicações; inativos e arquivados deixam marcadores para
impedir que a versão estática reapareça. Novos slugs são resolvidos em tempo de
requisição, sem rebuild. Filtros e histórico de pedidos existentes são preservados.
Se a tabela ainda não existe, a loja usa o catálogo estático. Outros erros da API
não reativam silenciosamente versões antigas.

### Consolidação dos produtos antigos

A estrutura permite várias cores no mesmo produto. A migração não mescla modelos
automaticamente: o catálogo atual declara expressamente que o Sculpt com legging
e o Sculpt com calça flare são diferentes. Preparar uma relação revisada
`ID antigo → ID do modelo → cor`, conferir fotos, medidas e SKUs, e só então
transferir registros e URLs. Mudança de slug do mesmo ID já é suportada; fusão
entre IDs diferentes ainda exige uma migração de dados específica, inclusive
mapeamento de favoritos/sacolas. Pedidos históricos devem manter seus snapshots.

### Validação

`tests/product-admin.test.cjs` cobre publicação, formato, GTIN, preços por SKU,
estoque, promoções, projeção sem campos privados e fallback de produtos ocultos.
`tests/products-database.test.cjs` aplica migrações localmente e verifica RLS,
gravação atômica, unicidade, aliases, revisão, isolamento de rascunho e soft delete.

Referência de permissões: [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

A resolução de URLs no proxy consulta somente ID, slug e agendamento antes do streaming, preservando HTTP 404 e redirecionamentos HTTP 308. O catálogo atual com tamanhos Único, nomes de arquivo com espaços e classificação Novidades pode ser preparado em rascunho; a classificação definitiva deve ser informada antes de publicar.
