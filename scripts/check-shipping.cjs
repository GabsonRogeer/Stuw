// Reads local secrets but only prints configuration names and sanitized quote results.
const { loadEnvConfig } = require('@next/env');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename);
  cache.set(filename, loaded);
  loaded.require = (name) => {
    if (name === 'server-only') return {};
    if (name.startsWith('@/')) return load(path.join(process.cwd(), 'src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), name) + '.ts');
    throw new Error('Unsupported diagnostic dependency');
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return loaded.exports;
}
async function main() {
  const { shippingConfig, ConfigurationError } = load('src/lib/integrations/config.ts');
  console.log(
    'Pagamento habilitado: ' +
      (process.env.COMMERCE_ENABLED === 'true'
        ? 'sim'
        : 'não (não impede simulação de frete no admin)'),
  );
  console.log(
    'Chave de servidor Supabase: ' +
      (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        ? 'preenchida'
        : 'AUSENTE (necessária no checkout)'),
  );
  try {
    const config = shippingConfig();
    console.log(
      'Configuração Melhor Envio preenchida; ambiente: ' +
        (config.production ? 'produção' : 'sandbox'),
    );
    const destination = process.argv[2];
    if (!destination) {
      console.log('Para validar o token com uma cotação: npm run shipping:check -- CEP_DESTINO');
      return;
    }
    if (!/^\d{8}$/.test(destination)) throw new Error('CEP_DESTINO deve ter oito dígitos.');
    if (config.production)
      throw new Error(
        'Este diagnóstico com embalagem fictícia exige MELHOR_ENVIO_ENVIRONMENT=sandbox.',
      );
    const { calculateShipping } = load('src/lib/integrations/melhor-envio.ts');
    const options = await calculateShipping(destination, [
      {
        id: 'stuw-diagnostic',
        width: 20,
        height: 5,
        length: 30,
        weight: 0.3,
        insurance_value: 100,
        quantity: 1,
      },
    ]);
    console.log('API respondeu com sucesso: token aceito. Serviços disponíveis: ' + options.length);
    for (const option of options)
      console.log(option.name + ': R$ ' + option.price.toFixed(2) + '; ' + option.deliveryEstimate);
  } catch (error) {
    if (error instanceof ConfigurationError)
      console.error('Ausentes ou inválidas: ' + error.fields.join(', '));
    else if (error.provider === 'Melhor Envio')
      console.error(
        'Melhor Envio HTTP ' +
          error.status +
          ([401, 403].includes(error.status)
            ? ': confira ambiente, validade e permissões do token.'
            : ': confira disponibilidade e dados de envio.'),
      );
    else if (error.cause || ['TimeoutError', 'AbortError', 'TypeError'].includes(error.name))
      console.error('Falha de rede ao consultar Melhor Envio.');
    else console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { load };
if (require.main === module)
  main().catch(() => {
    console.error('Falha no diagnóstico; nenhum segredo foi exibido.');
    process.exitCode = 1;
  });
