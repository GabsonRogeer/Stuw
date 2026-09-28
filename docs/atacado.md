# Atacado e cotações B2B

## Ativação

Após as migrações anteriores (incluindo pedidos), execute `supabase/migrations/20260928185642_wholesale_quotes.sql` e depois `supabase/tests/wholesale.sql` no SQL Editor. O teste desfaz todos os dados criados com rollback. No painel `/admin/atacado`, abra **Configurar mínimo e WhatsApp** e cadastre o número oficial com código do país e DDD. Nenhuma credencial adicional é necessária.

O mínimo inicial é **1 peça**, configurável de 1 a 100.000, somando todas as variantes da solicitação. O número de WhatsApp começa vazio: cotações podem ser registradas, mas o botão de envio só aparece após configurar o número. CNPJ e empresa são opcionais; um CNPJ preenchido é validado no servidor.

## Fluxo

- `/atacado` reutiliza o catálogo de produtos, sem apresentar preços. Busca, categorias, fotos frente/costas, cores, tamanhos e quantidades. A lista de atacado usa uma chave de armazenamento própria, sem misturar itens com o varejo. Apenas itens são persistidos localmente, não os dados pessoais do formulário.
- `/atacado/cotacao` exige login e aproveita nome/telefone do perfil. A lista permanece após o login. O cliente revisa as quantidades e cadastra contato, empresa/CNPJ opcionais e observações.
- O banco valida novamente o mínimo vigente e as variantes no catálogo privado `checkout_products`, cria snapshots sem preços e vincula a cotação ao `auth.uid()`. Uma chave por tentativa evita duplicação em retentativas. Só limpa a lista após o banco confirmar o registro.
- `/conta/cotacoes` permite acompanhar a solicitação e abrir o WhatsApp com uma mensagem pronta. O usuário precisa confirmar o envio no WhatsApp; abrir o link **não** prova que a mensagem foi enviada. Não há API de WhatsApp nem envio automático. Listas grandes usam um resumo com o número da cotação para evitar links excessivos; todos os itens permanecem no painel.
- `/admin/atacado` tem configurações, busca por número/cliente/empresa, filtro de status, paginação, detalhes e histórico. Estados: Recebida → Em negociação → Aprovada ou Cancelada. Uma recebida também pode ser cancelada. Mensagens do administrador são visíveis na conta do cliente. Revisão impede sobrescrever alterações concorrentes.

## Estoque, preço e integração

Cotação não tem valor zero: **não possui preço definido**. Não cobra, não consome cupons, não reserva estoque nem gera pedido/faturamento. Aprovar indica resultado da negociação, sem conversão automática em pedido. Frete, valores e disponibilidade são negociados no atendimento. Olist e conversão da proposta aprovada em pedido serão etapas futuras.

O catálogo privado deve acompanhar o catálogo da loja: ao alterar produtos/variantes, rode `node scripts/export-checkout-catalog.cjs` e aplique `supabase/setup/checkout-catalog.sql`, como no checkout de varejo. Mudanças no catálogo e no mínimo não alteram solicitações já registradas.

Permissões: clientes leem somente suas cotações e histórico; administradores consultam todas e atualizam por função autorizada. Configurações comerciais são públicas para consulta; somente administradores podem alterá-las. Testes locais com PostgreSQL/PGlite verificam isolamento, mínimo, snapshots, idempotência e transições. Validar também no Supabase e no navegador após aplicar a migração.
