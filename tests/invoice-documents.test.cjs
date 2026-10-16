const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript: load } = require('../scripts/lib/load-typescript.cjs');
const { validateInvoiceXml, extractInvoiceXml, olistDocumentUrl } = load(
  'src/services/invoice-documents.ts',
);
const orderId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const buyerId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const otherId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const issuer = '12345678000199',
  tax = '52998224725';
const key = '352610' + issuer + '550010000000751234567890';
const order = {
  id: orderId,
  is_demo: false,
  payment_test_mode: false,
  payment_status: 'approved',
  subtotal_cents: 100,
  total_cents: 100,
  shipping_cents: 0,
  gift_cents: 0,
  discount_cents: 0,
  pix_discount_cents: 0,
  items: [{ sku: 'KIT-P', qty: 1, price_cents: 100 }],
};
const invoice = { id: '99', numero: '75', serie: '1', chave_acesso: key };
const components = [{ sku: 'TOP-P', quantity: 1 }];
function xml() {
  return `<nfeProc><NFe><infNFe Id="NFe${key}"><ide><tpAmb>1</tpAmb><mod>55</mod><nNF>75</nNF><serie>1</serie></ide><emit><CNPJ>${issuer}</CNPJ></emit><dest><CPF>${tax}</CPF></dest><det><prod><cProd>TOP-P</cProd><qCom>1.0000</qCom><NCM>61062000</NCM><CFOP>5102</CFOP></prod></det><total><ICMSTot><vNF>1.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>1</tpAmb><cStat>100</cStat><nProt>135260000000075</nProt><chNFe>${key}</chNFe><dhRecbto>2026-10-16T00:00:00-03:00</dhRecbto></infProt></protNFe></nfeProc>`;
}

test('authorized XML checks production protocol, identity, recipient, items and total', () => {
  assert.equal(key.length, 44);
  const text = xml();
  const result = validateInvoiceXml(text, order, '78', invoice, tax, components);
  assert.equal(result.number, '75');
  assert.equal(result.accessKey, key);
  assert.equal(
    extractInvoiceXml(`<retorno><status>OK</status><xml_nfe>${text}</xml_nfe></retorno>`),
    text,
  );
  for (const [from, to] of [
    ['<tpAmb>1</tpAmb>', '<tpAmb>2</tpAmb>'],
    ['<cStat>100</cStat>', '<cStat>101</cStat>'],
    ['<vNF>1.00</vNF>', '<vNF>1.01</vNF>'],
    ['<CPF>' + tax, '<CPF>12345678900'],
    ['<cProd>TOP-P', '<cProd>TOP-M'],
    ['<qCom>1.0000', '<qCom>2.0000'],
    ['<NCM>61062000', '<NCM>'],
    ['<nNF>75', '<nNF>76'],
  ])
    assert.throws(() =>
      validateInvoiceXml(text.replace(from, to), order, '78', invoice, tax, components),
    );
  assert.throws(() =>
    extractInvoiceXml('<!DOCTYPE x [<!ENTITY bad SYSTEM "file:///secret">]><retorno/>'),
  );
  assert.throws(() => extractInvoiceXml('<retorno><status>Erro</status></retorno>'));
  for (const url of [
    'http://erp.olist.com/doc.view?id=x',
    'https://evil.example/doc.view',
    'https://erp.olist.com.evil.example/doc.view',
    'https://erp.olist.com/admin',
    'https://user@erp.olist.com/doc.view',
  ])
    assert.throws(() => olistDocumentUrl(url));
  assert.equal(
    olistDocumentUrl('https://erp.olist.com/doc.view?id=private').hostname,
    'erp.olist.com',
  );
});

test('download requires verified session and order ownership before privileged storage access', async () => {
  let user = null,
    owner = false,
    calls = 0;
  const route = load('src/app/conta/compras/[id]/nota-fiscal/[format]/route.ts', {
    '@/lib/supabase/server': {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user }, error: null }) },
        from: () => {
          const q = {
            select: () => q,
            eq: () => q,
            maybeSingle: async () => ({ data: owner ? { id: orderId } : null, error: null }),
          };
          return q;
        },
      }),
    },
    '@/lib/invoices/files': {
      readInvoiceFile: async () => {
        calls++;
        return { bytes: Buffer.from('%PDF-test'), document: { number: '75', series: '1' } };
      },
    },
  });
  const context = { params: Promise.resolve({ id: orderId, format: 'pdf' }) };
  assert.equal((await route.GET(new Request('https://stuw.example'), context)).status, 401);
  user = { id: otherId };
  assert.equal((await route.GET(new Request('https://stuw.example'), context)).status, 404);
  assert.equal(calls, 0);
  user = { id: buyerId };
  owner = true;
  const success = await route.GET(new Request('https://stuw.example'), context);
  assert.equal(success.status, 200);
  assert.equal(success.headers.get('cache-control'), 'private, no-store');
  assert.equal(success.headers.get('content-type'), 'application/pdf');
  assert.match(
    success.headers.get('content-disposition'),
    /attachment; filename="STUW-NFe-75-serie-1.pdf"/,
  );
  assert.equal(calls, 1);
});

test('fiscal metadata is owner-readable, immutable and queues a single invoice email', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema private; create schema auth; create schema storage;
      grant usage on schema private to service_role; grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create function public.is_admin() returns boolean language sql stable as $$ select false $$;
      create table public.orders(id uuid primary key,user_id uuid,payment_status text,is_demo boolean,payment_test_mode boolean,total_cents integer);
      alter table public.orders enable row level security;
      grant select on public.orders to authenticated,service_role;
      create policy own_order on public.orders for select to authenticated using(user_id=(select auth.uid()));
      create table public.olist_invoice_jobs(order_id uuid primary key,invoice_id text,status text);
      grant select on public.olist_invoice_jobs to service_role;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      insert into public.orders values('${orderId}','${buyerId}','approved',false,false,100);
      insert into public.olist_invoice_jobs values('${orderId}','99','authorized');`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261014212138_transactional_email_outbox.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/20261016033746_order_invoice_delivery.sql', 'utf8'),
    );
    const insert = `insert into public.order_invoice_documents(order_id,invoice_id,number,series,access_key,total_cents,authorized_at,pdf_path,xml_path,pdf_sha256,xml_sha256) values('${orderId}','99','75','1','${key}',100,now(),'${orderId}/99/${'a'.repeat(64)}.pdf','${orderId}/99/${'b'.repeat(64)}.xml','${'a'.repeat(64)}','${'b'.repeat(64)}')`;
    await db.exec('set role service_role');
    await db.exec(insert);
    await db.exec(insert + ' on conflict(order_id) do nothing');
    assert.equal(
      (await db.query("select * from public.email_outbox where kind='invoice_available'")).rows
        .length,
      1,
    );
    await assert.rejects(
      db.exec("update public.order_invoice_documents set number='76'"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec('delete from public.order_invoice_documents'),
      /permission denied/,
    );
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('test.uid',$1,false)", [buyerId]);
    assert.equal(
      (await db.query('select order_id,number,series from public.order_invoice_documents')).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query('select pdf_path from public.order_invoice_documents'),
      /permission denied/,
    );
    await db.query("select set_config('test.uid',$1,false)", [otherId]);
    assert.equal(
      (await db.query('select order_id,number,series from public.order_invoice_documents')).rows
        .length,
      0,
    );
    await assert.rejects(db.exec(insert), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(
      db.query('select order_id from public.order_invoice_documents'),
      /permission denied/,
    );
    await db.exec('reset role');
    assert.equal(
      (await db.query("select public from storage.buckets where id='order-invoices'")).rows[0]
        .public,
      false,
    );
  } finally {
    await db.close();
  }
});
