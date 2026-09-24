import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="text-center px-6 py-28 space-y-6">
      <Link href="/" className="text-2xl tracking-[.25em]">
        STUW
      </Link>
      <p className="eyebrow">404</p>
      <h1 className="font-serif text-4xl">Essa página não está por aqui.</h1>
      <Link href="/produtos" className="inline-block underline text-sm">
        Explorar coleção
      </Link>
    </main>
  );
}
