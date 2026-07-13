import { useEffect, useRef, useState } from 'react';
import { Camera, Clock3, LocateFixed, MapPin, Navigation, Route as RouteIcon, Utensils } from 'lucide-react';
import type { RoutePoint, SmartRoute } from '../types/route';
import { getPointTypeLabel } from '../services/mapService';

declare global { interface Window { AMap?: any; _AMapSecurityConfig?: { securityJsCode: string } } }

type Props = { route: SmartRoute; selectedPointId?: string; activePointIndex: number; navigating: boolean; onSelectPoint: (point: RoutePoint) => void; onDistanceCalculated?: (distanceKm: number) => void; mapOnly?: boolean };
const icons: Record<RoutePoint['type'], typeof MapPin> = { start: Navigation, scenic: MapPin, food: Utensils, photo: Camera, rest: Clock3, hotel: MapPin, end: RouteIcon };

export function RouteMap({ route, selectedPointId, onSelectPoint, onDistanceCalculated, mapOnly = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>();
  const markerRef = useRef<any[]>([]);
  const [status, setStatus] = useState<'loading'|'ready'|'raster'|'fallback'>('loading');
  const [message, setMessage] = useState('正在载入高德真实地图…');
  const selected = route.points.find((p) => p.id === selectedPointId) ?? route.points[0];
  const amapEnabled = import.meta.env.VITE_AMAP_ENABLED !== 'false';
  const key = import.meta.env.VITE_AMAP_KEY as string | undefined;
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined;

  useEffect(() => {
    let disposed = false;
    async function mount() {
      if (!container.current) return;
      if (!amapEnabled || !key) { setStatus('raster'); setMessage('高德底图已显示，当前用瓦片底图叠加 AI 实时路线。'); return; }
      try {
        if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode };
        if (!window.AMap) await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-amap]');
          if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
          const script = document.createElement('script'); script.dataset.amap = 'true'; script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Driving`; script.onload = () => resolve(); script.onerror = reject; document.head.appendChild(script);
        });
        if (disposed || !container.current || !window.AMap) return;
        const AMap = window.AMap;
        mapRef.current?.destroy();
        const map = new AMap.Map(container.current, {
          zoom: 12,
          center: [route.points[0].lng, route.points[0].lat],
          viewMode: '2D',
          resizeEnable: true,
          mapStyle: 'amap://styles/normal',
          features: ['bg', 'road', 'building', 'point'],
          layers: [new AMap.TileLayer({ visible: true, zIndex: 1 })],
        });
        map.setFeatures?.(['bg', 'road', 'building', 'point']);
        map.setMapStyle?.('amap://styles/normal');
        mapRef.current = map;

        markerRef.current = route.points.map((point, index) => createRouteMarker(AMap, map, point, index, onSelectPoint));
        const routeResult = await drawAmapDrivingRoute(AMap, map, route.points);
        if (routeResult.distanceKm) onDistanceCalculated?.(routeResult.distanceKm);
        window.requestAnimationFrame(() => map.resize?.());
        map.setFitView([routeResult.overlay, ...markerRef.current].filter(Boolean), false, [90, 90, 90, 90]);
        if (routeResult.planned) {
          setStatus('ready');
          setMessage('高德地图已连接，已按真实道路生成实时导航路线。');
        } else {
          setStatus('ready');
          setMessage('高德 JS API 实时底图已显示，路径规划服务不可用时已叠加可缩放拖动的 AI 路线。');
        }
      } catch { setStatus('raster'); setMessage('真实地图加载失败，已切换高德底图瓦片并保留实时路线点。'); }
    }
    mount(); return () => { disposed = true; mapRef.current?.destroy(); mapRef.current = undefined; };
  }, [route.id, amapEnabled, key, securityCode]);

  useEffect(() => {
    if (!selected || status !== 'ready' || !mapRef.current) return;
    mapRef.current.resize?.();
    mapRef.current.setZoomAndCenter(15, [selected.lng, selected.lat], false, 350);
  }, [selected?.id, status]);

  const fallback = status === 'fallback';
  const raster = status === 'raster';

  return <section className={`min-w-0 overflow-hidden bg-white ${mapOnly ? 'h-full' : 'rounded-[1.75rem] shadow-soft ring-1 ring-ink/5'}`}>
    {!mapOnly && <div className="flex flex-col gap-4 border-b border-ink/5 p-5 md:flex-row md:items-center md:justify-between"><div><div className="inline-flex items-center gap-2 text-xs font-black tracking-[.16em] text-river"><Navigation className="h-4 w-4"/>LIVE ROUTE</div><h3 className="mt-2 font-display text-2xl font-black">{route.title}</h3><p className="mt-1 text-sm text-ink/50">{message}</p></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-mist px-3 py-2">{route.totalDistanceKm} km</span><span className="rounded-full bg-mist px-3 py-2">{route.recommendedStartTime} 出发</span></div></div>}
      <div className={mapOnly ? 'h-full min-w-0' : 'grid min-w-0 lg:grid-cols-[1.35fr_.65fr]'}><div className={`relative min-w-0 overflow-hidden bg-[#d8f1ee] ${mapOnly ? 'h-full min-h-[620px]' : 'min-h-[430px]'}`}><div ref={container} className={`absolute inset-0 ${fallback || raster ? 'hidden' : ''}`}/>{raster&&<GaodeRasterRouteMap route={route} selectedPointId={selectedPointId} onSelectPoint={onSelectPoint} />}{fallback&&<FallbackRouteMap route={route} selectedPointId={selectedPointId} onSelectPoint={onSelectPoint} />}</div>
      {!mapOnly&&<aside className="bg-[#fbfaf5] p-5">{selected&&<><div className="text-xs font-black tracking-[.16em] text-tower">STOP {route.points.findIndex(p=>p.id===selected.id)+1}</div><h4 className="mt-2 font-display text-3xl font-black">{selected.name}</h4><div className="mt-2 flex gap-2 text-xs font-bold text-ink/50"><span>{getPointTypeLabel(selected.type)}</span><span>·</span><span>{selected.time}</span><span>·</span><span>{selected.stayMinutes} 分钟</span></div><p className="mt-5 leading-7 text-ink/68">{selected.reason}</p><div className="mt-4 rounded-xl border-l-4 border-tower bg-white p-4 text-sm leading-6"><b>拍照：</b>{selected.photoTip}</div><div className="mt-3 rounded-xl bg-river/5 p-4 text-sm leading-6"><b>手账：</b>{selected.recordTip}</div></>}</aside>}
    </div>
  </section>;
}

function createRouteMarker(AMap: any, map: any, point: RoutePoint, index: number, onSelectPoint: (point: RoutePoint) => void) {
  const color = pointColor(point.type);
  const marker = new AMap.Marker({
    position: [point.lng, point.lat],
    title: point.name,
    anchor: 'bottom-center',
    content: `<button class="amap-smart-marker" style="--marker:${color}" aria-label="${index + 1} ${point.name}"><span>${index + 1}</span></button>`,
    label: {
      content: `<span class="amap-route-name">${point.name}</span>`,
      direction: 'bottom',
      offset: new AMap.Pixel(0, 8),
    },
  });
  marker.on('click', () => onSelectPoint(point));
  map.add(marker);
  return marker;
}

function drawAmapDrivingRoute(AMap: any, map: any, points: RoutePoint[]) {
  return new Promise<{ overlay: any; planned: boolean; distanceKm?: number }>((resolve, reject) => {
    const path = points.map((point) => [point.lng, point.lat]);
    const lngLats = points.map((point) => new AMap.LngLat(point.lng, point.lat));
    const fallbackLine = () => {
      const line = new AMap.Polyline({
        path,
        strokeColor: '#0E6B72',
        strokeWeight: 8,
        strokeOpacity: 0.9,
        showDir: true,
        lineJoin: 'round',
      });
      map.add(line);
      resolve({ overlay: line, planned: false });
    };

    if (points.length < 2 || !AMap.plugin) {
      fallbackLine();
      return;
    }

    AMap.plugin('AMap.Driving', () => {
      try {
        const driving = new AMap.Driving({
          map,
          hideMarkers: true,
          showTraffic: true,
          policy: AMap.DrivingPolicy?.LEAST_TIME,
        });
        const start = lngLats[0];
        const end = lngLats[lngLats.length - 1];
        const waypoints = lngLats.slice(1, -1);
        driving.search(start, end, { waypoints }, (status: string, result: any) => {
          if (status === 'complete') {
            const distanceMeters = result?.routes?.[0]?.distance;
            resolve({ overlay: driving, planned: true, distanceKm: distanceMeters ? Number((distanceMeters / 1000).toFixed(1)) : undefined });
          } else {
            fallbackLine();
          }
        });
      } catch {
        reject(new Error('AMap driving route failed'));
      }
    });
  });
}

function pointColor(type: RoutePoint['type']) {
  const colors: Record<RoutePoint['type'], string> = {
    start: '#12a885',
    scenic: '#1976d2',
    food: '#f97316',
    photo: '#ec4899',
    rest: '#64748b',
    hotel: '#7c3aed',
    end: '#7c3aed',
  };
  return colors[type];
}

function GaodeRasterRouteMap({ route, selectedPointId, onSelectPoint }: { route: SmartRoute; selectedPointId?: string; onSelectPoint: (point: RoutePoint) => void }) {
  const points = route.points;
  const zoom = 12;
  const bounds = getPointBounds(points);
  const center = {
    lng: (bounds.minLng + bounds.maxLng) / 2,
    lat: (bounds.minLat + bounds.maxLat) / 2,
  };
  const centerWorld = lngLatToWorld(center.lng, center.lat, zoom);
  const projected = points.map((point) => {
    const world = lngLatToWorld(point.lng, point.lat, zoom);
    return {
      point,
      x: world.x - centerWorld.x + 500,
      y: world.y - centerWorld.y + 350,
    };
  });
  const line = projected.map((item) => `${item.x},${item.y}`).join(' ');
  const tileCenter = {
    x: Math.floor(centerWorld.x / 256),
    y: Math.floor(centerWorld.y / 256),
  };
  const tiles = Array.from({ length: 35 }, (_, index) => {
    const dx = (index % 7) - 3;
    const dy = Math.floor(index / 7) - 2;
    const x = tileCenter.x + dx;
    const y = tileCenter.y + dy;
    const originX = x * 256 - centerWorld.x + 500;
    const originY = y * 256 - centerWorld.y + 350;
    return { x, y, originX, originY, server: Math.abs(x + y) % 4 + 1 };
  });

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#dce9e5]">
      <div className="absolute left-1/2 top-1/2 h-[760px] w-[1120px] -translate-x-1/2 -translate-y-1/2">
        {tiles.map((tile) => (
          <img
            key={`${tile.x}-${tile.y}`}
            src={`https://webrd0${tile.server}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${tile.x}&y=${tile.y}&z=${zoom}`}
            alt=""
            className="absolute select-none"
            draggable={false}
            style={{ left: tile.originX, top: tile.originY, width: 256, height: 256 }}
          />
        ))}
        <svg viewBox="0 0 1000 700" className="absolute inset-0 h-full w-full">
          <polyline points={line} fill="none" stroke="#ffffff" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
          <polyline points={line} fill="none" stroke="#0e6b72" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 12" />
          <polyline points={line} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".8" />
        </svg>
        {projected.map(({ point, x, y }, index) => {
          const active = point.id === selectedPointId;
          return (
            <button
              key={point.id}
              onClick={() => onSelectPoint(point)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white px-2.5 py-1.5 text-xs font-black text-white shadow-lg transition hover:-translate-y-[60%] active:scale-95 ${active ? 'bg-tower ring-4 ring-tower/25' : 'bg-river'}`}
              style={{ left: x, top: y }}
            >
              {index + 1}
            </button>
          );
        })}
        {projected.map(({ point, x, y }) => (
          <div
            key={`${point.id}-name`}
            className="absolute -translate-x-1/2 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-ink shadow-md"
            style={{ left: x, top: y + 25 }}
          >
            {point.name}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/55 to-transparent" />
      <div className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-ink/60 shadow-sm">高德地图底图 · AutoNavi</div>
      <div className="absolute bottom-3 right-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-river shadow-sm">实时路线叠加 · 可点击点位</div>
    </div>
  );
}

function FallbackRouteMap({ route, selectedPointId, onSelectPoint }: { route: SmartRoute; selectedPointId?: string; onSelectPoint: (point: RoutePoint) => void }) {
  const points = route.points.slice(0, 8);
  const positions = points.map((_, index) => {
    const t = points.length <= 1 ? 0 : index / (points.length - 1);
    return {
      x: 16 + t * 72 + (index % 2 === 0 ? 0 : 4),
      y: 74 - Math.sin(t * Math.PI) * 48 + (index % 2 === 0 ? 2 : -5),
    };
  });
  const line = positions.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="absolute inset-0 bg-[linear-gradient(135deg,#dff5f2_0%,#c7ecf1_48%,#d9f0d2_100%)]">
      <div className="absolute -left-16 top-24 h-44 w-[110%] -rotate-6 rounded-full bg-river/20 blur-sm" />
      <div className="absolute bottom-0 left-0 h-52 w-full bg-jade/20" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(#1b70a61a_1px,transparent_1px),linear-gradient(90deg,#1b70a61a_1px,transparent_1px)] [background-size:54px_54px]" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <path d="M-5 82 C20 62 35 78 55 58 C74 38 82 45 106 26" fill="none" stroke="#ffffff" strokeWidth="5.8" strokeLinecap="round" opacity="0.72" />
        <path d="M-2 72 C18 58 34 62 50 49 C66 36 81 38 104 18" fill="none" stroke="#78c8e2" strokeWidth="13" strokeLinecap="round" opacity="0.55" />
        <polyline points={line} fill="none" stroke="#ffffff" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={line} fill="none" stroke="#0e6b72" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
      </svg>
      {points.map((point, index) => {
        const pos = positions[index];
        const active = point.id === selectedPointId;
        return (
          <button
            key={point.id}
            onClick={() => onSelectPoint(point)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white px-2.5 py-1.5 text-xs font-black text-white shadow-lg transition hover:-translate-y-[60%] active:scale-95 ${active ? 'bg-tower ring-4 ring-tower/25' : 'bg-river'}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            {index + 1}
          </button>
        );
      })}
      {points.map((point, index) => {
        const pos = positions[index];
        return (
          <div
            key={`${point.id}-label`}
            className="absolute -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-ink shadow-sm"
            style={{ left: `${pos.x}%`, top: `calc(${pos.y}% + 28px)` }}
          >
            {point.name}
          </div>
        );
      })}
      <div className="absolute bottom-5 right-5 max-w-sm rounded-2xl bg-ink/92 p-4 text-white shadow-xl">
        <div className="text-xs font-black tracking-[.16em] text-jade">AI ROUTE LIVE DEMO</div>
        <div className="mt-2 font-display text-xl font-black">{route.city}实况路线图</div>
        <p className="mt-2 text-sm leading-6 text-white/70">点击地图编号或右侧模块，可联动查看沿路景点、交通、美食与预算。</p>
      </div>
    </div>
  );
}

function getPointBounds(points: RoutePoint[]) {
  return points.reduce((bounds, point) => ({
    minLng: Math.min(bounds.minLng, point.lng),
    maxLng: Math.max(bounds.maxLng, point.lng),
    minLat: Math.min(bounds.minLat, point.lat),
    maxLat: Math.max(bounds.maxLat, point.lat),
  }), { minLng: points[0]?.lng ?? 111, maxLng: points[0]?.lng ?? 111, minLat: points[0]?.lat ?? 30, maxLat: points[0]?.lat ?? 30 });
}

function lngLatToWorld(lng: number, lat: number, zoom: number) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const size = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size,
  };
}
