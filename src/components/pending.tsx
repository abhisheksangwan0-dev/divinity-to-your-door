export function PagePending({ label = "Fetching the shelf" }: { label?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse bg-line" />
        ))}
      </div>
    </div>
  );
}
