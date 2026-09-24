# Arquitetura STUW

## Referências e decisões

- `index.html` permanece como referência original, sem alterações.
- `STUW_DESIGN_SYSTEM_AND_BENCHMARK.md` define a identidade: Cloud Silk, Obsidian, Sage, Champagne, Cormorant Garamond e Plus Jakarta Sans.
- `SITEMAP_ARQUITETURA_INFORMACAO.md` orienta a descoberta por categoria, tecido e ocasião.
- A Farfetch foi consultada como referência de navegação e de conteúdo reduzido, conforme orientação do projeto. A home destaca fotografia e produto; detalhes ficam nas páginas de produto e em disclosures.
- A organização foi comparada com `D:/Projeto/evolane-react/evolane-react`: App Router, componentes por domínio, hooks, serviços e repositórios. A STUW mantém `src/`, já existente na base.

## Camadas

```text
src/
  app/
    (store)/             layout da loja, home e catálogo
      produtos/
        [slug]/          página e metadata de cada produto
    checkout/            checkout com cabeçalho próprio
  components/
    layout/              header, footer e overlays
    home/                hero e editoriais
    catalog/             filtros, grade e cards
    product/             detalhes e guia de caimento
    cart/                sacola e resumo financeiro
    checkout/            formulário da demonstração
    search/              busca
    wishlist/            favoritos
    ui/                  primitivas compartilhadas
  providers/             estado React: sacola, favoritos e painéis
  hooks/                 persistência e preferência de tema
  services/              acesso ao catálogo e consultas
  repositories/          implementação da fonte de produtos
  data/                  catálogo demonstrativo e navegação
  lib/                   regras puras de preço e variantes
  types/                 contratos TypeScript
```

Cada componente tem sua própria pasta. `app` compõe páginas e define as rotas; não contém regras da sacola. Os componentes de página renderizam no servidor por padrão. Apenas as partes interativas usam `use client`; os diálogos são carregados sob demanda. O contrato assíncrono do repositório permite trocar o catálogo local por banco/API sem mudar as páginas de produto.

## URLs e identidade dos produtos

- `/`: home editorial.
- `/produtos`: catálogo, com categoria, tecido, ocasião, busca, ordenação e paginação na URL.
- `/produtos/legging-sculpt-pure-waist`: exemplo de página individual.
- `/checkout`: demonstração da finalização.
- Slugs desconhecidos retornam 404; os seis produtos têm rotas geradas e metadata individual.

Na fonte local, `dynamicParams = false` garante status HTTP 404 antes do streaming para slugs fora do catálogo. Depois de cadastrar uma peça, executar novo build. Ao integrar catálogo dinâmico, trocar essa política por geração sob demanda/revalidação e validar novamente os status HTTP. O diretório de compilação é o padrão `.next`, compatível com o deploy na Vercel. No painel da Vercel, use o preset Next.js, o comando `npm run build` e o diretório de saída padrão (sem override).

`id` é a identidade do produto; `slug` é um campo explícito e estável, não recalculado quando o título muda. Novos produtos devem ter slugs únicos, minúsculos e separados por hífen. Ao integrar o banco, adicionar constraint única em `slug`; alterações editoriais de slug devem gerar redirecionamento permanente da URL anterior.

O catálogo aplica até 12 resultados por página. Filtros e busca podem ser compartilhados por URL. O MVP filtra a fonte em memória; para um catálogo grande, mover busca, ordenação e paginação para o repositório/API e buscar apenas os IDs necessários para sacola/favoritos. Hoje os seis produtos são enviados aos providers para recuperação e busca local. Esse comportamento deve ser substituído antes de importar um catálogo extenso.

## Estado comercial

- A chave de uma linha da sacola é `id + cor + tamanho`.
- A sacola persiste em `stuw_cart`; favoritos em `stuw_wishlist`; tema em `stuw_theme`.
- A leitura ocorre após a hidratação; JSON inválido e storage indisponível não interrompem a loja.
- Ao restaurar a sacola, variantes são conferidas e preços são recuperados do catálogo, não do storage.
- `calculateTotals` centraliza cupom PRIVE10 (10%), PIX (5% sobre produtos já descontados), frete demonstrativo (R$ 28 abaixo de R$ 499) e presente (R$ 35).
- Em produção, estoque, preços, cupons, frete e total devem ser recalculados no servidor ao criar o pedido.

## Limites da entrega e roadmap

Esta migração entrega a base de interface dos dias 2–9 e preserva uma demonstração de checkout. Não representa a conclusão das etapas comerciais do roadmap.

Ainda dependem de implementação/fornecedor: PostgreSQL, autenticação, conta, endereços salvos, estoque, frete por CEP, pedidos persistidos, gateway, webhooks, rastreio e administração. Não há cobrança real, QR Code de pagamento válido ou envio de dados do checkout. A confirmação usa identificação `DEMO` e existe apenas no estado da sessão.

O guia de tamanhos não usa o cálculo por IMC do protótipo: faltam medidas reais e regras de modelagem para recomendar tamanhos. Newsletter informa que o cadastro ainda não está ativo. WhatsApp depende de `NEXT_PUBLIC_WHATSAPP_NUMBER`; na ausência, o contato aponta ao Instagram da marca.

## Validação

Validação executada em 23/09/2026: build de produção com Next.js 16.3.6 e React 19.3.0, lint, TypeScript, nove testes unitários e oito verificações HTTP aprovados. A instalação final reportou zero vulnerabilidades no npm. Não havia navegador conectado para validar visualmente os breakpoints ou executar interações ponta a ponta; a lista de revisão abaixo permanece pendente.

`npm test` cobre regras financeiras, variantes, restauração de storage, slugs, busca, filtros e paginação. `npm run typecheck`, `npm run lint` e `npm run build` verificam os contratos e a compilação. Com servidor ativo, `npm run test:smoke` verifica home, catálogo, buscas, produto, 404, checkout e imagem por HTTP.

Revisão visual manual: desktop e mobile, tema claro/escuro, filtros combinados, adicionar cores e tamanhos diferentes, quantidade/remoção, recarregar com sacola, favoritos, Escape/Tab nos diálogos, cupom e conclusão da demonstração. Fontes Google são carregadas no navegador, com fallbacks locais; o build não depende de baixar fontes.
