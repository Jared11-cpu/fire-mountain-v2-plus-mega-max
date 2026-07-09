import { Sparkles } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white shadow-glow">
        <Sparkles className="h-5 w-5 text-jade" />
      </div>
      <div>
        <div className="font-display text-xl font-black tracking-wide text-ink">楚游智导 AI</div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-river">Hubei Travel Agent</div>
      </div>
    </div>
  );
}
