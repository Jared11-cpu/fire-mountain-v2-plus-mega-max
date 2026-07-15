import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Clock3, MapPin, Navigation, RefreshCw, Route as RouteIcon, Utensils } from 'lucide-react';
import type { RoutePoint, SmartRoute } from '../types/route';
import { getPointTypeLabel } from '../services/mapService';
import { classifyDrivingFailure, convertGpsPoint, loadAmapJsApi, loadAmapPlugin, planAmapDrivingRoute, resetAmapJsApiLoader, type DrivingSearchFailure, type RoadPlanMetrics, type RoadPlanStatus } from '../services/amapDriving';

declare global { interface Window { AMap?: any; _AMapSecurityConfig?: { securityJsCode: string } } }

type Props = { route: SmartRoute; selectedPointId?: string; activePointIndex: number; navigating: boolean; onSelectPoint: (point: RoutePoint) => void; onRoadPlanChange?: (metrics: RoadPlanMetrics) => void; mapOnly?: boolean };
const icons: Record<RoutePoint['type'], typeof MapPin> = { start: Navigation, scenic: MapPin, food: Utensils, photo: Camera, rest: Clock3, hotel: MapPin, end: RouteIcon };

export function RouteMap({ route, selectedPointId, onSelectPoint, onRoadPlanChange, mapOnly = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>();
  const markerRef = useRef<any[]>([]);
  const overlayRef = useRef<any[]>([]);
  const drivingRef = useRef<any[]>([]);
  const requestIdRef = useRef(0);
  const [status, setStatus] = useState<RoadPlanStatus>('loading');
  const [message, setMessage] = useState('正在载入高德交互地图…');
  const [retryVersion, setRetryVersion] = useState(0);
  const [mapAvailable, setMapAvailable] = useState(false);
  const selected = route.points.find((p) => p.id === selectedPointId) ?? route.points[0];
  const amapEnabled = import.meta.env.VITE_AMAP_ENABLED !== 'false';
  const key = import.meta.env.VITE_AMAP_KEY;
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE;
  const routeSignature = useMemo(() => route.points.map(({ id, lng, lat, roadAccessLng, roadAccessLat, coordinateSystem }) => `${id}:${lng},${lat}:${roadAccessLng},${roadAccessLat}:${coordinateSystem}`).join('|'), [route.points]);

  useEffect(() => {
    let disposed = false;
    const requestId = ++requestIdRef.current;
    const isCurrent = () => !disposed && requestId === requestIdRef.current;
    const publish = (metrics: RoadPlanMetrics) => {
      if (!isCurrent()) return;
      setStatus(metrics.status);
      setMessage(metrics.message);
      onRoadPlanChange?.(metrics);
    };
    const cleanupMap = () => {
      for (const driving of drivingRef.current) driving?.clear?.();
      drivingRef.current = [];
      if (mapRef.current) {
        if (overlayRef.current.length) mapRef.current.remove?.(overlayRef.current);
        if (markerRef.current.length) mapRef.current.remove?.(markerRef.current);
        mapRef.current.clearMap?.();
        mapRef.current.destroy?.();
      }
      overlayRef.current = [];
      markerRef.current = [];
      mapRef.current = undefined;
    };
    async function mount() {
      if (!container.current) return;
      cleanupMap();
      setMapAvailable(false);
      publish({ status: 'loading', source: 'estimate', message: '正在请求高德道路规划…' });
      if (!amapEnabled || !key) {
        publish({ status: 'auth-error', source: 'estimate', distanceKm: route.totalDistanceKm, message: '未配置高德 JS API Key，道路规划不可用。' });
        return;
      }
      if (!securityCode || /请填写|placeholder/i.test(securityCode)) {
        publish({ status: 'auth-error', source: 'estimate', distanceKm: route.totalDistanceKm, message: '缺少高德安全密钥，未发起道路规划' });
        return;
      }
      try {
        const AMap = await loadAmapJsApi(key, securityCode);
        if (!isCurrent() || !container.current) return;
        await loadAmapPlugin(AMap, 'AMap.Driving');
        if (!isCurrent() || !container.current) return;
        const amapPoints = await Promise.all(route.points.map((point, index) => index === 0 ? convertGpsPoint(AMap, point) : Promise.resolve(point)));
        const map = new AMap.Map(container.current, {
          zoom: 12,
          center: [amapPoints[0].lng, amapPoints[0].lat],
          viewMode: '2D',
          resizeEnable: true,
          mapStyle: 'amap://styles/normal',
          features: ['bg', 'road', 'building', 'point'],
          layers: [new AMap.TileLayer({ visible: true, zIndex: 1 })],
        });
        map.setFeatures?.(['bg', 'road', 'building', 'point']);
        map.setMapStyle?.('amap://styles/normal');
        mapRef.current = map;
        setMapAvailable(true);

        markerRef.current = amapPoints.map((point, index) => createRouteMarker(AMap, map, point, index, onSelectPoint, point.id === selectedPointId));
        const routeResult = await planAmapDrivingRoute(AMap, amapPoints);
        if (!isCurrent()) {
          routeResult.drivingInstances.forEach((driving) => driving?.clear?.());
          return;
        }
        drivingRef.current = routeResult.drivingInstances;
        overlayRef.current = addRoadPolyline(AMap, map, routeResult.path);
        window.requestAnimationFrame(() => map.resize?.());
        map.setFitView([...overlayRef.current, ...markerRef.current], false, [90, 90, 90, 90]);
        publish({
          status: 'planned',
          source: 'amap-driving',
          distanceKm: Number((routeResult.distanceMeters / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round(routeResult.durationSeconds / 60)),
          message: '高德真实道路路线已生成；距离与行车时间来自本次 Driving 结果。',
        });
      } catch (caught) {
        const failure = normalizeFailure(caught);
        console.error('AMap driving failed', { status: failure.status, result: failure.result, error: failure.error });
        if (!isCurrent()) return;
        const failureStatus = classifyDrivingFailure(failure);
        if (mapRef.current && window.AMap) {
          overlayRef.current = addFallbackPolyline(window.AMap, mapRef.current, route.points);
          mapRef.current.setFitView?.([...overlayRef.current, ...markerRef.current], false, [90, 90, 90, 90]);
        }
        publish({ status: failureStatus, source: 'estimate', distanceKm: route.totalDistanceKm, message: failureMessage(failureStatus) });
      }
    }
    mount();
    return () => {
      disposed = true;
      requestIdRef.current += 1;
      cleanupMap();
    };
  }, [route.id, routeSignature, route.totalDistanceKm, amapEnabled, key, securityCode, retryVersion, onRoadPlanChange]);

  useEffect(() => {
    if (!selected || !mapAvailable || !mapRef.current) return;
    mapRef.current.resize?.();
    mapRef.current.setZoomAndCenter(15, [selected.lng, selected.lat], false, 350);
    markerRef.current.forEach((marker, index) => marker.setContent?.(markerContent(route.points[index], index, route.points[index].id === selected.id)));
  }, [selected?.id, mapAvailable]);

  const failed = status !== 'loading' && status !== 'planned';

  return <section className={`min-w-0 overflow-hidden bg-white ${mapOnly ? 'h-full' : 'rounded-[1.75rem] shadow-soft ring-1 ring-ink/5'}`}>
    {!mapOnly && <div className="flex flex-col gap-4 border-b border-ink/5 p-5 md:flex-row md:items-center md:justify-between"><div><div className="inline-flex items-center gap-2 text-xs font-black tracking-[.16em] text-river"><Navigation className="h-4 w-4"/>LIVE ROUTE</div><h3 className="mt-2 font-display text-2xl font-black">{route.title}</h3><p className="mt-1 text-sm text-ink/50">{message}</p></div><div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-mist px-3 py-2">{route.totalDistanceKm} km</span><span className="rounded-full bg-mist px-3 py-2">{route.recommendedStartTime} 出发</span></div></div>}
      <div className={mapOnly ? 'h-full min-w-0' : 'grid min-w-0 lg:grid-cols-[1.35fr_.65fr]'}><div className={`relative min-w-0 overflow-hidden bg-[#d8f1ee] ${mapOnly ? 'h-full min-h-[620px]' : 'min-h-[430px]'}`}><div ref={container} className={`absolute inset-0 ${!mapAvailable ? 'invisible' : ''}`}/>{mapAvailable && <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-river shadow-sm">高德交互地图</div>}{!mapAvailable && status !== 'loading' && <GaodeRasterRouteMap route={route} selectedPointId={selectedPointId} onSelectPoint={onSelectPoint} />}{status === 'loading' && <div className="absolute inset-0 grid place-items-center bg-[#d8f1ee]"><div className="rounded-2xl bg-white/90 px-5 py-4 text-sm font-black text-river shadow-soft">正在请求高德道路规划…</div></div>}{failed && <div role="alert" className="absolute left-4 right-4 top-20 z-30 rounded-2xl border border-red-200 bg-white/95 p-4 shadow-xl backdrop-blur"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500"/><div className="min-w-0 flex-1"><strong className="block text-sm text-red-700">道路规划失败，当前仅为点位连线</strong><p className="mt-1 text-xs font-bold leading-5 text-ink/55">{message}；仅为点位连线，不代表真实道路。</p></div><button type="button" onClick={() => { resetAmapJsApiLoader(); setRetryVersion((value) => value + 1); }} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-black text-white"><RefreshCw className="h-3.5 w-3.5"/>重新规划</button></div></div>}</div>
      {!mapOnly&&<aside className="bg-[#fbfaf5] p-5">{selected&&<><div className="text-xs font-black tracking-[.16em] text-tower">STOP {route.points.findIndex(p=>p.id===selected.id)+1}</div><h4 className="mt-2 font-display text-3xl font-black">{selected.name}</h4><div className="mt-2 flex gap-2 text-xs font-bold text-ink/50"><span>{getPointTypeLabel(selected.type)}</span><span>·</span><span>{selected.time}</span><span>·</span><span>{selected.stayMinutes} 分钟</span></div><p className="mt-5 leading-7 text-ink/68">{selected.reason}</p><div className="mt-4 rounded-xl border-l-4 border-tower bg-white p-4 text-sm leading-6"><b>拍照：</b>{selected.photoTip}</div><div className="mt-3 rounded-xl bg-river/5 p-4 text-sm leading-6"><b>手账：</b>{selected.recordTip}</div></>}</aside>}
    </div>
  </section>;
}

function normalizeFailure(caught: unknown): DrivingSearchFailure {
  if (caught && typeof caught === 'object' && 'status' in caught) return caught as DrivingSearchFailure;
  return { status: 'error', error: caught };
}

function failureMessage(status: RoadPlanStatus) {
  if (status === 'auth-error') return '高德 Key、安全密钥或域名白名单校验失败，请检查部署配置。';
  if (status === 'network-error') return '高德脚本或路线服务网络请求失败，请检查网络后重试。';
  if (status === 'no-data') return '高德没有返回可用道路方案，请调整点位后重试。';
  return '道路服务暂时不可用，已使用灰色虚线显示估算点位顺序。';
}

function createRouteMarker(AMap: any, map: any, point: RoutePoint, index: number, onSelectPoint: (point: RoutePoint) => void, active: boolean) {
  const color = pointColor(point.type);
  const marker = new AMap.Marker({
    position: [point.lng, point.lat],
    title: point.name,
    anchor: 'bottom-center',
    content: markerContent(point, index, active, color),
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

function markerContent(point: RoutePoint, index: number, active: boolean, color = pointColor(point.type)) {
  return `<button class="amap-smart-marker${active ? ' is-selected' : ''}" style="--marker:${color}" aria-label="${index + 1} ${escapeMarkerText(point.name)}"${active ? ' aria-current="location"' : ''}><span>${index + 1}</span></button>`;
}

function escapeMarkerText(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char); }

function addRoadPolyline(AMap: any, map: any, path: any[]) {
  const outline = new AMap.Polyline({
    path,
    strokeColor: '#ffffff',
    strokeWeight: 12,
    strokeOpacity: 0.92,
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 45,
  });
  const routeLine = new AMap.Polyline({
    path,
    strokeColor: '#0E6B72',
    strokeWeight: 7,
    strokeOpacity: 0.96,
    showDir: true,
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 46,
  });
  const overlays = [outline, routeLine];
  map.add(overlays);
  return overlays;
}

function addFallbackPolyline(AMap: any, map: any, points: RoutePoint[]) {
  const fallbackLine = new AMap.Polyline({
    path: points.map((point) => [point.lng, point.lat]),
    strokeColor: '#dc4b3e',
    strokeWeight: 5,
    strokeOpacity: 0.78,
    strokeStyle: 'dashed',
    strokeDasharray: [10, 10],
    lineJoin: 'round',
    lineCap: 'round',
    zIndex: 42,
  });
  map.add(fallbackLine);
  return [fallbackLine];
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
        <svg viewBox="0 0 1000 700" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <polyline points={projected.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="#ffffff" strokeWidth="10" strokeOpacity=".86" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={projected.map(({ x, y }) => `${x},${y}`).join(' ')} fill="none" stroke="#dc4b3e" strokeWidth="5" strokeOpacity=".82" strokeDasharray="12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {projected.map(({ point, x, y }, index) => {
          const active = point.id === selectedPointId;
          return (
            <button
              key={point.id}
              aria-label={`${index + 1} ${point.name}`}
              aria-current={active ? 'location' : undefined}
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
      <div className="absolute bottom-3 left-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-ink/60 shadow-sm">高德瓦片底图 · AutoNavi</div>
      <div className="absolute bottom-3 right-3 rounded-full bg-white/92 px-3 py-1.5 text-xs font-black text-red-600 shadow-sm">仅为点位连线，不代表真实道路</div>
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
            aria-label={`${index + 1} ${point.name}`}
            aria-current={active ? 'location' : undefined}
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
        <div className="text-xs font-black tracking-[.16em] text-jade">RULES-V1 ROUTE DEMO</div>
        <div className="mt-2 font-display text-xl font-black">{route.city}示例点位顺序图</div>
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
