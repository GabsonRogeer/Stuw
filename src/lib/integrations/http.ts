import 'server-only';

export class IntegrationError extends Error {
  constructor(
    public provider: string,
    public status: number,
    public codes: string[] = [],
  ) {
    super(`${provider} temporariamente indisponível. Tente novamente.`);
  }
}
export async function integrationRequest<T>(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) {
    // Keep only machine codes, never provider messages, request bodies or card data.
    let codes: string[] = [];
    if (provider === 'Mercado Pago') {
      const body = await response.json().catch(() => null);
      const symbolic = new Set([
        'bad_request',
        'unauthorized',
        'forbidden',
        'invalid_token',
        'invalid_access_token',
        'invalid_users',
        'internal_error',
        'not_found',
      ]);
      const values: unknown[] = [
        body?.error,
        ...(Array.isArray(body?.cause)
          ? body.cause.map((c: { code?: unknown } | null) => c?.code)
          : []),
      ];
      codes = [
        ...new Set(
          values
            .filter(
              (code): code is string | number =>
                (typeof code === 'number' &&
                  Number.isInteger(code) &&
                  code >= 0 &&
                  code <= 999999) ||
                (typeof code === 'string' && (/^\d{1,6}$/.test(code) || symbolic.has(code))),
            )
            .map(String),
        ),
      ].slice(0, 10);
    }
    throw new IntegrationError(provider, response.status, codes);
  }
  return response.json() as Promise<T>;
}
