export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark relative grid shrink-0 place-items-center overflow-hidden rounded-[22%] bg-ink text-white ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}>
      <svg viewBox="0 0 64 64" role="img" aria-label="楚游智导 AI 标识" className="h-full w-full">
        <path d="M15 43 C24 43 26 23 38 23 H47" fill="none" stroke="#F8FFFC" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="48" cy="23" r="4" fill="#D35236"/>
      </svg>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-none">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[1.25rem] font-black tracking-[.04em] text-ink">楚游智导</span>
          <span className="rounded-full bg-tower px-1.5 py-0.5 text-[10px] font-black leading-none tracking-[0.08em] text-white">AI</span>
        </div>
        <div className="mt-1.5 text-[10px] font-black tracking-[0.16em] text-river">湖北旅行智能体</div>
      </div>
    </div>
  );
}
