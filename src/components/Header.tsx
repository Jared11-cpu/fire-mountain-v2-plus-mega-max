import type { navItems } from '../data/mockData';
import { Logo } from './Logo';

type PageId = (typeof navItems)[number]['id'];

type HeaderProps = {
  page: PageId;
  nav: typeof navItems;
  onNavigate: (page: PageId) => void;
};

export function Header({ page, nav, onNavigate }: HeaderProps) {
  const activeIndex = Math.max(nav.findIndex((item) => item.id === page), 0);
  const indicatorStyle = {
    width: `calc((100% - 0.75rem) / ${nav.length})`,
    transform: `translateX(${activeIndex * 100}%)`,
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-mist/80 backdrop-blur-2xl">
      <div className="w-full px-4 pt-3 sm:px-6 lg:px-8">
        <nav
          className="relative grid w-full min-w-0 overflow-hidden rounded-full border border-white/70 bg-white/40 p-1.5 shadow-[0_18px_50px_rgba(18,34,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1.5 h-[calc(100%-0.75rem)] rounded-full bg-[#12222A]/95 shadow-[0_12px_28px_rgba(18,34,42,0.24),inset_0_1px_0_rgba(255,255,255,0.22)] transition-transform duration-300 ease-out before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-white/50"
            style={indicatorStyle}
          />
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-pressed={page === item.id}
              className={`relative z-10 rounded-full px-1.5 py-2 text-[11px] font-black transition-colors duration-300 active:scale-95 sm:px-4 sm:text-sm ${
                page === item.id
                  ? 'text-white'
                  : 'text-ink/66 hover:bg-white/45 hover:text-ink hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex px-4 pb-3 pt-2 sm:px-6 lg:px-8">
        <button
          onClick={() => onNavigate('home')}
          aria-label="返回首页"
          className="rounded-2xl text-left transition hover:translate-x-0.5 hover:scale-[1.01] active:scale-95"
        >
          <Logo />
        </button>
      </div>
    </header>
  );
}

