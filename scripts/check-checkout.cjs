// Uses the same configuration validation as the checkout; never prints secret values.
const { load } = require('./check-shipping.cjs');
const { commerceConfig, CheckoutConfigurationError } = load('src/lib/integrations/config.ts');
try {
  const config = commerceConfig();
  console.log(
    'Configuração do checkout: OK; ambiente ' + (config.production ? 'produção' : 'teste'),
  );
  console.log(
    config.localTest
      ? 'Teste local: confirmação por consulta à API; webhook não é enviado para localhost.'
      : 'Webhook: URL HTTPS configurada (acessibilidade ainda precisa ser verificada).',
  );
  console.log(
    'Esta verificação não cria pedidos nem cobranças e não valida as credenciais na API.',
  );
} catch (error) {
  if (error instanceof CheckoutConfigurationError) {
    console.error('Checkout bloqueado: ' + error.code);
    console.error('Configurações a conferir: ' + error.fields.join(', '));
  } else console.error('Não foi possível verificar a configuração.');
  process.exitCode = 1;
}
