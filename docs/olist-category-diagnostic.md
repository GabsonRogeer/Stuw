# Categoria não persistida pela API V2

Verificação em 14/10/2026, sem dados de autenticação neste relatório.

- Produto: `363797584`, SKU `STUW-TOP-AZUL-P`.
- Categoria existente na árvore de produtos: `363795784`, descrição `Stuw`, sem descendentes.
- Inclusão e alteração enviaram `categoria: "Stuw"` dentro de `produtos[].produto`, seguindo o layout documentado.
- Alteração completa autorizada pelo usuário. Enviados nome, código, unidade, preço 70, origem 0, situação A, tipo P, classe S, marca, descrição, medidas e quatro imagens. O campo `estoque_atual` foi omitido para não alterar saldo.
- Retorno de `produto.alterar.php`: `status_processamento: "3"`, `status: "OK"`, registro `status: "OK"`, ID `363797584`.
- Consulta `produto.obter.php`: SKU correto, preço 70, quatro imagens, `categoria: ""`.
- Consulta independente `pdv.produtos.php`: SKU correto, `categoria: ""`, `idCategoria: "0"`.
- Nenhuma inclusão adicional foi executada para tentar corrigir essa classificação. O SKU existente precisa ser reconciliado, nunca recriado.

Após o usuário salvar Stuw pelo painel, `produto.obter.php` confirmou `categoria: "Stuw"`, preço 70 e quatro imagens. A consulta independente `pdv.produtos.php` confirmou `idCategoria: "363795784"`.

O worker reconciliou o cadastro existente sem nova inclusão. Conferência no Supabase: SKU `STUW-TOP-AZUL-P`, remote_id `363797584`, state `linked`, last_error nulo.

A gravação manual funciona; isso não comprova que a classificação via API foi corrigida. Os outros 83 SKUs permanecem sem carga, aguardando solução para a classificação automática.

Pergunta preparada para o suporte: por que `categoria: "Stuw"`, enviada no layout documentado de inclusão e alteração V2, retorna sucesso mas não associa a categoria existente 363795784 ao produto 363797584, enquanto salvar pelo painel persiste corretamente? Existe configuração necessária para esse campo na conta ou correção disponível para o endpoint?

Este relatório não foi enviado a terceiros e não contém token nem senha.

Referências oficiais: [alterar produto](https://tiny.com.br/api-docs/api2-produtos-alterar), [árvore de categorias](https://tiny.com.br/api-docs/api2-produtos-categorias-arvore), [pesquisa do PDV](https://tiny.com.br/api-docs/api2-pdv-produtos-pesquisar).

## Decis?o posterior do usu?rio

O usu?rio autorizou continuar os cadastros com categoria vazia e classific?-los manualmente na Olist. O bloqueio da carga por categoria foi substitu?do por pend?ncia expl?cita por SKU, somente na execu??o assistida. A causa da categoria ignorada pela API permanece sem solu??o confirmada. Consulte o relat?rio da carga para a situa??o atual; a contagem de 83 pendentes acima descreve o momento anterior ? autoriza??o.
