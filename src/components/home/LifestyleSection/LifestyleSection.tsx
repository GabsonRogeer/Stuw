import Image from 'next/image';
import Link from 'next/link';

const edits = [
  {
    title: 'Studio & Mindful',
    image: '/products/top-sage-frente.jpg',
    caption: 'Encontre seu equilíbrio.',
  },
  {
    title: 'Street & Travel',
    image: '/products/bomber-taupe-frente.jpg',
    caption: 'Além do estúdio.',
  },
  {
    title: 'Racquet Club',
    image: '/products/skirt-tennis-frente.jpg',
    caption: 'Movimento com leveza.',
  },
];
export function LifestyleSection() {
  return (
    <section className="page-container py-16 sm:py-24">
      <div className="text-center mb-10">
        <p className="eyebrow mb-3">The STUW edit</p>
        <h2 className="font-serif text-4xl">Um ritmo. Muitas possibilidades.</h2>
      </div>
      <div className="grid sm:grid-cols-3 gap-6">
        {edits.map((edit) => (
          <Link
            key={edit.title}
            href={`/produtos?ocasiao=${encodeURIComponent(edit.title)}`}
            className="group"
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-stuw-sand">
              <Image
                src={edit.image}
                alt={edit.title}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover group-hover:scale-[1.03] silk-transition"
              />
            </div>
            <h3 className="font-serif text-2xl mt-4">{edit.title}</h3>
            <p className="text-xs text-stuw-slate mt-1">{edit.caption}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
