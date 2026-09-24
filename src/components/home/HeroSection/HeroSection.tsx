import Image from 'next/image';
import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="grid md:grid-cols-2 bg-stuw-sand dark:bg-stone-900">
      <div className="flex flex-col justify-center items-start px-6 py-14 sm:px-12 lg:px-24 lg:py-24 order-2 md:order-1">
        <p className="eyebrow mb-6">STUW / Coleção 2026</p>
        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.05] max-w-xl">
          A precisão do movimento.
          <br />
          <em className="text-stuw-sage dark:text-stuw-champagne">O luxo da pausa.</em>
        </h1>
        <p className="text-sm text-stuw-slate mt-6 mb-8">
          Essenciais para o estúdio. Liberdade para todos os dias.
        </p>
        <Link
          href="/produtos"
          className="text-xs uppercase tracking-[.18em] border-b border-current pb-2 hover:text-stuw-sage"
        >
          Explorar coleção
        </Link>
      </div>
      <Link
        href="/produtos/legging-sculpt-pure-waist"
        aria-label="Conhecer a Legging Sculpt Pure Waist"
        className="relative block aspect-[4/5] md:aspect-auto md:min-h-[620px] order-1 md:order-2 overflow-hidden"
      >
        <Image
          src="/products/legging-sculpt-frente.jpg"
          alt="Legging Sculpt da coleção STUW"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover object-top"
        />
        <span className="absolute bottom-6 left-6 text-white text-[10px] tracking-[.2em] uppercase">
          Sculpt / Obsidian
        </span>
      </Link>
    </section>
  );
}
