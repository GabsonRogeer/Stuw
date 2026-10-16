# Preenchimento de endereço pelo CEP

Disponível no checkout e em **Minha conta → Endereços**, tanto para novos endereços quanto para edição. A consulta começa ao digitar os oito dígitos; abrir ou selecionar um endereço salvo preserva os dados cadastrados.

O serviço é o [ViaCEP](https://viacep.com.br/), acessado pelo backend em `GET /api/cep/[cep]`. Não exige token nem nova variável de ambiente. Apenas o CEP é enviado ao provedor; número, complemento, destinatário e dados da conta permanecem fora da consulta.

- O campo apresenta a máscara `00000-000`. Rua, bairro, cidade e UF são preenchidos automaticamente; número e complemento continuam manuais.
- Campos alterados pelo cliente durante a consulta são preservados. Trocar o CEP, selecionar um endereço salvo, enviar o formulário ou sair da tela cancela a aplicação da resposta anterior.
- CEPs gerais de município podem trazer somente cidade e UF; os campos restantes permanecem editáveis.
- Há debounce de 350 ms, limite de cinco segundos no provedor e de oito segundos no navegador. Uma indisponibilidade permite preenchimento manual e nova tentativa.
- O backend aceita apenas oito dígitos e usa um host fixo. Valida CEP retornado, UF e campos antes de responder. Respostas válidas públicas podem ser armazenadas em cache por 24 horas; erros não são cacheados.
- Os códigos HTTP são 400 para formato inválido, 404 para CEP inexistente e 503 para falha do serviço. A consulta não substitui a validação dos dados ao salvar o endereço ou finalizar a compra.

Validação em 16/10/2026: 176 testes aprovados, incluindo respostas atrasadas, cancelamento, timeout, preenchimento dos dois formulários e preservação de edições manuais. Lint, tipagem e build Webpack passaram. O servidor local do build também foi testado com o ViaCEP real: CEP válido (200), inválido (400) e inexistente (404), sem cadastrar clientes ou criar pedidos.

Para atualizar a loja na Hostinger, publicar o ZIP `.local-backups/stuw-hostinger-cep-20261016.zip` (fontes e arquivos públicos, sem credenciais). A publicação na Vercel não substitui o upload no hPanel.

Deploy Vercel de produção: `dpl_CMjGyxuggHtWF9vj5AHgtHCpymaY`, promovido para `stuw.vercel.app` após confirmar a consulta real com HTTP 200 no novo deploy. Não houve alteração de variáveis, banco ou agendamentos para esta funcionalidade.
