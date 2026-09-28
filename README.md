# STUW — Activewear & Wellness

Migração do MVP HTML para Next.js App Router, React e TypeScript. A interface mantém a identidade STUW com menos texto, mais espaço para imagens e navegação por categoria, tecido e ocasião.

## Executar

Requer Node.js 20.9 ou superior. Base: Next.js 16 e React 19.

```bash
npm ci
npm run dev
```

Abra [localhost:3000](http://localhost:3000). Se a porta estiver ocupada, use a URL indicada pelo Next.js no terminal.

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Com o servidor ativo, `npm run test:smoke` verifica as rotas por HTTP. Defina `SMOKE_URL` para testar outra porta.

## Incluído

- Home editorial e catálogo responsivo.
- Filtros combinados, busca, ordenação e paginação por URL.
- Produtos em `/produtos/[slug]`, com slugs estáveis, metadata e 404.
- Cor, tamanho, sacola persistente e favoritos.
- Cálculo compartilhado de cupom, frete, presente e desconto PIX.
- Checkout demonstrativo com validação de formulário.
- Tema claro/escuro, imagens com Next Image e diálogos com foco/Escape nativos.

## Organização

`src/app` reúne as rotas. `src/components` separa cada componente em sua pasta por domínio. `providers`, `hooks`, `services`, `repositories`, `data`, `lib` e `types` separam estado, comportamento, acesso a dados e contratos. A estrutura segue a separação de responsabilidades usada na Evolane.

Veja [a arquitetura e os limites do MVP](docs/architecture.md).

## Produtos e configuração

Cadastre produtos em `src/data/products.ts`. Mantenha o `id` e o `slug` estáveis. O slug deve ser único; editar o título não muda a URL.

Na versão com catálogo local, execute novo build após cadastrar produtos para gerar as novas rotas.

Copie `.env.example` para `.env.local` se precisar configurar o número oficial do WhatsApp. Sem número configurado, o contato usa o Instagram da STUW.

## Próximas integrações do roadmap

Conta, cupons, banners e pedidos usam Supabase. Após aplicar as migrações, o checkout salva pedidos de teste na conta do usuário e no painel administrativo, incluindo endereço e itens. Veja [configuração de pedidos](docs/pedidos.md). Estoque, frete real, gateway PIX/cartão, webhooks e Olist aguardam integração: não há cobrança, emissão de nota fiscal ou envio de mercadoria. Newsletter e tabela de medidas aguardam serviço e conteúdo oficiais.

## Referências preservadas

- `index.html` — MVP original.
- `STUW_DESIGN_SYSTEM_AND_BENCHMARK.md` — identidade visual.
- `SITEMAP_ARQUITETURA_INFORMACAO.md` — arquitetura de informação.
- `STUW_Roadmap_20_Dias.pdf` — etapas de execução.
- [Farfetch](https://www.farfetch.com/br/shopping/women/items.aspx) — referência de simplificação visual e navegação indicada pelo projeto.
