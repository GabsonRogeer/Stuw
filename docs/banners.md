# Campanhas e carrossel da home

Em **Admin → Banners**, use **Novo card** para adicionar uma campanha. Cada card é independente: publicar um segundo card mantém o primeiro e os dois alternam na home quando seus períodos coincidem.

## Criar ou editar

1. Escolha **Foto + texto** ou **Foto em toda a largura** do destaque inicial da home.
2. Preencha o título e o link. No formato de foto inteira, o título identifica a campanha e descreve a imagem para leitores de tela; não aparece sobre a foto.
3. Envie a imagem. Por padrão, a mesma foto atende desktop e celular; desmarque a opção para enviar uma versão própria para celular.
4. Defina início, fim e ordem, se desejar. As datas do editor usam o horário local do navegador; a listagem apresenta os horários de Brasília. Menores números de ordem aparecem primeiro.
5. Confira a prévia para desktop e celular e clique em **Salvar rascunho**.
6. Clique em **Publicar rascunho** para incluir o card no carrossel, conforme o período escolhido.

Salvar uma edição não modifica a versão no ar. É preciso publicá-la novamente. O editor impede publicar alterações locais ainda não salvas.

- Imagens: JPG, PNG ou WebP, até 5 MB por arquivo.
- Foto inteira desktop: sugestão de 1920 × 800 px.
- Foto com texto: sugestão de 1200 × 1400 px.
- Celular: sugestão de 800 × 1000 px.
- As fotos ocupam o espaço com recorte centralizado; confira o enquadramento nas duas prévias.
- Links aceitam caminhos internos, como `/produtos`, ou HTTPS.

## Período e cards salvos

- Sem início: entra no ar assim que for publicado.
- Com início futuro: fica **Agendada** até a data.
- Sem fim: permanece publicada até ser retirada.
- O início é inclusivo; no instante final, a campanha deixa de ser exibida.
- Ao terminar, o card continua salvo como **Encerrada**. Edite as datas e publique novamente para reutilizá-lo.
- **Retirar do ar**, dentro do editor, remove somente a publicação daquele card e preserva o rascunho.
- **Excluir**, na lista, pede confirmação e retira o card da lista e da home. Os demais cards permanecem.

A lista indica quando há mudanças salvas ainda não publicadas. Nessa situação, a home continua usando conteúdo e período da última publicação.

## Comportamento da home

Dois ou mais cards vigentes alternam a cada 6 segundos. Há setas, seletores e botão de pausa. A alternância pausa ao passar o mouse, navegar por teclado ou interagir manualmente. A preferência de movimento reduzido desativa a alternância automática.

Um único card aparece sem controles. Se não houver campanha vigente, ou se a consulta falhar, aparece o destaque original da loja.

A consulta pública não usa cache de dados. Abas abertas verificam novas publicações a cada 30 segundos enquanto visíveis; o fim da campanha também é verificado no cliente a cada segundo. Novas visitas já consultam as campanhas vigentes. Não é necessário novo deploy para alterar os cards.

## Banco, migração e segurança

Migração: `supabase/migrations/20261013055416_home_banner_campaigns.sql`, após as migrações anteriores de banners.

- `banner_campaigns`: rascunhos, restritos aos administradores por RLS.
- `banner_publications`: versões publicadas. Visitantes só leem campanhas dentro do período; administradores também leem futuras e encerradas.
- `change_banner_campaign`: publicação, retirada e exclusão transacionais, com verificação de administrador, ID e revisão. Alterações concorrentes exigem recarregar.
- A migração preserva o banner anterior e seu rascunho separadamente. As tabelas legadas ficam disponíveis para compatibilidade durante a publicação do novo site.
- A exclusão é lógica no cadastro, com remoção da versão publicada. O cadastro excluído deixa de ser acessível pelo admin da aplicação.
- O bucket público `site-banners` é mantido. Os uploads usam caminhos imutáveis e não são removidos automaticamente: excluir um card não exclui seus arquivos do Storage. URLs de imagens continuam públicas.
- Nenhuma chave administrativa é exposta ao navegador.

Os testes cobrem migração com rascunho diferente da publicação, múltiplos cards, datas, RLS, concorrência, retirada/exclusão isoladas, validação de imagens/links e renderização dos dois formatos.

Na implantação de 13/10/2026, o site usava o destaque original e havia um rascunho sem publicação. O rascunho foi preservado separadamente. A foto e o texto do destaque original foram guardados em uma campanha publicada, para que o próximo card seja acrescentado sem retirar o conteúdo atual. As cópias de segurança e os registros dessa operação ficam em `.local-backups/banner-campaigns/`, fora do deploy e do Git.
