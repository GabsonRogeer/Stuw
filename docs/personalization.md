# Privacidade e personalização

Na primeira visita, o aviso oferece aceitar ou recusar personalização com o mesmo
destaque. O link “Cookies e privacidade” no rodapé abre as preferências novamente.
A interface explica o mecanismo atual: armazenamento local do navegador. Esta
implementação não cria cookies HTTP, identificadores publicitários nem envia o
histórico a um servidor. O aviso cobre as preferências de armazenamento da loja.

A escolha dura 180 dias. A ausência de escolha e a recusa desativam o registro.
Aceitar habilita o histórico somente a partir desse momento; se um produto estiver
aberto, ele é registrado. Links pré-carregados não contam como visualização.
Recusar nas preferências apaga o histórico. Limpar o histórico mantém a escolha,
e novas páginas visitadas podem voltar a ser registradas.

## Camadas

- `services/personalization.ts`: validação, expiração, limite de 20 produtos,
  registro condicionado à escolha e retenção de 30 dias por visualização.
- `repositories/personalization.ts`: adaptador local em `stuw_personalization_v1`,
  sincronização entre abas e fallback em memória quando o armazenamento falha.
- `providers/personalization-provider.tsx`: estado compartilhado, remoção de
  produtos fora do catálogo e limpeza periódica dos registros expirados.
- `services/recommendations.ts`: sugestões por categoria, tecido e ocasião,
  com maior peso para visitas recentes; combinações complementares para o look.
- `ProductViewTracker`: registra visitas apenas após a montagem no navegador.
- `ProductDiscovery`: histórico e sugestões na home e na página do produto.
- `PrivacyNotice`: aviso inicial e modal de preferências.

Os dados guardados são escolha, data da escolha, ID e data da última visualização
de cada produto. Não são guardados nomes, preços ou descrições: a interface resolve
os IDs contra o catálogo atual. Produtos excluídos são retirados do histórico.
O registro consulta a escolha persistida novamente para respeitar revogações
feitas por outra aba. As páginas continuam pré-renderizadas: o histórico privado
é aplicado somente no navegador, sem entrar no HTML compartilhado do build.

As sugestões priorizam produtos ainda não vistos. Se não houver opções novas
compatíveis, incluem produtos já vistos, sem sugerir o produto atualmente aberto.
Na home, o histórico vazio mostra se falta ativar a personalização ou visitar um
produto, em vez de ocultar a seção sem explicação. A escolha e os IDs permanecem
na mesma chave de armazenamento, inclusive após atualizações do catálogo.

## Supabase e Olist

O catálogo permanece separado do histórico. Na integração, os dados comerciais
do Olist podem alimentar `ProductRepository`. A persistência de visualizações pode
ganhar um adaptador de API autenticada para Supabase, com autorização por usuário,
retenção e exclusão equivalentes. IDs locais precisam de mapeamento estável para
os IDs do catálogo integrado. Para sincronizar entre dispositivos, será necessário
associar o histórico à conta autenticada e atualizar o aviso sobre esse envio.

Não compartilhar respostas personalizadas em cache público, não expor chaves de
serviço no cliente e não confiar em um ID de usuário fornecido pelo navegador.
