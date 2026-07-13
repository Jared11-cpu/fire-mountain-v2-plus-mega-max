import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, MapPin, Plus, Route, ShieldCheck, Trash2 } from 'lucide-react';
import type { JournalEntry } from '../types/route';
import { clearJournal, deletePhoto, loadPhoto, readEntries, savePhoto, writeEntries } from '../services/journalStorage';

type FootprintDetail = 'places' | 'mileage' | 'cities' | 'photos';

export function JournalPage({ onPlan, initialFocus = null }: { onPlan: () => void; initialFocus?: FootprintDetail | null }) {
  const [entries, setEntries] = useState<JournalEntry[]>(readEntries);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ pointName: '', note: '', city: '武汉' });
  const [focus, setFocus] = useState<FootprintDetail | null>(initialFocus);

  useEffect(() => {
    setFocus(initialFocus);
  }, [initialFocus]);

  useEffect(() => {
    const urls: string[] = [];
    Promise.all(entries.flatMap((entry) => entry.photoIds).map(async (id) => {
      const blob = await loadPhoto(id);
      if (blob) { const url = URL.createObjectURL(blob); urls.push(url); setPhotos((p) => ({ ...p, [id]: url })); }
    }));
    return () => urls.forEach(URL.revokeObjectURL);
  }, [entries]);

  const copy = useMemo(() => entries.length
    ? `这次湖北之旅走过 ${new Set(entries.map((e) => e.pointName)).size} 个地点，留下 ${entries.reduce((n, e) => n + e.photoIds.length, 0)} 张现场照片。把攻略走成故事，才是旅行真正的开始。`
    : '把沿途真实照片、当时的心情和位置收进一本会生长的湖北旅行手账。', [entries]);

  const addEntry = async (files: FileList | null) => {
    if (!draft.pointName.trim() && !files?.length) return;
    const photoIds = files ? await Promise.all(Array.from(files).slice(0, 6).map(savePhoto)) : [];
    const next: JournalEntry = { id: crypto.randomUUID(), pointId: 'manual', pointName: draft.pointName || '沿途一刻', city: draft.city as JournalEntry['city'], day: 1, note: draft.note, visitedAt: new Date().toISOString(), photoIds };
    const updated = [next, ...entries]; setEntries(updated); writeEntries(updated); setDraft({ ...draft, pointName: '', note: '' });
  };

  const removeEntry = async (entry: JournalEntry) => {
    await Promise.all(entry.photoIds.map(deletePhoto));
    const updated = entries.filter((item) => item.id !== entry.id); setEntries(updated); writeEntries(updated);
  };

  return <main className="section-pad py-10"><div className="mx-auto max-w-6xl">
    <header className="journal-cover overflow-hidden rounded-[2rem] p-7 text-white md:p-12">
      <div className="text-sm font-black tracking-[.24em] text-[#bfe8d5]">MY HUBEI FIELD NOTES</div>
      <h1 className="mt-4 font-display text-4xl font-black md:text-6xl">旅行不是打卡，<br/>是把路走成自己的故事。</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75">{copy}</p>
      <div className="mt-7 flex flex-wrap gap-3"><button onClick={onPlan} className="rounded-full bg-[#e75b3d] px-5 py-3 font-black">去生成一条路线</button><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm"><ShieldCheck className="h-4 w-4"/>照片仅保存在此设备</span></div>
    </header>

    <section className="mt-7 grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="paper-card h-fit rounded-[1.5rem] p-5 lg:sticky lg:top-28">
        <div className="flex items-center gap-2 font-display text-2xl font-black"><Plus className="text-tower"/>记下这一刻</div>
        <input aria-label="地点" value={draft.pointName} onChange={(e) => setDraft({ ...draft, pointName: e.target.value })} placeholder="地点，例如：汉口江滩" className="focus-ring mt-5 w-full rounded-xl border border-ink/10 bg-white px-4 py-3" />
        <select aria-label="城市" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} className="mt-3 w-full rounded-xl border border-ink/10 bg-white px-4 py-3">{['武汉','宜昌','恩施','荆州','襄阳','黄石'].map((x)=><option key={x}>{x}</option>)}</select>
        <textarea aria-label="手账文字" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="当时看见了什么、听见了什么？" className="focus-ring mt-3 min-h-28 w-full resize-none rounded-xl border border-ink/10 bg-white px-4 py-3" />
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-black text-white"><Camera className="h-5 w-5"/>选择真实照片<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addEntry(e.target.files)}/></label>
        <p className="mt-3 text-xs leading-5 text-ink/45">每次最多 6 张。照片存入浏览器 IndexedDB，不会上传云端。</p>
      </div>
      <div>
        <FootprintDetailPanel focus={focus} entries={entries} photos={photos} onFocus={setFocus} />
        <JournalRouteMap entries={entries} photos={photos} />
        {entries.length > 0 && <div className="mt-5 space-y-5">{entries.map((entry, index)=><article key={entry.id} className="paper-card rounded-[1.5rem] p-5 md:p-7"><div className="flex items-start justify-between"><div><div className="text-xs font-black tracking-[.18em] text-tower">STOP {String(entries.length-index).padStart(2,'0')}</div><h2 className="mt-1 font-display text-3xl font-black">{entry.pointName}</h2><div className="mt-2 flex items-center gap-2 text-sm text-ink/50"><MapPin className="h-4 w-4"/>{entry.city} · {new Date(entry.visitedAt).toLocaleString('zh-CN')}</div></div><button aria-label="删除记录" onClick={()=>removeEntry(entry)} className="rounded-full p-2 text-ink/35 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-5 w-5"/></button></div>{entry.photoIds.length>0&&<div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">{entry.photoIds.map((id)=><div key={id} className="aspect-[4/3] overflow-hidden rounded-xl bg-ink/5">{photos[id]&&<img src={photos[id]} alt={`${entry.pointName}旅行照片`} className="h-full w-full object-cover"/>}</div>)}</div>}<p className="journal-handwriting mt-5 whitespace-pre-wrap rounded-2xl bg-[#fff8d8] px-4 py-3 text-lg leading-8 text-ink/76">{entry.note||'这一站没有文字，照片已经记住了当时的光。'}</p></article>)}</div>}
      {entries.length>0&&<button onClick={async()=>{await clearJournal(entries);setEntries([])}} className="mt-6 text-sm font-bold text-red-600">清空整本手账</button>}</div>
    </section>
  </div></main>;
}

function JournalRouteMap({ entries, photos }: { entries: JournalEntry[]; photos: Record<string, string> }) {
  const chronological = [...entries].reverse();
  const points = chronological.length > 0 ? chronological : demoJournalStops;
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>();
  const [selectedId, setSelectedId] = useState(points[0]?.id ?? '');
  const [mapStatus, setMapStatus] = useState('正在连接高德实时地图…');
  const selected = points.find((entry) => entry.id === selectedId) ?? points[0];
  const selectedPhotoId = selected?.photoIds?.[0];
  const selectedPhoto = selectedPhotoId ? photos[selectedPhotoId] : '';
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined;

  useEffect(() => {
    if (!points.some((entry) => entry.id === selectedId)) setSelectedId(points[0]?.id ?? '');
  }, [points.map((entry) => entry.id).join('|')]);

  useEffect(() => {
    let disposed = false;
    async function mountMap() {
      if (!mapContainer.current || !key) {
        setMapStatus('请配置高德 JS API Key 后显示实时地图');
        return;
      }
      try {
        if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
        if (!window.AMap) await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-amap]');
          if (existing) {
            if (window.AMap) resolve();
            else {
              existing.addEventListener('load', () => resolve(), { once: true });
              existing.addEventListener('error', reject, { once: true });
            }
            return;
          }
          const script = document.createElement('script');
          script.dataset.amap = 'true';
          script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (disposed || !mapContainer.current || !window.AMap) return;
        const AMap = window.AMap;
        const coordinates = points.map((entry, index) => journalCoordinate(entry, index));
        const map = new AMap.Map(mapContainer.current, {
          zoom: 7,
          center: coordinates[0],
          viewMode: '2D',
          resizeEnable: true,
          mapStyle: 'amap://styles/normal',
          features: ['bg', 'road', 'building', 'point'],
        });
        mapInstance.current = map;
        const line = new AMap.Polyline({
          path: coordinates,
          strokeColor: '#0E6B72',
          strokeWeight: 6,
          strokeOpacity: .88,
          showDir: true,
          lineJoin: 'round',
        });
        map.add(line);
        const markers = points.map((entry, index) => {
          const marker = new AMap.Marker({
            position: coordinates[index],
            anchor: 'bottom-center',
            title: entry.pointName,
            content: `<button class="amap-smart-marker journal-amap-marker" aria-label="${index + 1} ${entry.pointName}"><span>${index + 1}</span></button>`,
            label: { content: `<span class="amap-route-name">${entry.pointName}</span>`, direction: 'bottom', offset: new AMap.Pixel(0, 8) },
          });
          marker.on('click', () => setSelectedId(entry.id));
          map.add(marker);
          return marker;
        });
        map.setFitView([line, ...markers], false, [70, 70, 70, 70]);
        setMapStatus('高德实时地图 · 可缩放、拖动并点击记录点');
      } catch {
        setMapStatus('高德地图暂未加载，请检查 Key 与安全密钥');
      }
    }
    mountMap();
    return () => { disposed = true; mapInstance.current?.destroy(); mapInstance.current = undefined; };
  }, [key, securityCode, points.map((entry) => `${entry.id}-${entry.city}`).join('|')]);

  return (
    <section className="journal-map mt-5 overflow-hidden rounded-[1.7rem] border border-ink/8 p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-black tracking-[.2em] text-river"><Route className="h-4 w-4"/>MY ROUTE MAP</div>
          <h2 className="journal-handwriting mt-2 text-4xl font-black text-ink">我的旅行路线手账</h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-ink/52">每个点位都保留照片和当时的感想，路线会随着你上传记录自动生长。</p>
      </div>

      <div className="relative mt-5 h-[420px] overflow-hidden rounded-[1.4rem] bg-[#e5efeb]">
        <div ref={mapContainer} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/92 px-3 py-2 text-xs font-black text-river shadow-lg backdrop-blur">{mapStatus}</div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {points.map((entry, index) => <button key={entry.id} onClick={() => setSelectedId(entry.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${selected?.id === entry.id ? 'bg-ink text-white' : 'bg-white text-ink/55 hover:text-ink'}`}>{index + 1} · {entry.pointName}</button>)}
      </div>

      {selected && <article className="journal-notebook-lines mt-4 grid min-h-48 overflow-hidden rounded-[1.4rem] border border-ink/10 shadow-[0_18px_45px_rgba(18,34,42,.09)] md:grid-cols-[220px_1fr]">
        <div className="relative min-h-44 bg-ink/5">
          {selectedPhoto ? <img src={selectedPhoto} alt={`${selected.pointName}旅行照片`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-center text-ink/28"><Camera className="mb-2 h-7 w-7"/><span className="text-xs font-black">这一站等待真实照片</span></div>}
        </div>
        <div className="relative px-7 py-6 md:px-9">
          <div className="absolute bottom-0 left-4 top-0 w-px bg-tower/25" />
          <div className="flex items-center gap-2 text-[10px] font-black tracking-[.22em] text-tower"><BookOpen className="h-4 w-4"/>TRAVEL NOTE</div>
          <div className="journal-handwriting mt-2 flex flex-wrap items-baseline gap-x-3 text-ink"><h3 className="text-3xl font-black">{selected.pointName}</h3><span className="text-lg text-ink/45">{selected.city}</span></div>
          <p className="journal-handwriting mt-3 whitespace-pre-wrap text-xl leading-8 text-ink/72">{selected.note || '这一站没有文字，照片已经记住了当时的光。'}</p>
        </div>
      </article>}
    </section>
  );
}

const journalCityCoordinates: Record<string, [number, number]> = {
  武汉: [114.3055, 30.5928], 宜昌: [111.2865, 30.6919], 恩施: [109.4882, 30.2722],
  荆州: [112.2397, 30.3352], 襄阳: [112.1224, 32.009], 黄石: [115.0389, 30.1995],
};

function journalCoordinate(entry: JournalEntry, index: number): [number, number] {
  const base = journalCityCoordinates[entry.city] ?? journalCityCoordinates.武汉;
  const offset = index * .012;
  return [base[0] + offset, base[1] + (index % 2 ? offset : -offset)];
}

const demoJournalStops: JournalEntry[] = [
  { id: 'demo-1', pointId: 'demo-1', pointName: '出发地', city: '武汉', day: 1, note: '从这里开始写下今天的风。', visitedAt: new Date().toISOString(), photoIds: [] },
  { id: 'demo-2', pointId: 'demo-2', pointName: '沿途风景', city: '宜昌', day: 1, note: '把窗外的山水收进口袋。', visitedAt: new Date().toISOString(), photoIds: [] },
  { id: 'demo-3', pointId: 'demo-3', pointName: '夜景收尾', city: '宜昌', day: 1, note: '灯亮起来，路线也有了结尾。', visitedAt: new Date().toISOString(), photoIds: [] },
];

function FootprintDetailPanel({ focus, entries, photos, onFocus }: { focus: FootprintDetail | null; entries: JournalEntry[]; photos: Record<string, string>; onFocus: (focus: FootprintDetail | null) => void }) {
  const places = [...new Set(entries.map((entry) => entry.pointName))];
  const cities = [...new Set(entries.map((entry) => entry.city))];
  const photoCount = entries.reduce((sum, entry) => sum + entry.photoIds.length, 0);
  const mileage = Math.round(Math.max(0, places.length - 1) * 8.6);
  const current = focus ?? 'places';

  return (
    <section className="paper-card rounded-[1.5rem] p-5 md:p-7">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <div className="text-xs font-black tracking-[.18em] text-river">FOOTPRINT DETAILS</div>
          <h2 className="mt-1 font-display text-3xl font-black">足迹详情</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <DetailTab active={current === 'places'} label="地点" onClick={() => onFocus('places')} />
          <DetailTab active={current === 'mileage'} label="里程" onClick={() => onFocus('mileage')} />
          <DetailTab active={current === 'cities'} label="城市" onClick={() => onFocus('cities')} />
          <DetailTab active={current === 'photos'} label="照片" onClick={() => onFocus('photos')} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-mist p-4">
        {entries.length === 0 && <p className="text-sm leading-6 text-ink/55">还没有旅行记录。上传第一张真实照片后，这里会自动生成详细足迹。</p>}
        {entries.length > 0 && current === 'places' && <div className="flex flex-wrap gap-2">{places.map((place)=><span key={place} className="rounded-full bg-white px-3 py-2 text-sm font-black text-ink shadow-sm">{place}</span>)}</div>}
        {entries.length > 0 && current === 'cities' && <div className="flex flex-wrap gap-2">{cities.map((city)=><span key={city} className="rounded-full bg-river/10 px-3 py-2 text-sm font-black text-river">{city}</span>)}</div>}
        {entries.length > 0 && current === 'mileage' && <div><div className="font-display text-4xl font-black text-ink">{mileage} km</div><p className="mt-2 text-sm leading-6 text-ink/55">当前根据记录地点数量估算；接入真实 GPS 轨迹后，可替换为精确步行/驾车/公交里程。</p></div>}
        {entries.length > 0 && current === 'photos' && <div><div className="mb-3 text-sm font-black text-ink/55">共 {photoCount} 张真实照片</div><div className="grid grid-cols-3 gap-2">{entries.flatMap((entry)=>entry.photoIds.map((id)=><div key={id} className="aspect-square overflow-hidden rounded-xl bg-white">{photos[id]&&<img src={photos[id]} alt="旅行足迹照片" className="h-full w-full object-cover"/>}</div>))}</div></div>}
      </div>
    </section>
  );
}

function DetailTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button onClick={onClick} className={`rounded-full px-3 py-2 text-xs font-black transition active:scale-95 ${active ? 'bg-ink text-white' : 'bg-white text-ink/55 hover:text-ink'}`}>{label}</button>;
}
