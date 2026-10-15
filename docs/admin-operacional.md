# Admin operacional STUW

Entrega implementada em 14/10/2026. Entrada: `/operacao`, disponível na navegação do admin e na conta dos colaboradores autorizados.

## Fluxos

- Preparação: aguardando separação → separado → conferido → faturado → postado. Cada registro atribui a responsabilidade ao usuário autenticado, registra observação, data e histórico. Não permite saltos nem gravação sobre uma revisão antiga. Exige pagamento aprovado; faturamento exige vínculo de nota na integração Olist; postagem exige status de envio confirmado e rastreio. O operador deve conferir a autorização da NF antes de registrar o faturamento: a existência do vínculo não substitui essa conferência fiscal.
- Reembolsos: `order_refunds` guarda aumentos confirmados do valor acumulado estornado no Mercado Pago, com valor, pagamento, data do provedor e histórico imutável pela aplicação. Se duas devoluções financeiras ocorrerem entre consultas, podem aparecer juntas em uma entrada de conciliação; não são IDs individuais de reembolso do provedor. Estorno parcial mantém o pagamento aprovado; somente o valor integral gera `refunded`. Contestação continua independente. Eventos antigos e repetidos não duplicam valores. O valor acumulado nunca pode ultrapassar o pedido nem regredir silenciosamente.
- Estoque: `stock_movements` distingue físico e reservado observados na Olist, disponibilidade local, reservas de checkout, conciliação de pagamento, ajustes de cadastro e cálculo de conjuntos. Registra antes/depois, quantidade, motivo, responsável ou sistema e pedido quando aplicável. Consultas sucessivas da Olist mostram diferenças entre observações, não cada movimento interno do ERP. O histórico começa na instalação; não inventa movimentos anteriores.
- Trocas/devoluções: por posição do item imutável no pedido e quantidade. Solicitado → autorizado → recebido → conferido → concluído; recusa/cancelamento apenas antes do recebimento. Bloqueia quantidades acima do comprado, incluindo outras solicitações não recusadas. Conferência exige condição da peça. Conclusão exige destinação de estoque e referência da resolução financeira ou novo envio; peça danificada não pode ser recolocada no estoque vendável.
- A devolução física deve ser lançada na Olist após conferência. O módulo registra o acompanhamento e as evidências, sem executar estornos, emitir NF, criar envios de troca ou somar estoque automaticamente. Reembolsos são solicitados no Mercado Pago; o painel consulta a confirmação.

## Acesso

| Perfil                  | Permissões                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Administrador existente | Operações, financeiro, estoque e auditoria; gestão de equipe reservada ao super admin |
| Expedição               | Pedidos, preparação, trocas/devoluções, extrato                                       |
| Atendimento             | Pedidos e trocas/devoluções                                                           |
| Financeiro              | Pedidos, consulta e conciliação de reembolsos                                         |
| Auditoria               | Pedidos, extrato e histórico, sem alterar operações                                   |

Super admin cadastra/revoga acesso usando o e-mail de uma conta existente. Não envia convites nem transforma o colaborador em administrador do catálogo. A autorização usa tabelas protegidas, não metadados editáveis ou informações enviadas pelo formulário. A revogação vale na próxima operação, sem esperar renovar JWT.

`operation_audit` registra alterações de preparação, trocas/devoluções, conciliação de reembolsos e perfis da equipe. O histórico anterior de produtos e pedidos permanece nas estruturas existentes; não foi convertido em uma auditoria universal de todos os módulos da loja. Operadores consultam o histórico operacional do pedido; eventos financeiros são restritos. A auditoria geral é somente de leitura.

## Publicação e validação

1. A migração `supabase/migrations/20261015010526_operational_admin.sql` já foi aplicada e verificada no Supabase vinculado (`lddrltvbyxufiollvspi`) em 14/10/2026. Não reaplicar nesse banco. Em outro ambiente, aplicá-la antes do deploy do código. A função de pagamento antiga continua disponível para compatibilidade durante a publicação. O projeto remoto atual não possui a tabela de histórico da CLI; não usar `db push` indiscriminadamente para executar novamente as migrações antigas.
2. Publicar o código e abrir `/operacao` com um administrador. Cadastrar contas de colaboradores existentes conforme as funções.
3. Validar com o pedido controlado: separação/conferência, nota autorizada e vinculada na Olist, etiqueta e postagem, e-mail, estoque e valores financeiros. Estes fluxos reais ainda dependem da homologação integrada da loja.

Testes locais cobrem checkout e kits existentes, reembolso parcial/total/repetido, reparo de normalização parcial antiga mediante nova consulta ao provedor, limites de quantidade, sequência e revisão das operações, condição de peças devolvidas, vínculo da reserva ao pedido, matriz de perfis e revogação. Não foram realizados estornos reais nem alterações de saldos físicos para testar este módulo.

Verificação final: 136 testes passaram; lint, typecheck e build aprovados. Smoke HTTP do build local com acesso ao Supabase: home 200; `/operacao` e detalhe do pedido sem sessão retornam 307 para `/conta`. As seis novas tabelas têm RLS e a função de conciliação não é executável por anônimos; advisors não apresentou novos avisos de segurança. Os 56 componentes continuaram ativos, sem erros e sem leituras vencidas após a instalação. A interface autenticada e a compra real ainda devem ser homologadas no deploy; o código desta entrega não foi publicado automaticamente.

Referências: [status de pagamento do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/response-handling/query-results?scope=prod), [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).
