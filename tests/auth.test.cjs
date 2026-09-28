const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );
  return compiled.exports;
}
const validation = load('src/services/auth.ts');
test('email delivery quota is distinguished from request throttling and unauthorized email', () => {
  assert.match(validation.authErrorMessage('over_email_send_rate_limit'), /limite de envios/);
  assert.match(validation.authErrorMessage('over_request_rate_limit'), /Muitas tentativas/);
  assert.match(validation.authErrorMessage('email_address_not_authorized'), /envio de confirmação/);
});

test('signup quota rejection returns an error without reporting success or redirecting', async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://store.example';
  try {
    const api = actions({
      auth: {
        signUp: async () => ({
          data: { user: null, session: null },
          error: { code: 'over_email_send_rate_limit', status: 429 },
        }),
      },
    });
    const result = await api.register({}, form());
    assert.equal(result.error, validation.authErrorMessage('over_email_send_rate_limit'));
    assert.equal(result.message, undefined);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});
function actions(client) {
  return load('src/app/auth/actions.ts', {
    '@/services/auth': validation,
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': {
      redirect: (url) => {
        throw new Error(`REDIRECT:${url}`);
      },
    },
  });
}
function form(patch = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: 'Cliente Teste',
    email: 'test@example.invalid',
    password: 'test-password-123',
    confirmation: 'test-password-123',
    ...patch,
  }))
    data.set(key, value);
  return data;
}

test('registration rejects invalid data before contacting Auth', async () => {
  const api = actions({ auth: { signUp: () => assert.fail('Invalid input reached Auth') } });
  for (const patch of [
    { name: ' ' },
    { email: 'invalid' },
    { password: 'short' },
    { confirmation: 'different' },
  ]) {
    assert.ok((await api.register({}, form(patch))).error);
  }
});

test('registration sends name only as display metadata, never confirmation or admin role', async () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://store.example';
  try {
    const api = actions({
      auth: {
        signUp: async (input) => {
          assert.deepEqual(input.options.data, { full_name: 'Cliente Teste' });
          assert.equal(input.options.emailRedirectTo, 'https://store.example/auth/callback');
          assert.equal(input.confirmation, undefined);
          return { data: { session: null }, error: null };
        },
      },
    });
    const result = await api.register({}, form({ role: 'admin' }));
    assert.match(result.message, /e-mail de confirmação/);
    assert.equal(result.error, undefined);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('login routes verified administrators to admin and customers to account', async () => {
  for (const isAdmin of [true, false, null]) {
    const api = actions({
      auth: { signInWithPassword: async () => ({ error: null }) },
      rpc: async () => ({ data: isAdmin }),
    });
    await assert.rejects(
      () => api.login({}, form()),
      new RegExp(`REDIRECT:${isAdmin === true ? '/admin' : '/conta'}`),
    );
  }
});

test('login preserves generic credential errors and handles network failures', async () => {
  const api = actions({
    auth: {
      signInWithPassword: async () => ({
        error: { code: 'invalid_credentials', message: 'private details' },
      }),
    },
  });
  assert.deepEqual(await api.login({}, form()), { error: 'E-mail ou senha incorretos.' });
  const failing = actions({
    auth: {
      signInWithPassword: async () => {
        throw new Error('private details');
      },
    },
  });
  assert.equal((await failing.login({}, form())).error, validation.authErrorMessage());
});

test('checkout login returns only to the allowlisted checkout route', async () => {
  const api = actions({
    auth: { signInWithPassword: async () => ({ error: null }) },
    rpc: async () => ({ data: false }),
  });
  const checkoutForm = form();
  checkoutForm.set('next', 'checkout');
  await assert.rejects(() => api.login({}, checkoutForm), /REDIRECT:\/checkout\/information/);
  checkoutForm.set('next', 'https://evil.example');
  await assert.rejects(() => api.login({}, checkoutForm), /REDIRECT:\/conta/);
  checkoutForm.set('next', 'atacado');
  await assert.rejects(() => api.login({}, checkoutForm), /REDIRECT:\/atacado\/cotacao/);
});

test('logout reports failures and only redirects after successful sign-out', async () => {
  const failing = actions({ auth: { signOut: async () => ({ error: new Error('Offline') }) } });
  assert.ok((await failing.logout()).error);
  const success = actions({
    auth: {
      signOut: async ({ scope }) => {
        assert.equal(scope, 'local');
        return { error: null };
      },
    },
  });
  await assert.rejects(() => success.logout(), /REDIRECT:\/login/);
});

test('confirmation rejects other token types and ignores external redirect parameters', async () => {
  let calls = 0;
  const route = load('src/app/auth/confirm/route.ts', {
    'next/server': { NextResponse: { redirect: (url) => url.pathname } },
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: {
          verifyOtp: async () => {
            calls++;
            return { error: null };
          },
        },
      }),
    },
  });
  const request = (query) => {
    const url = new URL('https://store.example/auth/confirm?' + query);
    return { url: url.href, nextUrl: url };
  };
  assert.equal(await route.GET(request('type=recovery&token_hash=test')), '/auth/erro');
  assert.equal(calls, 0);
  assert.equal(
    await route.GET(request('type=email&token_hash=test&next=https://evil.example')),
    '/conta',
  );
  assert.equal(calls, 1);
});
