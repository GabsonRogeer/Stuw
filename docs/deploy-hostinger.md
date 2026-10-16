# Publicação na Hostinger

Destino confirmado: **Aplicações Node.js no hPanel**, domínio principal **https://www.stuw.com.br**, já publicado pelo usuário. O domínio sem `www` deve redirecionar para esse endereço. Os workers continuam na Vercel durante a validação da Hostinger.

## Node e instalação

O projeto declara **Node.js 24.19.0** em `package.json`, no pacote raiz do `package-lock.json`, em `.nvmrc` e em `.node-version`. O campo `engines` declara a versão esperada; sem modo estrito, o npm pode apenas avisar quando ela for diferente. Os arquivos de versão são usados por gerenciadores compatíveis, não instalam Node automaticamente.

O hPanel [permite selecionar a linha 24.x e consulta o campo engines](https://www.hostinger.com/support/how-to-select-the-node-js-version-for-your-application/). Selecione **24.x** e confira `node --version` no log/terminal do ambiente de build e do runtime; a documentação não garante controle do patch exato pelo seletor. Se a Hostinger executar outro patch, registrar essa diferença antes de afirmar que o servidor está em 24.19.0.

Configuração esperada para a aplicação:

- Framework: **Next.js com servidor Node.js**.
- Diretório raiz: raiz do repositório.
- Instalação: `npm ci`, preservando o lockfile.
- Build: `npm run build` (executa `next build --webpack`).
- Inicialização: `npm start`, quando esse campo for solicitado pelo painel; o projeto usa `next start` e respeita `PORT` fornecida pelo host.
- Saída: usar a detecção de Next.js do hPanel. Não selecionar exportação estática: autenticação, Server Actions, checkout, webhooks e jobs precisam do servidor.

O guia oficial descreve [a publicação de aplicações Node.js e Next.js pelo GitHub no hPanel](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). Conectar apenas o repositório necessário. Credenciais e arquivos `.env.local`, `.vercel/`, backups, DANFE/XML e artefatos operacionais não devem entrar no repositório ou no pacote de publicação.

O primeiro deploy será por ZIP, pois o colaborador não consegue conectar o GitHub nessa conta. O arquivo deve conter `package.json` e `package-lock.json` na raiz, os arquivos de configuração necessários, `src/` e `public/`; excluir `node_modules`, `.next`, `.git`, `.env*`, `.vercel` e artefatos internos. A Hostinger instala as dependências e gera o build.

Depois, um usuário com as permissões necessárias pode acessar o Dashboard do site → **⋮ → Connect to GitHub**, autorizar o repositório e selecionar a branch. O [guia oficial de Node.js, FAQ sobre conexão com GitHub](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) documenta essa opção. Conferir que o repositório contém a mesma versão do ZIP antes do novo deploy: os arquivos da aplicação serão substituídos pelos do repositório. As variáveis devem continuar configuradas no painel e o Supabase permanece externo.

## Variáveis e integrações

Configurar as variáveis de produção diretamente em Environment Variables no hPanel, antes do build. Não copiar o `.env.local` integralmente: ele mantém o checkout local desabilitado e configurações de desenvolvimento. Usar as configurações efetivas da produção atual como referência, sem colar segredos no chat.

1. Definir `NODE_ENV=production` e `NEXT_PUBLIC_SITE_URL=https://www.stuw.com.br`. As variáveis `NEXT_PUBLIC_*` são incorporadas ao JavaScript no build; alterações exigem novo build.
2. Manter **o banco Supabase existente** e as credenciais correspondentes. Não criar ou trocar o projeto de banco para mudar a hospedagem.
3. Conferir Mercado Pago em produção, Melhor Envio em produção, Olist e e-mail transacional; replicar os segredos no painel, incluindo o segredo do cron. O checklist `scripts/production-preflight.cjs` verifica o ambiente sem gerar compras. Executar em um processo que receba somente o ambiente do servidor.
4. Após a nova URL responder por HTTPS, configurar Site URL e Redirect URLs do Supabase para os retornos de autenticação usados em `/auth/callback` e `/auth/confirm`, mantendo os retornos antigos durante a transição. As configurações da integração OAuth, se habilitada, também devem ser conferidas.
5. Atualizar a notificação de pagamentos no Mercado Pago para `https://www.stuw.com.br/api/webhooks/mercado-pago`, com o segredo correspondente, e conferir o webhook de estoque da Olist se estiver configurado. Não desabilitar validação de assinatura.
6. Os agendamentos no Supabase atualmente chamam a Vercel: pagamentos, e-mail, pedidos e estoque. Validar os endpoints autenticados na Hostinger antes de mudar seus destinos. Manter um agendamento de cada rotina, evitando duplicar execuções entre as hospedagens. Preservar o segredo do Vault e o mesmo `CRON_SECRET` no destino, ou coordenar sua rotação.
7. Os e-mails continuam usando o SMTP Hostinger existente. Na troca de DNS, preservar MX, SPF, DKIM e DMARC. Alterar apenas os registros necessários ao site.

## Verificação antes da troca

- Build e runtime com a versão de Node documentada; home, catálogo, imagens e páginas autenticadas funcionando.
- Ajustar as URLs canônicas e os dados estruturados de produto para usar o domínio de produção configurado: a página de produto e a validação do campo canonical ainda possuem referência fixa à Vercel. Pendência identificada durante a preparação; não está resolvida apenas ao mudar `NEXT_PUBLIC_SITE_URL`.
- Cadastro, confirmação, recuperação de senha e login retornam ao domínio correto.
- Cotação real de frete e consulta de pagamento funcionando com os ambientes de produção.
- Webhooks com assinatura e jobs com autenticação; chamadas sem segredo continuam recusadas.
- Envio de e-mail e geração de PDF/DANFE testados **no servidor Hostinger**. O projeto usa Puppeteer e Chromium; validar as bibliotecas e a execução do navegador nesse ambiente. `INVOICE_CHROMIUM_EXECUTABLE_PATH` permite usar um executável instalado no host quando necessário. Não afirmar compatibilidade do PDF com base apenas no teste da Vercel ou do Windows.
- Consulta da NF pelo titular e recusa de acesso por outra conta.
- HTTPS e redirecionamento do domínio sem `www`; páginas de conta, API e checkout sem cache público no proxy/CDN.

A Vercel permanece como destino dos workers até concluir a validação. Algumas imagens já cadastradas na Olist apontam para URLs da Vercel; preservar esses endereços até revisar os vínculos. A hospedagem anterior pode servir de retorno operacional durante a troca, sem duplicar agendamentos ou criar outra compra para provocar uma confirmação.

O [fluxo fiscal automático](olist-automatic-invoicing.md) depende da fila ativada no banco e do worker publicado. Trocar a hospedagem não ativa a fila nem migra o cron. Pedidos anteriores à data de ativação continuam manuais.

## Compatibilidade do build com a GLIBC da Hostinger

O build enviado à Hostinger falhou porque `@next/swc-linux-x64-gnu` exigiu `GLIBC_2.29`, ausente no servidor. O Next carregou as alternativas WASM, mas o Turbopack exige os módulos nativos e encerrou a compilação.

O script `build` passou a executar `next build --webpack`, conforme a [orientação oficial para plataformas com apenas WASM](https://nextjs.org/docs/app/api-reference/turbopack#supported-platforms). O script de desenvolvimento permanece `next dev`; a alteração afeta a compilação de produção. Pode aumentar o tempo de build; a aplicação deve manter o comportamento funcional, sujeito à verificação após a compilação.

No hPanel, usar `npm run build` para que a flag seja respeitada. Se o painel chamar `next build` diretamente, alterar esse comando para `next build --webpack`. Publicar os fontes e o lockfile atualizados, sem `node_modules` ou `.next`, e conferir o novo log no servidor. Um build local aprovado não comprova as dependências de runtime na Hostinger; o teste do PDF/DANFE continua necessário.

Validação local em 16/10/2026: builds Webpack normal e com carregamento WASM forçado concluídos, incluindo TypeScript e as 41 páginas estáticas. O teste de WASM usou `NEXT_TEST_WASM` apenas no processo de diagnóstico; essa variável não foi adicionada ao projeto nem deve ser configurada na Hostinger. O build foi servido temporariamente com `next start`: home, catálogo, login e imagem de produto responderam 200; conta e checkout sem sessão redirecionaram ao login (307); job sem segredo respondeu 401. Nenhuma compra ou emissão fiscal foi criada. A confirmação final do ambiente Linux depende do novo deploy no hPanel.
