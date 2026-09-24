import Image from 'next/image';
import Link from 'next/link';

export function FabricSection() {
  return (
    <section id="sensorial" className="grid md:grid-cols-2 bg-stuw-sand dark:bg-stone-900">
      <div className="relative aspect-square md:aspect-[5/4]">
        <Image
          src="/products/fabric-macro.jpg"
          alt="Detalhe da trama do tecido STUW"
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col items-start justify-center px-6 py-14 sm:px-12 lg:px-24">
        <p className="eyebrow mb-5">A ciência do toque</p>
        <h2 className="font-serif text-4xl sm:text-5xl font-light">Feito para sentir.</h2>
        <p className="text-sm text-stuw-slate max-w-sm leading-relaxed mt-5 mb-8">
          Texturas suaves. Linhas precisas. Descubra o tecido que acompanha o seu ritmo.
        </p>
        <Link
          href="/produtos?tecido=SilkAir"
          className="text-xs uppercase tracking-widest border-b border-current pb-2"
        >
          Conhecer SilkAir™
        </Link>
      </div>
    </section>
  );
}
