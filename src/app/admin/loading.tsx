export default function AdminLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E8" }}>
      <div style={{ background: "#124E40", height: "4.5rem" }} />
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:flex lg:gap-6">
        <div className="mb-4 h-11 rounded-full bg-white/70 lg:mb-0 lg:hidden" />
        <div className="hidden w-60 flex-shrink-0 lg:block">
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-11 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.8)", boxShadow: "0 10px 28px rgba(15,23,42,0.06)" }}
              />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-32 rounded-[1.5rem]" style={{ background: "rgba(255,255,255,0.84)" }} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-[1.5rem]" style={{ background: "rgba(255,255,255,0.84)" }} />
            <div className="h-48 rounded-[1.5rem]" style={{ background: "rgba(255,255,255,0.84)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
