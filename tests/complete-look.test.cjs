const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');
const { defaultCompleteLook, completeLookProduct, validateCompleteLook } = loadTypeScript(
  'src/services/complete-look.ts',
);
const products = [
  {
    id: 1,
    category: 'Conjuntos',
    image: '/one.jpg',
    price: 150,
    galleryImages: [{ src: '/back.jpg' }],
  },
  { id: 2, category: 'Conjuntos', image: '/two.jpg', price: 160, featured: true },
  { id: 3, category: 'Tops', image: '/top.jpg', price: 70 },
];
test('complete look selects current catalog products and validates gallery and copy', () => {
  assert.equal(completeLookProduct(products, defaultCompleteLook).id, 2);
  const selected = { ...defaultCompleteLook, product_id: 1, image: '/back.jpg' };
  assert.equal(completeLookProduct(products, selected).id, 1);
  assert.equal(validateCompleteLook(selected, products), null);
  assert.ok(
    validateCompleteLook({ ...selected, image: 'https://untrusted.example/image.jpg' }, products),
  );
  assert.ok(validateCompleteLook({ ...selected, title: 'a'.repeat(81) }, products));
  assert.equal(
    completeLookProduct(
      products.filter((p) => p.id !== 1),
      selected,
    ),
    undefined,
  );
  assert.ok(validateCompleteLook({ ...selected, product_id: 3 }, products));
  assert.equal(validateCompleteLook({ ...defaultCompleteLook, enabled: false }, []), null);
  assert.equal(validateCompleteLook({ ...selected, enabled: false }, []), null);
});
test('complete look settings permit public reads, admin-only updates and detect stale edits', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema private;
      create function public.is_admin() returns boolean language sql stable as $$ select current_setting('test.admin',true) = 'yes' $$;
      create function private.banner_revision() returns trigger language plpgsql set search_path='' as $$ begin new.revision := old.revision + 1; new.updated_at := clock_timestamp(); return new; end; $$;`);
    await db.exec(
      fs.readFileSync('supabase/migrations/20261015041046_complete_look_settings.sql', 'utf8'),
    );
    await db.exec('set role anon');
    assert.equal(
      (await db.query('select enabled from public.complete_look_settings')).rows[0].enabled,
      true,
    );
    await assert.rejects(
      db.exec("update public.complete_look_settings set title='Bad'"),
      /permission denied/,
    );
    await db.exec('reset role; set role authenticated');
    assert.equal(
      (await db.query("update public.complete_look_settings set title='Bad' returning *")).rows
        .length,
      0,
    );
    await db.query("select set_config('test.admin','yes',false)");
    const update = await db.query(
      "update public.complete_look_settings set title='Nova campanha', product_id=2 where revision=1 returning *",
    );
    assert.equal(update.rows[0].revision, 2);
    assert.equal(update.rows[0].product_id, 2);
    assert.equal(
      (
        await db.query(
          "update public.complete_look_settings set title='Stale' where revision=1 returning *",
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.exec("update public.complete_look_settings set title=''"),
      /check constraint/,
    );
    await assert.rejects(
      db.exec('update public.complete_look_settings set revision=1'),
      /permission denied/,
    );
    await assert.rejects(db.exec('delete from public.complete_look_settings'), /permission denied/);
  } finally {
    await db.close();
  }
});
