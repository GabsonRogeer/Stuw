const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith('sb_publishable_')) {
    throw new Error('Configure a URL e a chave publishable em .env.local.');
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });

  // Anonymous select is allowed at table level, but RLS must hide every row.
  const { data, error } = await supabase.from('profiles').select('id').limit(1);
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw new Error(
        'API acessível. A migração de profiles ainda precisa ser aplicada no Supabase.',
      );
    }
    throw new Error(`Falha ao consultar profiles (${error.code || 'rede'}): ${error.message}`);
  }
  if (data.length) throw new Error('Falha de segurança: visitante conseguiu ler perfis.');

  const { error: adminError } = await supabase.rpc('is_admin');
  if (adminError?.code !== '42501') {
    throw new Error('Esperado acesso negado (42501) para is_admin sem autenticação.');
  }
  console.log(
    'Conexão OK. Migração acessível; perfis ocultos e is_admin bloqueado para visitantes.',
  );
  console.log('Execute também supabase/tests/identity.sql para testar isolamento e permissões.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
