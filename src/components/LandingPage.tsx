import { useMemo, useState } from 'react';
import { ArrowRight, Send } from 'lucide-react';
import { cities, type CityName } from '../data/mockData';
import { useTrip } from '../state/tripStore';

type LandingPageProps = {
  onStart: (prompt?: string) => void;
  onCitySelect: (city: CityName) => void;
  onFootprintDetail: (type: 'places' | 'mileage' | 'cities' | 'photos') => void;
};

export function LandingPage({ onStart, onCitySelect, onFootprintDetail }: LandingPageProps) {
  const [prompt, setPrompt] = useState('');
  const { journalEntries: entries } = useTrip();
  const stats = useMemo(() => {
    const places = new Set(entries.map((item) => item.pointName)).size;
    const citiesVisited = new Set(entries.map((item) => item.city)).size;
    const photos = entries.reduce((sum, item) => sum + item.photoIds.length, 0);
    const mileage = 0;
    return { places, citiesVisited, photos, mileage };
  }, [entries]);
  const submitPrompt = () => onStart(prompt.trim());
  return (
    <main>
      <section className="section-pad river-line relative overflow-hidden py-14 md:py-20">
        <div className="absolute inset-0 -z-10 bg-river-grid map-ridge opacity-80" />
        <div className="mx-auto max-w-5xl text-center">
            <h1 className="font-display text-5xl font-black leading-[1.08] text-ink sm:text-6xl lg:text-7xl">
              一句话，走懂湖北
            </h1>
            <form onSubmit={(event) => { event.preventDefault(); submitPrompt(); }} className="mx-auto mt-8 flex w-full max-w-2xl items-center gap-2 rounded-full border border-ink/10 bg-white/92 px-5 py-3 text-left shadow-soft transition focus-within:border-river/40 focus-within:ring-4 focus-within:ring-river/10">
              <input
                aria-label="旅行需求"
                value={prompt}
                onChange={(event)=>setPrompt(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:text-ink/35"
                placeholder="例如：恩施三天两夜，预算 1000，喜欢峡谷和拍照"
              />
              <button type="submit" aria-label="发送旅行需求" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-tower text-white transition hover:scale-105 active:scale-95"><Send className="h-4 w-4" /></button>
            </form>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => onStart()}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 font-black text-white shadow-soft transition hover:-translate-y-1 hover:bg-river active:scale-95"
              >
                立即生成行程
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </button>
            </div>
        </div>
      </section>

      <section className="section-pad py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div>
              <h2 className="font-display text-4xl font-black text-ink">湖北城市入口</h2>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cities.map((city) => (
              <article key={city.name} className="group relative min-h-[250px] overflow-hidden rounded-[1.75rem] text-left text-white shadow-soft transition hover:-translate-y-1">
                <img src={city.imageUrl} alt={`${city.name}城市风景`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-black/10" />
                <button type="button" aria-label={`选择${city.name}并进入规划`} onClick={() => onCitySelect(city.name)} className="absolute inset-0 z-[1]" />
                <a href={city.imageCredit.sourceUrl} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[9px] font-bold text-white/75">{city.imageCredit.author} · {city.imageCredit.license}</a>
                <div className="pointer-events-none relative z-[2] flex h-full flex-col justify-between p-5">
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
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad pb-20 pt-4">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] bg-ink p-7 text-white shadow-soft md:p-10">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="text-xs font-black tracking-[.22em] text-jade">MY TRAVEL FOOTPRINT</div><h2 className="mt-2 font-display text-3xl font-black">我的湖北旅行足迹</h2></div><p className="text-sm text-white/45">数据来自保存在本设备的旅行手账</p></div>
            <div className="mt-7 grid grid-cols-2 divide-x divide-white/10 md:grid-cols-4">
              <Stat value={stats.places} unit="处" label="记录地点" onClick={()=>onFootprintDetail('places')} />
              <Stat value={stats.mileage} unit="km" label="累计里程" onClick={()=>onFootprintDetail('mileage')} />
              <Stat value={stats.citiesVisited} unit="座" label="到访城市" onClick={()=>onFootprintDetail('cities')} />
              <Stat value={stats.photos} unit="张" label="真实照片" onClick={()=>onFootprintDetail('photos')} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({value,unit,label,onClick}:{value:number;unit:string;label:string;onClick:()=>void}) { return <button onClick={onClick} className="px-4 py-4 text-center transition hover:-translate-y-1 hover:bg-white/5 active:scale-95 first:pl-0 last:pr-0"><div><span className="font-display text-4xl font-black text-[#f4d17a] md:text-5xl">{value}</span><span className="ml-1 text-sm font-black text-white/55">{unit}</span></div><div className="mt-2 text-sm font-bold text-white/55">{label} · 进入详情</div></button> }
