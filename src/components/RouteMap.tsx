import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock3, LocateFixed, MapPin, Navigation, Route as RouteIcon, Utensils } from 'lucide-react';
import type { RoutePoint, SmartRoute } from '../types/route';
import { getPointTypeLabel } from '../services/mapService';

declare global { interface Window { AMap?: any; _AMapSecurityConfig?: { securityJsCode: string } } }

type Props = { route: SmartRoute; selectedPointId?: string; activePointIndex: number; navigating: boolean; onSelectPoint: (point: RoutePoint) => void; mapOnly?: boolean };
const icons: Record<RoutePoint['type'], typeof MapPin> = { start: Navigation, scenic: MapPin, food: Utensils, photo: Camera, rest: Clock3, hotel: MapPin, end: RouteIcon };

export function RouteMap({ route, selectedPointId, onSelectPoint, mapOnly = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>();
  const markerRef = useRef<any[]>([]);
  const [status, setStatus] = useState<'loading'|'ready'|'fallback'>('loading');
  const [message, setMessage] = useState('正在载入高德真实地图…');
  const selected = route.points.find((p) => p.id === selectedPointId) ?? route.points[0];
  const amapEnabled = import.meta.env.VITE_AMAP_ENABLED === 'true';
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined;

  useEffect(() => {
    let disposed = false;
    async function mount() {
      if (!amapEnabled || !key || !container.current) { setStatus('fallback'); setMessage('演示地图模式：未启用真实高德地图，当前展示 AI 路线点列表。'); return; }
      try {
        if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
        if (!window.AMap) await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-amap]');
          if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
          const script = document.createElement('script'); script.dataset.amap = 'true'; script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`; script.onload = () => resolve(); script.onerror = reject; document.head.appendChild(script);
        });
        if (disposed || !container.current || !window.AMap) return;
        const AMap = window.AMap;
        mapRef.current?.destroy();
        const map = new AMap.Map(container.current, { zoom: 12, center: [route.points[0].lng, route.points[0].lat], mapStyle: 'amap://styles/whitesmoke' });
        mapRef.current = map;
        const path = route.points.map((p) => [p.lng, p.lat]);
        const line = new AMap.Polyline({ path, strokeColor: '#0E6B72', strokeWeight: 7, showDir: true, lineJoin: 'round' });
        map.add(line);
        markerRef.current = route.points.map((point, index) => {
          const marker = new AMap.Marker({ position: [point.lng, point.lat], title: point.name, label: { content: `<span class="amap-route-label">${index + 1}</span>`, direction: 'top' } });
          marker.on('click', () => onSelectPoint(point)); map.add(marker); return marker;
        });
        map.setFitView([line, ...markerRef.current], false, [60, 60, 60, 60]);
        setStatus('ready'); setMessage('高德地图已连接，点击编号可联动行程。');
      } catch { setStatus('fallback'); setMessage('真实地图加载失败，已安全回退到演示路线点列表。'); }
    }
    mount(); return () => { disposed = true; mapRef.current?.destroy(); mapRef.current = undefined; };
  }, [route.id, amapEnabled, key, securityCode]);

  useEffect(() => {
    if (!selected || status !== 'ready' || !mapRef.current) return;
    mapRef.current.setZoomAndCenter(15, [selected.lng, selected.lat], false, 350);
  }, [selected?.id, status]);

  return <section className={`overflow-hidden bg-white ${mapOnly ? 'h-full' : 'rounded-[1.75rem] shadow-soft ring-1 ring-ink/5'}`}>
    {!mapOnly && <div className="flex flex-col gap-4 border-b border-ink/5 p-5 md:flex-row md:items-center md:justify-between"><div><div className="inline-flex items-center gap-2 text-xs font-black tracking-[.16em] text-river"><Navigation className="h-4 w-4"/>LIVE ROUTE</div><h3 className="mt-2 font-display text-2xl font-black">{route.title}</h3><p className="mt-1 text-sm text-ink/50">{message}</p></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-mist px-3 py-2">{route.totalDistanceKm} km</span><span className="rounded-full bg-mist px-3 py-2">{route.recommendedStartTime} 出发</span></div></div>}
    <div className={mapOnly ? 'h-full' : 'grid lg:grid-cols-[1.35fr_.65fr]'}><div className={`relative bg-[#e9efec] ${mapOnly ? 'h-full min-h-[620px]' : 'min-h-[430px]'}`}><div ref={container} className={`absolute inset-0 ${status === 'fallback' ? 'hidden' : ''}`}/>{mapOnly&&<div className="absolute left-5 top-5 z-10 max-w-sm rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur"><div className="text-xs font-black tracking-[.16em] text-river">LIVE ROUTE · {route.totalDistanceKm} KM</div><h3 className="mt-1 font-display text-xl font-black">{route.title}</h3><p className="mt-1 text-xs text-ink/50">{message}</p></div>}{status === 'fallback'&&<div className="absolute inset-0 grid place-items-center p-6"><div className="max-w-md text-center"><AlertTriangle className="mx-auto h-9 w-9 text-amber-600"/><h4 className="mt-3 font-display text-2xl font-black">演示数据模式</h4><p className="mt-2 text-sm leading-6 text-ink/55">真实底图暂不可用，仍可点击侧栏路线点查看完整行程。</p><div className="mt-5 flex flex-wrap justify-center gap-2">{route.points.map((p,i)=><button key={p.id} onClick={()=>onSelectPoint(p)} className="rounded-full bg-white px-3 py-2 text-sm font-black shadow-sm">{i+1} {p.name}</button>)}</div></div></div>}</div>
      {!mapOnly&&<aside className="bg-[#fbfaf5] p-5">{selected&&<><div className="text-xs font-black tracking-[.16em] text-tower">STOP {route.points.findIndex(p=>p.id===selected.id)+1}</div><h4 className="mt-2 font-display text-3xl font-black">{selected.name}</h4><div className="mt-2 flex gap-2 text-xs font-bold text-ink/50"><span>{getPointTypeLabel(selected.type)}</span><span>·</span><span>{selected.time}</span><span>·</span><span>{selected.stayMinutes} 分钟</span></div><p className="mt-5 leading-7 text-ink/68">{selected.reason}</p><div className="mt-4 rounded-xl border-l-4 border-tower bg-white p-4 text-sm leading-6"><b>拍照：</b>{selected.photoTip}</div><div className="mt-3 rounded-xl bg-river/5 p-4 text-sm leading-6"><b>手账：</b>{selected.recordTip}</div></>}</aside>}
    </div>
  </section>;
}
