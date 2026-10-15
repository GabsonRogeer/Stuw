const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');

function fixture({ smtpError = false, saveError = false, verifyError = false } = {}) {
  const tables = {
    email_outbox: [
      {
        id: 'mail-1',
        order_id: 'order-1',
        status: 'pending',
        attempts: 0,
        available_at: '2000-01-01T00:00:00.000Z',
        claimed_at: null,
      },
    ],
    orders: [
      {
        id: 'order-1',
        customer_email: 'buyer@example.com',
        payment_status: 'approved',
        is_demo: false,
        payment_test_mode: false,
      },
    ],
  };
  let sends = 0;
  const db = {
    from(table) {
      const filters = [];
      let patch;
      let one = false;
      const query = {
        select() {
          return query;
        },
        update(value) {
          patch = value;
          return query;
        },
        eq(key, value) {
          filters.push((row) => row[key] === value);
          return query;
        },
        lt(key, value) {
          filters.push((row) => row[key] !== null && row[key] < value);
          return query;
        },
        lte(key, value) {
          filters.push((row) => row[key] !== null && row[key] <= value);
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        single() {
          one = true;
          return query;
        },
        maybeSingle() {
          one = true;
          return query;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              if (saveError && patch?.status === 'sent')
                return { data: null, error: 'unavailable' };
              const rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
              if (patch) for (const row of rows) Object.assign(row, patch);
              return {
                data: one ? (rows[0] ? { ...rows[0] } : null) : rows.map((row) => ({ ...row })),
                error: null,
              };
            })
            .then(resolve, reject);
        },
      };
      return query;
    },
  };
  const worker = load('src/lib/email/outbox.ts', {
    'server-only': {},
    '@/lib/supabase/service': { createServiceClient: () => db },
    '@/services/email-templates': {
      purchaseEmail: () => ({ subject: 'Test', html: 'Test', text: 'Test' }),
    },
    './smtp': {
      smtpTransport: () => ({
        verify: async () => {
          if (verifyError) throw new Error('offline');
        },
        sendMail: async (input) => {
          sends++;
          assert.equal(input.to, 'buyer@example.com');
          assert.equal(input.messageId, '<purchase-mail-1@stuw.example>');
          if (smtpError) throw new Error('timeout after DATA');
          return { accepted: ['buyer@example.com'], rejected: [] };
        },
        close() {},
      }),
    },
  });
  return { worker, tables, sends: () => sends };
}

test('worker deduplicates concurrent jobs and holds ambiguous outcomes for review', async () => {
  const saved = { ...process.env };
  process.env.TRANSACTIONAL_EMAIL_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://stuw.example';
  try {
    const success = fixture();
    await Promise.all([success.worker.processEmailOutbox(), success.worker.processEmailOutbox()]);
    assert.equal(success.sends(), 1);
    assert.equal(success.tables.email_outbox[0].status, 'sent');
    await success.worker.processEmailOutbox();
    assert.equal(success.sends(), 1);
    for (const option of [{ smtpError: true }, { saveError: true }]) {
      const uncertain = fixture(option);
      await uncertain.worker.processEmailOutbox();
      assert.equal(uncertain.tables.email_outbox[0].status, 'uncertain');
      await uncertain.worker.processEmailOutbox();
      assert.equal(uncertain.sends(), 1);
    }
    const unavailable = fixture({ verifyError: true });
    await assert.rejects(() => unavailable.worker.processEmailOutbox());
    assert.equal(unavailable.tables.email_outbox[0].status, 'pending');
    assert.equal(unavailable.sends(), 0);
    const interrupted = fixture();
    Object.assign(interrupted.tables.email_outbox[0], {
      status: 'sending',
      claimed_at: '2000-01-01T00:00:00.000Z',
    });
    await interrupted.worker.processEmailOutbox();
    assert.equal(interrupted.tables.email_outbox[0].status, 'uncertain');
    assert.equal(interrupted.sends(), 0);
    for (const changes of [
      { payment_status: 'refunded' },
      { is_demo: true },
      { payment_test_mode: true },
    ]) {
      const excluded = fixture();
      Object.assign(excluded.tables.orders[0], changes);
      await excluded.worker.processEmailOutbox();
      assert.equal(excluded.tables.email_outbox[0].status, 'cancelled');
      assert.equal(excluded.sends(), 0);
    }
    process.env.TRANSACTIONAL_EMAIL_ENABLED = 'false';
    const disabled = fixture();
    assert.equal((await disabled.worker.processEmailOutbox()).enabled, false);
    assert.equal(disabled.sends(), 0);
  } finally {
    for (const name of ['TRANSACTIONAL_EMAIL_ENABLED', 'NEXT_PUBLIC_SITE_URL']) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});

test('email job rejects unauthenticated requests before calling the worker', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-job-secret';
  let calls = 0;
  const route = load('src/app/api/jobs/email/route.ts', {
    '@/lib/email/outbox': {
      processEmailOutbox: async () => {
        calls++;
        return { sent: 1 };
      },
    },
  });
  try {
    assert.equal((await route.GET(new Request('https://stuw.example/api/jobs/email'))).status, 401);
    assert.equal(calls, 0);
    const response = await route.GET(
      new Request('https://stuw.example/api/jobs/email', {
        headers: { authorization: 'Bearer test-job-secret' },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
