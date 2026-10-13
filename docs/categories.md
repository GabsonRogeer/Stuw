# Categorias

O admin em `/admin/categorias` permite adicionar, editar, ordenar, remover e restaurar
tipos de peça e linhas de uso. A busca e os filtros são executados no banco; a lista
usa páginas de 20 registros com cursor por ID, sem limite fixo de categorias.

## Instalação

Aplicar `supabase/migrations/20261012170807_category_management.sql` após a migração
do catálogo de produtos. A migração importa as 13 categorias atuais e não altera
produtos. Antes de aplicá-la, a loja continua usando as categorias originais; o
admin informa que o gerenciamento ainda não está disponível.

## Comportamento

- Nome é o texto exibido na navegação, filtros e seleção do produto. Pode ser editado.
- Tipo é definido na criação. Ordem menor aparece primeiro; empates seguem o ID.
- A identidade e o valor dos filtros permanecem estáveis ao renomear, preservando
  URLs e produtos existentes.
- Remover arquiva após confirmação. A categoria sai dos menus e filtros e das novas
  seleções de produtos, mas os produtos vinculados continuam publicados. Vínculos
  anteriores podem ser mantidos ao editar um produto. URLs antigas continuam válidas.
- O filtro Arquivadas permite restaurar categorias. Nomes continuam reservados
  por tipo, inclusive quando arquivados, para evitar duplicação acidental.
- Uma lista ativa vazia permanece vazia; não repõe as categorias originais.

## Segurança e verificação

Cada ação exige administrador autenticado. RLS permite somente leitura de categorias
ativas a visitantes e clientes, e gerenciamento a administradores. Não há DELETE;
tipo, identidade e valor não podem ser alterados pela API. Revisões detectam edição
simultânea. O trigger de produtos valida a existência da categoria no tipo correto,
inclusive por chamadas diretas à RPC. O editor e a ação de produto restringem novas
seleções às categorias ativas; o banco mantém referências arquivadas válidas.

`npm test` inclui testes em Postgres/PGlite de permissões, validações, arquivamento,
restauração e conflitos de revisão, além da integração das opções dinâmicas.
