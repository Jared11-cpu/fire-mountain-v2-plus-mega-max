import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, Bus, CalendarDays, Camera, CarFront, Check, ChevronDown, CircleDollarSign, Clock3, CloudRain, CloudSun, Copy, Droplets, ExternalLink, Footprints, Loader2, MapPin, Navigation, NotebookPen, PencilLine, Plus, ReceiptText, RefreshCw, Route as RouteIcon, Sparkles, Sun, Sunrise, Sunset, TrainFront, Trash2, Umbrella, Utensils, WalletCards, Wifi, WifiOff, Wind } from 'lucide-react';
import type { TravelPlan } from '../utils/aiGenerator';
import type { RoutePoint, SmartRoute } from '../types/route';
import { budgetTotal, calculateTimeline, parseLocalDate, type BudgetItem, type PlannedRoutePoint, type TripRequest } from '../domain/trip';
import { useTrip } from '../state/tripStore';
import { resolveTransportPlan, toTransportPlanRequest, type TransportMode, type TransportPlanResponse } from '../services/transportService';
import type { RoadPlanMetrics } from '../services/amapDriving';
import { RouteMap } from './RouteMap';

type Tab = 'overview' | 'stops' | 'days' | 'weather' | 'transport' | 'food' | 'budget';
const tabs: Array<{ id: Tab; label: string; icon: typeof MapPin }> = [
  { id: 'overview', label: '概览', icon: Sparkles }, { id: 'stops', label: '路线', icon: MapPin },
  { id: 'days', label: '行程记录', icon: CalendarDays }, { id: 'weather', label: '天气', icon: CloudSun },
  { id: 'transport', label: '交通', icon: Bus }, { id: 'food', label: '美食', icon: Utensils },
  { id: 'budget', label: '预算', icon: CircleDollarSign },
];

export function MapWorkspace({ route, plan, selectedPointId, activePointIndex, navigating, imageUrl, onSelectPoint, onRegenerate, onCopySocial, onSimulateNavigation }: {
  route: SmartRoute; plan: TravelPlan; selectedPointId?: string; activePointIndex: number; navigating: boolean; imageUrl: string;
  onSelectPoint: (point: RoutePoint) => void; onRegenerate?: () => void; onCopySocial?: () => void; onSimulateNavigation?: () => void;
}) {
  const { plan: tripPlan, request, isReplanning, patchPlan, updatePlanSettings, updateBudgetItems, setBudgetTotal, updateRequest } = useTrip();
  const [tab, setTab] = useState<Tab>('overview');
  const [mobilePane, setMobilePane] = useState<'map' | 'details'>('map');
  const [roadPlan, setRoadPlan] = useState<RoadPlanMetrics>({ status: 'loading', source: 'estimate', message: '正在请求高德道路规划…' });
  const selected = route.points.find((point) => point.id === selectedPointId) as PlannedRoutePoint | undefined ?? route.points[0] as PlannedRoutePoint;
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
  if (!tripPlan) return null;

  return <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-soft">
    <div className="border-b border-ink/10 bg-ink p-2 lg:hidden" role="tablist" aria-label="移动端工作区">
      <div className="grid grid-cols-2 rounded-full bg-white/10 p-1">{(['map', 'details'] as const).map((pane) => <button key={pane} type="button" role="tab" aria-selected={mobilePane === pane} onClick={() => setMobilePane(pane)} className={`rounded-full px-4 py-2 text-sm font-black ${mobilePane === pane ? 'bg-white text-ink' : 'text-white'}`}>{pane === 'map' ? '地图' : '详情'}</button>)}</div>
    </div>
    <div className="grid lg:h-[760px] lg:grid-cols-[72px_minmax(0,1fr)_420px]">
      <nav className={`${mobilePane === 'details' ? 'flex' : 'hidden'} gap-2 overflow-x-auto bg-ink p-2 text-white lg:flex lg:flex-col lg:justify-center`} aria-label="方案详情标签">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} aria-label={label} onClick={() => { setTab(id); setMobilePane('details'); }} className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black lg:flex-col lg:px-2 ${tab === id ? 'bg-river text-white' : 'text-white/65 hover:bg-white/10'}`}><Icon className="h-5 w-5" /><span>{label}</span></button>)}
      </nav>

      <div role="region" aria-label="路线地图" className={`${mobilePane === 'map' ? 'block' : 'hidden'} relative min-h-[620px] min-w-0 overflow-hidden border-ink/10 lg:block lg:border-r`}>
        <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
          <CommandButton icon={isReplanning ? Loader2 : RefreshCw} label={isReplanning ? '计算中' : '重新规划'} disabled={isReplanning} onClick={onRegenerate} spin={isReplanning} />
          <CommandButton icon={Copy} label="复制文案" onClick={onCopySocial} />
        </div>
        <RouteMap route={route} selectedPointId={selectedPointId} activePointIndex={activePointIndex} navigating={navigating} onSelectPoint={handleMapSelect} onRoadPlanChange={setRoadPlan} mapOnly />
        <div role="region" aria-label="地图行程摘要" className={`pointer-events-none absolute bottom-4 left-4 right-4 z-20 grid gap-2 ${roadPlan.status === 'planned' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          <Metric tone="river" label={roadPlan.status === 'planned' ? '高德 Driving 距离' : '估算距离'} value={roadPlan.status === 'loading' ? '计算中…' : `${(roadPlan.distanceKm ?? route.totalDistanceKm).toFixed(1)} km`} />
          {roadPlan.status === 'planned' && roadPlan.durationMinutes && <Metric tone="jade" label="预计行车" value={formatDriveDuration(roadPlan.durationMinutes)} />}
          <Metric tone="tower" label="出发时间" value={tripPlan.settings.departureTime} />
          <Metric label="当前点到达" value={selected?.arrivalTime ?? selected?.time ?? '--:--'} />
        </div>
      </div>

      <aside aria-label="方案详情" className={`${mobilePane === 'details' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col overflow-hidden bg-[#fffdf7] lg:flex`}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [scrollbar-gutter:stable]">
          {tab === 'overview' && <Overview plan={tripPlan} route={route} summary={plan.summary} onSettings={updatePlanSettings} onBudget={setBudgetTotal} onDate={(startDate) => updateRequest({ startDate })} />}
          {tab === 'stops' && <Stops points={route.points as PlannedRoutePoint[]} selectedId={selectedPointId} fallbackImageUrl={imageUrl} dailyRecords={tripPlan.dailyRecords} maxDays={request.days} onSelect={onSelectPoint} onPatchPoint={patchRoutePoint} onPatchNote={(id, note) => patchPlan((value) => ({ ...value, pointNotes: { ...value.pointNotes, [id]: note } }))} notes={tripPlan.pointNotes} />}
          {tab === 'days' && <Days plan={tripPlan} onPatch={patchPlan} />}
          {tab === 'weather' && <Weather request={request} lat={route.points[0]?.lat} lng={route.points[0]?.lng} />}
          {tab === 'transport' && <Transport plan={tripPlan} request={request} onSimulate={onSimulateNavigation} />}
          {tab === 'food' && <Food plan={tripPlan} />}
          {tab === 'budget' && <Budget items={tripPlan.budgetItems} target={request.budget} days={request.days} onChange={updateBudgetItems} />}
        </div>
      </aside>
    </div>
  </section>;
}

function Overview({ plan, route, summary, onSettings, onBudget, onDate }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; route: SmartRoute; summary: string; onSettings: ReturnType<typeof useTrip>['updatePlanSettings']; onBudget: (total: number) => void; onDate: (date: string) => void }) {
  return <div className="space-y-4">
    <section className="rounded-[1.65rem] bg-ink p-5 text-white"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-jade">已保存方案 · 自动同步</div><h3 className="mt-2 font-display text-2xl font-black leading-tight">{route.title}</h3><p className="mt-3 text-sm leading-6 text-white/65">{summary}</p></section>
    <div className="flex items-end justify-between gap-3"><div><h4 className="font-display text-2xl font-black">路线总览</h4><p className="mt-1 text-xs font-bold text-ink/45">点击卡片中的数字或日期即可直接修改</p></div><span className="rounded-full bg-jade/10 px-3 py-1 text-[10px] font-black text-jade">自动保存</span></div>
    <div className="grid grid-cols-2 gap-3">
      <EditableMetric label="点位" value={plan.settings.targetPointCount} min={2} max={plan.route.points.length} suffix="个" onCommit={(value) => onSettings({ targetPointCount: value })} />
      <EditableMetric label="预计时长" value={Math.round(plan.settings.targetDurationMinutes / 6) / 10} min={1} max={24} step={0.5} suffix="小时" onCommit={(value) => onSettings({ targetDurationMinutes: Math.round(value * 60) })} />
      <EditableMetric label="预算总计" value={budgetTotal(plan.budgetItems)} min={0} max={999999} prefix="¥" onCommit={onBudget} />
      <section aria-label="总览出发安排" className="rounded-2xl bg-white p-4 shadow-sm transition focus-within:ring-4 focus-within:ring-jade/15">
        <span className="block text-xs font-black text-ink/50">出发安排</span>
        <div className="mt-2 grid gap-2">
          <label className="flex items-center gap-2 rounded-xl bg-ink/[0.035] px-2.5 py-2"><CalendarDays className="h-4 w-4 shrink-0 text-river" /><span className="sr-only">出发日期</span><input aria-label="总览出发日期" type="date" value={plan.requestSnapshot.startDate} onChange={(event) => onDate(event.target.value)} className="focus-ring min-w-0 w-full bg-transparent text-xs font-black text-ink" /></label>
          <label className="flex items-center gap-2 rounded-xl bg-ink/[0.035] px-2.5 py-2"><Clock3 className="h-4 w-4 shrink-0 text-tower" /><span className="sr-only">出发时间</span><input aria-label="总览出发时间" type="time" value={plan.settings.departureTime} onChange={(event) => onSettings({ departureTime: event.target.value })} className="focus-ring min-w-0 w-full bg-transparent font-display text-base font-black text-ink" /></label>
        </div>
      </section>
    </div>
  </div>;
}

function Stops({ points, selectedId, fallbackImageUrl, dailyRecords, maxDays, onSelect, onPatchPoint, notes, onPatchNote }: { points: PlannedRoutePoint[]; selectedId?: string; fallbackImageUrl: string; dailyRecords: Array<{ day: number; date: string }>; maxDays: number; onSelect: (point: RoutePoint) => void; onPatchPoint: (id: string, changes: Partial<PlannedRoutePoint>) => void; notes: Record<string, string>; onPatchNote: (id: string, note: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(selectedId ?? points[0]?.id ?? null);
  useEffect(() => { if (selectedId) setExpandedId(selectedId); }, [selectedId]);
  return <div className="space-y-4"><div><h4 className="font-display text-2xl font-black">地点安排</h4><p className="mt-1 text-xs font-bold leading-5 text-ink/50">展开地点卡片查看实景、游览重点与个人安排；修改内容会自动保存。</p></div>{points.map((point, index) => { const expanded = expandedId === point.id; const date = dailyRecords.find((record) => record.day === (point.day ?? 1))?.date; const serviceLinks = getPointServiceLinks(point); return <article key={point.id} className={`overflow-hidden rounded-[1.65rem] border bg-white transition ${selectedId === point.id ? 'border-river shadow-[0_12px_35px_rgba(14,116,128,.14)]' : 'border-ink/10 shadow-sm'}`}>
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
        <div className="space-y-2 rounded-2xl bg-[#f1f6f2] p-3 text-xs leading-5 text-ink/65"><p className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-river" /><span><strong className="text-ink">拍摄建议：</strong>{point.photoTip}</span></p><p className="flex gap-2"><NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-tower" /><span><strong className="text-ink">记录重点：</strong>{point.recordTip}</span></p></div>
        <PointServiceLinks pointName={point.name} links={serviceLinks} />
        <section className="rounded-2xl border border-ink/10 p-3"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">我的地点安排</strong><span className="rounded-full bg-jade/10 px-2 py-1 text-[10px] font-black text-jade">自动保存</span></div><div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-black text-ink/50">安排日期<select value={point.day ?? 1} onChange={(event) => onPatchPoint(point.id, { day: Number(event.target.value) })} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 bg-white px-2 py-2 text-sm font-bold text-ink">{Array.from({ length: maxDays }, (_, day) => <option key={day + 1} value={day + 1}>第{day + 1}天</option>)}</select></label><label className="text-[11px] font-black text-ink/50">停留分钟<input type="number" min={10} max={480} step={5} value={point.durationMinutes} onChange={(event) => onPatchPoint(point.id, { durationMinutes: Math.max(10, Number(event.target.value) || 10) })} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 px-2 py-2 text-sm font-bold text-ink" /></label></div><label className="mt-3 block text-[11px] font-black text-ink/50">我的安排<textarea value={notes[point.id] ?? ''} placeholder="例如：提前预约、重点拍摄坝体全景、为老人预留休息时间" onChange={(event) => onPatchNote(point.id, event.target.value)} rows={3} className="focus-ring mt-1 w-full resize-none rounded-xl border border-ink/10 px-3 py-2 text-sm font-medium text-ink" /></label></section>
        <div className="flex items-center justify-between gap-3">{point.imageCredit ? <a href={point.imageCredit.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-ink/40 underline decoration-ink/20 underline-offset-2">{point.imageCredit.author} · {point.imageCredit.license}</a> : <span className="text-[10px] font-bold text-ink/40">城市授权代表图</span>}<a href={serviceLinks.amapUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-black text-white">高德地点详情<ExternalLink className="h-3.5 w-3.5" /></a></div>
      </div>}
    </article>; })}</div>;
}

type PointServiceLinkSet = {
  kind: 'railway' | 'attraction';
  amapUrl: string;
  detailUrl: string;
  bookingUrl: string;
};

export function getPointServiceLinks(point: Pick<RoutePoint, 'name' | 'city' | 'type'>): PointServiceLinkSet {
  const keyword = encodeURIComponent(`${point.city} ${point.name}`);
  const isRailwayStation = point.type === 'start' && /(?:站|高铁站|火车站)$/.test(point.name.trim());
  return {
    kind: isRailwayStation ? 'railway' : 'attraction',
    amapUrl: `https://uri.amap.com/search?keyword=${keyword}&city=${encodeURIComponent(point.city)}`,
    detailUrl: isRailwayStation
      ? 'https://kyfw.12306.cn/mormhweb/czyd_2143/'
      : `https://you.ctrip.com/searchsite/sight/?query=${keyword}`,
    bookingUrl: isRailwayStation
      ? 'https://kyfw.12306.cn/otn/leftTicket/init?linktypeid=dc'
      : `https://m.ctrip.com/webapp/ticket/index.html#/dest/k-keyword-0/s-tickets?keyword=${keyword}`,
  };
}

function PointServiceLinks({ pointName, links }: { pointName: string; links: PointServiceLinkSet }) {
  const railway = links.kind === 'railway';
  return <section aria-label={`${pointName}外部服务`} className={`overflow-hidden rounded-2xl border ${railway ? 'border-[#d94141]/15 bg-[#fff8f7]' : 'border-river/12 bg-gradient-to-br from-[#eef8f5] to-[#f8fbf4]'}`}>
    <div className="flex items-start gap-3 p-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${railway ? 'bg-[#d94141] text-white' : 'bg-river text-white'}`}>{railway ? <TrainFront className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1"><strong className="block text-sm text-ink">{railway ? `铁路站点 · ${pointName}` : `旅行服务 · ${pointName}`}</strong><p className="mt-1 text-[10px] font-bold leading-4 text-ink/45">{railway ? '前往中国铁路 12306 官方页面核对车站引导、车次与余票。' : '携程页面提供地点攻略、开放信息与可预订门票；价格和库存以打开页面为准。'}</p></div>
    </div>
    <div className="grid grid-cols-2 border-t border-ink/8 bg-white/65">
      <a href={links.detailUrl} target="_blank" rel="noreferrer" aria-label={`${pointName}${railway ? '12306车站引导' : '携程旅游详情'}`} className="inline-flex items-center justify-center gap-1.5 border-r border-ink/8 px-3 py-3 text-xs font-black text-river transition hover:bg-white">{railway ? '12306 车站引导' : '携程旅游详情'}<ExternalLink className="h-3.5 w-3.5" /></a>
      <a href={links.bookingUrl} target="_blank" rel="noreferrer" aria-label={`${pointName}${railway ? '12306官方购票' : '携程门票活动'}`} className={`inline-flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-black transition hover:bg-white ${railway ? 'text-[#c83232]' : 'text-tower'}`}>{railway ? '12306 官方购票' : '携程门票 / 活动'}<ExternalLink className="h-3.5 w-3.5" /></a>
    </div>
  </section>;
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) { return <div className="rounded-2xl bg-ink/[0.045] p-3"><Icon className="mb-2 h-4 w-4 text-river" /><span className="block text-[10px] text-ink/45">{label}</span><strong className="mt-0.5 block text-ink">{value}</strong></div>; }
function formatCompactDate(value?: string) { if (!value) return '日期待定'; return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(parseLocalDate(value)); }

function Days({ plan, onPatch }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; onPatch: ReturnType<typeof useTrip>['patchPlan'] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const updatePoint = (pointId: string, changes: Partial<PlannedRoutePoint>) => onPatch((value) => ({ ...value, route: { ...value.route, points: (value.route.points as PlannedRoutePoint[]).map((point) => point.id === pointId ? { ...point, ...changes } : point) } }));
  const updateTime = (pointId: string, nextTime: string) => onPatch((value) => {
    const points = value.route.points as PlannedRoutePoint[];
    const index = points.findIndex((point) => point.id === pointId);
    if (index < 0) return value;
    const target = points[index];
    const delta = clockMinutes(nextTime) - clockMinutes(target.arrivalTime);
    return { ...value, route: { ...value.route, points: points.map((point, pointIndex) => pointIndex >= index && point.day === target.day ? { ...point, arrivalTime: shiftClock(point.arrivalTime, delta), time: shiftClock(point.arrivalTime, delta) } : point) } };
  });
  const togglePoint = (day: number, pointId: string, checked: boolean) => {
    onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === day ? { ...item, checkedPointIds: checked ? item.checkedPointIds.filter((id) => id !== pointId) : [...item.checkedPointIds, pointId] } : item) }));
    if (!checked) { setCelebratingId(pointId); window.setTimeout(() => setCelebratingId((current) => current === pointId ? null : current), 900); }
  };
  return <div className="space-y-5"><div className="flex items-end justify-between"><div><h4 className="font-display text-2xl font-black">每日记录</h4><p className="mt-1 text-xs font-bold text-ink/45">点击任务完成打卡，铅笔可修改时间与任务名称。</p></div><span className="rounded-full bg-jade/10 px-3 py-1 text-[10px] font-black text-jade">自动保存</span></div>{plan.dailyRecords.map((record) => { const points = plan.route.points.filter((point) => (point.day ?? 1) === record.day) as PlannedRoutePoint[]; const dateTitle = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(parseLocalDate(record.date)); const completed = points.filter((point) => record.checkedPointIds.includes(point.id)).length; return <section key={record.day} className="itinerary-paper relative overflow-hidden rounded-[1.75rem] border border-ink/10 px-5 pb-5 pt-6 shadow-[0_14px_38px_rgba(18,34,42,.08)]">
    <div className="relative z-10 mb-5 flex items-start justify-between border-b-2 border-ink/10 pb-4 pl-8"><div><span className="text-[10px] font-black uppercase tracking-[0.22em] text-tower">DAY {String(record.day).padStart(2, '0')}</span><h5 className="mt-1 font-display text-2xl font-black leading-none text-ink">{dateTitle}</h5><p className="mt-2 text-[11px] font-bold text-ink/40">{record.date}</p></div><div className="grid h-12 w-12 place-items-center rounded-full border border-river/15 bg-white/80 text-center shadow-sm"><strong className="text-sm text-river">{completed}/{points.length}</strong><span className="-mt-1 text-[8px] font-black text-ink/40">完成</span></div></div>
    <div className="relative z-10 space-y-1 pl-8">{points.map((point) => { const checked = record.checkedPointIds.includes(point.id); const editing = editingId === point.id; return <div key={point.id} className="relative min-h-[52px] py-1">{celebratingId === point.id && <Confetti />}{editing ? <div className="grid grid-cols-[86px_1fr_36px] items-center gap-2 rounded-xl bg-white/90 p-2 shadow-sm"><label className="sr-only" htmlFor={`time-${point.id}`}>修改{point.name}时间</label><input id={`time-${point.id}`} aria-label={`修改${point.name}时间`} type="time" value={point.arrivalTime} onChange={(event) => updateTime(point.id, event.target.value)} className="focus-ring min-w-0 rounded-lg border border-ink/10 px-2 py-2 text-xs font-black text-river" /><label className="sr-only" htmlFor={`name-${point.id}`}>修改任务名称</label><input id={`name-${point.id}`} aria-label={`修改${point.name}任务`} value={point.name} onChange={(event) => updatePoint(point.id, { name: event.target.value })} className="focus-ring min-w-0 rounded-lg border border-ink/10 px-2 py-2 text-sm font-bold" /><button type="button" aria-label={`完成编辑${point.name}`} onClick={() => setEditingId(null)} className="grid h-9 w-9 place-items-center rounded-lg bg-jade text-white"><Check className="h-4 w-4" /></button></div> : <div className="group flex min-h-[46px] items-center gap-2"><button type="button" aria-pressed={checked} aria-label={`${checked ? '取消完成' : '完成'}${point.name}`} onClick={() => togglePoint(record.day, point.id, checked)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition ${checked ? 'text-ink/30' : 'hover:bg-white/60'}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${checked ? 'scale-110 border-jade bg-jade text-white' : 'border-river/30 bg-white text-transparent'}`}><Check className="h-3.5 w-3.5" /></span><span className={`w-12 shrink-0 font-display text-sm font-black ${checked ? 'text-ink/25' : 'text-river'}`}>{point.arrivalTime}</span><span className={`relative min-w-0 flex-1 font-bold transition after:absolute after:left-0 after:top-1/2 after:h-[2px] after:bg-tower after:transition-all ${checked ? 'text-ink/30 after:w-full' : 'after:w-0'}`}>{point.name}</span></button><button type="button" aria-label={`编辑${point.name}`} onClick={() => setEditingId(point.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink/35 transition hover:bg-river/10 hover:text-river"><PencilLine className="h-4 w-4" /></button></div>}</div>; })}</div>
    <label className="relative z-10 mt-4 block pl-8 text-[11px] font-black text-ink/45">今日手记<textarea aria-label={`第${record.day}天手记`} value={record.note} placeholder="写下今天的天气、心情或临时调整……" onChange={(event) => onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === record.day ? { ...item, note: event.target.value } : item) }))} rows={3} className="focus-ring mt-2 w-full resize-none rounded-2xl border border-ink/10 bg-white/55 px-4 py-3 font-medium leading-7 text-ink placeholder:text-ink/25" /></label>
  </section>; })}</div>;
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
    <section className="rounded-[1.5rem] border border-tower/15 bg-[#fff8ed] p-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-tower text-white"><Sparkles className="h-4 w-4" /></span><div><h5 className="font-black">结合行程的准备建议</h5><p className="text-[10px] font-bold text-ink/40">依据天气阈值与“{request.travelerType}”条件生成</p></div></div><ul className="mt-3 space-y-2">{advice.map((item) => <li key={item} className="flex gap-2 text-xs font-bold leading-5 text-ink/65"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-tower" />{item}</li>)}</ul></section>
    <HourlyWeatherChart hours={weather.hourly} />
    <section className="rounded-[1.5rem] bg-white p-4 shadow-sm"><h5 className="font-display text-lg font-black">行程期间</h5><div className="mt-3 space-y-3">{weather.daily.slice(0, Math.min(3, Math.max(1, request.days))).map((day, index) => <div key={day.date} className="grid grid-cols-[70px_1fr_auto] items-center gap-3 border-b border-ink/8 pb-3 last:border-0 last:pb-0"><div><strong className="text-xs">{index === 0 ? '今天' : `第${index + 1}天`}</strong><span className="mt-1 block text-[9px] font-bold text-ink/35">{day.date.slice(5).replace('-', '/')}</span></div><div><p className="text-xs font-black">{weatherLabel(day.code)}</p><p className="mt-1 text-[10px] font-bold text-ink/40">降雨 {day.rainProbability}% · UV {day.uv.toFixed(1)}</p></div><strong className="text-sm">{Math.round(day.min)}°–{Math.round(day.max)}°</strong></div>)}</div>{today && <div className="mt-4 grid grid-cols-2 gap-2"><MiniFact icon={Sunrise} label="日出" value={today.sunrise.slice(11, 16)} /><MiniFact icon={Sunset} label="日落" value={today.sunset.slice(11, 16)} /></div>}</section>
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
function MiniFact({ icon: Icon, label, value }: { icon: typeof Sunrise; label: string; value: string }) { return <div className="flex items-center gap-2 rounded-xl bg-ink/[0.035] p-2.5"><Icon className="h-4 w-4 text-tower" /><span className="text-[10px] font-bold text-ink/40">{label}</span><strong className="ml-auto text-xs">{value}</strong></div>; }
function weatherLabel(code: number) { if (code === 0) return '晴朗'; if (code <= 3) return '多云'; if (code <= 48) return '雾'; if (code <= 57) return '毛毛雨'; if (code <= 67) return '降雨'; if (code <= 77) return '降雪'; if (code <= 82) return '阵雨'; if (code <= 86) return '阵雪'; return '雷雨'; }
function buildWeatherAdvice(weather: WeatherData, request: TripRequest) { const advice: string[] = []; const today = weather.daily[0]; if (weather.apparentTemperature >= 33 || (today?.max ?? 0) >= 34) advice.push('防暑优先：准备饮水、电解质和遮阳帽；把长时间户外点位避开 12:00–15:00。'); if ((today?.uv ?? 0) >= 6) advice.push(`紫外线指数最高 ${today.uv.toFixed(1)}，建议 SPF30+ 防晒，并每 2–3 小时补涂。`); if ((today?.rainProbability ?? 0) >= 40 || weather.precipitation > 0) advice.push(`降雨概率最高 ${today?.rainProbability ?? 0}%，带折叠伞和防滑鞋；优先保留室内或有遮蔽点位。`); if (weather.windGusts >= 35) advice.push(`阵风约 ${Math.round(weather.windGusts)} km/h，江边和观景台减少使用自拍杆，留意临时封闭。`); if (request.travelerType === '老人' || request.specialNeeds.includes('行动不便')) advice.push('同行包含老人或行动不便需求：每 60–90 分钟安排休息，雨后减少台阶和湿滑栈道路段。'); if (request.specialNeeds.includes('带儿童')) advice.push('带儿童出行：额外准备替换衣物、驱蚊用品和少量补充能量的零食。'); if (!advice.length) advice.push('天气风险较低，按原路线执行即可；仍建议随身带水，并在出发前再次刷新天气。'); return advice.slice(0, 4); }

function Transport({ plan, request, onSimulate }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; request: TripRequest; onSimulate?: () => void }) {
  const [transport, setTransport] = useState<TransportPlanResponse | null>(null); const [loading, setLoading] = useState(true);
  const load = () => { const controller = new AbortController(); setLoading(true); resolveTransportPlan(toTransportPlanRequest(request, plan.route.points as PlannedRoutePoint[], plan.settings.departureTime), { signal: controller.signal }).then(setTransport).finally(() => setLoading(false)); return controller; };
  useEffect(() => { const controller = load(); return () => controller.abort(); }, [plan.route.points, plan.settings.departureTime, request.destinationCity, request.travelerType, request.specialNeeds]);
  const realtime = transport?.isRealtime ?? false;
  return <div className="space-y-4"><div className="flex items-end justify-between"><div><h4 className="font-display text-2xl font-black">智能交通方案</h4><p className="mt-1 text-xs font-bold text-ink/45">按当前点位、时间与同行人群自动组织每段交通。</p></div><button type="button" aria-label="重新计算交通方案" disabled={loading} onClick={() => load()} className="grid h-9 w-9 place-items-center rounded-full bg-white text-river shadow-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    <section className="overflow-hidden rounded-[1.6rem] bg-ink text-white shadow-[0_16px_38px_rgba(18,34,42,.16)]"><div className="p-4"><div className="flex items-center justify-between"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${realtime ? 'bg-jade/25 text-emerald-100' : 'bg-white/10 text-white/65'}`}>{realtime ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{transport?.sourceLabel ?? '正在计算'}</span><span className="text-[9px] font-bold text-white/40">{realtime ? '实时数据' : '非实时估算'}</span></div><p className="mt-4 text-sm font-bold leading-6 text-white/75">{transport?.summary ?? '正在根据路线生成分段交通建议……'}</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-white/8 p-3"><span className="text-[9px] font-bold text-white/40">交通总时长</span><strong className="mt-1 block font-display text-xl">{transport?.totalMinutes ?? '—'}<small className="ml-1 text-xs">分钟</small></strong></div><div className="rounded-2xl bg-white/8 p-3"><span className="text-[9px] font-bold text-white/40">估算总距离</span><strong className="mt-1 block font-display text-xl">{transport?.totalDistanceKm ?? '—'}<small className="ml-1 text-xs">km</small></strong></div></div></div><div className="border-t border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold leading-4 text-white/45">已预留 TransportPlanProvider 接口；配置后端代理地址后可无缝切换实时交通 API。</div></section>
    {transport?.segments.map((segment, index) => <article key={segment.id} className="relative rounded-[1.5rem] border border-ink/8 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-river/10 text-river">{transportIcon(segment.mode)}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-river">第 {index + 1} 段 · {segment.mode}</span><span className="rounded-full bg-ink/5 px-2 py-1 text-[9px] font-black text-ink/45">{segment.durationMinutes} 分钟</span></div><h5 className="mt-2 text-sm font-black"><span>{segment.from}</span><span className="mx-2 text-ink/25">→</span><span>{segment.to}</span></h5><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-ink/45"><span>{segment.departureTime} 出发</span><span>{segment.arrivalTime} 到达</span><span>{segment.distanceKm} km</span><span>{segment.costEstimate}</span></div><p className="mt-3 rounded-xl bg-[#f1f6f2] p-2.5 text-[11px] font-bold leading-5 text-ink/60">{segment.instruction}</p>{segment.liveStatus && <p className="mt-2 text-[10px] font-black text-jade">实时状态：{segment.liveStatus}</p>}</div></div></article>)}
    {transport?.notices.map((notice, index) => <div key={notice} className={`flex gap-2 rounded-2xl p-3 text-[11px] font-bold leading-5 ${index === 0 ? 'bg-tower/10 text-ink/65' : 'bg-ink/[0.035] text-ink/50'}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tower" />{notice}</div>)}
    <div className="grid grid-cols-2 gap-2"><a href="https://www.12306.cn/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-black shadow-sm"><TrainFront className="h-4 w-4 text-river" />铁路12306<ExternalLink className="h-3 w-3" /></a><a href="https://www.amap.com/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-xs font-black shadow-sm"><Bus className="h-4 w-4 text-river" />高德地图<ExternalLink className="h-3 w-3" /></a></div><button type="button" onClick={onSimulate} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-river px-4 py-3 font-black text-white"><RouteIcon className="h-4 w-4" />在地图上演示路线顺序</button></div>;
}

function transportIcon(mode: TransportMode) { if (mode === '步行') return <Footprints className="h-4 w-4" />; if (mode === '公共交通') return <Bus className="h-4 w-4" />; if (mode === '景区专线') return <RouteIcon className="h-4 w-4" />; return <CarFront className="h-4 w-4" />; }

const dianpingCityIds: Record<TripRequest['destinationCity'], string> = { 宜昌: '179', 武汉: '16', 恩施: '1368', 荆州: '184', 襄阳: '180', 黄石: '177' };

export function getDianpingSearchUrl(city: TripRequest['destinationCity'], name: string, area: string) {
  const primaryArea = area.split('/')[0]?.trim() ?? area.trim();
  return `https://www.dianping.com/search/keyword/${dianpingCityIds[city]}/0_${encodeURIComponent(`${name} ${primaryArea}`.trim())}`;
}

function Food({ plan }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']> }) {
  return <div className="space-y-4"><div><h4 className="font-display text-2xl font-black">餐饮建议</h4><p className="mt-1 text-xs font-bold text-ink/45">菜品为区域推荐，可前往大众点评筛选具体门店并核对营业状态。</p></div>{plan.foodRecommendations.length ? plan.foodRecommendations.map((food) => <article key={food.id} className="rounded-3xl bg-white p-4 shadow-sm"><h5 className="font-black">{food.name}</h5><p className="mt-2 text-sm font-bold text-ink/60">{food.area} · {food.priceRange}</p><div className="mt-2 flex flex-wrap gap-1">{food.tags.map((tag) => <span key={tag} className="rounded-full bg-jade/10 px-2 py-1 text-xs font-black text-jade">{tag}</span>)}</div><p className="mt-3 text-xs font-bold text-tower">营业状态：{food.businessStatus}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><a href={food.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-river">来源：{food.source.name} · 核验 {food.source.checkedAt}<ExternalLink className="h-3 w-3" /></a><a href={getDianpingSearchUrl(plan.requestSnapshot.destinationCity, food.name, food.area)} target="_blank" rel="noreferrer" aria-label={`在大众点评搜索${food.name}同类店铺`} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1eb] px-3 py-2 text-xs font-black text-[#d95028] transition hover:bg-[#ffdfd2]">大众点评 · 搜索同类店铺<ExternalLink className="h-3.5 w-3.5" /></a></div></article>) : <p className="rounded-2xl bg-white p-4 text-sm font-bold text-ink/55">当前限制条件下没有合适条目，请放宽筛选或自行核验。</p>}</div>;
}

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
function Metric({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'river' | 'tower' | 'jade' }) {
  const tones = { ink: 'border-white/15 bg-[#10272f]/95', river: 'border-white/20 bg-[#0e6b72]/95', tower: 'border-white/20 bg-[#b64a32]/95', jade: 'border-white/20 bg-[#18775e]/95' };
  return <div className={`rounded-2xl border p-3 text-white shadow-[0_12px_28px_rgba(18,34,42,.28)] backdrop-blur-sm ${tones[tone]}`}><div className="text-[10px] font-black uppercase tracking-[.12em] text-white/70">{label}</div><div className="mt-1 font-display text-lg font-black leading-tight text-white">{value}</div></div>;
}
function formatDriveDuration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = minutes % 60; return hours > 0 ? `${hours}小时${rest ? `${rest}分` : ''}` : `${rest}分钟`; }
function EditableMetric({ label, value, min, max, step = 1, prefix = '', suffix = '', onCommit }: { label: string; value: number; min: number; max: number; step?: number; prefix?: string; suffix?: string; onCommit: (value: number) => void }) { const [draft, setDraft] = useState(String(value)); useEffect(() => setDraft(String(value)), [value]); const commit = () => { const parsed = Number(draft); const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value; setDraft(String(next)); onCommit(next); }; return <label className="rounded-2xl bg-white p-4 shadow-sm transition focus-within:ring-4 focus-within:ring-jade/15"><span className="block text-xs font-black text-ink/50">{label}</span><span className="mt-2 flex items-baseline gap-1 font-display text-xl font-black text-ink">{prefix && <span>{prefix}</span>}<input aria-label={`总览${label}`} type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="focus-ring min-w-0 w-full bg-transparent font-display text-xl font-black text-ink" />{suffix && <span className="shrink-0 text-sm">{suffix}</span>}</span></label>; }

