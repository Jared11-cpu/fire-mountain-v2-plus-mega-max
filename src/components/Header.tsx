import type { navItems } from '../data/mockData';
import { Logo } from './Logo';

type PageId = (typeof navItems)[number]['id'];

type HeaderProps = {
  page: PageId;
  nav: typeof navItems;
  onNavigate: (page: PageId) => void;
};

export function Header({ page, nav, onNavigate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-mist/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button onClick={() => onNavigate('home')} className="rounded-2xl text-left transition hover:scale-[1.01] active:scale-95">
          <Logo />
        </button>
        <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/70 p-1 shadow-sm lg:flex">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
                page === item.id ? 'bg-ink text-white shadow-md' : 'text-ink/70 hover:bg-white hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => onNavigate('planner')}
          className="rounded-full bg-tower px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#ba432b] active:scale-95"
        >
          开始 AI 规划
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
        {nav.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95 ${
              page === item.id ? 'bg-ink text-white' : 'bg-white/70 text-ink/70'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}
