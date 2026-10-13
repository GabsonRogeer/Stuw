import 'server-only';

export class ConfigurationError extends Error {
  constructor(public fields: string[]) {
    super('O frete está temporariamente indisponível. Entre em contato com a STUW.');
  }
}

// Quoting shipping does not create a payment and must work before payment activation.
export function shippingConfig() {
  const environment = process.env.MELHOR_ENVIO_ENVIRONMENT?.trim();
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim();
  const contact = process.env.MELHOR_ENVIO_CONTACT_EMAIL?.trim();
  const postalCode = process.env.MELHOR_ENVIO_ORIGIN_POSTAL_CODE?.replace(/\D/g, '');
  const fields: string[] = [];
  if (!['sandbox', 'production'].includes(environment ?? ''))
    fields.push('MELHOR_ENVIO_ENVIRONMENT');
  if (!token) fields.push('MELHOR_ENVIO_TOKEN');
  if (!contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
    fields.push('MELHOR_ENVIO_CONTACT_EMAIL');
  if (!postalCode || !/^\d{8}$/.test(postalCode)) fields.push('MELHOR_ENVIO_ORIGIN_POSTAL_CODE');
  if (fields.length) throw new ConfigurationError(fields);
  return {
    production: environment === 'production',
    token: token!,
    contact: contact!,
    postalCode: postalCode!,
  };
}

export class CheckoutConfigurationError extends Error {
  constructor(
    public fields: string[],
    public code: string,
  ) {
    super('O checkout ainda não está habilitado para pagamento. Entre em contato com a STUW.');
  }
}

export function commerceConfig() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const environment = process.env.MERCADO_PAGO_ENVIRONMENT?.trim();
  const shippingEnvironment = process.env.MELHOR_ENVIO_ENVIRONMENT?.trim();
  if (process.env.COMMERCE_ENABLED !== 'true')
    throw new CheckoutConfigurationError(['COMMERCE_ENABLED'], 'CHECKOUT_DISABLED');
  if (
    !site ||
    !['test', 'production'].includes(environment ?? '') ||
    shippingEnvironment !== (environment === 'production' ? 'production' : 'sandbox')
  ) {
    throw new CheckoutConfigurationError(
      ['NEXT_PUBLIC_SITE_URL', 'MERCADO_PAGO_ENVIRONMENT', 'MELHOR_ENVIO_ENVIRONMENT'],
      'INVALID_ENVIRONMENT',
    );
  }
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    throw new CheckoutConfigurationError(['NEXT_PUBLIC_SITE_URL'], 'INVALID_SITE_URL');
  }
  const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const localTest =
    environment === 'test' &&
    shippingEnvironment === 'sandbox' &&
    process.env.ALLOW_LOCAL_CHECKOUT_TEST === 'true' &&
    localhost &&
    url.protocol === 'http:';
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !localTest) ||
    (localhost && !localTest)
  )
    throw new CheckoutConfigurationError(
      ['NEXT_PUBLIC_SITE_URL', 'ALLOW_LOCAL_CHECKOUT_TEST'],
      'HTTPS_REQUIRED',
    );
  const missing = [
    'MERCADO_PAGO_ACCESS_TOKEN',
    'MERCADO_PAGO_COLLECTOR_ID',
    'MERCADO_PAGO_WEBHOOK_SECRET',
    'NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_CONTACT_EMAIL',
    'MELHOR_ENVIO_ORIGIN_POSTAL_CODE',
  ].filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new CheckoutConfigurationError(missing, 'MISSING_CREDENTIALS');
  // Credential prefixes do not identify the account environment reliably.
  // Use the explicitly configured environment; applyPayment checks live_mode
  // and collector_id from the authenticated provider response before confirmation.
  return { origin: url.origin, production: environment === 'production', localTest };
}
export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Integração temporariamente indisponível.');
  return value;
}
