export default function StudentPlaceholderPage({
  title,
  description,
  marker,
}: {
  title: string;
  description: string;
  marker: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(30,64,175,0.04)]">
      <div className="h-1 bg-blue-600" aria-hidden="true" />
      <div className="px-5 py-12 text-center sm:px-8 sm:py-16">
        <span
          aria-hidden="true"
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700 ring-1 ring-blue-100"
        >
          {marker}
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
    </section>
  );
}
