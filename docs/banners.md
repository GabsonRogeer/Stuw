# Banners da home

Esta entrega administra o destaque principal da home, mantendo a disposição de
texto e imagem e as demais seções existentes. Há uma posição (`home`), com uma
imagem desktop e outra mobile. Não é um carrossel.

## Aplicar no Supabase

Após as migrações anteriores, execute no SQL Editor:

1. `supabase/migrations/20260928145859_banners.sql` uma única vez.
2. `supabase/migrations/20260928153112_banner_text_fields.sql` para subtítulo e descrição.
3. `supabase/tests/banners.sql` (fixtures transacionais; termina em ROLLBACK).

Se a migração inicial de banners já foi aplicada, execute somente a nova migração
de campos de texto e o teste atualizado. Ela preserva títulos, imagens e links;
subtítulo e descrição começam vazios nos banners existentes.

A migração cria as tabelas, o bucket público `site-banners` e suas políticas.
Não é necessário cadastrar credenciais novas no projeto. Clientes usam a sessão
autenticada e a publishable key; as permissões são conferidas por RLS. Confira
os Security Advisors no painel depois de aplicar a migração.

## Uso

Em `/admin/banners`, preencha título principal, subtítulo, descrição e link e envie as duas imagens. A prévia usa
os arquivos locais antes do upload e permite alternar desktop/celular. Os links
da prévia não navegam, evitando sair do editor sem salvar.

O título principal usa a cor escura da STUW; o subtítulo aparece abaixo, em verde
e itálico; a descrição tem tamanho menor e cor discreta. Subtítulo (até 160
caracteres) e descrição (até 300) são opcionais. O tema escuro mantém os contrastes
da marca. Os três campos são salvos e publicados juntos.

- JPG, PNG e WebP, no máximo 5 MB por imagem. SVG não é aceito.
- Sugestões: desktop 1200 × 1400 e celular 800 × 1000 px. O recorte usa object-fit
  cover centralizado; confirme o enquadramento na prévia.
- Link: caminho interno como `/produtos` ou URL HTTPS, sem credenciais embutidas.
- **Salvar rascunho**: envia arquivos diretamente ao Storage e grava título,
  link e caminhos. Isso não altera o conteúdo publicado.
- **Publicar rascunho**: publica somente a versão salva. Alterações locais
  precisam ser salvas primeiro. A função verifica a revisão e a existência das
  duas imagens antes de copiar o rascunho para a versão pública, em transação.
- **Retirar do ar**: remove a versão publicada; o rascunho é mantido e a home volta
  ao destaque original.

O bucket é público: imagens enviadas podem ser acessadas por sua URL mesmo antes
de publicar. Os caminhos têm UUID aleatório. Títulos e links do rascunho permanecem
restritos aos administradores. Não use esse bucket para material confidencial.

## Cache e persistência

A home consulta somente `site_banners`, sem usar sessão administrativa. A leitura
tem cache de 60 segundos com tag `home-banner`. Publicar/retirar expira essa tag
imediatamente via `updateTag` e revalida `/`. Não é necessário novo deploy. Abas
já abertas precisam atualizar a página para exibir o novo banner.

Enquanto não há publicação, ou se o banco não responde, o destaque original
continua disponível. O editor mostra falha de consulta em vez de simular sucesso.

Cada upload cria um caminho novo, sem sobrescrever arquivos. Isso evita modificar
uma imagem publicada ao editar o rascunho e permite cache longo das imagens.
Arquivos anteriores ou uploads cujo salvamento falhou não são apagados
automaticamente. Uma futura rotina de limpeza deve preservar todos os caminhos
referenciados por `banner_drafts` e `site_banners` antes de remover órfãos.

## Segurança e verificação

As ações conferem `requireAdmin`. Visitantes leem somente a versão publicada;
clientes comuns não editam tabelas nem enviam imagens. As funções de publicação
conferem `auth.uid()` e a permissão no banco, com search_path vazio. O schema
`private` deve permanecer fora da Data API. O bucket permite inserção a admins e
nunca overwrite/delete via aplicação. Limites de tamanho e MIME também existem
no Storage, além das validações do editor.

Os testes Node verificam validações, acesso e separação entre salvar/publicar.
Os testes SQL verificam RLS, Storage, concorrência de revisão e publicação. Após
aplicar, teste com a conta admin: salvar rascunho, conferir que a home não mudou,
publicar, conferir desktop/mobile, editar sem publicar e retirar do ar.
