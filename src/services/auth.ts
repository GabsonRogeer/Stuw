export function validateRegistration(input: {
  name: string;
  email: string;
  password: string;
  confirmation: string;
}) {
  if (input.name.trim().length < 2 || input.name.trim().length > 200)
    return 'Informe seu nome (entre 2 e 200 caracteres).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) || input.email.length > 254)
    return 'Informe um e-mail válido.';
  if (input.password.length < 8 || input.password.length > 128)
    return 'Use uma senha entre 8 e 128 caracteres.';
  if (input.password !== input.confirmation) return 'As senhas não coincidem.';
  return null;
}
export function authErrorMessage(code?: string) {
  switch (code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar. Verifique também a pasta de spam.';
    case 'weak_password':
      return 'Escolha uma senha mais forte para atender aos requisitos de segurança.';
    case 'over_email_send_rate_limit':
      return 'O serviço de confirmação de e-mail atingiu o limite de envios. Não foi possível concluir o cadastro agora. Tente novamente mais tarde.';
    case 'over_request_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'email_address_not_authorized':
      return 'O envio de confirmação para este endereço ainda não está disponível. Entre em contato com a loja.';
    case 'user_already_exists':
      return 'Não foi possível concluir o cadastro. Tente entrar na sua conta.';
    default:
      return 'Não foi possível concluir agora. Tente novamente em instantes.';
  }
}
