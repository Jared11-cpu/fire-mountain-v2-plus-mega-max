import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bus, CalendarDays, CircleDollarSign, CloudSun, Copy, ExternalLink, Loader2, MapPin, Minus, Plus, RefreshCw, Sparkles, TrainFront, Utensils } from 'lucide-react';
import type { TravelPlan } from '../utils/aiGenerator';
import type { RoutePoint, SmartRoute } from '../types/route';
import { budgetTotal, type BudgetItem, type PlannedRoutePoint } from '../domain/trip';
import { useTrip } from '../state/tripStore';
import { RouteMap } from './RouteMap';

type Tab = 'overview' | 'stops' | 'days' | 'weather' | 'transport' | 'food' | 'budget';
const tabs: Array<{ id: Tab; label: string; icon: typeof MapPin }> = [
  { id: 'overview', label: '概览', icon: Sparkles }, { id: 'stops', label: '路线', icon: MapPin },
  { id: 'days', label: '行程记录', icon: CalendarDays }, { id: 'weather', label: '天气', icon: CloudSun },
  { id: 'transport', label: '交通', icon: Bus }, { id: 'food', label: '美食', icon: Utensils },
  { id: 'budget', label: '预算', icon: CircleDollarSign },
];

export function MapWorkspace({ route, plan, selectedPointId, activePointIndex, navigating, onSelectPoint, onRegenerate, onCopySocial, onSimulateNavigation }: {
  route: SmartRoute; plan: TravelPlan; selectedPointId?: string; activePointIndex: number; navigating: boolean; imageUrl: string;
  onSelectPoint: (point: RoutePoint) => void; onRegenerate?: () => void; onCopySocial?: () => void; onSimulateNavigation?: () => void;
}) {
  const { plan: tripPlan, request, isReplanning, patchPlan, updatePlanSettings, updateBudgetItems } = useTrip();
  const [tab, setTab] = useState<Tab>('overview');
  const [mobilePane, setMobilePane] = useState<'map' | 'details'>('map');
  const selected = route.points.find((point) => point.id === selectedPointId) as PlannedRoutePoint | undefined ?? route.points[0] as PlannedRoutePoint;
  if (!tripPlan) return null;

  return <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-soft">
    <div className="border-b border-ink/10 bg-ink p-2 lg:hidden" role="tablist" aria-label="移动端工作区">
      <div className="grid grid-cols-2 rounded-full bg-white/10 p-1">{(['map', 'details'] as const).map((pane) => <button key={pane} type="button" role="tab" aria-selected={mobilePane === pane} onClick={() => setMobilePane(pane)} className={`rounded-full px-4 py-2 text-sm font-black ${mobilePane === pane ? 'bg-white text-ink' : 'text-white'}`}>{pane === 'map' ? '地图' : '详情'}</button>)}</div>
    </div>
    <div className="grid lg:min-h-[760px] lg:grid-cols-[72px_minmax(0,1fr)_420px]">
      <nav className={`${mobilePane === 'details' ? 'flex' : 'hidden'} gap-2 overflow-x-auto bg-ink p-2 text-white lg:flex lg:flex-col lg:justify-center`} aria-label="方案详情标签">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} aria-label={label} onClick={() => { setTab(id); setMobilePane('details'); }} className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black lg:flex-col lg:px-2 ${tab === id ? 'bg-river text-white' : 'text-white/65 hover:bg-white/10'}`}><Icon className="h-5 w-5" /><span>{label}</span></button>)}
      </nav>

      <div className={`${mobilePane === 'map' ? 'block' : 'hidden'} relative min-h-[620px] min-w-0 overflow-hidden border-ink/10 lg:block lg:border-r`}>
        <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
          <CommandButton icon={isReplanning ? Loader2 : RefreshCw} label={isReplanning ? '计算中' : '重新规划'} disabled={isReplanning} onClick={onRegenerate} spin={isReplanning} />
          <CommandButton icon={Copy} label="复制文案" onClick={onCopySocial} />
        </div>
        <RouteMap route={route} selectedPointId={selectedPointId} activePointIndex={activePointIndex} navigating={navigating} onSelectPoint={onSelectPoint} mapOnly />
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 grid gap-2 sm:grid-cols-3"><Metric label="规则估算距离" value={`${route.totalDistanceKm.toFixed(1)} km`} /><Metric label="出发时间" value={tripPlan.settings.departureTime} /><Metric label="当前点到达" value={selected?.arrivalTime ?? selected?.time ?? '--:--'} /></div>
      </div>

      <aside className={`${mobilePane === 'details' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col bg-[#fffdf7] lg:flex`}>
        <div className="border-b border-ink/10 p-5"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-river">RULES-V1 · SAVED PLAN</div><h3 className="mt-1 font-display text-2xl font-black">{route.title}</h3><p className="mt-2 text-sm leading-6 text-ink/55">{plan.summary}</p></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'overview' && <Overview plan={tripPlan} onSettings={updatePlanSettings} />}
          {tab === 'stops' && <Stops points={route.points as PlannedRoutePoint[]} selectedId={selectedPointId} onSelect={onSelectPoint} onPatchNote={(id, note) => patchPlan((value) => ({ ...value, pointNotes: { ...value.pointNotes, [id]: note } }))} notes={tripPlan.pointNotes} />}
          {tab === 'days' && <Days plan={tripPlan} onPatch={patchPlan} />}
          {tab === 'weather' && <Weather city={request.destinationCity} lat={route.points[0]?.lat} lng={route.points[0]?.lng} />}
          {tab === 'transport' && <Transport onSimulate={onSimulateNavigation} />}
          {tab === 'food' && <Food plan={tripPlan} />}
          {tab === 'budget' && <Budget items={tripPlan.budgetItems} target={request.budget} onChange={updateBudgetItems} />}
        </div>
      </aside>
    </div>
  </section>;
}

function Overview({ plan, onSettings }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; onSettings: ReturnType<typeof useTrip>['updatePlanSettings'] }) {
  return <div className="space-y-4"><h4 className="font-display text-2xl font-black">路线总览</h4><div className="grid grid-cols-2 gap-3"><MetricCard label="点位" value={`${plan.route.points.length} 个`} /><MetricCard label="预计时长" value={`${Math.round(plan.settings.targetDurationMinutes / 60 * 10) / 10} 小时`} /><MetricCard label="预算总计" value={`¥${budgetTotal(plan.budgetItems)}`} /><MetricCard label="出发日期" value={plan.requestSnapshot.startDate} /></div><div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm"><NumberField label="目标点位数" value={plan.settings.targetPointCount} min={2} max={plan.route.points.length} onChange={(value) => onSettings({ targetPointCount: value })} /><NumberField label="目标时长（分钟）" value={plan.settings.targetDurationMinutes} min={60} max={1440} onChange={(value) => onSettings({ targetDurationMinutes: value })} /><label className="block text-xs font-black text-ink/60">出发时间<input type="time" value={plan.settings.departureTime} onChange={(event) => onSettings({ departureTime: event.target.value })} className="focus-ring mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 text-sm" /></label></div><p className="rounded-2xl bg-jade/10 p-3 text-xs font-bold leading-5 text-ink/60">时间线根据出发时间、停留时长和点间交通顺序计算；跨区路段采用单独覆写，不作为实时路况。</p></div>;
}

function Stops({ points, selectedId, onSelect, notes, onPatchNote }: { points: PlannedRoutePoint[]; selectedId?: string; onSelect: (point: RoutePoint) => void; notes: Record<string, string>; onPatchNote: (id: string, note: string) => void }) {
  return <div className="space-y-3"><h4 className="font-display text-2xl font-black">文字版真实路线</h4><p className="text-xs font-bold text-ink/50">地图不可用时，可按以下日期、到达时间和交通时长执行。</p>{points.map((point, index) => <div key={point.id} className={`rounded-3xl border p-4 ${selectedId === point.id ? 'border-river bg-river/5' : 'border-ink/10 bg-white'}`}><button type="button" onClick={() => onSelect(point)} className="w-full text-left"><div className="flex items-center justify-between"><strong>{index + 1}. {point.name}</strong><span className="rounded-full bg-ink px-2 py-1 text-xs font-black text-white">第{point.day ?? 1}天 {point.arrivalTime}</span></div><p className="mt-2 text-xs font-bold text-ink/55">停留 {point.durationMinutes} 分钟 · 前往下一站 {point.travelMinutesToNext || 0} 分钟</p></button><label className="mt-3 block text-xs font-black text-ink/55">点位备注<textarea value={notes[point.id] ?? ''} onChange={(event) => onPatchNote(point.id, event.target.value)} rows={2} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 font-medium" /></label></div>)}</div>;
}

function Days({ plan, onPatch }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']>; onPatch: ReturnType<typeof useTrip>['patchPlan'] }) {
  return <div className="space-y-4"><h4 className="font-display text-2xl font-black">每日记录</h4>{plan.dailyRecords.map((record) => { const points = plan.route.points.filter((point) => (point.day ?? 1) === record.day) as PlannedRoutePoint[]; return <section key={record.day} className="rounded-3xl bg-white p-4 shadow-sm"><div className="font-black">第{record.day}天 · {record.date}</div><div className="mt-3 space-y-2">{points.map((point) => <label key={point.id} className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={record.checkedPointIds.includes(point.id)} onChange={() => onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === record.day ? { ...item, checkedPointIds: item.checkedPointIds.includes(point.id) ? item.checkedPointIds.filter((id) => id !== point.id) : [...item.checkedPointIds, point.id] } : item) }))} />{point.arrivalTime} {point.name}</label>)}</div><label className="mt-3 block text-xs font-black text-ink/55">当日备注<textarea value={record.note} onChange={(event) => onPatch((value) => ({ ...value, dailyRecords: value.dailyRecords.map((item) => item.day === record.day ? { ...item, note: event.target.value } : item) }))} rows={3} className="focus-ring mt-1 w-full rounded-xl border border-ink/10 px-3 py-2 font-medium" /></label></section>; })}</div>;
}

type WeatherData = { temperature: number; code: number; fetchedAt: string; state: '实时' | '30分钟缓存' | '演示降级'; reason?: string };
function Weather({ city, lat, lng }: { city: string; lat?: number; lng?: number }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  useEffect(() => { let alive = true; const key = `weather-v1-${city}`; const cached = localStorage.getItem(key); if (cached) { try { const value = JSON.parse(cached) as WeatherData; if (Date.now() - new Date(value.fetchedAt).getTime() < 1800000) { setWeather({ ...value, state: '30分钟缓存' }); return; } } catch { /* ignore invalid cache */ } } if (!lat || !lng) { setWeather({ temperature: 24, code: 0, fetchedAt: new Date().toISOString(), state: '演示降级', reason: '路线缺少经纬度，未发起天气请求。' }); return; } fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }).then((data) => { const value: WeatherData = { temperature: data.current.temperature_2m, code: data.current.weather_code, fetchedAt: new Date().toISOString(), state: '实时' }; localStorage.setItem(key, JSON.stringify(value)); if (alive) setWeather(value); }).catch((error) => alive && setWeather({ temperature: 24, code: 0, fetchedAt: new Date().toISOString(), state: '演示降级', reason: `Open‑Meteo 请求失败：${error instanceof Error ? error.message : '未知错误'}。显示值不可用于出行决策。` })); return () => { alive = false; }; }, [city, lat, lng]);
  return <div className="space-y-4"><h4 className="font-display text-2xl font-black">天气透明度</h4><div className="rounded-3xl bg-river p-5 text-white"><div className="text-sm font-black">{city} · {weather?.state ?? '请求中'}</div><div className="mt-3 text-5xl font-black">{weather ? `${weather.temperature}°` : '—'}</div><div className="mt-4 space-y-1 text-xs font-bold text-white/80"><p>数据源：<a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open‑Meteo</a></p><p>更新时间：{weather ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(weather.fetchedAt)) : '正在请求'}</p><p>时区：Asia/Shanghai（UTC+8）</p>{weather?.reason && <p className="mt-2 rounded-xl bg-white/15 p-2">{weather.reason}</p>}</div></div></div>;
}

function Transport({ onSimulate }: { onSimulate?: () => void }) { return <div className="space-y-4"><h4 className="font-display text-2xl font-black">交通查询</h4><div className="rounded-3xl border border-tower/20 bg-tower/10 p-4 text-sm font-bold leading-6"><AlertTriangle className="mb-2 h-5 w-5 text-tower" />本页不提供实时班次。以下仅为“示例数据”，请在出发前通过官方渠道核验。</div><a href="https://www.12306.cn/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-white p-4 font-black shadow-sm"><span className="flex items-center gap-2"><TrainFront className="h-5 w-5 text-river" />铁路12306 官方查询</span><ExternalLink className="h-4 w-4" /></a><a href="https://www.amap.com/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-white p-4 font-black shadow-sm"><span className="flex items-center gap-2"><Bus className="h-5 w-5 text-river" />高德地图路线查询</span><ExternalLink className="h-4 w-4" /></a><button type="button" onClick={onSimulate} className="w-full rounded-2xl bg-ink px-4 py-3 font-black text-white">演示路线顺序</button></div>; }

function Food({ plan }: { plan: NonNullable<ReturnType<typeof useTrip>['plan']> }) { return <div className="space-y-4"><h4 className="font-display text-2xl font-black">餐饮建议</h4>{plan.foodRecommendations.length ? plan.foodRecommendations.map((food) => <article key={food.id} className="rounded-3xl bg-white p-4 shadow-sm"><h5 className="font-black">{food.name}</h5><p className="mt-2 text-sm font-bold text-ink/60">{food.area} · {food.priceRange}</p><div className="mt-2 flex flex-wrap gap-1">{food.tags.map((tag) => <span key={tag} className="rounded-full bg-jade/10 px-2 py-1 text-xs font-black text-jade">{tag}</span>)}</div><p className="mt-3 text-xs font-bold text-tower">营业状态：{food.businessStatus}</p><a href={food.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-river">来源：{food.source.name} · 核验 {food.source.checkedAt}<ExternalLink className="h-3 w-3" /></a></article>) : <p className="rounded-2xl bg-white p-4 text-sm font-bold text-ink/55">当前限制条件下没有合适条目，请放宽筛选或自行核验。</p>}</div>; }

function Budget({ items, target, onChange }: { items: BudgetItem[]; target: number; onChange: (items: BudgetItem[]) => void }) {
  const total = budgetTotal(items); return <div className="space-y-4"><div className="flex items-end justify-between"><div><h4 className="font-display text-2xl font-black">预算明细</h4><p className="text-xs font-bold text-ink/50">统一状态自动保存</p></div><strong className={total > target ? 'text-red-600' : 'text-jade'}>¥{total} / ¥{target}</strong></div>{items.map((item) => <div key={item.id} className="grid grid-cols-[1fr_88px_36px] gap-2 rounded-2xl bg-white p-3 shadow-sm"><label className="text-xs font-black text-ink/55">项目<input value={item.item} onChange={(event) => onChange(items.map((value) => value.id === item.id ? { ...value, item: event.target.value } : value))} className="focus-ring mt-1 w-full rounded-lg border border-ink/10 px-2 py-2 text-sm text-ink" /></label><label className="text-xs font-black text-ink/55">金额<input type="number" min={0} value={item.amount} onChange={(event) => onChange(items.map((value) => value.id === item.id ? { ...value, amount: Number(event.target.value) } : value))} className="focus-ring mt-1 w-full rounded-lg border border-ink/10 px-2 py-2 text-sm text-ink" /></label><button type="button" aria-label={`删除${item.item}`} onClick={() => onChange(items.filter((value) => value.id !== item.id))} className="mt-5 grid h-9 place-items-center rounded-lg bg-red-50 text-red-600"><Minus className="h-4 w-4" /></button></div>)}<button type="button" onClick={() => onChange([...items, { id: `budget-${crypto.randomUUID()}`, item: '新条目', amount: 0, note: '' }])} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-river/40 px-4 py-3 font-black text-river"><Plus className="h-4 w-4" />新增预算条目</button></div>;
}

function CommandButton({ icon: Icon, label, onClick, disabled, spin }: { icon: typeof RefreshCw; label: string; onClick?: () => void; disabled?: boolean; spin?: boolean }) { return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-black text-ink shadow-soft backdrop-blur disabled:opacity-60"><Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />{label}</button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-ink/88 p-3 text-white shadow-soft backdrop-blur"><div className="text-[10px] font-black uppercase tracking-wider text-white/55">{label}</div><div className="mt-1 font-black">{value}</div></div>; }
function MetricCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white p-4 shadow-sm"><div className="text-xs font-black text-ink/50">{label}</div><div className="mt-1 font-display text-xl font-black">{value}</div></div>; }
function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) { return <label className="block text-xs font-black text-ink/60">{label}<input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} className="focus-ring mt-2 w-full rounded-xl border border-ink/10 px-3 py-2 text-sm" /></label>; }
