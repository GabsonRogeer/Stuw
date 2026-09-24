# Checkout em etapas

O fluxo usa três rotas pequenas. Cada uma importa somente o componente de sua etapa:

- `/checkout/information`: contato, nome, endereço brasileiro e telefone. Preferências
  de ofertas são opcionais e começam desmarcadas. “Voltar para o carrinho” abre a
  sacola existente, sem descartar o formulário.
- `/checkout/shipping`: endereço resumido e escolha obrigatória de frete.
- `/checkout/payment`: presente, embalagem opcional, CPF/CNPJ obrigatório, PIX ou
  cartão e parcelamento demonstrativo. A conclusão não envia dados nem cobra.

`/checkout` redireciona para informações. O link da sacola já usa a rota nova.

## Responsabilidades

- `checkout/layout.tsx`: mantém `CheckoutProvider` montado entre as três rotas.
- `CheckoutShell`: marca, navegação por etapas, proteção da sequência, sacola vazia,
  resumo lateral e confirmação demonstrativa.
- `CheckoutInformation`, `CheckoutShipping`, `CheckoutPayment`: formulários isolados.
- `CheckoutContactSummary`: contato/endereço/frete com links para alterar.
- `CheckoutSummary`: itens, cupom e total, compartilhado pelas etapas.
- `CouponForm`: mesma implementação no carrinho e no checkout.
- `services/checkout.ts`: validações e identificação do contexto de uma cotação.
- `services/shipping.ts`: adaptador de fretes fictícios, substituível por uma API.
- `lib/commerce.ts`: totais; aceita o preço do frete escolhido, mantendo o cálculo
  estimado anterior para a sacola.

Os dados preenchidos e as escolhas ficam em memória enquanto o layout de checkout
permanece montado. Avançar e voltar com os links mantém os dados. Recarregar a página
ou sair do checkout reinicia o formulário; endereço e CPF/CNPJ não são persistidos
no navegador. O carrinho mantém sua persistência independente.

Informações incompletas impedem acesso ao frete e pagamento. Sem frete válido,
pagamento volta à seleção de frete. Alterações no endereço ou itens invalidam a
cotação selecionada. Alterar somente o e-mail não exige escolher o frete novamente.

## Valores demonstrativos

- Econômico: R$ 28, 5–8 dias úteis; cortesia a partir de R$ 499 em produtos.
- Expresso: R$ 45, 2–3 dias úteis, inclusive em pedidos acima de R$ 499.
- Presente: marcar a intenção não cobra; embalagem opcional custa R$ 35.
- PIX: mantém 5% de desconto sobre os produtos após cupom.
- Cartão: até 6 parcelas ilustrativas; não coleta dados do cartão.
- Antes da seleção de frete, o resumo mostra “A calcular” e “Total parcial”.

CPF e CNPJ são validados pelo formato e dígitos verificadores, sem consulta de
situação cadastral. O CNPJ aceita letras nas primeiras 12 posições conforme o
[manual da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).

## Integração futura

Substituir as cotações locais por respostas do serviço de frete com identificação,
validade e vínculo ao endereço/carrinho. Revalidar endereço, documento, estoque,
cupons, frete e totais no servidor antes de criar pedidos. Integrar o gateway para
tokenização de cartão e criação de PIX, sem confiar em valores vindos do cliente.
A finalização atual limpa o rascunho e o carrinho somente após validar todas as
etapas e exibir uma confirmação identificada como demonstração.
