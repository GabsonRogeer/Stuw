const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadAdmin(client) {
  const filename = path.resolve(__dirname, '../src/lib/supabase/admin.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name === 'server-only') return {};
    if (name === './server') return { createClient: async () => client };
    throw new Error(`Unexpected import: ${name}`);
  };
  compiled._compile(outputText, filename);
  return compiled.exports.requireAdmin;
}

test('admin guard rejects missing or invalid identity before querying permissions', async () => {
  for (const result of [
    { data: { user: null }, error: null },
    { data: { user: { id: 'customer' } }, error: new Error('Invalid token') },
  ]) {
    const requireAdmin = loadAdmin({
      auth: { getUser: async () => result },
      rpc: () => assert.fail('Must not query permissions without verified identity'),
    });
    await assert.rejects(requireAdmin, /Autenticação necessária/);
  }
});

test('admin guard fails closed on customer role, missing migration or database failure', async () => {
  for (const result of [
    { data: false, error: null },
    { data: null, error: new Error('Missing function') },
    { data: true, error: new Error('Database unavailable') },
  ]) {
    const requireAdmin = loadAdmin({
      auth: { getUser: async () => ({ data: { user: { id: 'customer' } }, error: null }) },
      rpc: async () => result,
    });
    await assert.rejects(requireAdmin, /não autorizado/);
  }
});

test('admin permission is queried again and revocation takes effect on next operation', async () => {
  let granted = true;
  const user = { id: 'admin' };
  const requireAdmin = loadAdmin({
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async (name) => {
      assert.equal(name, 'is_admin');
      return { data: granted, error: null };
    },
  });
  assert.equal((await requireAdmin()).user, user);
  granted = false;
  await assert.rejects(requireAdmin, /não autorizado/);
});
