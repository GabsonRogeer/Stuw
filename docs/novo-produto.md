# O que é necessário para cadastrar um novo produto na STUW

Guia baseado no formulário e nas validações atuais do projeto, consultados em 13/10/2026. O escopo é cadastrar um produto no catálogo da loja.

## 1. Acesso e estrutura do cadastro

- Ter acesso administrativo à loja.
- Acessar **Administração → Produtos → Novo produto**, em `/admin/produtos/novo`.
- Preparar os dados seguindo a hierarquia **Produto → Cor → Tamanho/SKU**.

Um modelo com várias cores fica em um único produto. Cada combinação de cor e tamanho tem seu próprio SKU e estoque. Uma combinação bicolor vendida como uma única opção pode ser uma só cor comercial.

## 2. Mínimo para salvar como rascunho

| Informação | Regra |
| --- | --- |
| Nome do modelo | Obrigatório; até 160 caracteres; informar sem o sufixo da cor. |
| Slug | Obrigatório; até 160 caracteres; letras minúsculas, números e hífens. Exemplo: `conjunto-sculpt`. Deve estar disponível, inclusive em relação a URLs históricas. |
| Status | Selecionar **Rascunho**. |

O formulário já inicia com marca `STUW`, mínimo de atacado `1`, unidade `UN`, origem do dado `manual` e destaque desmarcado. Esses padrões podem ser mantidos.

É possível deixar preço, descrição, classificação, tamanhos, cores e embalagem para depois. Entretanto, todo campo preenchido deve respeitar suas regras: uma cor adicionada, por exemplo, já precisa de nome, slug e amostra válidos.

Um novo produto salvo apenas como rascunho não aparece na vitrine.

## 3. Obrigatório para publicar

Além do nome e do slug, reunir:

| Informação | O que preencher |
| --- | --- |
| Descrição completa | Texto do produto, com até 10.000 caracteres. |
| Marca | Marca do produto; padrão `STUW`; até 80 caracteres. |
| Tipo de peça | Uma categoria ativa disponível no painel. |
| Linha de uso | Uma linha de uso ativa disponível no painel. |
| Preço de venda | Valor em reais maior que zero, com até duas casas decimais. |
| Grade de tamanhos | Pelo menos um tamanho entre `PP`, `P`, `M`, `G`, `GG` e `Único`. |
| Cores | Pelo menos uma cor ativa. |
| Foto de frente | Pelo menos uma imagem com papel **frente** para cada cor ativa. |
| SKU | Pelo menos um SKU ativo para cada cor ativa. |
| Peso embalado | Valor maior que zero, em **gramas**. |
| Comprimento, largura e altura | Três medidas maiores que zero, em **centímetros**, da peça embalada. |
| Status | Selecionar **Ativo** e salvar. |

As opções de tipo de peça e linha de uso são administradas em `/admin/categorias`. Exemplos das opções iniciais são Conjuntos, Tops e Leggings; Training, Running e Studio. Para um novo produto, selecionar as opções ativas exibidas no formulário.

**Estoque zero não impede a publicação**, mas impede a compra daquela variante. Para disponibilizar uma combinação para compra, informar seu estoque real e mantê-la ativa.

Em ambiente de teste de frete, o editor pode preencher medidas de teste automaticamente. Para a operação real, conferir o peso e as dimensões da embalagem do produto.

## 4. Dados de cada cor

| Campo | Obrigatoriedade e regra |
| --- | --- |
| Nome | Obrigatório; até 80 caracteres; único dentro do produto. Exemplo: `Mocha`. |
| Slug da cor | Obrigatório; até 80 caracteres; minúsculas, números e hífens; único dentro do produto. Exemplo: `mocha`. |
| Amostra | Informar hexadecimal no formato `#8B6B55` ou um caminho de imagem de amostra permitido. |
| Cor ativa | Marcar para disponibilizar a cor na publicação. |
| Preço da cor | Opcional; em branco, herda o preço do produto. |
| Imagens | Galeria específica dessa cor; frente obrigatória para publicar a cor ativa. |
| SKUs | Combinações de tamanho, código e estoque dessa cor. |

O cadastro aceita até **30 cores**. A primeira cor ativa na ordem do formulário é a cor padrão.

## 5. Dados de cada SKU

Após selecionar os tamanhos, usar **Gerar SKUs da grade** em cada cor e revisar:

| Campo | Obrigatoriedade e regra |
| --- | --- |
| Tamanho | Obrigatório; deve pertencer à grade do produto. |
| Código SKU | Obrigatório e único no catálogo; 1 a 64 caracteres, com letras maiúsculas, números, `_` ou `-`. Exemplo: `STUW-SCULPT-MOCHA-P`. |
| Estoque | Inteiro de 0 a 1.000.000; preencher a quantidade real disponível. |
| Ativo | Pelo menos um SKU ativo em cada cor ativa para publicar. |
| Preço do SKU | Opcional; em branco, herda o preço da cor ou do produto. |
| EAN/GTIN | Opcional; se informado, deve ser único, ter 8, 12, 13 ou 14 dígitos e dígito verificador válido. |

Não repetir o mesmo tamanho dentro de uma cor. Selecionar a grade não cria os SKUs automaticamente: é necessário gerá-los. Os novos SKUs gerados começam com estoque zero.

## 6. Fotos necessárias

- **Obrigatória:** uma foto de frente para cada cor ativa.
- **Recomendadas:** costas, detalhes do tecido/acabamento e fotos de uso.
- Formatos de upload: **JPG, PNG, WebP ou AVIF**.
- Limite: **5 MB por arquivo** e **20 imagens por cor**.
- Cada imagem precisa de texto alternativo descritivo, com até **200 caracteres**.
- Selecionar o papel de cada foto: `frente`, `costas`, `detalhe` ou `lifestyle`.
- Preferir enquadramento e dimensões consistentes; a galeria usa proporção visual 3:4. Essa proporção é uma orientação visual, não uma exigência do upload.

Para imagens já existentes, o editor aceita caminhos em `/products/...` ou caminhos de upload em `/api/product-images/...`. Adicionar um arquivo à pasta, isoladamente, não cadastra o produto nem o vincula à galeria.

## 7. Informações complementares

Os campos abaixo não bloqueiam a publicação quando estão vazios, mas devem ser preenchidos quando houver informação confirmada.

| Grupo | Informações |
| --- | --- |
| Conteúdo | Descrição curta, até 300 caracteres; destaques, um por linha. |
| Classificação | Ocasião, gênero, coleção e tags separadas por vírgula. |
| Tecido | Tecnologia, composição, modelagem, cintura, compressão e suporte. |
| Cuidados e ficha técnica | Instruções de lavagem e atributos no formato `chave: valor`, um por linha. |
| Medidas | Tabela por tamanho em centímetros e link do guia de tamanhos. |
| Comercial | Preço anterior, custo interno, promoção e condições de atacado. |
| Fiscal | NCM, CEST, origem fiscal e unidade. A obrigatoriedade descrita aqui é a do formulário. |
| SEO | Título até 70 caracteres, descrição até 160 e canonical opcional. |
| Integração | ID externo do ERP e origem do dado: `manual`, `olist` ou `importacao`. |
| Exibição | Destaque na home e data/hora de publicação. |

Regras dos campos opcionais:

- **Composição:** usar `Poliamida: 80; Elastano: 20`; os percentuais devem somar 100%.
- **Preço anterior:** precisa ser maior que o preço base.
- **Promoção:** preço menor que o base, com início e fim preenchidos; fim posterior ao início. Não informar datas sem preço promocional.
- **Valores monetários:** não negativos, até R$ 1.000.000,00 e com até duas casas decimais; o preço base precisa ser positivo para publicar.
- **Preço aplicado:** SKU → cor → promoção vigente do produto → preço base. Deixar a sobrescrita vazia para herdar; zero é um valor explícito.
- **Atacado:** quantidade mínima inteira e positiva, padrão 1. A grade/cartela é uma condição comercial registrada, sem geração automática de kits.
- **NCM e CEST:** quando informados, respectivamente oito e sete dígitos.
- **Guia de tamanhos:** caminho interno ou URL HTTPS de um destino existente.
- **Canonical:** a validação atual aceita URL no formato `https://stuw.vercel.app/produtos/slug`; pode ficar vazio para usar o padrão.

## 8. Passo a passo de publicação

1. Abrir `/admin/produtos/novo`.
2. Preencher nome, slug, descrição, marca e classificação.
3. Informar preço e, quando aplicável, condições comerciais.
4. Selecionar a grade de tamanhos.
5. Adicionar as cores, suas amostras e suas fotos.
6. Gerar os SKUs de cada cor; revisar códigos, estoque e ativação.
7. Informar peso e dimensões da peça embalada.
8. Completar os demais dados disponíveis e conferir imagens e textos.
9. Selecionar **Ativo**. Deixar **Publicar a partir de** vazio para publicação imediata, ou preencher o agendamento no horário local do navegador.
10. Clicar em **Salvar produto** e conferir a página pública, as cores, os tamanhos e os preços.

Para preparar o cadastro sem publicá-lo, salvar como **Rascunho**. Em um produto já publicado, salvar rascunho preserva a versão pública anterior; salvar como **Inativo** retira o produto da vitrine.

## 9. Ficha para preencher

### Produto

- Nome do modelo:
- Slug desejado:
- Descrição completa:
- Marca: STUW
- Tipo de peça:
- Linha de uso:
- Preço base (R$):
- Tamanhos:
- Peso embalado (g):
- Comprimento da embalagem (cm):
- Largura da embalagem (cm):
- Altura da embalagem (cm):

### Cor — repetir para cada opção

- Nome:
- Slug:
- Hexadecimal ou imagem de amostra:
- Cor ativa: sim / não
- Foto de frente e texto alternativo:
- Fotos adicionais e respectivos textos alternativos:
- Preço específico da cor, se houver:

| Tamanho | Código SKU | Estoque real | Ativo | Preço específico, se houver | EAN/GTIN, se houver |
| --- | --- | --- | --- | --- | --- |
| A preencher | A preencher | A preencher | Sim / Não | | |

### Complementos e publicação

- Composição e tecnologia do tecido:
- Modelagem, compressão e suporte:
- Cuidados de lavagem:
- Tabela de medidas:
- Coleção, ocasião, gênero e tags:
- Promoção e vigência, se houver:
- Condições de atacado, se houver:
- Dados fiscais confirmados, se disponíveis:
- Título e descrição SEO:
- Status desejado: Rascunho / Ativo
- Publicação: imediata / data e horário
- Destaque na home: sim / não

## Referências do projeto

- [Campos, padrões e validações](../src/services/product-admin.ts)
- [Formulário de cadastro e upload](../src/components/admin/ProductEditor.tsx)
- [Gerenciamento de categorias](categories.md)
- [Referência detalhada do cadastro](product-registration.md)

Este guia segue o código atual quando houver divergência com a documentação anterior, especialmente na exigência de peso e dimensões para publicar.
