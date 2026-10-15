const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');

function actions(auth) {
  return load('src/app/auth/email-actions.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth }) },
    'next/cache': { revalidatePath() {} },
    'next/navigation': {
      redirect: (url) => {
        throw new Error('REDIRECT:' + url);
      },
    },
  });
}
function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test('recovery and resend validate input, preserve fixed redirects and hide account existence', async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://stuw.example';
  try {
    const requests = [];
    const api = actions({
      resetPasswordForEmail: async (...args) => {
        requests.push(args);
        return { error: null };
      },
      resend: async (...args) => {
        requests.push(args);
        return { error: { code: 'user_not_found' } };
      },
    });
    assert.ok((await api.requestPasswordReset({}, form({ email: 'invalid' }))).error);
    assert.equal(requests.length, 0);
    const recovery = await api.requestPasswordReset(
      {},
      form({ email: ' buyer@example.com ', next: 'https://evil.example' }),
    );
    assert.match(recovery.message, /Se houver uma conta/);
    assert.deepEqual(requests[0], [
      'buyer@example.com',
      { redirectTo: 'https://stuw.example/auth/callback?next=recovery' },
    ]);
    const resend = await api.resendConfirmation({}, form({ email: 'buyer@example.com' }));
    assert.match(resend.message, /Se houver um cadastro/);
    assert.equal(requests[1][0].type, 'signup');
    assert.equal(requests[1][0].options.emailRedirectTo, 'https://stuw.example/auth/callback');
    for (const code of [
      'over_email_send_rate_limit',
      'over_request_rate_limit',
      'unexpected_failure',
    ]) {
      const failed = actions({ resetPasswordForEmail: async () => ({ error: { code } }) });
      assert.ok(
        (await failed.requestPasswordReset({}, form({ email: 'buyer@example.com' }))).error,
      );
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('tokens are validated on submission, only email/recovery are accepted, redirects stay internal', async () => {
  const seen = [];
  const api = actions({
    verifyOtp: async (args) => {
      seen.push(args);
      return { error: null };
    },
  });
  for (const type of ['invite', 'email_change', 'invalid']) {
    assert.ok((await api.verifyEmailLink({}, form({ type, token_hash: 'token' }))).error);
  }
  assert.equal(seen.length, 0);
  for (const [type, target] of [
    ['email', '/conta'],
    ['recovery', '/redefinir-senha'],
  ]) {
    await assert.rejects(
      () =>
        api.verifyEmailLink({}, form({ type, token_hash: 'token', next: 'https://evil.example' })),
      { message: 'REDIRECT:' + target },
    );
  }
  const expired = actions({ verifyOtp: async () => ({ error: { code: 'otp_expired' } }) });
  assert.match(
    (await expired.verifyEmailLink({}, form({ type: 'recovery', token_hash: 'used' }))).error,
    /expirou/,
  );
});

test('password update requires a verified user, matching passwords and revokes other refresh sessions', async () => {
  let updated = 0;
  const guest = actions({
    getUser: async () => ({ data: { user: null }, error: null }),
    updateUser: () => {
      updated++;
    },
  });
  const valid = form({
    password: 'a-new-password-123',
    confirmation: 'a-new-password-123',
    user_id: 'someone-else',
  });
  assert.ok((await guest.updatePassword({}, valid)).error);
  assert.equal(updated, 0);
  const api = actions({
    getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }),
    updateUser: async (input) => {
      assert.deepEqual(input, { password: 'a-new-password-123' });
      updated++;
      return { error: null };
    },
    signOut: async (input) => {
      assert.deepEqual(input, { scope: 'others' });
      return { error: null };
    },
  });
  assert.ok(
    (await api.updatePassword({}, form({ password: 'short', confirmation: 'short' }))).error,
  );
  assert.ok(
    (
      await api.updatePassword(
        {},
        form({ password: 'a-new-password-123', confirmation: 'different' }),
      )
    ).error,
  );
  assert.equal(updated, 0);
  assert.match((await api.updatePassword({}, valid)).message, /sucesso/);
  assert.equal(updated, 1);
});

test('PKCE callback only accepts the fixed recovery destination', async () => {
  const api = load('src/app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect: (url) => url.pathname } },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { exchangeCodeForSession: async () => ({ error: null }) },
      }),
    },
  });
  for (const [next, expected] of [
    ['recovery', '/redefinir-senha'],
    ['https://evil.example', '/conta'],
  ]) {
    const url = new URL(
      `https://stuw.example/auth/callback?code=token&next=${encodeURIComponent(next)}`,
    );
    assert.equal(await api.GET({ url: url.href, nextUrl: url }), expected);
  }
});
