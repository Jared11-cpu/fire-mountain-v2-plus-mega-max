import { ArrowRight, CheckCircle2, Play, Wand2 } from 'lucide-react';
import { cities, valueCards, type CityName } from '../data/mockData';

type LandingPageProps = {
  onStart: () => void;
  onCitySelect: (city: CityName) => void;
};

export function LandingPage({ onStart, onCitySelect }: LandingPageProps) {
  return (
    <main>
      <section className="section-pad river-line relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10 bg-river-grid map-ridge opacity-80" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-river/20 bg-white/75 px-4 py-2 text-sm font-bold text-river shadow-sm">
              <Wand2 className="h-4 w-4" />
              2026 湖北“火山杯”青年 AI 创新赛道 Demo
            </div>
            <h1 className="font-display text-5xl font-black leading-[1.05] text-ink sm:text-6xl lg:text-7xl">
              一句话生成你的
              <span className="block text-river">湖北旅行智能体</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-ink/70">路线、讲解、预算、拍照点、短视频脚本，一次生成。</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onStart}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 font-black text-white shadow-soft transition hover:-translate-y-1 hover:bg-river active:scale-95"
              >
                开始 AI 规划
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-full border border-river/20 bg-white/75 px-7 py-4 font-black text-ink shadow-sm transition hover:-translate-y-1 hover:border-river/40 hover:bg-white active:scale-95">
                <Play className="h-5 w-5 text-tower" />
                现场路演模式
              </button>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {['路线', '讲解', '传播'].map((item) => (
                <div key={item} className="glass rounded-2xl p-4">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-jade" />
                  <div className="font-black text-ink">{item}自动生成</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[500px] overflow-hidden rounded-[2rem] bg-ink shadow-soft">
            <img src={cities[0].imageUrl} alt="三峡大坝风景" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="mb-4 inline-flex rounded-full bg-white/16 px-4 py-2 text-sm font-black backdrop-blur">AI Agent Canvas</div>
              <h2 className="font-display text-4xl font-black">旅行想法 → 可执行行程</h2>
              <p className="mt-3 max-w-xl text-white/72">一句话输入，自动产出路线、预算、讲解和传播内容。</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {['路线', '预算', '打卡', '脚本'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/14 p-4 text-center font-black backdrop-blur">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-river">City Entrances</p>
              <h2 className="mt-2 font-display text-4xl font-black text-ink">湖北城市入口</h2>
            </div>
            <p className="max-w-xl text-ink/60">选择城市，快速生成专属湖北路线。</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cities.map((city) => (
              <button
                key={city.name}
                onClick={() => onCitySelect(city.name)}
                className="group relative min-h-[250px] overflow-hidden rounded-[1.75rem] p-5 text-left text-white shadow-soft transition hover:-translate-y-1 active:scale-[0.98]"
              >
                <img src={city.imageUrl} alt={`${city.name}风景`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className={`absolute inset-0 bg-gradient-to-br ${city.gradient} opacity-70 mix-blend-multiply`} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="rounded-full bg-white/18 px-3 py-1 text-sm font-black backdrop-blur">{city.image}</div>
                    <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
                  </div>
                  <div>
                    <h3 className="font-display text-3xl font-black">{city.name}</h3>
                    <p className="mt-2 text-lg font-semibold text-white/88">{city.title}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {city.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/18 px-3 py-1 text-sm font-bold backdrop-blur">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="glass rounded-[1.5rem] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
                  <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-river/10 text-river">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-2xl font-black text-ink">{card.title}</h3>
                  <p className="mt-3 leading-7 text-ink/62">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
