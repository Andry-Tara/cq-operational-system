export default function ProtectedLoading() {
  return (
    <main className="min-h-[70vh] bg-[#f5f5f3] px-5 py-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />

            <div>
              <p className="text-sm font-black text-neutral-900">
                Loading page...
              </p>
              <p className="mt-1 text-xs font-semibold text-neutral-500">
                Please wait, we are preparing the latest operational data.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-neutral-100" />
            <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
