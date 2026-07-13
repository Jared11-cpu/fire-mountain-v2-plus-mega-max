export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark relative grid shrink-0 place-items-center overflow-hidden rounded-[24%] bg-ink text-white shadow-[0_10px_22px_rgba(18,34,42,0.16)] ring-1 ring-white/70 ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}>
      <svg viewBox="0 0 64 64" role="img" aria-label="楚游智导 AI 标识" className="h-full w-full">
        <text x="15" y="41" fill="#F8FFFC" fontSize="29" fontWeight="900" fontFamily="Noto Serif SC, Source Han Serif SC, serif">楚</text>
        <path d="M16 49 H43" fill="none" stroke="#2FB98E" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="48" cy="16" r="4" fill="#D35236"/>
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
