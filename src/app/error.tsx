'use client';

import { Button } from '@/components/ui/button/button';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="text-center px-6 py-28 space-y-6">
      <h1 className="font-serif text-4xl">Não foi possível carregar esta página.</h1>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
