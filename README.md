# STUW — Activewear & Wellness

Migração do MVP HTML para Next.js App Router, React e TypeScript. A interface mantém a identidade STUW com menos texto, mais espaço para imagens e navegação por categoria, tecido e ocasião.

## Executar

Requer Node.js 20.9 ou superior. Base: Next.js 16 e React 19.

```bash
npm ci
npm run dev
```

Abra [localhost:3000](http://localhost:3000). Se a porta estiver ocupada, use a URL indicada pelo Next.js no terminal.

O `.env.local` usa somente credenciais de testes. As credenciais de produção
ficam na Vercel, separadas das variáveis Preview da branch `teste`.
Veja a [configuração dos ambientes](docs/ambientes.md).

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Para homologar os pagamentos no ambiente atual de testes, siga o
[roteiro de homologação](docs/homologacao-pagamentos.md). Ele separa testes
automatizados, verificações de configuração e cenários que ainda exigem execução
no Mercado Pago e no site publicado.

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

Cadastre e edite produtos em `/admin/produtos`. O catálogo público usa apenas as versões publicadas no banco; `src/data/products.ts` permanece vazio para impedir o retorno de produtos antigos. Mantenha IDs e slugs estáveis.

Veja o [catálogo de produção com 21 produtos](docs/catalogo-producao.md), seus preços, grade P/M/G e pendências antes da publicação.

Copie `.env.example` para `.env.local` se precisar configurar o número oficial do WhatsApp. Sem número configurado, o contato usa o Instagram da STUW.

## Próximas integrações do roadmap

Conta, cupons, banners e pedidos usam Supabase. Após aplicar as migrações, o checkout salva pedidos de teste na conta do usuário e no painel administrativo, incluindo endereço e itens. Veja [configuração de pedidos](docs/pedidos.md). O [atacado B2B](docs/atacado.md) tem catálogo sem preços, lista separada e cotações com mínimo configurável e negociação pelo WhatsApp. Estoque, frete real, gateway PIX/cartão, webhooks e Olist aguardam integração: não há cobrança, emissão de nota fiscal ou envio de mercadoria. Newsletter e tabela de medidas aguardam serviço e conteúdo oficiais.

## Referências preservadas

- `index.html` — MVP original.
- `STUW_DESIGN_SYSTEM_AND_BENCHMARK.md` — identidade visual.
- `SITEMAP_ARQUITETURA_INFORMACAO.md` — arquitetura de informação.
- `STUW_Roadmap_20_Dias.pdf` — etapas de execução.
- [Farfetch](https://www.farfetch.com/br/shopping/women/items.aspx) — referência de simplificação visual e navegação indicada pelo projeto.
