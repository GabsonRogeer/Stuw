# Imagens dos produtos

## Fotografias reais STUW

Os sete produtos `STUW-01` a `STUW-07` aparecem no catálogo com os códigos das
pastas `public/products/stuw-01/` a `stuw-07/`. Cada pasta contém seis fotos:
`frente.jpg` é a principal, `costas.jpg` aparece no hover, os dois arquivos
`FIT-*.jpg` são as poses seguintes, e `detalhe1.jpg` e `detalhe2.jpg` fecham a galeria.
Os arquivos originais foram preservados, e o Next Image otimiza a entrega.

O cadastro em `src/data/products.ts` usa IDs de 101 a 107 e `price: null` para
exibir “Em breve”, sem compra, parcelamento ou inclusão na sacola. Busca e favoritos
continuam disponíveis. Esses produtos não entram no atacado nem na exportação do
catálogo de checkout enquanto não tiverem preço. Nome comercial, preço, variantes
e especificações devem ser confirmados antes de liberar a venda; não use zero
como preço provisório. Mantenha os IDs, slugs e pastas quando alterar os nomes.

## Cadastro das imagens

O catálogo em `src/data/products.ts` declara as imagens explicitamente:

```ts
image: '/products/top-sage-frente.jpg',
hoverImage: '/products/top-sage-costas.png',
galleryImages: [
  { src: '/products/top-sage-detalhe.png', alt: 'Top Studio — detalhe' },
],
```

`image` é a imagem principal, também usada na busca, favoritos e sacola.
`hoverImage` é opcional e representa a vista de costas. O componente compartilhado
`ProductCardImage` atende à home e ao catálogo. A troca acontece no hover com mouse
ou no foco de teclado do link da foto, após a imagem secundária carregar. Se ela
não existir ou falhar ao carregar, a frente permanece visível. Em telas de toque,
o card mantém a frente e o toque continua abrindo o produto.

Use nomes como `<produto>-<cor>-frente.webp` e `<produto>-<cor>-costas.webp`, com
dimensões e enquadramento iguais. JPG e PNG também funcionam, inclusive misturados.
Os nomes não são interpretados pelo componente: adicionar arquivos à pasta não
cria um produto nem altera seu cadastro automaticamente.

## Integrações futuras

Mantenha o contrato `Product` independente da origem. A implementação de
`ProductRepository`, em `src/repositories/products.ts`, deverá mapear os dados
do Olist/Supabase para esse contrato, escolhendo explicitamente a imagem principal
e a vista de costas. Não dependa da ordem não garantida de uma consulta ou do nome
de arquivos remotos. Caso a origem armazene uma galeria, persista a função de cada
foto (frente, costas, detalhe) ou uma ordenação definida na importação.

Os campos aceitam caminhos locais ou URLs. Ao integrar URLs externas, configure
os hosts e caminhos autorizados em `images.remotePatterns` no `next.config.mjs`.
Nenhuma conexão com Olist ou Supabase é necessária para o hover atual.

Os conjuntos Mocha Sculpt e Run Mauve estão cadastrados com dados fictícios,
autorizados para o ambiente de teste: preços de R$ 690 e R$ 490, respectivamente,
tamanhos PP a GG e tecidos SculptHold e SilkAir. Substitua esses dados na integração.

## Galeria na página do produto

`ProductGallery` mostra a imagem principal, a vista de costas (quando cadastrada)
e as fotos extras de `galleryImages`, nessa ordem, sem repetir URLs. As miniaturas
permitem selecionar a foto por mouse, toque ou teclado. O quadro mantém a proporção
3:4 e exibe a imagem inteira sem recorte. Produtos com apenas uma foto não exibem
miniaturas. A textura genérica não é adicionada automaticamente aos produtos.

Para novas fotos, acrescente `{ src, alt }` a `galleryImages` no cadastro do produto.
Na integração futura, o repositório deve preencher essa lista em ordem, com URLs
e descrições vindas do catálogo, sem mudanças no componente da galeria.
