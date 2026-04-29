export function LoadingBar() {
  return (
    <div className="w-full h-0.5 bg-line overflow-hidden rounded-none relative">
      <div className="absolute top-0 bottom-0 left-0 bg-g500 w-1/3 animate-[slide_1s_ease-in-out_infinite]"></div>
      <style>{`
        @keyframes slide {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-48">
        <LoadingBar />
      </div>
      <p className="text-[13px] font-sans text-ink2">Loading data</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string, description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-line border-dashed rounded-[12px] bg-surface2">
      <h3 className="font-display font-bold text-lg text-ink">{title}</h3>
      {description && <p className="text-[14px] font-sans text-ink2 mt-2 max-w-md">{description}</p>}
    </div>
  );
}
