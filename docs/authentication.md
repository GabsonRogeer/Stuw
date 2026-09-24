# Página de acesso

`/login` exibe uma página independente do cabeçalho de catálogo, com marca STUW,
card central, e-mail e senha. O ícone de perfil do cabeçalho e “Minha conta” no
menu mobile apontam para essa rota. A página não deve ser indexada.

O formulário é uma prévia visual: valida campos obrigatórios e formato do e-mail,
permite mostrar/ocultar a senha e informa que o acesso ainda não está disponível.
Não envia requisições de autenticação, não persiste credenciais e não cria sessões.
O botão só é habilitado após a hidratação; a senha é limpa ao enviar a prévia.
Google e Facebook não aparecem nesta etapa.

Na integração com Supabase Auth, substituir o handler demonstrativo por acesso
real por e-mail e senha, com tratamento de erros, estado de envio e sessão segura.
Implementar também cadastro e recuperação de senha antes de oferecer seus links.
Adicionar OAuth Google/Facebook apenas quando os provedores e as URLs de retorno
estiverem configurados. Não usar flags em localStorage como autenticação.
