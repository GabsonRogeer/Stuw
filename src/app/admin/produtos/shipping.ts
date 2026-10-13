'use server';
import { requireAdmin } from '@/lib/supabase/admin';
import { ConfigurationError, shippingConfig } from '@/lib/integrations/config';
import { IntegrationError } from '@/lib/integrations/http';
import { calculateShipping } from '@/lib/integrations/melhor-envio';
import type { ShippingOption } from '@/services/shipping';

export async function testProductShipping(input: {
  postalCode: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  price: number;
  isTestPackage: boolean;
}): Promise<{ error?: string; options?: ShippingOption[]; sandbox?: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { error: 'Acesso administrativo necessário.' };
  }
  try {
    if (
      !input ||
      typeof input.postalCode !== 'string' ||
      !/^\d{8}$/.test(input.postalCode.replace(/\D/g, '')) ||
      ![input.weight, input.length, input.width, input.height, input.price].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 100000,
      )
    )
      return { error: 'Informe CEP válido, peso, dimensões e valor positivo para a simulação.' };
    const { production } = shippingConfig();
    if (production && input.isTestPackage)
      return { error: 'Use medidas reais para consultar o frete em produção.' };
    const options = await calculateShipping(input.postalCode.replace(/\D/g, ''), [
      {
        id: 'admin-shipping-test',
        weight: input.weight! / 1000,
        length: input.length!,
        width: input.width!,
        height: input.height!,
        insurance_value: Math.round(input.price * 100) / 100,
        quantity: 1,
      },
    ]);
    return options.length
      ? { options, sandbox: !production }
      : {
          error:
            'A API respondeu, mas não há serviços disponíveis para esses CEPs e essa embalagem.',
        };
  } catch (error) {
    if (error instanceof ConfigurationError)
      return {
        error: `Configuração ausente ou inválida: ${error.fields.join(', ')}. Atualize o ambiente e reinicie a aplicação.`,
      };
    if (error instanceof IntegrationError) {
      if ([401, 403].includes(error.status))
        return {
          error: `Melhor Envio recusou a autorização (HTTP ${error.status}). Confira se o token pertence ao ambiente configurado, está ativo e permite cotação.`,
        };
      if (error.status === 422)
        return {
          error:
            'Melhor Envio recusou os dados. Confira os CEPs, peso e dimensões da embalagem (HTTP 422).',
        };
      return { error: `Melhor Envio indisponível (HTTP ${error.status}). Tente novamente.` };
    }
    return {
      error: 'Não foi possível conectar ao Melhor Envio. Confira a rede e tente novamente.',
    };
  }
}
