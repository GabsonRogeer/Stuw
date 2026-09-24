export default function Loading() {
  return (
    <div className="page-container py-20" role="status" aria-label="Carregando coleção">
      <div className="h-10 w-56 bg-stuw-sand dark:bg-stone-800 mb-10 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="aspect-[3/4] bg-stuw-sand dark:bg-stone-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
