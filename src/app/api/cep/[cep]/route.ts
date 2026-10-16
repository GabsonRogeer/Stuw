import { parsePostalAddress } from '@/services/postal-code';

export const runtime = 'nodejs';

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;
  if (!/^\d{8}$/.test(cep)) return failure('invalid_postal_code', 400);
  try {
    // Only a validated CEP can reach this fixed host. No account, document or
    // delivery data is sent to the provider. Cache only validated public output.
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return failure('postal_service_unavailable', 503);
    const text = await response.text();
    if (text.length > 10_000) return failure('postal_service_unavailable', 503);
    const result: unknown = JSON.parse(text);
    if (
      result &&
      typeof result === 'object' &&
      'erro' in result &&
      (result.erro === true || result.erro === 'true')
    )
      return failure('postal_code_not_found', 404);
    const address = parsePostalAddress(result, cep);
    return Response.json(address, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    });
  } catch {
    return failure('postal_service_unavailable', 503);
  }
}
