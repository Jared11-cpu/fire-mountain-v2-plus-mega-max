import { useEffect, useState } from 'react';
import { CircleDollarSign, AlertTriangle, Bus, CalendarDays, Camera, Check, CheckCircle2, ChevronRight, Clock3, CloudSun, Copy, ExternalLink, MapPin, Minus, PencilLine, Plus, RefreshCw, Sparkles, TrainFront, Umbrella, Utensils, Wind, X } from 'lucide-react';
import type { TravelPlan } from '../utils/aiGenerator';
import type { RoutePoint, SmartRoute } from '../types/route';
import { RouteMap } from './RouteMap';
import { getPointTypeLabel } from '../services/mapService';

type Tab = 'overview' | 'stops' | 'days' | 'records' | 'weather' | 'transport' | 'food' | 'budget';

const tabs: Array<{ id: Tab; label: string; short: string; icon: typeof MapPin }> = [
  { id: 'overview', label: '概览', short: 'AI', icon: Sparkles },
  { id: 'stops', label: '路线', short: '线', icon: MapPin },
  { id: 'days', label: '日程', short: '日', icon: Clock3 },
  { id: 'records', label: '记录', short: '记', icon: CalendarDays },
  { id: 'weather', label: '天气', short: '天', icon: CloudSun },
  { id: 'transport', label: '交通', short: '车', icon: Bus },
  { id: 'food', label: '美食', short: '食', icon: Utensils },
  { id: 'budget', label: '预算', short: '¥', icon: CircleDollarSign },
];

export function MapWorkspace({ route, plan, selectedPointId, activePointIndex, navigating, imageUrl, onSelectPoint, onRegenerate, onCopySocial, onSimulateNavigation }: {
  route: SmartRoute;
  plan: TravelPlan;
  selectedPointId?: string;
  activePointIndex: number;
  navigating: boolean;
  imageUrl: string;
  onSelectPoint: (point: RoutePoint) => void;
  onRegenerate?: () => void;
  onCopySocial?: () => void;
  onSimulateNavigation?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const selected = route.points.find((point) => point.id === selectedPointId) ?? route.points[0];

  return (
    <section className="map-workspace overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-soft">
      <div className="grid lg:h-[calc(100vh-7rem)] lg:min-h-[720px] lg:grid-cols-[68px_minmax(0,1fr)_410px]">
        <nav className="flex gap-2 overflow-x-auto bg-ink px-2.5 py-3 text-white lg:flex-col lg:justify-center lg:overflow-visible">
          <div className="flex gap-2 lg:flex-col">
            {tabs.map((item) => (
              <SidebarTab
                key={item.id}
                active={tab === item.id}
                icon={item.icon}
                short={item.short}
                label={item.label}
                onClick={() => setTab(item.id)}
              />
            ))}
          </div>
        </nav>

        <div className="relative min-h-[68vh] min-w-0 overflow-hidden border-ink/10 lg:border-r">
          <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
            <CommandButton icon={RefreshCw} label="重新规划" onClick={onRegenerate} />
            <CommandButton icon={Copy} label="复制文案" onClick={onCopySocial} />
          </div>
          <div className="h-full min-w-0">
            <RouteMap route={route} selectedPointId={selectedPointId} activePointIndex={activePointIndex} navigating={navigating} onSelectPoint={onSelectPoint} mapOnly />
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 right-5 z-20 grid gap-3 md:grid-cols-3">
            <Metric label="路线距离" value={`${route.totalDistanceKm}km`} />
            <Metric label="建议出发" value={route.recommendedStartTime} />
            <Metric label="到达时间" value={selected?.time ?? route.recommendedStartTime} />
          </div>
        </div>

        <aside className="flex min-h-0 min-w-0 flex-col bg-[#fffdf7]">
          <div className="border-b border-ink/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-river">Interactive Itinerary</div>
            <h3 className="mt-1 font-display text-2xl font-black text-ink">{route.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/50">{plan.summary}</p>
          </div>
          <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'overview' && <OverviewPanel route={route} plan={plan} selected={selected} />}
            {tab === 'stops' && <StopsPanel route={route} selectedPointId={selectedPointId} imageUrl={imageUrl} onSelectPoint={onSelectPoint} />}
            {tab === 'days' && <DaysPanel plan={plan} />}
            {tab === 'records' && <DailyRecordPanel route={route} plan={plan} onSelectPoint={onSelectPoint} />}
            {tab === 'weather' && <WeatherWarningPanel route={route} />}
            {tab === 'transport' && <TransportPanel city={route.city} items={plan.transport} />}
            {tab === 'food' && <FoodPanel route={route} plan={plan} />}
            {tab === 'budget' && <BudgetPanel plan={plan} />}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SidebarTab({ active, onClick, icon: Icon, short, label }: { active: boolean; onClick: () => void; icon: typeof MapPin; short: string; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative flex h-12 min-w-12 items-center justify-center rounded-2xl text-sm font-black transition active:scale-95 lg:w-12 ${
        active ? 'bg-river text-white shadow-[0_8px_22px_rgba(14,107,114,.35)]' : 'bg-transparent text-white/42 hover:bg-white/8 hover:text-white'
      }`}
    >
      <Icon className="hidden h-5 w-5 lg:block" strokeWidth={active ? 2.5 : 1.9} />
      <span className="lg:hidden">{short}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function CommandButton({ icon: Icon, label, onClick, disabled = false }: { icon: typeof MapPin; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick || disabled}
      className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/92 px-4 py-2 text-sm font-black text-ink shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:bg-ink hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
      <div className="text-xs font-bold text-ink/45">{label}</div>
      <div className="mt-1 font-display text-2xl font-black text-ink">{value}</div>
    </div>
  );
}

function SideTitle({eyebrow,title,desc}:{eyebrow:string;title:string;desc:string}) { return <header className="mb-4"><div className="text-[10px] font-black tracking-[.2em] text-tower">{eyebrow}</div><h3 className="mt-1 font-display text-2xl font-black">{title}</h3><p className="mt-1 text-sm text-ink/45">{desc}</p></header> }
function InfoList({title,icon:Icon,items}:{title:string;icon:typeof MapPin;items:string[]}) { return <div><SideTitle eyebrow="LOCAL GUIDE" title={title} desc="根据路线顺序整理的实用建议。"/><div className="space-y-3">{items.map((item,index)=><div key={item} className="rounded-2xl border border-ink/8 bg-white p-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-river/10 text-river"><Icon className="h-4 w-4"/></span><div><div className="text-xs font-black text-tower">推荐 {String(index+1).padStart(2,'0')}</div><p className="mt-1 text-sm font-semibold leading-6 text-ink/65">{item}</p></div></div></div>)}</div></div> }

function OverviewPanel({ route, plan, selected }: { route: SmartRoute; plan: TravelPlan; selected?: RoutePoint }) {
  const [editableStats, setEditableStats] = useState(() => ({
    points: String(route.points.length),
    duration: route.estimatedTime,
    budget: String(budgetTotal(plan)),
    navigation: route.recommendedStartTime,
  }));

  useEffect(() => {
    setEditableStats({
      points: String(route.points.length),
      duration: route.estimatedTime,
      budget: String(budgetTotal(plan)),
      navigation: route.recommendedStartTime,
    });
  }, [route.id, plan.title]);

  return (
    <div>
      <SideTitle eyebrow="AI TRIP BRIEF" title="路线总览" desc="AI 给出初始建议，你可以直接修改以下内容。" />
      <div className="grid grid-cols-2 gap-3">
        <EditableMiniStat label="点位" value={editableStats.points} suffix="个" inputMode="numeric" onChange={(points) => setEditableStats((prev) => ({ ...prev, points }))} />
        <EditableMiniStat label="耗时" value={editableStats.duration} onChange={(duration) => setEditableStats((prev) => ({ ...prev, duration }))} />
        <EditableMiniStat label="预算" value={editableStats.budget} prefix="¥" inputMode="numeric" onChange={(budget) => setEditableStats((prev) => ({ ...prev, budget }))} />
        <EditableMiniStat label="导航" value={editableStats.navigation} onChange={(navigation) => setEditableStats((prev) => ({ ...prev, navigation }))} />
      </div>
      {selected && (
        <button className="mt-4 w-full rounded-2xl border border-river/20 bg-river/5 p-4 text-left">
          <div className="text-xs font-black tracking-[0.16em] text-river">CURRENT STOP</div>
          <h4 className="mt-2 font-display text-2xl font-black text-ink">{selected.name}</h4>
          <p className="mt-2 text-sm leading-6 text-ink/58">{selected.reason}</p>
        </button>
      )}
      <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
        <div className="text-xs font-black tracking-[0.16em] text-jade">沿途 AI 观察</div>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/78">{route.sceneryAnalysis.highlights.slice(0, 2).join('；')}</p>
        <p className="mt-3 text-sm leading-6 text-white/58">{route.sceneryAnalysis.socialCopy}</p>
      </div>
    </div>
  );
}

type PointArrangement = {
  date: string;
  time: string;
  stayMinutes: number;
  included: boolean;
  note: string;
};

function StopsPanel({ route, selectedPointId, imageUrl, onSelectPoint }: { route: SmartRoute; selectedPointId?: string; imageUrl: string; onSelectPoint: (point: RoutePoint) => void }) {
  const [detailPoint, setDetailPoint] = useState<RoutePoint | null>(null);
  const [arrangements, setArrangements] = useState<Record<string, PointArrangement>>({});
  const selectedArrangement = detailPoint ? arrangements[detailPoint.id] ?? makeDefaultArrangement(detailPoint) : null;

  const openDetail = (point: RoutePoint) => {
    onSelectPoint(point);
    setDetailPoint(point);
    setArrangements((prev) => prev[point.id] ? prev : { ...prev, [point.id]: makeDefaultArrangement(point) });
  };

  const updateArrangement = (point: RoutePoint, patch: Partial<PointArrangement>) => {
    setArrangements((prev) => ({ ...prev, [point.id]: { ...(prev[point.id] ?? makeDefaultArrangement(point)), ...patch } }));
  };

  return (
    <div>
      <SideTitle eyebrow="ROUTE STOPS" title="沿路景点与记录点" desc="点击点位后，地图 Marker 和详情同步高亮。" />
      <div className="space-y-3">{route.points.map((point,index)=>{
        const arranged = arrangements[point.id]?.included;
        return <button key={point.id} onClick={()=>openDetail(point)} className={`group w-full overflow-hidden rounded-2xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg ${point.id===selectedPointId?'border-tower ring-2 ring-tower/15':'border-ink/8'}`}><div className="relative h-32 overflow-hidden bg-ink/10"><RealPlaceImage query={`${point.city} ${point.name}`} fallback={point.imageUrl||imageUrl} alt={`${point.name}真实照片`} /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10"/><span className="absolute left-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-tower text-xs font-black text-white">{index+1}</span>{arranged&&<span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-jade px-2 py-1 text-[10px] font-black text-ink"><Check className="h-3 w-3"/>已安排</span>}<div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white"><div><div className="text-xs font-bold text-white/70">{point.time} · 停留 {point.stayMinutes} 分钟</div><div className="font-display text-xl font-black">{point.name}</div></div><ChevronRight className="h-5 w-5 transition group-hover:translate-x-1"/></div></div><div className="p-3"><p className="line-clamp-2 text-sm leading-6 text-ink/65">{point.reason}</p><div className="mt-2 flex items-start gap-2 text-xs font-bold leading-5 text-river"><Camera className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{point.photoTip}</div><div className="mt-3 inline-flex rounded-full bg-mist px-3 py-1 text-xs font-black text-ink/55">查看详情 / 自行安排</div></div></button>;
      })}</div>

      {detailPoint && selectedArrangement && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/35 p-3 backdrop-blur-sm md:place-items-center md:p-6" onClick={() => setDetailPoint(null)}>
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.5rem] bg-[#fffdf7] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="relative h-48 overflow-hidden bg-ink/10">
              <RealPlaceImage query={`${detailPoint.city} ${detailPoint.name}`} fallback={detailPoint.imageUrl||imageUrl} alt={`${detailPoint.name}实景详情`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
              <button onClick={() => setDetailPoint(null)} className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow-lg transition hover:bg-ink hover:text-white active:scale-95" aria-label="关闭详情">
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-jade">{getPointTypeLabel(detailPoint.type)} · {detailPoint.city}</div>
                <h3 className="mt-1 font-display text-3xl font-black">{detailPoint.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                  <span className="rounded-full bg-white/18 px-3 py-1">{detailPoint.time}</span>
                  <span className="rounded-full bg-white/18 px-3 py-1">建议 {detailPoint.stayMinutes} 分钟</span>
                  <span className="rounded-full bg-white/18 px-3 py-1">{detailPoint.openingHours ?? '开放时间以景区公告为准'}</span>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <DetailInfo title="地点简介" text={placeIntroduction(detailPoint)} />
                <DetailInfo title="开放与停留" text={`${detailPoint.openingHours ?? '开放时间以场馆或景区公告为准'}；建议停留约 ${detailPoint.stayMinutes} 分钟。`} />
                <DetailInfo title="交通与到达" text={`${transportModeLabel(detailPoint.transportMode)}；坐标 ${detailPoint.lat.toFixed(4)}, ${detailPoint.lng.toFixed(4)}。出发前建议在地图中确认实时路况与入口。`} />
                <DetailInfo title="费用与提示" text={`参考费用约 ¥${detailPoint.estimatedCost ?? (detailPoint.type === 'food' ? 50 : 0)}。票价、预约与开放政策可能调整，请以地点官方信息为准。`} />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <a href={amapPlaceUrl(detailPoint)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-river px-4 py-3 text-sm font-black text-white transition hover:bg-ink active:scale-95">
                  在高德地图查看<ExternalLink className="h-4 w-4" />
                </a>
                <a href={placeResearchUrl(detailPoint)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-black text-ink transition hover:border-river/25 hover:text-river active:scale-95">
                  搜索官方与百科资料<ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-river/15 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black tracking-[0.16em] text-river">MY PLAN</div>
                    <h4 className="font-display text-xl font-black">我的自定义安排</h4>
                  </div>
                  <button
                    onClick={() => updateArrangement(detailPoint, { included: !selectedArrangement.included })}
                    className={`rounded-full px-4 py-2 text-xs font-black transition active:scale-95 ${selectedArrangement.included ? 'bg-jade text-ink' : 'bg-ink text-white'}`}
                  >
                    {selectedArrangement.included ? '已加入' : '加入行程'}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-black text-ink/45">日期</span>
                    <input type="date" value={selectedArrangement.date} onChange={(event) => updateArrangement(detailPoint, { date: event.target.value })} className="focus-ring w-full rounded-xl border border-ink/8 bg-mist px-3 py-3 text-sm font-bold" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-black text-ink/45">到达时间</span>
                    <input type="time" value={selectedArrangement.time} onChange={(event) => updateArrangement(detailPoint, { time: event.target.value })} className="focus-ring w-full rounded-xl border border-ink/8 bg-mist px-3 py-3 text-sm font-bold" />
                  </label>
                </div>
                <div className="mt-3 rounded-xl bg-mist p-3">
                  <div className="mb-2 text-xs font-black text-ink/45">停留时长</div>
                  <div className="flex items-center justify-between">
                    <button onClick={() => updateArrangement(detailPoint, { stayMinutes: Math.max(15, selectedArrangement.stayMinutes - 15) })} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-sm active:scale-95" aria-label="减少停留时间"><Minus className="h-4 w-4" /></button>
                    <div className="font-display text-3xl font-black">{selectedArrangement.stayMinutes}<span className="ml-1 text-sm font-bold text-ink/45">分钟</span></div>
                    <button onClick={() => updateArrangement(detailPoint, { stayMinutes: Math.min(240, selectedArrangement.stayMinutes + 15) })} className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-sm active:scale-95" aria-label="增加停留时间"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-black text-ink/45">个人备注</span>
                  <textarea value={selectedArrangement.note} onChange={(event) => updateArrangement(detailPoint, { note: event.target.value })} placeholder="例如：想拍大坝全景、预留讲解时间、给朋友买伴手礼..." className="focus-ring min-h-24 w-full resize-none rounded-xl border border-ink/8 bg-mist px-3 py-3 text-sm leading-6" />
                </label>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function makeDefaultArrangement(point: RoutePoint): PointArrangement {
  return { date: toInputDate(new Date()), time: point.time, stayMinutes: point.stayMinutes, included: true, note: '' };
}

function DetailInfo({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/6">
      <div className="text-xs font-black tracking-[0.12em] text-tower">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-ink/62">{text}</p>
    </div>
  );
}

function DaysPanel({ plan }: { plan: TravelPlan }) {
  return <div><SideTitle eyebrow="DAY BY DAY" title="每日行程安排" desc="把时间、地点和停留逻辑放在同一条时间线上。"/>{plan.days.map(day=><div key={day.day} className="mb-5"><div className="sticky top-0 z-10 mb-2 rounded-xl bg-ink px-3 py-2 text-white"><b>{day.day}</b><span className="ml-2 text-xs text-white/60">{day.theme}</span></div>{day.items.map(item=><div key={`${day.day}-${item.time}`} className="relative ml-3 border-l border-river/25 py-3 pl-5 before:absolute before:-left-1.5 before:top-5 before:h-3 before:w-3 before:rounded-full before:bg-river"><div className="text-xs font-black text-tower">{item.time}</div><div className="font-black">{item.place}</div><p className="mt-1 text-sm leading-6 text-ink/55">{item.reason}</p></div>)}</div>)}</div>;
}

function DailyRecordPanel({ route, plan, onSelectPoint }: { route: SmartRoute; plan: TravelPlan; onSelectPoint: (point: RoutePoint) => void }) {
  const [startDate, setStartDate] = useState(() => toInputDate(new Date()));
  const [endDate, setEndDate] = useState(() => toInputDate(addDays(new Date(), Math.max(0, plan.days.length - 1))));
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    setEndDate(toInputDate(addDays(parseInputDate(startDate), Math.max(0, plan.days.length - 1))));
  }, [plan.days.length, startDate]);

  const togglePoint = (point: RoutePoint) => {
    setChecked((prev) => ({ ...prev, [point.id]: !prev[point.id] }));
    onSelectPoint(point);
  };
  const dayCount = Math.max(1, plan.days.length);
  const rangeText = `${formatMonthDay(startDate)} - ${formatMonthDay(endDate)}`;
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div>
      <SideTitle eyebrow="DAILY CHECK-IN" title="每日记录与打卡" desc="自定义旅行日期，把路线点变成可勾选的现场记录。" />
      <div className="rounded-2xl bg-ink p-4 text-white">
        <div className="text-xs font-black tracking-[0.18em] text-jade">TRAVEL DATE</div>
        <div className="mt-2 font-display text-3xl font-black">{rangeText}</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DateField label="开始" value={startDate} onChange={setStartDate} />
          <DateField label="结束" value={endDate} onChange={setEndDate} />
        </div>
        <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white/70">{doneCount} 个点已打卡 · 共 {route.points.length} 个路线点</div>
      </div>

      <div className="mt-4 space-y-4">
        {Array.from({ length: dayCount }, (_, index) => {
          const day = index + 1;
          const date = addDays(parseInputDate(startDate), index);
          const points = route.points.filter((point) => (point.day ?? 1) === day || (day === 1 && point.type === 'start'));
          return (
            <section key={day} className="rounded-2xl border border-ink/8 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-tower">Day {day}</div>
                  <h4 className="font-display text-xl font-black text-ink">{formatMonthDay(toInputDate(date))}</h4>
                </div>
                <span className="rounded-full bg-river/10 px-3 py-1 text-xs font-black text-river">{points.filter((point) => checked[point.id]).length}/{points.length} 打卡</span>
              </div>
              <div className="mt-3 space-y-2">
                {points.map((point) => (
                  <button
                    key={point.id}
                    onClick={() => togglePoint(point)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.99] ${
                      checked[point.id] ? 'bg-jade/12 text-ink ring-1 ring-jade/25' : 'bg-mist text-ink/62 hover:bg-river/8'
                    }`}
                  >
                    <CheckCircle2 className={`h-5 w-5 shrink-0 ${checked[point.id] ? 'text-jade' : 'text-ink/25'}`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{point.time} · {point.name}</div>
                      <div className="mt-0.5 truncate text-xs font-semibold text-ink/45">{point.photoTip}</div>
                    </div>
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="mb-2 flex items-center gap-1 text-xs font-black text-ink/42"><PencilLine className="h-3.5 w-3.5" />今日自定义记录</span>
                <textarea
                  value={notes[day] ?? ''}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [day]: event.target.value }))}
                  placeholder="写下当天最值得记录的风景、花费、心情或短视频镜头..."
                  className="focus-ring min-h-20 w-full resize-none rounded-xl border border-ink/8 bg-[#fffdf7] px-3 py-2 text-sm leading-6"
                />
              </label>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-xl bg-white/10 px-3 py-2">
      <span className="block text-[10px] font-black text-white/45">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none [color-scheme:dark]" />
    </label>
  );
}

type WeatherState = {
  status: 'loading' | 'ready' | 'fallback';
  temperature: number;
  windSpeed: number;
  rainProbability: number;
  weatherCode: number;
  updatedAt: string;
  alerts: string[];
};

function WeatherWarningPanel({ route }: { route: SmartRoute }) {
  const [weather, setWeather] = useState<WeatherState>(() => makeFallbackWeather(route.city, 'loading'));

  const refreshWeather = async () => {
    setWeather((prev) => ({ ...prev, status: 'loading' }));
    try {
      const point = route.startPoint ?? route.points[0];
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lng}&current=temperature_2m,weather_code,wind_speed_10m&hourly=precipitation_probability,wind_speed_10m,weather_code&forecast_days=1&timezone=auto`);
      if (!response.ok) throw new Error('weather request failed');
      const data = await response.json();
      const rainProbability = Math.max(...(data.hourly?.precipitation_probability?.slice(0, 8) ?? [0]));
      const maxWind = Math.max(...(data.hourly?.wind_speed_10m?.slice(0, 8) ?? [data.current?.wind_speed_10m ?? 0]));
      const temperature = Math.round(data.current?.temperature_2m ?? 24);
      const windSpeed = Math.round(maxWind);
      const weatherCode = Number(data.current?.weather_code ?? 0);
      setWeather({
        status: 'ready',
        temperature,
        windSpeed,
        rainProbability,
        weatherCode,
        updatedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        alerts: buildWeatherAlerts({ rainProbability, windSpeed, temperature, weatherCode }, route.city),
      });
    } catch {
      setWeather(makeFallbackWeather(route.city, 'fallback'));
    }
  };

  useEffect(() => {
    refreshWeather();
    const timer = window.setInterval(refreshWeather, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [route.id]);

  const level = weather.alerts.length > 1 ? '注意' : weather.rainProbability >= 50 || weather.windSpeed >= 30 ? '关注' : '适宜';

  return (
    <div>
      <SideTitle eyebrow="LIVE WEATHER" title="天气预警" desc="根据路线起点实时更新，自动给出拍照、出行和安全建议。" />
      <div className="rounded-2xl bg-ink p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-jade">{route.city} · {weather.status === 'loading' ? '更新中' : `更新 ${weather.updatedAt}`}</div>
            <div className="mt-2 font-display text-5xl font-black">{weather.temperature}°C</div>
            <div className="mt-1 text-sm font-bold text-white/60">{weatherText(weather.weatherCode)} · 风速 {weather.windSpeed} km/h</div>
          </div>
          <span className={`rounded-full px-3 py-2 text-xs font-black ${level === '适宜' ? 'bg-jade text-ink' : 'bg-tower text-white'}`}>{level}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <WeatherMetric icon={Umbrella} label="降雨概率" value={`${weather.rainProbability}%`} />
          <WeatherMetric icon={Wind} label="最大风速" value={`${weather.windSpeed} km/h`} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {weather.alerts.map((alert) => (
          <div key={alert} className="rounded-2xl border border-ink/8 bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-tower/10 text-tower"><AlertTriangle className="h-4 w-4" /></span>
              <p className="text-sm font-semibold leading-6 text-ink/68">{alert}</p>
            </div>
          </div>
        ))}
      </div>
      <button onClick={refreshWeather} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-river px-4 py-3 text-sm font-black text-white transition hover:bg-ink active:scale-95">
        <RefreshCw className="h-4 w-4" />
        立即刷新天气
      </button>
    </div>
  );
}

function WeatherMetric({ icon: Icon, label, value }: { icon: typeof CloudSun; label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 p-3"><Icon className="h-4 w-4 text-jade" /><div className="mt-2 text-xs text-white/45">{label}</div><div className="font-display text-xl font-black">{value}</div></div>;
}

function makeFallbackWeather(city: string, status: WeatherState['status']): WeatherState {
  const presets: Record<string, { temperature: number; windSpeed: number; rainProbability: number; weatherCode: number }> = {
    宜昌: { temperature: 29, windSpeed: 14, rainProbability: 35, weatherCode: 2 },
    武汉: { temperature: 31, windSpeed: 12, rainProbability: 28, weatherCode: 1 },
    恩施: { temperature: 24, windSpeed: 10, rainProbability: 48, weatherCode: 3 },
    荆州: { temperature: 30, windSpeed: 16, rainProbability: 32, weatherCode: 2 },
    襄阳: { temperature: 29, windSpeed: 18, rainProbability: 25, weatherCode: 1 },
    黄石: { temperature: 30, windSpeed: 13, rainProbability: 30, weatherCode: 2 },
  };
  const preset = presets[city] ?? presets.宜昌;
  return {
    status,
    ...preset,
    updatedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    alerts: buildWeatherAlerts(preset, city),
  };
}

function buildWeatherAlerts(weather: { rainProbability: number; windSpeed: number; temperature: number; weatherCode: number }, city: string) {
  const alerts = [];
  if (weather.rainProbability >= 60 || [61, 63, 65, 80, 81, 82, 95].includes(weather.weatherCode)) {
    alerts.push(`${city}未来数小时有明显降雨风险，建议把峡谷、江滩、古城墙等户外点位前移，带伞并避开湿滑台阶。`);
  } else if (weather.rainProbability >= 35) {
    alerts.push(`${city}有阵雨可能，拍照点建议优先安排在上午或雨停后，保留室内博物馆/咖啡店备选。`);
  } else {
    alerts.push(`${city}当前天气总体适宜出行，户外路线可正常推进，傍晚适合拍江景和城市灯光。`);
  }
  if (weather.windSpeed >= 30) {
    alerts.push('风速偏高，江边、山顶和观景平台拍摄时注意固定手机和三脚架，避免临水边缘停留过久。');
  }
  if (weather.temperature >= 33) {
    alerts.push('体感温度偏高，建议避开 12:00-15:00 暴晒时段，把美食、交通换乘和室内讲解放到中午。');
  }
  return alerts;
}

function weatherText(code: number) {
  if ([0].includes(code)) return '晴';
  if ([1, 2].includes(code)) return '多云';
  if ([3, 45, 48].includes(code)) return '阴/雾';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '降雨';
  if ([95, 96, 99].includes(code)) return '雷雨';
  return '实时天气';
}

function FoodPanel({ route, plan }: { route: SmartRoute; plan: TravelPlan }) {
  const foodStops = route.points.filter((point) => point.type === 'food');
  const foodItems = foodStops.length > 0
    ? foodStops.map((point) => `${point.name}：${point.time} 到达，建议停留 ${point.stayMinutes} 分钟。${point.reason}`)
    : plan.food;
  return <InfoList title="美食店铺推荐" icon={Utensils} items={foodItems} />;
}

function EditableMiniStat({ label, value, onChange, prefix = '', suffix = '', inputMode = 'text' }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; inputMode?: 'text' | 'numeric' }) {
  return (
    <label className="rounded-2xl border border-ink/8 bg-white p-4 transition focus-within:border-river/30 focus-within:ring-4 focus-within:ring-river/8">
      <span className="text-xs font-bold text-ink/42">{label} · 可修改</span>
      <span className="mt-2 flex items-baseline gap-1 font-display text-xl font-black text-ink">
        {prefix && <span>{prefix}</span>}
        <input aria-label={`修改${label}`} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 w-full bg-transparent font-display text-xl font-black text-ink outline-none" />
        {suffix && <span className="shrink-0 text-sm text-ink/45">{suffix}</span>}
      </span>
    </label>
  );
}

function RealPlaceImage({query,fallback,alt}:{query:string;fallback:string;alt:string}) {
  const [photo,setPhoto]=useState<{url:string;page:string;credit:string}>({url:fallback,page:'',credit:'正在查找实景照片…'});
  useEffect(()=>{let active=true; const url=`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*`; fetch(url).then(r=>r.json()).then(data=>{const page=Object.values(data.query?.pages||{})[0] as any; const info=page?.imageinfo?.[0]; if(active&&info?.thumburl) setPhoto({url:info.thumburl,page:`https://commons.wikimedia.org/?curid=${page.pageid}`,credit:'Wikimedia Commons'});}).catch(()=>{}); return()=>{active=false}},[query,fallback]);
  return <><img src={photo.url} alt={alt} onError={(e)=>{e.currentTarget.src=fallback}} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>{photo.page&&<a href={photo.page} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="absolute right-2 top-2 z-10 rounded-full bg-black/55 px-2 py-1 text-[9px] font-bold text-white/80">{photo.credit}</a>}</>;
}

function budgetTotal(plan: TravelPlan) {
  return plan.budget.reduce((sum, row) => sum + row.amount, 0);
}

function placeIntroduction(point: RoutePoint) {
  if (point.type === 'start' || point.type === 'end') {
    return `${point.name}是本次${point.city}行程的交通衔接点，可用于确认集合、换乘和返程安排。`;
  }
  const reason = /Mock|演示路线/.test(point.reason) ? '' : point.reason;
  return reason || `${point.name}位于${point.city}，属于本次路线中的${getPointTypeLabel(point.type)}点位，可结合现场导览了解其历史、景观与游览信息。`;
}

function transportModeLabel(mode?: RoutePoint['transportMode']) {
  if (mode === 'walk') return '建议步行到达或衔接周边公共交通';
  if (mode === 'transit') return '建议优先查询实时公交或轨道交通';
  if (mode === 'drive') return '建议驾车前确认停车场、入口与实时路况';
  return '建议使用高德地图查询当前出发地到该地点的实时路线';
}

function amapPlaceUrl(point: RoutePoint) {
  const params = new URLSearchParams({ keyword: `${point.city} ${point.name}`, city: point.city, view: 'map', src: 'chuyou-ai', callnative: '0' });
  return `https://uri.amap.com/search?${params.toString()}`;
}

function placeResearchUrl(point: RoutePoint) {
  return `https://www.baidu.com/s?wd=${encodeURIComponent(`${point.city} ${point.name} 官方 介绍`)}`;
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthDay(value: string) {
  const date = parseInputDate(value);
  return `${date.getMonth() + 1}月${date.getDate()}号`;
}

const scheduleByCity: Record<string,{rail:string[];bus:string[]}> = {
  宜昌:{rail:['D2234 宜昌东 13:05 → 武汉 15:36（约2小时31分）','D2248 宜昌东 13:10 → 汉口 15:05（约1小时55分）'],bus:['B1路 宜昌东站 → 山庄路：约06:00–22:30，高峰约5–8分钟/班','B9路 宜昌东站 → 葛洲坝方向：约06:20–21:30，约10–15分钟/班','三峡游客中心旅游专线：按景区预约班次发车，建议提前30分钟到站']},
  武汉:{rail:['G/动车 武汉站 → 宜昌东：全天约61个可选车次，常见耗时约2小时','城际/动车 汉口站 → 荆州站：早中晚均有班次，常见耗时约1.5小时'],bus:['地铁4号线 武汉站 → 复兴路：约06:00–23:00，高峰约3–6分钟/班','公交402路串联东湖、江汉关等区域：约06:00–20:30，约10–15分钟/班','轮渡中华路码头 → 武汉关码头：白天约20–30分钟/班']},
  恩施:{rail:['D字头 武汉/汉口 → 恩施：每日多班，常见耗时约4小时','恩施站返汉口：建议优先选择17:00前车次，预留景区返程时间'],bus:['恩施站 → 女儿城公交：白天约10–20分钟/班','恩施汽车客运中心 → 大峡谷旅游专线：通常上午集中发班，返程以景区公告为准']},
  荆州:{rail:['D字头 汉口 → 荆州：每日多班，常见耗时约1.5小时','荆州站 → 宜昌东：动车班次密集，常见耗时约40–60分钟'],bus:['公交21路 荆州站 → 古城/博物馆方向：约10–15分钟/班','古城旅游公交：节假日可能加密班次，以站牌为准']},
  襄阳:{rail:['G/动车 武汉 → 襄阳东：每日多班，常见耗时约2小时','襄阳东 → 汉口：早中晚均有班次'],bus:['G02高铁公交 襄阳东站 → 市区：高铁到站时段滚动发车','古城 → 唐城公交：约10–20分钟/班，夜场结束前确认末班车']},
  黄石:{rail:['城际/高铁 武汉 → 黄石北：每日多班，常见耗时约30–50分钟','黄石北 → 武汉：晚间仍有部分班次，具体以12306为准'],bus:['公交37路 黄石北站 → 市区方向：约10–15分钟/班','磁湖景区周边公交：白天约10–20分钟/班']},
};
function TransportPanel({city,items}:{city:string;items:string[]}) { const schedule=scheduleByCity[city]||scheduleByCity.宜昌; return <div><SideTitle eyebrow="TRANSIT BOARD" title="交通与班次" desc="班次会临时调整，出发前务必实时复核。"/><ScheduleBlock icon={TrainFront} title="高铁 / 动车参考" items={schedule.rail}/><a href="https://kyfw.12306.cn/otn/leftTicket/init" target="_blank" rel="noreferrer" className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-[#d83b32] px-4 py-3 text-sm font-black text-white">打开铁路12306实时查询<ExternalLink className="h-4 w-4"/></a><ScheduleBlock icon={Bus} title="公交 / 专线参考" items={schedule.bus}/><div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">公交发车间隔受工作日、节假日和交通状况影响；页面展示为比赛 Demo 参考，实际以当地公交 App、站牌和景区公告为准。</div><div className="mt-4"><InfoList title="换乘建议" icon={Bus} items={items}/></div></div> }
function ScheduleBlock({icon:Icon,title,items}:{icon:typeof Bus;title:string;items:string[]}) { return <div className="mb-4 rounded-2xl border border-ink/8 bg-white p-4"><div className="mb-3 flex items-center gap-2 font-black"><Icon className="h-5 w-5 text-river"/>{title}</div><div className="space-y-2">{items.map(item=><div key={item} className="rounded-xl bg-mist px-3 py-3 text-sm font-semibold leading-6 text-ink/68">{item}</div>)}</div></div> }
function BudgetPanel({plan}:{plan:TravelPlan}) { const total=plan.budget.reduce((sum,row)=>sum+row.amount,0); return <div><SideTitle eyebrow="TRIP COST" title="预算明细表" desc="按交通、门票、餐饮和住宿拆分。"/><div className="overflow-hidden rounded-2xl border border-ink/8 bg-white">{plan.budget.map(row=><div key={row.item} className="border-b border-ink/8 p-4 last:border-0"><div className="flex items-center justify-between"><b>{row.item}</b><span className="font-display text-xl font-black text-tower">¥{row.amount}</span></div><p className="mt-1 text-xs leading-5 text-ink/45">{row.note}</p></div>)}</div><div className="mt-4 flex items-end justify-between rounded-2xl bg-ink p-5 text-white"><div><div className="text-xs font-bold text-white/50">预计总计</div><div className="mt-1 text-sm text-white/70">建议预留 10% 机动费用</div></div><div className="font-display text-3xl font-black text-jade">¥{total}</div></div></div> }
