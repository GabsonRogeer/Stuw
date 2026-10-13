const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(file, deps = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const m = new Module(filename);
  m.require = (name) => {
    if (name in deps) return deps[name];
    throw new Error(name);
  };
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return m.exports;
}
const categories = load('src/services/categories.ts');
const navigation = load('src/data/navigation.ts');
test('category validation rejects invalid names, kinds and ordering', () => {
  const valid = { kind: 'piece', label: 'Shorts', position: 0 };
  assert.equal(categories.validateCategory(valid), null);
  for (const patch of [
    { label: '' },
    { label: '  ' },
    { label: 'a'.repeat(81) },
    { kind: '__proto__' },
    { kind: 'other' },
    { position: -1 },
    { position: 0.5 },
    { position: Infinity },
  ]) {
    assert.ok(categories.validateCategory({ ...valid, ...patch }));
  }
});
test('category loading uses cursors and preserves an empty managed list', async (t) => {
  const repository = load('src/repositories/categories.ts', {
    react: { cache: (fn) => fn },
    '@/data/navigation': navigation,
    '@/services/categories': categories,
    '@/lib/supabase/config': {
      isSupabaseConfigured: () => true,
      getSupabaseConfig: () => ({ url: 'https://example.invalid', key: 'test' }),
    },
  });
  const calls = [];
  const replies = [
    [{ id: 1, kind: 'piece', label: 'Renamed', value: 'original', position: 3, archived: false }],
    [
      { id: 2, kind: 'activity', label: 'Running', value: 'run', position: 0, archived: false },
      { id: 3, kind: 'piece', label: 'First', value: 'first', position: 0, archived: false },
    ],
    [],
  ];
  t.mock.method(global, 'fetch', async (url) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => replies.shift() ?? [] };
  });
  const result = await repository.getCategoryNavigation();
  assert.deepEqual(result.categories, [
    { label: 'First', value: 'first' },
    { label: 'Renamed', value: 'original' },
  ]);
  assert.match(calls[1], /id=gt.1/);
  assert.match(calls[2], /id=gt.3/);
  assert.deepEqual(await repository.getCategoryNavigation(), {
    categories: [],
    activityCategories: [],
  });
  global.fetch.mock.mockImplementation(async () => ({ status: 404 }));
  assert.deepEqual(await repository.getCategoryNavigation(), {
    categories: navigation.categories,
    activityCategories: navigation.activityCategories,
  });
  global.fetch.mock.mockImplementation(async () => ({ status: 500, ok: false }));
  await assert.rejects(repository.getCategoryNavigation(), /categorias/);
});
test('category actions require authorization and handle stale edits without revalidation', async () => {
  let authorized = false;
  let response = { data: null, error: null };
  let invalidations = 0;
  const query = {
    update() {
      return this;
    },
    insert() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      return response;
    },
    async single() {
      return response;
    },
  };
  const actions = load('src/app/admin/categorias/actions.ts', {
    'next/cache': {
      revalidatePath() {
        invalidations++;
      },
    },
    '@/services/categories': categories,
    '@/lib/supabase/admin': {
      async requireAdmin() {
        if (!authorized) throw new Error('unauthorized');
        return { supabase: { from: () => query } };
      },
    },
  });
  const input = { kind: 'piece', label: 'Shorts', position: 0 };
  assert.ok((await actions.saveCategory(input)).error);
  assert.ok((await actions.setCategoryArchived(1, 1, true)).error);
  authorized = true;
  assert.match((await actions.saveCategory(input, 1, 1)).error, /Outra sessão/);
  assert.match((await actions.setCategoryArchived(1, 1, true)).error, /Outra sessão/);
  assert.equal(invalidations, 0);
  response = { data: null, error: { code: '23505' } };
  assert.match((await actions.saveCategory(input)).error, /Já existe/);
  response = { data: { id: 1 }, error: null };
  assert.ok((await actions.saveCategory(input)).success);
  assert.ok((await actions.setCategoryArchived(1, 1, true)).success);
  assert.equal(invalidations, 2);
});
