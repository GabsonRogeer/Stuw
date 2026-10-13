const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadTypeScript } = require('../scripts/lib/load-typescript.cjs');

function loadComponent(file, dependencies = {}) {
  const filename = path.resolve(file);
  const compiled = new Module(filename);
  compiled.require = (name) => {
    if (name in dependencies) return dependencies[name];
    if (name.endsWith('.css'))
      return new Proxy({}, { get: (_, key) => (key === '__esModule' ? false : key) });
    if (name === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (name === '@/services/banners')
      return {
        ...loadTypeScript('src/services/banners.ts'),
        bannerImageUrl: (asset) => 'https://example.com/' + asset,
      };
    if (name.startsWith('.')) return loadComponent(path.join(path.dirname(file), name + '.tsx'));
    return require(name);
  };
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
  return compiled.exports;
}
const { BannerCarousel } = loadComponent('src/components/home/ManagedBanner/BannerCarousel.tsx');
const now = Date.parse('2026-10-20T12:00:00Z');
const fixture = {
  id: 'first',
  title: 'Foto principal',
  subtitle: 'Subtítulo do card',
  description: 'Texto explicativo',
  desktop_path: 'home/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg',
  mobile_path: 'home/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.jpg',
  link: '/produtos?categoria=Shorts',
  layout: 'image',
  starts_at: null,
  ends_at: null,
};
const render = (banners) =>
  renderToStaticMarkup(
    React.createElement(BannerCarousel, {
      banners,
      serverNow: now,
      fallback: React.createElement('div', {}, 'Destaque original'),
    }),
  );

test('carousel renders two independent layouts, accessible controls and only one visible slide', () => {
  const html = render([
    fixture,
    { ...fixture, id: 'second', title: 'Foto com texto', layout: 'split' },
  ]);
  assert.equal((html.match(/aria-roledescription="slide"/g) || []).length, 2);
  assert.equal((html.match(/ hidden=""/g) || []).length, 1);
  assert.match(html, /Próxima campanha/);
  assert.match(html, /Pausar alternância automática/);
  assert.match(html, /class="imageLink"/);
  assert.match(html, /Texto explicativo/);
  assert.equal((html.match(/Subtítulo do card/g) || []).length, 1, 'image-only slide hides text');
  assert.match(html, /href="\/produtos\?categoria=Shorts"/);
});
test('single card hides carousel controls and no current campaigns shows the original hero', () => {
  assert.doesNotMatch(render([fixture]), /Próxima campanha|Selecionar campanha/);
  assert.equal(render([]), '<div>Destaque original</div>');
  assert.equal(
    render([{ ...fixture, ends_at: new Date(now).toISOString() }]),
    '<div>Destaque original</div>',
  );
  assert.equal(
    render([{ ...fixture, starts_at: new Date(now + 1).toISOString() }]),
    '<div>Destaque original</div>',
  );
});
