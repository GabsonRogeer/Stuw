const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiledModule = new Module(filename);
  compiledModule.require = (name) => {
    if (name in deps) return deps[name];
    throw new Error('Unexpected import ' + name);
  };
  compiledModule._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiledModule.exports;
}
const banner = load('src/services/banners.ts');
const content = {
  subtitle: 'O luxo da pausa.',
  description: 'Essenciais para o estúdio. Liberdade para todos os dias.',
  title: 'Nova coleção',
  link: '/produtos',
  desktop_path: 'home/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
  mobile_path: 'home/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.webp',
};
const form = (patch = {}) => {
  const data = new FormData();
  Object.entries({ ...content, revision: '0', ...patch }).forEach(([key, value]) =>
    data.set(key, value),
  );
  return data;
};
test('banner links block executable schemes, protocol-relative links and credentials', () => {
  for (const link of ['/', '/produtos?colecao=Move', 'https://example.com/collection'])
    assert.equal(banner.bannerLinkValid(link), true, link);
  for (const link of [
    'javascript:alert(1)',
    'data:image/png,test',
    '//evil.example',
    '/\\evil.example',
    '/%2fevil.example',
    'https://user:pass@example.com',
    'http://example.com',
    '/broken%',
  ])
    assert.equal(banner.bannerLinkValid(link), false, link);
});
test('banner requires both controlled storage paths and valid titles', () => {
  assert.equal(banner.validateBanner(content), null);
  assert.equal(banner.validateBanner({ ...content, subtitle: '', description: '' }), null);
  assert.ok(banner.validateBanner({ ...content, subtitle: 'a'.repeat(161) }));
  assert.ok(banner.validateBanner({ ...content, description: 'a'.repeat(301) }));
  for (const patch of [
    { title: ' ' },
    { title: 'a'.repeat(161) },
    { desktop_path: 'https://external/image.jpg' },
    { mobile_path: '../private/file' },
    { mobile_path: '' },
  ])
    assert.ok(banner.validateBanner({ ...content, ...patch }));
});
test('banner uploads enforce size and image types', () => {
  assert.equal(
    banner.validateBannerFile({ size: banner.BANNER_MAX_BYTES, type: 'image/webp' }),
    null,
  );
  for (const file of [
    { size: 0, type: 'image/jpeg' },
    { size: banner.BANNER_MAX_BYTES + 1, type: 'image/png' },
    { size: 100, type: 'image/svg+xml' },
  ])
    assert.ok(banner.validateBannerFile(file));
});
function setup({
  authorized = true,
  storageError = null,
  result = { data: { ...content, slot: 'home', revision: 1 }, error: null },
  rpcError = null,
} = {}) {
  const calls = [];
  const query = {};
  for (const name of ['insert', 'update', 'eq', 'select'])
    query[name] = (...args) => {
      calls.push([name, ...args]);
      return query;
    };
  query.maybeSingle = async () => result;
  const client = {
    from: (table) => {
      calls.push(['from', table]);
      return query;
    },
    storage: { from: () => ({ info: async () => ({ error: storageError }) }) },
    rpc: async (...args) => {
      calls.push(['rpc', ...args]);
      return { error: rpcError };
    },
  };
  const actions = load('src/app/admin/banners/actions.ts', {
    '@/services/banners': banner,
    '@/lib/supabase/admin': {
      requireAdmin: async () => {
        if (!authorized) throw new Error('Denied');
        return { supabase: client };
      },
    },
    'next/cache': {
      revalidatePath: (path) => calls.push(['path', path]),
      updateTag: (tag) => calls.push(['tag', tag]),
    },
  });
  return { actions, calls };
}
test('all banner writes reject unauthorized callers', async () => {
  const { actions, calls } = setup({ authorized: false });
  assert.ok((await actions.saveBanner(form())).error);
  assert.ok((await actions.publishBanner(1)).error);
  assert.ok((await actions.unpublishBanner()).error);
  assert.deepEqual(calls, []);
});
test('saving a draft never writes the live banner or invalidates the home cache', async () => {
  const { actions, calls } = setup();
  assert.ok((await actions.saveBanner(form())).draft);
  const saved = calls.find((call) => call[0] === 'insert')[1];
  assert.equal(saved.subtitle, content.subtitle);
  assert.equal(saved.description, content.description);
  assert.ok(calls.some((call) => call[0] === 'from' && call[1] === 'banner_drafts'));
  assert.ok(
    !calls.some((call) => call[0] === 'rpc' || call[0] === 'tag' || call[1] === 'site_banners'),
  );
});
test('draft save checks uploaded assets and refuses concurrent edits', async () => {
  assert.ok(
    (await setup({ storageError: { message: 'missing' } }).actions.saveBanner(form())).error,
  );
  const { actions, calls } = setup({ result: { data: null, error: null } });
  assert.match((await actions.saveBanner(form({ revision: '3' }))).error, /outra sessão/);
  assert.ok(calls.some((call) => call[0] === 'eq' && call[1] === 'revision' && call[2] === 3));
});
test('publication passes expected revision and refreshes cache only on success', async () => {
  const { actions, calls } = setup();
  assert.ok((await actions.publishBanner(3)).message);
  assert.deepEqual(
    calls.find((call) => call[0] === 'rpc'),
    ['rpc', 'publish_home_banner', { expected_revision: 3 }],
  );
  assert.ok(calls.some((call) => call[0] === 'tag' && call[1] === 'home-banner'));
  const failed = setup({ rpcError: { message: 'conflict' } });
  assert.ok((await failed.actions.publishBanner(3)).error);
  assert.ok(!failed.calls.some((call) => call[0] === 'tag'));
});
