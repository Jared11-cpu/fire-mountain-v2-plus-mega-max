import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, ArrowLeft, Bus, CalendarDays, Camera, CarFront, Check, ChevronDown, CircleDollarSign, Clock3, CloudRain, CloudSun, Droplets, ExternalLink, Footprints, ImagePlus, Loader2, MapPin, Navigation, NotebookPen, PencilLine, Plus, ReceiptText, RefreshCw, Route as RouteIcon, Sparkles, Sun, Sunrise, Sunset, TrainFront, Trash2, Umbrella, Utensils, WalletCards, Wifi, WifiOff, Wind } from 'lucide-react';
import type { TravelPlan } from '../utils/aiGenerator';
import type { JournalEntry, RoutePoint, SmartRoute } from '../types/route';
import { budgetTotal, calculateTimeline, parseLocalDate, type BudgetItem, type PlannedRoutePoint, type TripRequest } from '../domain/trip';
import { useTrip } from '../state/tripStore';
import { resolveTransportPlan, toTransportPlanRequest, type TransportLeg, type TransitStrategy, type TransportMode, type TransportPlanResponse } from '../services/transportService';
import { compressPhoto, deletePhoto, savePhoto } from '../services/journalStorage';
import { RouteMap } from './RouteMap';

type Tab = 'overview' | 'stops' | 'days' | 'weather' | 'transport' | 'food' | 'budget';
const tabs: Array<{ id: Tab; label: string; icon: typeof MapPin }> = [
  { id: 'overview', label: '概览', icon: Sparkles }, { id: 'stops', label: '路线', icon: MapPin },
  { id: 'days', label: '行程记录', icon: CalendarDays }, { id: 'weather', label: '天气', icon: CloudSun },
  { id: 'transport', label: '交通', icon: Bus }, { id: 'food', label: '美食', icon: Utensils },
  { id: 'budget', label: '预算', icon: CircleDollarSign },
];

export function MapWorkspace({ route, plan, selectedPointId, activePointIndex, navigating, imageUrl, onSelectPoint, onRegenerate, onSimulateNavigation }: {
  route: SmartRoute; plan: TravelPlan; selectedPointId?: string; activePointIndex: number; navigating: boolean; imageUrl: string;
  onSelectPoint: (point: RoutePoint) => void; onRegenerate?: () => void; onSimulateNavigation?: () => void;
}) {
  const { plan: tripPlan, request, journalEntries, isReplanning, patchPlan, updatePlanSettings, updateBudgetItems, setBudgetTotal, setJournalEntries, updateRequest, notify } = useTrip();
  const [tab, setTab] = useState<Tab>('overview');
  const [mobilePane, setMobilePane] = useState<'map' | 'details'>('map');
  const [transportPlan, setTransportPlan] = useState<TransportPlanResponse | null>(null);
  const [transportLoading, setTransportLoading] = useState(true);
  const [transportStrategy, setTransportStrategy] = useState<TransitStrategy>('recommended');
  const loadTransport = useCallback((signal?: AbortSignal, silent = false) => {
    if (!silent) setTransportLoading(true);
    return resolveTransportPlan(toTransportPlanRequest(request, tripPlan?.route.points as PlannedRoutePoint[] ?? [], tripPlan?.settings.departureTime ?? '08:30', transportStrategy), { signal })
      .then(setTransportPlan)
      .finally(() => { if (!signal?.aborted) setTransportLoading(false); });
  }, [request, tripPlan?.route.points, tripPlan?.settings.departureTime, transportStrategy]);
  useEffect(() => {
    const controller = new AbortController();
    loadTransport(controller.signal).catch(() => undefined);
    const refreshTimer = window.setInterval(() => loadTransport(controller.signal, true).catch(() => undefined), 90_000);
    return () => { controller.abort(); window.clearInterval(refreshTimer); };
  }, [loadTransport]);
  const activeTabIndex = tabs.findIndex((item) => item.id === tab);
  const handleMapSelect = (point: RoutePoint) => { onSelectPoint(point); setTab('stops'); setMobilePane('details'); };
  const patchRoutePoint = (id: string, changes: Partial<PlannedRoutePoint>) => patchPlan((value) => {
    const source: PlannedRoutePoint[] = (value.route.points as PlannedRoutePoint[]).map((point) => point.id === id ? { ...point, ...changes } as PlannedRoutePoint : point);
    const points = changes.durationMinutes === undefined
      ? source
      : calculateTimeline(source, value.settings.departureTime);
    return {
      ...value,
      route: { ...value.route, points },
      settings: {
        ...value.settings,
        targetDurationMinutes: points.reduce((sum, point) => sum + point.durationMinutes + point.travelMinutesToNext, 0),
      },
    };
  });
  const updateRouteDistance = (totalDistanceKm: number) => patchPlan((value) => ({
    ...value,
    route: { ...value.route, totalDistanceKm },
  }));
  const updateFinalArrival = (arrivalTime: string) => patchPlan((value) => {
    const points = value.route.points as PlannedRoutePoint[];
    const finalIndex = points.length - 1;
    return {
      ...value,
      route: {
        ...value.route,
        points: points.map((point, index) => index === finalIndex ? { ...point, time: arrivalTime, arrivalTime } : point),
      },
    };
  });
  if (!tripPlan) return null;

  return <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-soft">
    <div className="border-b border-ink/10 bg-ink p-2 lg:hidden" role="tablist" aria-label="移动端工作区">
      <div className="grid grid-cols-2 rounded-full bg-white/10 p-1">{(['map', 'details'] as const).map((pane) => <button key={pane} type="button" role="tab" aria-selected={mobilePane === pane} onClick={() => setMobilePane(pane)} className={`rounded-full px-4 py-2 text-sm font-black ${mobilePane === pane ? 'bg-white text-ink' : 'text-white'}`}>{pane === 'map' ? '地图' : '详情'}</button>)}</div>
    </div>
    <div className="grid lg:h-[760px] lg:grid-cols-[72px_minmax(0,1fr)_420px]">
      <nav className={`${mobilePane === 'details' ? 'flex' : 'hidden'} workspace-tab-shell overflow-x-auto p-2 text-white lg:flex lg:items-center lg:overflow-visible`} aria-label="方案详情标签" role="tablist">
        <div className="workspace-tab-track">
          <span aria-hidden="true" className="workspace-tab-indicator" style={{ '--tab-index': activeTabIndex } as CSSProperties} />
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} aria-label={label} onClick={() => { setTab(id); setMobilePane('details'); }} className={`workspace-tab-button ${tab === id ? 'is-active' : ''}`}><Icon className="h-5 w-5" /><span>{label}</span></button>)}
        </div>
      </nav>

      <div role="region" aria-label="路线地图" className={`${mobilePane === 'map' ? 'block' : 'hidden'} relative min-h-[620px] min-w-0 overflow-hidden border-ink/10 lg:block lg:border-r`}>
        <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
          <CommandButton icon={isReplanning ? Loader2 : RefreshCw} label={isReplanning ? '计算中' : '重新规划'} disabled={isReplanning} onClick={onRegenerate} spin={isReplanning} />
        </div>
        <RouteMap route={route} transportPlan={transportPlan} selectedPointId={selectedPointId} activePointIndex={activePointIndex} navigating={navigating} onSelectPoint={handleMapSelect} mapOnly />
      </div>

      <aside aria-label="方案详情" className={`${mobilePane === 'details' ? 'flex' : 'hidden'} workspace-detail-glass min-h-0 min-w-0 flex-col overflow-hidden lg:flex`}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [scrollbar-gutter:stable]">
          {tab === 'overview' && <Overview plan={tripPlan} route={route} summary={plan.summary} onSettings={updatePlanSettings} onBudget={setBudgetTotal} onDistance={updateRouteDistance} onArrival={updateFinalArrival} onDate={(startDate) => updateRequest({ startDate })} />}
          {tab === 'stops' && <Stops points={route.points as PlannedRoutePoint[]} selectedId={selectedPointId} fallbackImageUrl={imageUrl} dailyRecords={tripPlan.dailyRecords} maxDays={request.days} onSelect={onSelectPoint} onPatchPoint={patchRoutePoint} onPatchNote={(id, note) => patchPlan((value) => ({ ...value, pointNotes: { ...value.pointNotes, [id]: note } }))} notes={tripPlan.pointNotes} />}
          {tab === 'days' && <Days plan={tripPlan} entries={journalEntries} onPatch={patchPlan} onEntries={setJournalEntries} onNotify={notify} />}
          {tab === 'weather' && <Weather request={request} lat={route.points[0]?.lat} lng={route.points[0]?.lng} />}
          {tab === 'transport' && <Transport transport={transportPlan} loading={transportLoading} strategy={transportStrategy} onStrategy={setTransportStrategy} onReload={() => loadTransport().catch(() => undefined)} onSimulate={onSimulateNavigation} />}
          {tab === 'food' && <Food plan={tripPlan} />}
          {tab === 'budget' && <Budget items={tripPlan.budgetItems} target={request.budget} days={request.days} onChange={updateBudgetItems} />}
        </div>
      </aside>
    </div>
  </section>;
}

function Overview({ plan, route, summary, onSettings, onBudget, onDistance, onArrival, onDate }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; route: SmartRoute; summary: string; onSettings: ReturnType<typeof useTrip>['updatePlanSettings']; onBudget: (total: number) => void; onDistance: (distance: number) => void; onArrival: (time: string) => void; onDate: (date: string) => void }) {
  const finalPoint = plan.route.points[plan.route.points.length - 1] as PlannedRoutePoint | undefined;
  return <div className="space-y-4">
    <section className="workspace-dark-glass rounded-[1.65rem] p-5 text-white"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-jade">已保存方案 · 自动同步</div><h3 className="mt-2 font-display text-2xl font-black leading-tight">{route.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{summary}</p></section>
    <div className="flex items-end justify-between gap-3"><div><h4 className="font-display text-2xl font-black">路线总览</h4><p className="mt-1 text-xs font-bold text-ink/45">点击卡片中的数字或日期即可直接修改</p></div><span className="rounded-full bg-jade/10 px-3 py-1 text-[10px] font-black text-jade">自动保存</span></div>
    <div className="grid grid-cols-2 gap-3">
      <EditableMetric label="点位" value={plan.settings.targetPointCount} min={2} max={plan.route.points.length} suffix="个" onCommit={(value) => onSettings({ targetPointCount: value })} />
      <EditableMetric label="预计时长" value={Math.round(plan.settings.targetDurationMinutes / 6) / 10} min={1} max={24} step={0.5} suffix="小时" onCommit={(value) => onSettings({ targetDurationMinutes: Math.round(value * 60) })} />
      <EditableMetric label="路线距离" value={plan.route.totalDistanceKm} min={0} max={99999} step={0.1} suffix="km" onCommit={onDistance} />
      <EditableMetric label="预算总计" value={budgetTotal(plan.budgetItems)} min={0} max={999999} prefix="¥" onCommit={onBudget} />
      <TimeMetric label="出发时间" value={plan.settings.departureTime} tone="tower" onChange={(value) => onSettings({ departureTime: value })} />
      <TimeMetric label="到达时间" value={finalPoint?.arrivalTime ?? finalPoint?.time ?? ''} tone="river" onChange={onArrival} />
      <label className="col-span-2 rounded-2xl bg-white p-4 shadow-sm transition focus-within:ring-4 focus-within:ring-jade/15"><span className="block text-xs font-black text-ink/50">出发日期</span><span className="mt-2 flex items-center gap-2 rounded-xl bg-ink/[0.035] px-2.5 py-2"><CalendarDays className="h-4 w-4 shrink-0 text-river" /><input aria-label="总览出发日期" type="date" value={plan.requestSnapshot.startDate} onChange={(event) => onDate(event.target.value)} className="focus-ring min-w-0 w-full bg-transparent text-sm font-black text-ink" /></span></label>
    </div>
  </div>;
}

function Stops({ points, selectedId, fallbackImageUrl, dailyRecords, maxDays, onSelect, onPatchPoint, notes, onPatchNote }: { points: PlannedRoutePoint[]; selectedId?: string; fallbackImageUrl: string; dailyRecords: Array<{ day: number; date: string }>; maxDays: number; onSelect: (point: RoutePoint) => void; onPatchPoint: (id: string, changes: Partial<PlannedRoutePoint>) => void; notes: Record<string, string>; onPatchNote: (id: string, note: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(selectedId ?? points[0]?.id ?? null);
  useEffect(() => { if (selectedId) setExpandedId(selectedId); }, [selectedId]);
  return <div className="space-y-4"><h4 className="font-display text-2xl font-black">地点安排</h4>{points.map((point, index) => { const expanded = expandedId === point.id; const date = dailyRecords.find((record) => record.day === (point.day ?? 1))?.date; const serviceLinks = getPointServiceLinks(point); return <article key={point.id} className={`overflow-hidden rounded-[1.65rem] border bg-white transition ${selectedId === point.id ? 'border-river shadow-[0_12px_35px_rgba(14,116,128,.14)]' : 'border-ink/10 shadow-sm'}`}>
      <button type="button" aria-expanded={expanded} onClick={() => { setExpandedId(expanded ? null : point.id); onSelect(point); }} className="group relative block h-36 w-full overflow-hidden text-left">
        <img src={point.imageUrl ?? fallbackImageUrl} alt={`${point.name}地点照片`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/20 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-ink backdrop-blur">{String(index + 1).padStart(2, '0')} · {point.type === 'start' ? '出发点' : '路线点'}</span>
        <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white"><span><strong className="block font-display text-xl font-black">{point.name}</strong><span className="mt-1 flex items-center gap-2 text-[11px] font-bold text-white/70"><CalendarDays className="h-3.5 w-3.5" />{formatCompactDate(date)}<Clock3 className="ml-1 h-3.5 w-3.5" />{point.arrivalTime}</span></span><ChevronDown className={`h-5 w-5 shrink-0 transition ${expanded ? 'rotate-180' : ''}`} /></span>
      </button>
      {!expanded && <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-ink/55"><span className="line-clamp-1">{point.reason}</span><span className="shrink-0 text-river">展开安排</span></div>}
      {expanded && <div className="space-y-4 p-4">
        <p className="text-sm font-bold leading-6 text-ink/65">{point.reason}</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold"><InfoTile icon={Clock3} label="停留时间" value={`${point.durationMinutes} 分钟`} /><InfoTile icon={Navigation} label="下一段交通" value={point.travelMinutesToNext ? `${point.travelMinutesToNext} 分钟` : '行程终点'} /></div>
        <div className="grid gap-2 rounded-2xl bg-[#f1f6f2] p-3 text-xs leading-5 text-ink/65"><p className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-river" /><span><strong className="text-ink">拍摄：</strong>{compactTravelTip(point.photoTip, `拍下${point.name}的代表性画面。`)}</span></p><p className="flex gap-2"><NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-tower" /><span><strong className="text-ink">记录：</strong>{compactTravelTip(point.recordTip, '记下最喜欢的细节。')}</span></p></div>
        <section className="rounded-2xl border border-ink/10 p-3"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">我的地点安排</strong><span className="rounded-full bg-jade/10 px-2 py-1 text-[10px] font-black text-jade">自动保存</span></div><div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-black text-ink/50">安排日期<select value={point.day ?? 1} onChange={(event) => onPatchPoint(point.id, { day: Number(event.target.value) })} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 bg-white px-2 py-2 text-sm font-bold text-ink">{Array.from({ length: maxDays }, (_, day) => <option key={day + 1} value={day + 1}>第{day + 1}天</option>)}</select></label><label className="text-[11px] font-black text-ink/50">停留分钟<input type="number" min={10} max={480} step={5} value={point.durationMinutes} onChange={(event) => onPatchPoint(point.id, { durationMinutes: Math.max(10, Number(event.target.value) || 10) })} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 px-2 py-2 text-sm font-bold text-ink" /></label></div><label className="mt-3 block text-[11px] font-black text-ink/50">我的安排<textarea value={notes[point.id] ?? ''} placeholder="例如：提前预约、重点拍摄坝体全景、为老人预留休息时间" onChange={(event) => onPatchNote(point.id, event.target.value)} rows={3} className="focus-ring mt-1 w-full resize-none rounded-xl border border-ink/10 px-3 py-2 text-sm font-medium text-ink" /></label></section>
        <div className="flex items-center justify-between gap-3">{point.imageCredit ? <a href={point.imageCredit.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-ink/40 underline decoration-ink/20 underline-offset-2">{point.imageCredit.author} · {point.imageCredit.license}</a> : <span className="text-[10px] font-bold text-ink/40">城市授权代表图</span>}<a href={serviceLinks.detailUrl} target="_blank" rel="noreferrer" aria-label={`${point.name}地点详细信息`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-black text-white transition hover:bg-river">地点详细信息<ExternalLink className="h-3.5 w-3.5" /></a></div>
      </div>}
    </article>; })}</div>;
}

type PointServiceLinkSet = {
  kind: 'railway' | 'attraction';
  amapUrl: string;
  detailUrl: string;
  bookingUrl: string;
};

const CTRIP_DETAIL_URLS: Readonly<Record<string, string>> = {
  // 携程旧版 searchsite/sight 深链会返回 432 或空白页；路线点位逐一绑定已核验页面。
  三峡游客中心: 'https://you.ctrip.com/traffic/yichang313/g51289164.html',
  坛子岭观景台: 'https://you.ctrip.com/sight/yichang313/46345.html',
  '185 平台': 'https://you.ctrip.com/sight/yichang313/1508935.html',
  西坝不夜城: 'https://you.ctrip.com/sight/yichang313/151629835.html',
  滨江公园夜景: 'https://you.ctrip.com/sight/yichang313/51550.html',
  昙华林: 'https://you.ctrip.com/sight/wuhan145/119307.html',
  黄鹤楼红墙: 'https://you.ctrip.com/sight/wuhan145/8979.html',
  武汉大学: 'https://you.ctrip.com/sight/145/1493507.html',
  武汉长江大桥: 'https://you.ctrip.com/sight/wuhan145/8978.html',
  粮道街: 'https://you.ctrip.com/sight/wuhan145/71454382.html',
  江汉关: 'https://you.ctrip.com/sight/wuhan145/1489369.html',
  汉口江滩日落: 'https://you.ctrip.com/sight/wuhan145/119534.html',
  女儿城: 'https://you.ctrip.com/sight/enshicity1446196/1414339.html',
  恩施大峡谷游客中心: 'https://you.ctrip.com/sight/enshigrandcanyon2128618.html',
  七星寨栈道: 'https://you.ctrip.com/sight/enshicity1446196/1714425.html',
  云龙地缝瀑布: 'https://you.ctrip.com/sight/enshicity1446196/4379383.html',
  峡谷民宿观景台: 'https://you.ctrip.com/sight/enshigrandcanyon2128618.html',
  荆州博物馆: 'https://you.ctrip.com/sight/jingzhou413/134921.html',
  宾阳楼: 'https://you.ctrip.com/sight/jingzhou413/5073085.html',
  早堂面老店: 'https://you.ctrip.com/food/jingzhou413.html',
  古城墙步道: 'https://you.ctrip.com/sight/jingzhou413/52023.html',
  沙市洋码头: 'https://you.ctrip.com/place/jingzhou413.html',
  襄阳古城北街: 'https://you.ctrip.com/sight/xiangyang414/5716122.html',
  古隆中: 'https://you.ctrip.com/sight/xiangyang414/48889.html',
  襄阳牛肉面: 'https://you.ctrip.com/food/xiangyang414.html',
  唐城影视基地: 'https://you.ctrip.com/sight/xiangyang414/1699843.html',
  汉江桥畔: 'https://you.ctrip.com/sight/xiangyang414/1834681.html',
  黄石国家矿山公园: 'https://you.ctrip.com/sight/huangshi710/141134.html',
  矿冶主题展区: 'https://you.ctrip.com/sight/huangshi710/141134.html',
  磁湖岸线: 'https://you.ctrip.com/sight/huangshi710/52097.html',
  黄石港饼老店: 'https://you.ctrip.com/food/huangshi710.html',
  团城山公园: 'https://you.ctrip.com/sight/huangshi710/52097.html',
};

export function getPointServiceLinks(point: Pick<RoutePoint, 'name' | 'city' | 'type'> & Partial<Pick<RoutePoint, 'lat' | 'lng'>>): PointServiceLinkSet {
  const keyword = encodeURIComponent(`${point.city} ${point.name}`);
  const isRailwayStation = point.type === 'start' && /(?:站|高铁站|火车站)$/.test(point.name.trim());
  const ctripTicketSearchUrl = `https://m.ctrip.com/webapp/ticket/index.html#/dest/k-keyword-0/s-tickets?keyword=${keyword}`;
  const exactAmapUrl = Number.isFinite(point.lng) && Number.isFinite(point.lat)
    ? `https://uri.amap.com/marker?position=${point.lng},${point.lat}&name=${encodeURIComponent(point.name)}`
    : `https://uri.amap.com/search?keyword=${keyword}&city=${encodeURIComponent(point.city)}`;
  return {
    kind: isRailwayStation ? 'railway' : 'attraction',
    amapUrl: exactAmapUrl,
    detailUrl: isRailwayStation
      ? 'https://kyfw.12306.cn/mormhweb/czyd_2143/'
      : CTRIP_DETAIL_URLS[point.name] ?? exactAmapUrl,
    bookingUrl: isRailwayStation
      ? 'https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc'
      : ctripTicketSearchUrl,
  };
}

export function compactTravelTip(value: string, fallback: string, maxLength = 30) {
  const normalized = value.trim()
    .replace(/^围绕“[^”]+”主题记录[^，。]*[，,]?/, '')
    .replace(/^记录这一站是否符合“[^”]+”的原始期待[。.]?$/, fallback)
    .replace(/现场遵守拍摄与开放规定[。.]?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const text = normalized || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).replace(/[，。；、,.!?！？]$/, '')}…` : text;
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="rounded-2xl bg-ink/[0.045] p-3"><Icon className="mb-2 h-4 w-4 text-river" /><span className="block text-[10px] text-ink/45">{label}</span><strong className="mt-0.5 block text-ink">{value}</strong></div>; }
function formatCompactDate(value?: string) { if (!value) return '日期待定'; return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(parseLocalDate(value)); }

function Days({ plan, entries, onPatch, onEntries, onNotify }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; entries: JournalEntry[]; onPatch: ReturnType<typeof useTrip>['patchPlan']; onEntries: (entries: JournalEntry[]) => void; onNotify: ReturnType<typeof useTrip>['notify'] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const editingPoint = (plan.route.points as PlannedRoutePoint[]).find((point) => point.id === editingId);
  const editingRecord = editingPoint ? plan.dailyRecords.find((record) => record.day === (editingPoint.day ?? 1)) : undefined;
  const existingEntry = editingPoint ? entries.find((entry) => entry.pointId === editingPoint.id && entry.day === (editingPoint.day ?? 1)) : undefined;

  const togglePoint = (day: number, pointId: string, checked: boolean) => {
    onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === day ? { ...item, checkedPointIds: checked ? item.checkedPointIds.filter((id) => id !== pointId) : [...item.checkedPointIds, pointId] } : item) }));
    if (!checked) { setCelebratingId(pointId); window.setTimeout(() => setCelebratingId((current) => current === pointId ? null : current), 900); }
  };

  if (editingPoint && editingRecord) return <DailyTaskEditor key={editingPoint.id} point={editingPoint} record={editingRecord} entry={existingEntry} entries={entries} onBack={() => setEditingId(null)} onPatch={onPatch} onEntries={onEntries} onNotify={onNotify} />;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><h4 className="font-display text-3xl font-black">每日记录</h4><span className="rounded-full bg-jade/10 px-3 py-1 text-[11px] font-black text-jade">自动保存</span></div>
    {plan.dailyRecords.map((record) => {
      const points = plan.route.points.filter((point) => (point.day ?? 1) === record.day) as PlannedRoutePoint[];
      const dateTitle = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(parseLocalDate(record.date));
      const completed = points.filter((point) => record.checkedPointIds.includes(point.id)).length;
      return <section key={record.day} className="itinerary-paper relative overflow-hidden rounded-[1.75rem] border border-ink/10 px-5 pb-5 pt-6 shadow-[0_14px_38px_rgba(18,34,42,.08)]">
        <div className="relative z-10 mb-4 flex items-start justify-between border-b-2 border-ink/10 pb-4"><div><span className="text-xs font-black uppercase tracking-[0.22em] text-tower">DAY {String(record.day).padStart(2, '0')}</span><h5 className="mt-1 font-display text-3xl font-black leading-none text-ink">{dateTitle}</h5><p className="mt-2 text-sm font-bold text-ink/40">{record.date}</p></div><div className="grid h-14 w-14 place-items-center rounded-full border border-river/15 bg-white/80 text-center shadow-sm"><strong className="text-base text-river">{completed}/{points.length}</strong><span className="-mt-1 text-[9px] font-black text-ink/40">完成</span></div></div>
        <div className="relative z-10 space-y-1">{points.map((point) => { const checked = record.checkedPointIds.includes(point.id); return <div key={point.id} className="relative min-h-[58px] py-1">{celebratingId === point.id && <Confetti />}<div className="group flex min-h-[52px] items-center gap-2"><button type="button" aria-pressed={checked} aria-label={`${checked ? '取消完成' : '完成'}${point.name}`} onClick={() => togglePoint(record.day, point.id, checked)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-2 text-left transition ${checked ? 'text-ink/30' : 'hover:bg-white/60'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${checked ? 'scale-110 border-jade bg-jade text-white' : 'border-river/30 bg-white text-transparent'}`}><Check className="h-4 w-4" /></span><span className={`w-14 shrink-0 font-display text-lg font-black ${checked ? 'text-ink/25' : 'text-river'}`}>{point.arrivalTime}</span><span className={`relative min-w-0 flex-1 text-base font-black transition after:absolute after:left-0 after:top-1/2 after:h-[2px] after:bg-tower after:transition-all ${checked ? 'text-ink/30 after:w-full' : 'after:w-0'}`}>{point.name}</span></button><button type="button" aria-label={`打开${point.name}详细编辑`} onClick={() => setEditingId(point.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/40 transition hover:bg-river/10 hover:text-river"><PencilLine className="h-5 w-5" /></button></div></div>; })}</div>
        <label className="relative z-10 mt-4 block text-sm font-black text-ink/50">今日手记<textarea aria-label={`第${record.day}天手记`} value={record.note} placeholder="写下今天的天气、心情或临时调整……" onChange={(event) => onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === record.day ? { ...item, note: event.target.value } : item) }))} rows={3} className="focus-ring mt-2 w-full resize-none rounded-2xl border border-ink/10 bg-white/65 px-4 py-3 text-base font-medium leading-7 text-ink placeholder:text-ink/25" /></label>
      </section>;
    })}
  </div>;
}

function DailyTaskEditor({ point, record, entry, entries, onBack, onPatch, onEntries, onNotify }: { point: PlannedRoutePoint; record: { day: number; date: string }; entry?: JournalEntry; entries: JournalEntry[]; onBack: () => void; onPatch: ReturnType<typeof useTrip>['patchPlan']; onEntries: (entries: JournalEntry[]) => void; onNotify: ReturnType<typeof useTrip>['notify'] }) {
  const [draft, setDraft] = useState({ name: point.name, arrivalTime: point.arrivalTime, durationMinutes: point.durationMinutes, note: entry?.note ?? '' });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const chooseFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list);
    if ((entry?.photoIds.length ?? 0) + files.length + next.length > 6) { setError('每条记录最多保存 6 张照片。'); return; }
    const oversized = next.find((file) => file.size > 10 * 1024 * 1024);
    if (oversized) { setError(`${oversized.name} 超过 10MB 原图上限。`); return; }
    setFiles((current) => [...current, ...next]);
    setError('');
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.arrivalTime) { setError('请填写任务名称和时间。'); return; }
    setSaving(true); setError('');
    const photoIds: string[] = [];
    try {
      for (const file of files) photoIds.push(await savePhoto(await compressPhoto(file)));
      onPatch((value) => {
        const points = value.route.points as PlannedRoutePoint[];
        const index = points.findIndex((item) => item.id === point.id);
        const delta = clockMinutes(draft.arrivalTime) - clockMinutes(points[index]?.arrivalTime ?? point.arrivalTime);
        const updatedPoints = points.map((item, pointIndex) => {
          if (item.id === point.id) return { ...item, name: draft.name.trim(), durationMinutes: Math.max(10, draft.durationMinutes), stayMinutes: Math.max(10, draft.durationMinutes), arrivalTime: draft.arrivalTime, time: draft.arrivalTime };
          if (pointIndex > index && item.day === point.day) return { ...item, arrivalTime: shiftClock(item.arrivalTime, delta), time: shiftClock(item.time, delta) };
          return item;
        });
        return {
          ...value,
          route: { ...value.route, points: updatedPoints },
          settings: { ...value.settings, targetDurationMinutes: updatedPoints.reduce((sum, item) => sum + item.durationMinutes + item.travelMinutesToNext, 0) },
        };
      });
      const nextEntry: JournalEntry = {
        id: entry?.id ?? crypto.randomUUID(), pointId: point.id, pointName: draft.name.trim(), city: point.city, day: record.day,
        note: draft.note.trim(), visitedAt: record.date, lat: point.lat, lng: point.lng, photoIds: [...(entry?.photoIds ?? []), ...photoIds],
      };
      onEntries(entry ? entries.map((item) => item.id === entry.id ? nextEntry : item) : [nextEntry, ...entries]);
      onNotify('日常记录已保存，并同步到旅行手账。', 'success');
      onBack();
    } catch (caught) {
      await Promise.all(photoIds.map(deletePhoto));
      const message = caught instanceof Error ? caught.message : '保存失败，请检查浏览器存储权限。';
      setError(message); onNotify(message, 'error');
    } finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-black text-river"><ArrowLeft className="h-4 w-4" />返回每日记录</button>
    <section className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-white shadow-[0_18px_48px_rgba(18,34,42,.11)]">
      <div className="relative h-36 overflow-hidden"><img src={point.imageUrl} alt={`${point.name}实景`} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" /><div className="absolute bottom-4 left-4 text-white"><span className="text-xs font-black tracking-[.18em] text-jade">DAY {String(record.day).padStart(2, '0')} · 详细编辑</span><h4 className="mt-1 font-display text-3xl font-black">{draft.name || point.name}</h4></div></div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3"><label className="col-span-2 text-sm font-black text-ink/55">任务名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="focus-ring mt-1 w-full rounded-2xl border border-ink/10 px-4 py-3 text-lg font-black" /></label><label className="text-sm font-black text-ink/55">到达时间<input type="time" value={draft.arrivalTime} onChange={(event) => setDraft({ ...draft, arrivalTime: event.target.value })} className="focus-ring mt-1 w-full rounded-2xl border border-ink/10 px-3 py-3 text-lg font-black text-river" /></label><label className="text-sm font-black text-ink/55">停留分钟<input type="number" min={10} max={480} step={5} value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) || 10 })} className="focus-ring mt-1 w-full rounded-2xl border border-ink/10 px-3 py-3 text-lg font-black" /></label></div>
        <label className="block text-sm font-black text-ink/55">当时的详细记录<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} rows={5} placeholder="写下天气、心情、见闻或临时调整……" className="journal-handwriting focus-ring mt-1 w-full resize-none rounded-2xl border border-ink/10 px-4 py-3 text-lg leading-7" /></label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-river/35 bg-river/[.04] px-4 py-4 font-black text-river"><ImagePlus className="h-5 w-5" />插入照片<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { chooseFiles(event.target.files); event.currentTarget.value = ''; }} /></label>
        {(entry?.photoIds.length ?? 0) > 0 && <p className="text-xs font-bold text-jade">旅行手账中已有 {entry?.photoIds.length} 张照片，本次保存将继续追加。</p>}
        {previews.length > 0 && <div className="grid grid-cols-3 gap-2">{previews.map((url, index) => <div key={url} className="relative"><img src={url} alt={`待保存照片${index + 1}`} className="aspect-square w-full rounded-xl object-cover" /><button type="button" aria-label={`删除待保存照片${index + 1}`} onClick={() => setFiles((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/80 text-xs font-black text-white">×</button></div>)}</div>}
        <p className="rounded-2xl bg-ink/[.04] p-3 text-xs font-bold leading-5 text-ink/50">文字记录保存在应用状态，照片压缩后写入本机 IndexedDB；保存后会出现在“旅行手账”的真实足迹中。</p>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
        <button type="button" disabled={saving} onClick={save} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-4 text-base font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{saving ? '正在保存照片…' : '保存并同步到旅行手账'}</button>
      </div>
    </section>
  </div>;
}

function Confetti() { const colors = ['bg-tower', 'bg-jade', 'bg-river', 'bg-amber-400', 'bg-violet-500', 'bg-rose-400']; return <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-20">{colors.map((color, index) => <i key={color} className={`confetti-piece ${color}`} style={{ '--confetti-angle': `${index * 60}deg`, '--confetti-x': `${(index - 2.5) * 18}px` } as CSSProperties} />)}</span>; }
function clockMinutes(value: string) { const [hours, minutes] = value.split(':').map(Number); return (hours || 0) * 60 + (minutes || 0); }
function shiftClock(value: string, delta: number) { const total = ((clockMinutes(value) + delta) % 1440 + 1440) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }

type WeatherHour = { time: string; temperature: number; rainProbability: number; code: number };
type WeatherDay = { date: string; code: number; max: number; min: number; rainProbability: number; sunrise: string; sunset: string; uv: number };
type WeatherData = { temperature: number; apparentTemperature: number; humidity: number; precipitation: number; code: number; windSpeed: number; windGusts: number; hourly: WeatherHour[]; daily: WeatherDay[]; fetchedAt: string };
function Weather({ request, lat, lng }: { request: TripRequest; lat?: number; lng?: number }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [dataState, setDataState] = useState<'请求中' | '实时' | '30分钟缓存' | '请求超时' | '网络失败'>('请求中');
  const [reason, setReason] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const key = `weather-v2-${request.destinationCity}`;
    if (reloadVersion === 0) {
      const cached = localStorage.getItem(key);
      if (cached) { try { const value = JSON.parse(cached) as WeatherData; if (value.daily?.length && Date.now() - new Date(value.fetchedAt).getTime() < 1_800_000) { setWeather(value); setDataState('30分钟缓存'); return () => controller.abort(); } } catch { /* ignore invalid cache */ } }
    }
    if (!lat || !lng) { setDataState('网络失败'); setReason('路线缺少经纬度，无法请求天气；请先重新生成路线。'); return () => controller.abort(); }
    setDataState('请求中'); setReason('正在连接 Open‑Meteo…');
    const timeout = window.setTimeout(() => controller.abort('timeout'), 8_000);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&timezone=Asia%2FShanghai&forecast_days=7`;
    fetch(url, { signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => {
      const currentIndex = Math.max(0, data.hourly.time.findIndex((time: string) => time >= data.current.time));
      const value: WeatherData = { temperature: data.current.temperature_2m, apparentTemperature: data.current.apparent_temperature, humidity: data.current.relative_humidity_2m, precipitation: data.current.precipitation, code: data.current.weather_code, windSpeed: data.current.wind_speed_10m, windGusts: data.current.wind_gusts_10m, hourly: data.hourly.time.slice(currentIndex, currentIndex + 8).map((time: string, index: number) => ({ time, temperature: data.hourly.temperature_2m[currentIndex + index], rainProbability: data.hourly.precipitation_probability[currentIndex + index] ?? 0, code: data.hourly.weather_code[currentIndex + index] })), daily: data.daily.time.map((date: string, index: number) => ({ date, code: data.daily.weather_code[index], max: data.daily.temperature_2m_max[index], min: data.daily.temperature_2m_min[index], rainProbability: data.daily.precipitation_probability_max[index] ?? 0, sunrise: data.daily.sunrise[index], sunset: data.daily.sunset[index], uv: data.daily.uv_index_max[index] ?? 0 })), fetchedAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(value)); if (alive) { setWeather(value); setDataState('实时'); setReason(''); }
    }).catch((error) => { if (!alive) return; const timedOut = controller.signal.reason === 'timeout'; setDataState(timedOut ? '请求超时' : '网络失败'); setReason(timedOut ? 'Open‑Meteo 请求超过 8 秒，已停止等待。' : `Open‑Meteo 网络请求失败：${error instanceof Error ? error.message : '未知错误'}。`); }).finally(() => window.clearTimeout(timeout));
    return () => { alive = false; window.clearTimeout(timeout); controller.abort(); };
  }, [request.destinationCity, lat, lng, reloadVersion]);
  const today = weather?.daily[0]; const advice = weather ? buildWeatherAdvice(weather, request) : [];
  const refresh = () => { setWeather(null); setReloadVersion((value) => value + 1); };
  return <div className="space-y-4"><div className="flex items-end justify-between gap-3"><div><h4 className="font-display text-2xl font-black">出行天气</h4><p className="mt-1 text-xs font-bold leading-5 text-ink/45">把天气数据翻译成今天真正需要的出行准备。</p></div><button type="button" onClick={refresh} disabled={dataState === '请求中'} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-black text-river shadow-sm disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${dataState === '请求中' ? 'animate-spin' : ''}`}/>重新获取天气</button></div>{weather ? <>
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-river via-[#127f8c] to-[#0a5964] p-5 text-white shadow-[0_18px_45px_rgba(14,107,114,.2)]"><Sun className="absolute -right-8 -top-8 h-36 w-36 text-white/10" /><div className="relative flex items-start justify-between"><div><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black backdrop-blur">{request.destinationCity} · {dataState}</span><div className="mt-4 flex items-end gap-3"><strong className="font-display text-6xl font-black leading-none">{Math.round(weather.temperature)}°</strong><div className="pb-1"><p className="text-sm font-black">{weatherLabel(weather.code)}</p><p className="mt-1 text-xs font-bold text-white/65">体感 {Math.round(weather.apparentTemperature)}°</p></div></div></div><div className="rounded-2xl bg-white/10 px-3 py-2 text-right text-xs font-bold backdrop-blur"><p>最高 {Math.round(today?.max ?? weather.temperature)}°</p><p className="mt-1 text-white/60">最低 {Math.round(today?.min ?? weather.temperature)}°</p></div></div><div className="relative mt-5 grid grid-cols-3 gap-2"><WeatherHeroMetric icon={Droplets} label="湿度" value={`${weather.humidity}%`} /><WeatherHeroMetric icon={Umbrella} label="降雨概率" value={`${today?.rainProbability ?? 0}%`} /><WeatherHeroMetric icon={Wind} label="阵风" value={`${Math.round(weather.windGusts)} km/h`} /></div></section>
    <WeatherAdviceCard advice={advice} />
    <HourlyWeatherChart hours={weather.hourly} />
    <TripForecastCard days={weather.daily.slice(0, Math.min(3, Math.max(1, request.days)))} today={today} />
  </> : <div className="rounded-[1.5rem] border border-dashed border-tower/35 bg-tower/5 p-5"><CloudRain className="h-7 w-7 text-tower" /><h5 className="mt-3 font-black">{dataState === '请求中' ? '正在取得天气数据' : '暂时无法取得天气数据'}</h5><p className="mt-2 text-xs font-bold leading-5 text-ink/55">{reason}</p>{dataState !== '请求中' && <button type="button" onClick={refresh} className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-black text-white"><RefreshCw className="h-3.5 w-3.5"/>重新获取天气</button>}</div>}<section className="rounded-2xl border border-ink/8 bg-white/70 p-3 text-[10px] font-bold leading-5 text-ink/45"><p>数据源：<a className="font-black text-river underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open‑Meteo Weather Forecast API</a></p><p>状态：{dataState} · 成功/缓存/超时/网络失败分别记录</p><p>最后成功更新时间：{weather ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(weather.fetchedAt)) : '尚无成功记录'}</p><p>时区：Asia/Shanghai（UTC+8） · 预报可能变化，关键行程请临行复核。</p></section></div>;
}

export function getHourlyChartScale(hours: WeatherHour[]) {
  const temperatures = hours.map((hour) => hour.temperature);
  const observedMin = temperatures.length ? Math.min(...temperatures) : 0;
  const observedMax = temperatures.length ? Math.max(...temperatures) : 1;
  const temperatureMin = Math.floor(observedMin - 1);
  const temperatureMax = Math.ceil(observedMax + 1);
  return { temperatureMin, temperatureMax: Math.max(temperatureMin + 1, temperatureMax) };
}

function HourlyWeatherChart({ hours }: { hours: WeatherHour[] }) {
  if (!hours.length) return null;
  const width = 420; const height = 218; const left = 30; const right = 34; const top = 30; const bottom = 62;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const { temperatureMin, temperatureMax } = getHourlyChartScale(hours);
  const x = (index: number) => left + (index / Math.max(1, hours.length - 1)) * plotWidth;
  const temperatureY = (value: number) => top + ((temperatureMax - value) / (temperatureMax - temperatureMin)) * plotHeight;
  const rainY = (value: number) => top + ((100 - Math.max(0, Math.min(100, value))) / 100) * plotHeight;
  const temperaturePoints = hours.map((hour, index) => `${x(index)},${temperatureY(hour.temperature)}`).join(' ');
  const rainPoints = hours.map((hour, index) => `${x(index)},${rainY(hour.rainProbability)}`).join(' ');
  const middleTemperature = Math.round((temperatureMin + temperatureMax) / 2);
  return <section aria-labelledby="hourly-weather-title" className="rounded-[1.5rem] border border-ink/8 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h5 id="hourly-weather-title" className="font-display text-lg font-black">接下来 8 小时</h5><p className="mt-1 text-[10px] font-bold text-ink/40">温度趋势与逐小时降雨概率</p></div><div className="flex shrink-0 flex-col items-end gap-1 text-[9px] font-black"><span className="inline-flex items-center gap-1.5 text-tower"><i className="h-0.5 w-5 rounded-full bg-tower" />温度 °C</span><span className="inline-flex items-center gap-1.5 text-river"><i className="w-5 border-t-2 border-dashed border-river" />降雨 %</span></div></div>
    <svg role="img" aria-label={`未来八小时温度从${Math.round(hours[0].temperature)}度变化到${Math.round(hours[hours.length - 1].temperature)}度，最高降雨概率${Math.max(...hours.map((hour) => hour.rainProbability))}%`} viewBox={`0 0 ${width} ${height}`} className="mt-3 h-auto w-full overflow-visible">
      <title>未来 8 小时温度与降雨概率折线图</title>
      {[0, 0.5, 1].map((ratio) => { const y = top + ratio * plotHeight; const temperature = ratio === 0 ? temperatureMax : ratio === 1 ? temperatureMin : middleTemperature; const rain = Math.round((1 - ratio) * 100); return <g key={ratio}><line x1={left} y1={y} x2={width - right} y2={y} stroke="#dfe7e4" strokeWidth="1" strokeDasharray={ratio === 1 ? undefined : '3 4'} vectorEffect="non-scaling-stroke" /><text x={left - 7} y={y + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="#738187">{temperature}°</text><text x={width - right + 7} y={y + 3} fontSize="9" fontWeight="700" fill="#738187">{rain}%</text></g>; })}
      <polyline points={temperaturePoints} fill="none" stroke="#b64a32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polyline points={rainPoints} fill="none" stroke="#0e6b72" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {hours.map((hour, index) => { const pointX = x(index); const tempY = temperatureY(hour.temperature); const precipitationY = rainY(hour.rainProbability); return <g key={hour.time}>
        <circle cx={pointX} cy={tempY} r="4.5" fill="#b64a32" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" /><text x={pointX} y={Math.max(12, tempY - 10)} textAnchor="middle" fontSize="10" fontWeight="900" fill="#8f3827">{Math.round(hour.temperature)}°</text>
        <circle cx={pointX} cy={precipitationY} r="4" fill="white" stroke="#0e6b72" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <text x={pointX} y={height - 36} textAnchor="middle" fontSize="9" fontWeight="800" fill="#43545a">{hour.time.slice(11, 16)}</text><text x={pointX} y={height - 18} textAnchor="middle" fontSize="9" fontWeight="900" fill="#0e6b72">雨 {hour.rainProbability}%</text>
      </g>; })}
    </svg>
    <table className="sr-only"><caption>未来 8 小时天气明细</caption><thead><tr><th>时间</th><th>天气</th><th>温度</th><th>降雨概率</th></tr></thead><tbody>{hours.map((hour) => <tr key={hour.time}><td>{hour.time.slice(11, 16)}</td><td>{weatherLabel(hour.code)}</td><td>{Math.round(hour.temperature)}°C</td><td>{hour.rainProbability}%</td></tr>)}</tbody></table>
  </section>;
}

function WeatherHeroMetric({ icon: Icon, label, value }: { icon: typeof Droplets; label: string; value: string }) { return <div className="rounded-2xl bg-white/10 p-2.5 backdrop-blur"><Icon className="h-4 w-4 text-white/70" /><span className="mt-2 block text-[9px] font-bold text-white/50">{label}</span><strong className="mt-0.5 block text-xs">{value}</strong></div>; }
function WeatherAdviceCard({ advice }: { advice: string[] }) {
  return <section aria-label="结合行程的准备建议" className="overflow-hidden rounded-[1.5rem] border border-tower/15 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3.5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-tower/10 text-tower"><Sparkles className="h-5 w-5" /></span><h5 className="font-display text-xl font-black tracking-tight">行前准备</h5><span className="ml-auto rounded-full bg-tower/8 px-2.5 py-1 text-[10px] font-black text-tower">天气建议</span></div>
    <ul className="divide-y divide-ink/8 px-4">{advice.map((item, index) => <li key={item} className="grid grid-cols-[24px_1fr] gap-2.5 py-3 text-[13px] font-semibold leading-6 text-ink/65"><span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-tower text-[10px] font-black text-white">{index + 1}</span><span>{item}</span></li>)}</ul>
  </section>;
}

function TripForecastCard({ days, today }: { days: WeatherDay[]; today?: WeatherDay }) {
  return <section aria-label="行程期间天气" className="rounded-[1.65rem] bg-white p-5 shadow-[0_14px_36px_rgba(18,34,42,.09)]"><h5 className="font-display text-2xl font-black tracking-tight">行程期间</h5><div className="mt-3 divide-y divide-ink/8">{days.map((day, index) => <div key={day.date} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-2"><WeatherDayIcon code={day.code} /><div className="min-w-0"><div className="flex items-baseline gap-2"><strong className="text-base font-black">{index === 0 ? '今天' : `第${index + 1}天`}</strong><span className="text-xs font-bold text-ink/35">{day.date.slice(5).replace('-', '/')}</span></div><p className="mt-1 text-base font-black text-river">{weatherLabel(day.code)}</p><p className="mt-1 text-xs font-bold text-ink/45">降雨 {day.rainProbability}% · UV {day.uv.toFixed(1)}</p></div><strong className="font-display text-xl font-black tabular-nums text-ink">{Math.round(day.min)}°–{Math.round(day.max)}°</strong></div>)}</div>{today && <div className="mt-3 grid grid-cols-2 gap-3"><MiniFact icon={Sunrise} label="日出" value={today.sunrise.slice(11, 16)} /><MiniFact icon={Sunset} label="日落" value={today.sunset.slice(11, 16)} /></div>}</section>;
}

function WeatherDayIcon({ code }: { code: number }) {
  const Icon = code === 0 ? Sun : code <= 3 ? CloudSun : CloudRain;
  const tone = code === 0 ? 'bg-amber-100 text-amber-600' : code <= 3 ? 'bg-sky-100 text-sky-600' : 'bg-river/10 text-river';
  return <span className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><Icon className="h-7 w-7" /></span>;
}

function MiniFact({ icon: Icon, label, value }: { icon: typeof Sunrise; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-ink/[0.035] p-3"><Icon className="h-7 w-7 shrink-0 text-tower" /><span className="text-xs font-bold text-ink/45">{label}</span><strong className="ml-auto font-display text-base font-black tabular-nums">{value}</strong></div>; }
function weatherLabel(code: number) { if (code === 0) return '晴朗'; if (code <= 3) return '多云'; if (code <= 48) return '雾'; if (code <= 57) return '毛毛雨'; if (code <= 67) return '降雨'; if (code <= 77) return '降雪'; if (code <= 82) return '阵雨'; if (code <= 86) return '阵雪'; return '雷雨'; }
function buildWeatherAdvice(weather: WeatherData, request: TripRequest) { const advice: string[] = []; const today = weather.daily[0]; if (weather.apparentTemperature >= 33 || (today?.max ?? 0) >= 34) advice.push('防暑优先：准备饮水、电解质和遮阳帽；把长时间户外点位避开 12:00–15:00。'); if ((today?.uv ?? 0) >= 6) advice.push(`紫外线指数最高 ${today.uv.toFixed(1)}，建议 SPF30+ 防晒，并每 2–3 小时补涂。`); if ((today?.rainProbability ?? 0) >= 40 || weather.precipitation > 0) advice.push(`降雨概率最高 ${today?.rainProbability ?? 0}%，带折叠伞和防滑鞋；优先保留室内或有遮蔽点位。`); if (weather.windGusts >= 35) advice.push(`阵风约 ${Math.round(weather.windGusts)} km/h，江边和观景台减少使用自拍杆，留意临时封闭。`); if (request.travelerType === '老人' || request.specialNeeds.includes('行动不便')) advice.push('同行包含老人或行动不便需求：每 60–90 分钟安排休息，雨后减少台阶和湿滑栈道路段。'); if (request.specialNeeds.includes('带儿童')) advice.push('带儿童出行：额外准备替换衣物、驱蚊用品和少量补充能量的零食。'); if (!advice.length) advice.push('天气风险较低，按原路线执行即可；仍建议随身带水，并在出发前再次刷新天气。'); return advice.slice(0, 4); }

const transitStrategies: Array<{ id: TransitStrategy; label: string }> = [
  { id: 'recommended', label: '推荐' }, { id: 'fastest', label: '时间短' }, { id: 'economy', label: '最省钱' },
  { id: 'fewest-transfers', label: '少换乘' }, { id: 'least-walking', label: '少步行' }, { id: 'subway-first', label: '地铁优先' },
];

function Transport({ transport, loading, strategy, onStrategy, onReload, onSimulate }: { transport: TransportPlanResponse | null; loading: boolean; strategy: TransitStrategy; onStrategy: (strategy: TransitStrategy) => void; onReload: () => void; onSimulate?: () => void }) {
  const freshness = transport?.freshness ?? 'estimate';
  const statusCopy = freshness === 'vehicle-realtime' ? '车辆实时数据' : freshness === 'live-query' ? '动态路线查询' : '规则估算';
  return <div className="space-y-4"><div className="flex items-end justify-between"><div><h4 className="font-display text-2xl font-black">公共交通路书</h4><p className="mt-1 text-xs font-bold text-ink/45">线路、站口、换乘、票价与步行接驳一页看懂。</p></div><button type="button" aria-label="重新查询交通方案" disabled={loading} onClick={onReload} className="grid h-9 w-9 place-items-center rounded-full bg-white text-river shadow-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="公共交通路线偏好">{transitStrategies.map((item) => <button key={item.id} type="button" role="radio" aria-checked={strategy === item.id} onClick={() => onStrategy(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black transition ${strategy === item.id ? 'bg-ink text-white shadow-sm' : 'bg-white text-ink/50'}`}>{item.label}</button>)}</div>
    <section className="overflow-hidden rounded-[1.6rem] bg-ink text-white shadow-[0_16px_38px_rgba(18,34,42,.16)]"><div className="p-4"><div className="flex items-center justify-between gap-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${freshness !== 'estimate' ? 'bg-jade/25 text-emerald-100' : 'bg-white/10 text-white/65'}`}>{freshness !== 'estimate' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{transport?.sourceLabel ?? '正在查询'}</span><span className="text-[9px] font-bold text-white/45">{statusCopy}</span></div><p className="mt-4 text-sm font-bold leading-6 text-white/75">{transport?.summary ?? '正在根据当前出发时间查询公交与地铁方案……'}</p><div className="mt-4 grid grid-cols-3 gap-2"><TransportKpi label="总时长" value={transport ? `${transport.totalMinutes} 分` : '—'} /><TransportKpi label="总距离" value={transport ? `${transport.totalDistanceKm} km` : '—'} /><TransportKpi label="预计票价" value={transport?.totalFare === undefined ? '待查询' : `¥${transport.totalFare}`} /></div></div><div className="border-t border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold leading-4 text-white/50">{transport ? `更新于 ${new Date(transport.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} · ${statusCopy}` : '正在连接交通服务'}</div></section>
    {transport?.segments.map((segment, index) => <article key={segment.id} className="relative overflow-hidden rounded-[1.5rem] border border-ink/8 bg-white shadow-sm"><div className="flex items-start gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-river/10 text-river">{transportIcon(segment.mode)}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-river">第 {index + 1} 段 · {segment.mode}</span><span className="rounded-full bg-ink/5 px-2 py-1 text-[9px] font-black text-ink/45">{segment.durationMinutes} 分钟</span></div><h5 className="mt-2 text-sm font-black"><span>{segment.from}</span><span className="mx-2 text-ink/25">→</span><span>{segment.to}</span></h5><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-ink/45"><span>{segment.departureTime}–{segment.arrivalTime}</span><span>{segment.distanceKm} km</span><span>{segment.costEstimate}</span></div></div></div>
      <div className="border-t border-ink/5 bg-[#f7faf8] px-4 py-3"><div className="space-y-2">{segment.legs.map((leg, legIndex) => <TransitLegRow key={leg.id} leg={leg} last={legIndex === segment.legs.length - 1} />)}</div>{!segment.legs.length && <p className="text-[11px] font-bold leading-5 text-ink/55">{segment.instruction}</p>}</div>
    </article>)}
    {transport?.notices.map((notice, index) => <div key={notice} className={`flex gap-2 rounded-2xl p-3 text-[11px] font-bold leading-5 ${index === 0 ? 'bg-tower/10 text-ink/65' : 'bg-ink/[0.035] text-ink/50'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tower" />{notice}</div>)}
    <div className="grid grid-cols-2 gap-2"><a href="https://www.12306.cn/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-black shadow-sm"><TrainFront className="h-4 w-4 text-river" />铁路12306<ExternalLink className="h-3 w-3" /></a><a href="https://www.amap.com/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-black shadow-sm"><Bus className="h-4 w-4 text-river" />高德复核<ExternalLink className="h-3 w-3" /></a></div><button type="button" onClick={onSimulate} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-river px-4 py-3 font-black text-white"><RouteIcon className="h-4 w-4" />在地图上高亮交通路线</button></div>;
}

function TransportKpi({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/8 p-2.5"><span className="block text-[9px] font-bold text-white/40">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>; }
function TransitLegRow({ leg, last }: { leg: TransportLeg; last: boolean }) { const label = leg.mode === 'subway' ? '地铁' : leg.mode === 'bus' ? '公交' : leg.mode === 'walk' ? '步行' : leg.mode === 'railway' ? '铁路' : leg.mode === 'taxi' ? '驾车' : '接驳'; return <div className="relative flex gap-3 pb-1"><div className="relative flex w-7 shrink-0 justify-center"><span className={`z-10 grid h-7 w-7 place-items-center rounded-full ${leg.mode === 'subway' ? 'bg-tower text-white' : leg.mode === 'bus' ? 'bg-river text-white' : 'bg-white text-ink/45 shadow-sm'}`}>{legIcon(leg.mode)}</span>{!last && <span className="absolute bottom-[-10px] top-6 w-px bg-ink/15" />}</div><div className="min-w-0 flex-1 pb-2"><div className="flex flex-wrap items-center gap-2"><strong className="text-[11px]">{leg.lineName || label}</strong><span className="text-[9px] font-black text-ink/40">{leg.durationMinutes} 分钟 · {leg.distanceKm} km</span></div>{(leg.departureStop || leg.arrivalStop) && <p className="mt-1 text-[10px] font-bold text-ink/55">{leg.entrance ? `${leg.entrance}进站 · ` : ''}{leg.departureStop ?? '起点'} → {leg.arrivalStop ?? '终点'}{leg.exit ? ` · ${leg.exit}出站` : ''}</p>}{leg.viaStops.length > 0 && <p className="mt-1 text-[9px] font-bold text-ink/35">途经 {leg.viaStops.length} 站：{leg.viaStops.slice(0, 4).join('、')}{leg.viaStops.length > 4 ? '…' : ''}</p>}{(leg.serviceStartTime || leg.serviceEndTime) && <p className="mt-1 text-[9px] font-bold text-jade">运营 {leg.serviceStartTime ?? '—'}–{leg.serviceEndTime ?? '—'}</p>}</div></div>; }
function legIcon(mode: TransportLeg['mode']) { if (mode === 'walk') return <Footprints className="h-3.5 w-3.5" />; if (mode === 'subway' || mode === 'railway') return <TrainFront className="h-3.5 w-3.5" />; if (mode === 'taxi') return <CarFront className="h-3.5 w-3.5" />; return <Bus className="h-3.5 w-3.5" />; }
function transportIcon(mode: TransportMode) { if (mode === '步行') return <Footprints className="h-4 w-4" />; if (mode === '地铁') return <TrainFront className="h-4 w-4" />; if (mode === '公交' || mode === '公共交通') return <Bus className="h-4 w-4" />; if (mode === '景区专线') return <RouteIcon className="h-4 w-4" />; return <CarFront className="h-4 w-4" />; }

const dianpingCityIds: Record<TripRequest['destinationCity'], string> = { 宜昌: '179', 武汉: '16', 恩施: '1368', 荆州: '184', 襄阳: '180', 黄石: '177' };

export function getDianpingSearchUrl(city: TripRequest['destinationCity'], name: string, area: string) {
  const primaryArea = area.split('/')[0]?.trim() ?? area.trim();
  return `https://www.dianping.com/search/keyword/${dianpingCityIds[city]}/0_${encodeURIComponent(`${name} ${primaryArea}`.trim())}`;
}

function Food({ plan }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']> }) {
  const foodStops = (plan.route.points as PlannedRoutePoint[]).filter((point) => point.type === 'food');
  const firstStop = foodStops[0];
  const totalStay = foodStops.reduce((sum, point) => sum + point.durationMinutes, 0);
  return <div className="space-y-4"><h4 className="font-display text-2xl font-black">路线餐饮点</h4>
    <section aria-label="路线餐饮 KPI" className="grid grid-cols-3 gap-2 rounded-[1.5rem] bg-gradient-to-br from-ink to-river p-3 text-white shadow-[0_14px_32px_rgba(18,34,42,.16)]"><FoodKpi label="餐饮点" value={`${foodStops.length} 处`} /><FoodKpi label="首个到达" value={firstStop?.arrivalTime ?? firstStop?.time ?? '待安排'} /><FoodKpi label="计划停留" value={`${totalStay} 分钟`} /></section>
    {firstStop && <p className="rounded-2xl border border-river/10 bg-river/[0.055] px-3 py-2.5 text-[11px] font-bold text-ink/55"><span className="font-black text-river">当前路线用餐锚点：</span>{firstStop.name} · 第 {firstStop.day ?? 1} 天 · {firstStop.arrivalTime ?? firstStop.time}</p>}
    {plan.foodRecommendations.length ? plan.foodRecommendations.map((food) => <article key={food.id} className="rounded-3xl bg-white p-4 shadow-sm"><h5 className="font-black">{food.name}</h5><p className="mt-2 text-sm font-bold text-ink/60">{food.area} · {food.priceRange}</p><div className="mt-2 flex flex-wrap gap-1">{food.tags.map((tag) => <span key={tag} className="rounded-full bg-jade/10 px-2 py-1 text-xs font-black text-jade">{tag}</span>)}</div><p className="mt-3 text-xs font-bold text-tower">营业状态：{food.businessStatus}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><a href={food.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-river">来源：{food.source.name} · 核验 {food.source.checkedAt}<ExternalLink className="h-3 w-3" /></a><a href={food.dianpingUrl ?? getDianpingSearchUrl(plan.requestSnapshot.destinationCity, food.name, food.area)} target="_blank" rel="noreferrer" aria-label={`打开${food.name}大众点评商户详情`} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1eb] px-3 py-2 text-xs font-black text-[#d95028] transition hover:bg-[#ffdfd2]">大众点评 · 商户详情<ExternalLink className="h-3.5 w-3.5" /></a></div></article>) : <p className="rounded-2xl bg-white p-4 text-sm font-bold text-ink/55">当前限制条件下没有合适条目，请放宽筛选或自行核验。</p>}</div>;
}

function FoodKpi({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-2.5 backdrop-blur"><span className="block text-[9px] font-bold text-white/45">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>; }

function Budget({ items, target, days, onChange }: { items: BudgetItem[]; target: number; days: number; onChange: (items: BudgetItem[]) => void }) {
  const total = budgetTotal(items); const remaining = target - total; const progress = target > 0 ? Math.min(100, Math.round(total / target * 100)) : 0;
  const updateItem = (id: string, changes: Partial<BudgetItem>) => onChange(items.map((item) => item.id === id ? { ...item, ...changes } : item));
  return <div className="space-y-4"><div><h4 className="font-display text-2xl font-black">旅行预算</h4><p className="mt-1 text-xs font-bold text-ink/45">金额可直接选中输入，所有条目自动保存。</p></div><section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-ink via-[#17353d] to-river p-5 text-white shadow-[0_18px_45px_rgba(18,34,42,.18)]"><WalletCards className="absolute -right-5 -top-5 h-28 w-28 rotate-[-12deg] text-white/[0.06]" /><div className="relative flex items-start justify-between"><div><span className="text-[10px] font-black uppercase tracking-[0.2em] text-jade">PLAN BUDGET</span><p className="mt-2 text-xs font-bold text-white/50">当前计划支出</p><strong className="mt-1 block font-display text-4xl font-black">¥{total.toLocaleString('zh-CN')}</strong></div><div className={`rounded-full px-3 py-1 text-[10px] font-black ${remaining >= 0 ? 'bg-jade/20 text-emerald-100' : 'bg-tower/25 text-orange-100'}`}>{remaining >= 0 ? '预算内' : '已超支'}</div></div><div className="relative mt-5"><div className="flex justify-between text-[10px] font-bold text-white/45"><span>已使用 {target > 0 ? Math.round(total / target * 100) : 0}%</span><span>目标 ¥{target.toLocaleString('zh-CN')}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><span className={`block h-full rounded-full transition-all duration-500 ${remaining >= 0 ? 'bg-jade' : 'bg-tower'}`} style={{ width: `${progress}%` }} /></div></div><div className="relative mt-4 grid grid-cols-3 gap-2"><BudgetFact label="剩余额度" value={`${remaining < 0 ? '-' : ''}¥${Math.abs(remaining)}`} tone={remaining < 0 ? 'warn' : 'normal'} /><BudgetFact label="日均预算" value={`¥${Math.round(target / Math.max(1, days))}`} /><BudgetFact label="预算条目" value={`${items.length} 项`} /></div></section>
    <div className="flex items-center justify-between"><h5 className="font-display text-lg font-black">支出分类</h5><span className="inline-flex items-center gap-1 text-[10px] font-black text-jade"><span className="h-1.5 w-1.5 rounded-full bg-jade" />自动保存</span></div>{items.map((item, index) => <BudgetRow key={item.id} item={item} index={index} onUpdate={(changes) => updateItem(item.id, changes)} onDelete={() => onChange(items.filter((value) => value.id !== item.id))} />)}<button type="button" onClick={() => onChange([...items, { id: `budget-${crypto.randomUUID()}`, item: '新预算项目', amount: 0, note: '' }])} className="group inline-flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-river/35 bg-river/[0.035] px-4 py-4 font-black text-river transition hover:border-river hover:bg-river/10"><span className="grid h-7 w-7 place-items-center rounded-full bg-river text-white transition group-hover:rotate-90"><Plus className="h-4 w-4" /></span>新增预算条目</button><p className="rounded-2xl bg-ink/[0.035] p-3 text-[10px] font-bold leading-5 text-ink/45">新增任意数量条目时，仅右侧预算栏滚动；地图工作区高度保持不变。</p></div>;
}

function BudgetFact({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) { return <div className="rounded-2xl bg-white/8 p-2.5"><span className="block text-[9px] font-bold text-white/40">{label}</span><strong className={`mt-1 block text-xs ${tone === 'warn' ? 'text-orange-200' : 'text-white'}`}>{value}</strong></div>; }
function BudgetRow({ item, index, onUpdate, onDelete }: { item: BudgetItem; index: number; onUpdate: (changes: Partial<BudgetItem>) => void; onDelete: () => void }) {
  const [amountDraft, setAmountDraft] = useState(String(item.amount)); useEffect(() => setAmountDraft(String(item.amount)), [item.amount]);
  const commitAmount = () => { const amount = Math.max(0, Math.round(Number(amountDraft.replace(/[^\d.]/g, '')) || 0)); setAmountDraft(String(amount)); onUpdate({ amount }); };
  return <article className="rounded-[1.5rem] border border-ink/8 bg-white p-4 shadow-sm transition focus-within:border-river/30 focus-within:shadow-[0_12px_30px_rgba(14,107,114,.1)]"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${index % 3 === 0 ? 'bg-river/10 text-river' : index % 3 === 1 ? 'bg-tower/10 text-tower' : 'bg-jade/10 text-jade'}`}>{index % 2 === 0 ? <ReceiptText className="h-5 w-5" /> : <CircleDollarSign className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><label className="block text-[10px] font-black text-ink/40">预算项目<input aria-label={`预算项目${index + 1}`} value={item.item} onChange={(event) => onUpdate({ item: event.target.value })} className="focus-ring mt-1 w-full border-0 bg-transparent p-0 text-sm font-black text-ink" /></label><div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2"><label className="block text-[10px] font-black text-ink/40">直接输入金额<span className="mt-1 flex items-center rounded-xl border border-ink/10 bg-[#f7faf8] px-3 focus-within:border-river/35 focus-within:ring-4 focus-within:ring-jade/10"><span className="font-display text-lg font-black text-river">¥</span><input aria-label={`${item.item}金额`} type="text" inputMode="decimal" value={amountDraft} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setAmountDraft(event.target.value.replace(/[^\d.]/g, ''))} onBlur={commitAmount} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="min-w-0 w-full border-0 bg-transparent px-2 py-2 font-display text-lg font-black outline-none" /></span></label><button type="button" aria-label={`删除${item.item}`} onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500 transition hover:bg-red-500 hover:text-white"><Trash2 className="h-4 w-4" /></button></div><label className="mt-3 block text-[10px] font-black text-ink/40">备注（可选）<input aria-label={`${item.item}备注`} value={item.note} placeholder="例如：含往返车费" onChange={(event) => onUpdate({ note: event.target.value })} className="focus-ring mt-1 w-full rounded-xl border border-ink/8 bg-white px-3 py-2 text-xs font-medium text-ink placeholder:text-ink/25" /></label></div></div></article>;
}

function CommandButton({ icon: Icon, label, onClick, disabled, spin }: { icon: typeof RefreshCw; label: string; onClick?: () => void; disabled?: boolean; spin?: boolean }) { return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-ink shadow-soft backdrop-blur disabled:opacity-60"><Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />{label}</button>; }
function TimeMetric({ label, value, tone, onChange }: { label: string; value: string; tone: 'river' | 'tower'; onChange: (value: string) => void }) {
  return <label className="rounded-2xl bg-white p-4 shadow-sm transition focus-within:ring-4 focus-within:ring-jade/15"><span className="block text-xs font-black text-ink/50">{label}</span><span className="mt-2 flex items-center gap-2"><Clock3 className={`h-4 w-4 shrink-0 ${tone === 'tower' ? 'text-tower' : 'text-river'}`} /><input aria-label={`总览${label}`} type="time" value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring min-w-0 w-full bg-transparent font-display text-xl font-black text-ink" /></span></label>;
}
function EditableMetric({ label, value, min, max, step = 1, prefix = '', suffix = '', onCommit }: { label: string; value: number; min: number; max: number; step?: number; prefix?: string; suffix?: string; onCommit: (value: number) => void }) { const [draft, setDraft] = useState(String(value)); useEffect(() => setDraft(String(value)), [value]); const commit = () => { const parsed = Number(draft); const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value; setDraft(String(next)); onCommit(next); }; return <label className="rounded-2xl bg-white p-4 shadow-sm transition focus-within:ring-4 focus-within:ring-jade/15"><span className="block text-xs font-black text-ink/50">{label}</span><span className="mt-2 flex items-baseline gap-1 font-display text-xl font-black text-ink">{prefix && <span>{prefix}</span>}<input aria-label={`总览${label}`} type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="focus-ring min-w-0 w-full bg-transparent font-display text-xl font-black text-ink" />{suffix && <span className="shrink-0 text-sm">{suffix}</span>}</span></label>; }

