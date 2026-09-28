# Administração de cupons

O painel usa um layout compartilhado com navegação lateral. `/admin` direciona
para `/admin/cupons`. Banners e Pedidos também estão implementados; Relatórios
permanece como próxima etapa.

## Aplicar no Supabase

Após as migrações anteriores, execute uma vez no SQL Editor:

1. `supabase/migrations/20260928141620_coupons.sql`.
2. `supabase/tests/coupons.sql` para verificar permissões e consumo (ROLLBACK).

Confira também os Security Advisors do projeto. A migração está preparada
localmente; a publishable key não autoriza aplicar DDL no banco remoto.

## Regras

- Código normalizado em maiúsculas, único, de 3 a 32 caracteres.
- Percentual maior que zero e até 100%, com até duas casas decimais.
- Limite de utilizações obrigatório e inteiro, nunca menor que o número já usado.
- Validade inclusiva até 23h59m59s999 da data selecionada, horário de Brasília
  (UTC−03 nesta implementação). O instante é armazenado em UTC.
- Filtros: ativo/disponível, inativo, expirado e limite atingido. Inativo prevalece
  no filtro quando o administrador desativa um cupom já vencido.
- Desativar não apaga histórico. Para recuperar vencidos/esgotados, edite a data ou
  limite e marque ativo. O botão reativar orienta essa correção quando necessária.
- O percentual aplica-se a produtos + frete + embalagem. O desconto de PIX de 5%
  continua incidindo apenas nos produtos após o desconto percentual do cupom.
  Exemplo: produtos R$100 + frete R$20 + embalagem R$35, cupom 10%, PIX: desconto
  do cupom R$15,50, desconto PIX R$4,50, total R$135.

## Uso no site

O formulário compartilhado pelo carrinho e checkout consulta `lookup_coupon` via
Server Action. O retorno inclui só código, percentual e validade de um cupom
disponível. A tabela administrativa e estatísticas não ficam visíveis ao cliente.
O cupom é revalidado antes de concluir a demonstração, incluindo desativação,
expiração e alterações de percentual. Falhas bloqueiam a conclusão com o desconto
antigo. O total mostrado no navegador é uma simulação, não uma autorização de preço.

O antigo PRIVE10 não é mais aplicado automaticamente pela interface; para usá-lo,
cadastre-o no painel. A função de cálculo mantém compatibilidade com chamadas
legadas dos testes demonstrativos, mas a vitrine só recebe objetos validados.

## Contador e pedidos

O contador é protegido: administradores editam o limite, não a quantidade utilizada.
Após a migração de pedidos, o checkout registra pedidos de teste e consome
utilizações. Use cupons próprios para testes. Veja [Pedidos](pedidos.md).

`record_coupon_use(code, order_id)` é reservada a `service_role`, nunca ao navegador
ou a administradores autenticados. A função privada é chamada internamente pela
transação do checkout, após calcular o total com o catálogo confiável. A função bloqueia
o pedido e o cupom, revalida disponibilidade, registra um uso por pedido, incrementa
o contador e reduz o total do pedido na mesma transação. Repetições retornam o
desconto original sem consumir novamente. Outro código no mesmo pedido é recusado.

O registro guarda percentual e valores originais para auditoria. O consumo ocorre
ao registrar o uso no pedido pendente; cancelamentos não devolvem usos nesta base.
Definir reservas, expiração de pedidos e devolução de usos antes da integração de
pagamento. Pedidos de teste não geram cobranças.

## Proteção

Todas as páginas, ações de gravação e consultas administrativas verificam
`requireAdmin`. RLS restringe as tabelas a administradores, grants limitam as
colunas editáveis e constraints reforçam percentuais/limites. Clientes e visitantes
podem consultar somente um código exato disponível pela função de lookup. Essa
consulta pública é deliberada para a sacola sem login; finalizar exige conta. Não exponha `private` na API.
