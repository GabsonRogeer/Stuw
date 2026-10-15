const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');

const isUuid = (value) => /^[a-f\d-]{36}$/i.test(value);
const order = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function runtime({ allow = true, failure = null } = {}) {
  const calls = [];
  const action = load('src/app/operacao/actions.ts', {
    'next/cache': { revalidatePath: (...args) => calls.push(['invalidate', ...args]) },
    '@/lib/supabase/operations': {
      requireOperation: async (permission) => {
        calls.push(['permission', permission]);
        if (!allow) throw new Error('Denied');
        return {
          supabase: {
            rpc: async (name, args) => {
              calls.push(['rpc', name, args]);
              return { error: failure };
            },
          },
        };
      },
    },
    '@/lib/integrations/checkout': { syncOrderPayment: async (id) => calls.push(['sync', id]) },
    '@/services/orders': { isUuid },
  });
  const submit = (values) =>
    action.operationalAction(
      {},
      Object.entries(values).reduce((f, [k, v]) => {
        f.set(k, String(v));
        return f;
      }, new FormData()),
    );
  return { calls, submit };
}
test('operational actions reject unauthorized mutations and payment synchronization before side effects', async () => {
  for (const action of ['stage', 'return', 'staff', 'payment']) {
    const { calls, submit } = runtime({ allow: false });
    assert.ok((await submit({ action, order })).error);
    assert.deepEqual(
      calls.map((c) => c[0]),
      ['permission'],
    );
  }
});
test('operational actions keep responsible identity server-side and preserve optimistic concurrency', async () => {
  const { calls, submit } = runtime({ failure: { message: 'Revision conflict' } });
  const result = await submit({
    action: 'stage',
    order,
    revision: 3,
    stage: 'picked',
    note: 'Separação conferida',
    responsible_id: 'forged',
  });
  assert.match(result.error, /Atualize/);
  assert.equal(calls[0][1], 'fulfill');
  assert.equal(calls[1][1], 'change_operation');
  assert.equal(calls[1][2].expected_revision, 3);
  assert.equal(calls[1][2].responsible_id, undefined);
  assert.equal(
    calls.some((c) => c[0] === 'invalidate'),
    false,
  );
});
test('finance synchronization is scoped; staff assignment requires team permission and validates email', async () => {
  const finance = runtime();
  assert.ok((await finance.submit({ action: 'payment', order })).message);
  assert.deepEqual(finance.calls.slice(0, 2), [
    ['permission', 'finance'],
    ['sync', order],
  ]);
  const staff = runtime();
  assert.ok((await staff.submit({ action: 'staff', email: 'bad', role: 'finance' })).error);
  assert.deepEqual(staff.calls, [['permission', 'team']]);
  assert.ok(
    (
      await staff.submit({
        action: 'staff',
        email: 'staff@example.com',
        role: 'finance',
        active: 'false',
      })
    ).message,
  );
  assert.equal(staff.calls.find((c) => c[0] === 'rpc')[2].input_active, false);
});
