const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

test('manual category exception links empty categories only and records the pending action', async (t) => {
  const original = process.env.OLIST_MANUAL_CATEGORY;
  t.after(() => {
    if (original === undefined) delete process.env.OLIST_MANUAL_CATEGORY;
    else process.env.OLIST_MANUAL_CATEGORY = original;
  });
  for (const [flag, category, expected] of [
    ['false', '', 'uncertain'],
    ['true', '', 'linked_category_pending'],
    ['true', 'Outra marca', 'uncertain'],
    ['true', 'Stuw', 'linked'],
  ]) {
    process.env.OLIST_MANUAL_CATEGORY = flag;
    const updates = [];
    let links = 0;
    const sku = { code: 'STUW-TOP-AZUL-P' };
    const db = {
      from(table) {
        const query = {
          select() {
            return query;
          },
          in() {
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          is() {
            return query;
          },
          eq() {
            return query;
          },
          upsert() {
            return Promise.resolve({ error: null });
          },
          update(value) {
            updates.push(value);
            return query;
          },
          then(resolve) {
            const rows =
              table === 'admin_products'
                ? [{ id: 1, document: { colors: [{ skus: [sku] }] } }]
                : table === 'olist_products'
                  ? [{ product_id: 1 }]
                  : [{ sku: sku.code, state: 'uncertain', attempted_at: '2026-10-14' }];
            return Promise.resolve({ data: rows, error: null }).then(resolve);
          },
        };
        return query;
      },
      async rpc() {
        links++;
        return { error: null };
      },
    };
    const { exportOne } = loadTypeScript('src/lib/integrations/olist-export.ts', {
      'server-only': {},
      '@/lib/supabase/service': { createServiceClient: () => db },
      '@/services/olist-catalog': {
        isStuwProduct: (p) => p.categoria === 'Stuw',
        productExportIssues: () => [],
        toOlistSku: () => ({ classe_produto: 'S' }),
      },
      './olist': {
        OlistError: class extends Error {},
        listOlistProducts: async () => ({ pages: 1, products: [{ codigo: sku.code, id: 123 }] }),
        getOlistProduct: async () => ({
          id: 123,
          codigo: sku.code,
          classe_produto: 'S',
          categoria: category,
        }),
        olistRequest: async () => {
          throw new Error('Must not recreate an existing product');
        },
      },
    });
    assert.equal(await exportOne(), expected);
    assert.equal(links, expected.startsWith('linked') ? 1 : 0);
    if (expected === 'linked_category_pending')
      assert.ok(updates.some((u) => u.last_error?.includes('classificação manual')));
  }
});
