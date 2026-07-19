import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, LocateFixed, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { cities, examples } from '../data/mockData';
import { DIETARY_RESTRICTIONS, INTERESTS, SPECIAL_NEEDS, TRAVELERS, updateDestinationCity, type DietaryRestriction, type Interest, type SpecialNeed, type TravelerType } from '../domain/trip';
import { getBrowserLocation } from '../services/locationService';
import type { RoutePoint } from '../types/route';
import { useTrip } from '../state/tripStore';
import { MapWorkspace } from './MapWorkspace';

export function PlannerPage() {
  const { request, plan, parsedTags, parseWarnings, isGenerating, isReplanning, updateRequest, parseText, generateFromText, replan, resetPlan, notify } = useTrip();
  const [resultMode, setResultMode] = useState(Boolean(plan));
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>(plan?.route.points[0]?.id);
  const [locating, setLocating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const selectedCity = useMemo(() => cities.find((city) => city.name === request.destinationCity) ?? cities[0], [request.destinationCity]);

  useEffect(() => { if (plan) { setResultMode(true); setSelectedPointId((current) => plan.route.points.some((point) => point.id === current) ? current : plan.route.points[0]?.id); } }, [plan]);

  const createPlan = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const next = await generateFromText(request.freeText);
      setSelectedPointId(next.route.points[0]?.id);
      setResultMode(true);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch {
      setResultMode(false);
    } finally { setGenerating(false); }
  };

  const locate = async () => {
    setLocating(true);
    try {
      const result = await getBrowserLocation(request.destinationCity);
      if (result.status === 'success') updateRequest({ origin: { name: result.name, city: result.city, lat: result.lat, lng: result.lng, source: 'browser' } });
      notify(result.message, result.status === 'success' ? 'success' : 'error');
    } finally { setLocating(false); }
  };

  const toggle = <T extends string>(field: 'interests' | 'dietaryRestrictions' | 'specialNeeds', item: T) => {
    const values = request[field] as readonly string[];
    updateRequest({ [field]: values.includes(item) ? values.filter((value) => value !== item) : [...values, item] });
  };

  return (
    <main className={resultMode && plan ? 'px-2 py-4 md:px-4 md:py-5' : 'section-pad py-10'}>
      <div className={resultMode && plan ? 'mx-auto w-full max-w-none' : 'mx-auto max-w-7xl'}>
        {!resultMode && <div className="mb-8">
          <h1 className="font-display text-4xl font-black text-ink md:text-5xl">懂你，也懂湖北</h1>
        </div>}

        <div className={resultMode && plan ? 'space-y-5' : 'mx-auto max-w-5xl'}>
          {(!resultMode || !plan) && <section className="glass rounded-[1.75rem] p-5 shadow-soft">
            <Field label="用一句话描述旅行需求" htmlFor="travel-free-text">
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea id="travel-free-text" rows={3} value={request.freeText} onChange={(event) => updateRequest({ freeText: event.target.value })} className="focus-ring min-w-0 flex-1 rounded-2xl border border-white/70 bg-white px-4 py-3 font-semibold text-ink" placeholder="恩施三天两夜，预算1000元，喜欢峡谷和拍照，不吃辣" />
                <button type="button" onClick={() => parseText()} className="rounded-2xl bg-river px-5 py-3 text-sm font-black text-white transition hover:bg-ink">识别条件</button>
              </div>
            </Field>

            {(parsedTags.length > 0 || parseWarnings.length > 0) && <div className="mb-5 rounded-3xl bg-jade/10 p-4" aria-live="polite">
              <div className="text-sm font-black text-ink">识别结果，请确认或修改</div>
              <div className="mt-3 flex flex-wrap gap-2">{parsedTags.map((tag) => <span key={`${tag.type}-${tag.value}`} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-river shadow-sm">{tag.type}：{tag.value}</span>)}</div>
              {parseWarnings.map((warning) => <p key={warning} className="mt-2 text-xs font-bold text-tower">{warning}</p>)}
            </div>}

            <Field label="快捷案例">
              <div className="flex flex-wrap gap-2">{examples.slice(0, 4).map((example) => <button type="button" key={example.label} onClick={() => { updateRequest({ freeText: example.prompt }); window.setTimeout(() => parseText(example.prompt), 0); }} className="rounded-full bg-white/75 px-3 py-2 text-xs font-black text-ink/65 hover:bg-white">{example.label}</button>)}</div>
            </Field>

            <Field label="目的地城市">
              <div className="grid grid-cols-3 gap-2">{cities.map((city) => <button type="button" key={city.name} aria-pressed={request.destinationCity === city.name} onClick={() => { const next = updateDestinationCity(request, city.name); updateRequest({ destinationCity: next.destinationCity, origin: next.origin }); }} className={`rounded-2xl px-3 py-3 text-sm font-black transition ${request.destinationCity === city.name ? 'bg-ink text-white' : 'bg-white/70 text-ink/70 hover:bg-white'}`}>{city.name}</button>)}</div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="出发地" htmlFor="trip-origin"><div className="flex gap-2"><input id="trip-origin" value={request.origin.name} onChange={(event) => updateRequest({ origin: { ...request.origin, name: event.target.value, source: 'manual' } })} className="focus-ring min-w-0 flex-1 rounded-2xl border border-white/70 bg-white px-4 py-3 font-bold" /><button type="button" aria-label="使用浏览器定位" disabled={locating} onClick={locate} className="inline-flex min-h-12 min-w-[9.5rem] items-center justify-center gap-2 rounded-2xl bg-river px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(14,107,114,.2)] transition hover:-translate-y-0.5 hover:bg-ink disabled:translate-y-0 disabled:opacity-60">{locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}<span>{locating ? '正在定位…' : '定位当前起点'}</span></button></div>{request.origin.source === 'browser' && <div className="mt-2 flex items-start gap-2 rounded-2xl border border-jade/20 bg-jade/10 px-3 py-2.5 text-xs font-bold leading-5 text-river" role="status"><LocateFixed className="mt-0.5 h-4 w-4 shrink-0"/><span>GPS 起点已锁定：{request.origin.name}<small className="block font-semibold text-ink/45">生成后将在地图显示“我的位置 → {request.destinationCity}首站”的真实道路连接。</small></span></div>}</Field>
              <Field label="出行人群" htmlFor="traveler-type"><select id="traveler-type" value={request.travelerType} onChange={(event) => updateRequest({ travelerType: event.target.value as TravelerType })} className="focus-ring w-full rounded-2xl border border-white/70 bg-white px-4 py-3 font-bold">{TRAVELERS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="天数" htmlFor="trip-days"><input id="trip-days" type="number" min={1} max={15} value={request.days} onChange={(event) => updateRequest({ days: Number(event.target.value) })} className="focus-ring w-full rounded-2xl border border-white/70 bg-white px-4 py-3 font-black" /></Field>
              <Field label="预算（元）" htmlFor="trip-budget"><input id="trip-budget" type="number" min={0} value={request.budget} onChange={(event) => updateRequest({ budget: Number(event.target.value) })} className="focus-ring w-full rounded-2xl border border-white/70 bg-white px-4 py-3 font-black" /></Field>
              <Field label="开始日期" htmlFor="start-date"><input id="start-date" type="date" value={request.startDate} onChange={(event) => updateRequest({ startDate: event.target.value })} className="focus-ring w-full rounded-2xl border border-white/70 bg-white px-4 py-3 font-bold" /></Field>
              <Field label="结束日期" htmlFor="end-date"><input id="end-date" type="date" min={request.startDate} value={request.endDate} onChange={(event) => updateRequest({ endDate: event.target.value })} className="focus-ring w-full rounded-2xl border border-white/70 bg-white px-4 py-3 font-bold" /></Field>
            </div>

            <ChoiceGroup label="旅行兴趣" values={INTERESTS} selected={request.interests} onToggle={(item) => toggle<Interest>('interests', item)} />
            <ChoiceGroup label="饮食限制" values={DIETARY_RESTRICTIONS} selected={request.dietaryRestrictions} onToggle={(item) => toggle<DietaryRestriction>('dietaryRestrictions', item)} />
            <ChoiceGroup label="特殊需求" values={SPECIAL_NEEDS} selected={request.specialNeeds} onToggle={(item) => toggle<SpecialNeed>('specialNeeds', item)} />

            <button type="button" disabled={generating || isGenerating} onClick={createPlan} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-4 font-black text-white shadow-soft transition hover:bg-river active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">{generating || isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{generating || isGenerating ? '正在生成最终 AI 分析…' : 'AI 个性化生成方案'}</button>
          </section>}

          {isGenerating && !plan && <section className="mt-5 rounded-[1.75rem] border border-river/15 bg-white/90 p-8 text-center shadow-soft" aria-live="polite"><Loader2 className="mx-auto h-8 w-8 animate-spin text-river" /><h2 className="mt-4 font-display text-2xl font-black">正在生成最终个性化方案</h2><p className="mt-2 text-sm font-bold text-ink/55">正在完成真实地点检索与千问分析；完成前不会显示规则占位结果。</p></section>}

          {resultMode && plan && <section ref={resultRef} className="space-y-3 scroll-mt-24">
            <div className="flex flex-col justify-between gap-3 rounded-[1.25rem] bg-white/75 px-4 py-3 shadow-sm ring-1 ring-ink/5 backdrop-blur md:flex-row md:items-center md:px-5">
              <h2 className="font-display text-2xl font-black text-ink">{plan.route.title}</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { if (window.confirm('重置当前方案？真实手账和照片会保留。')) { resetPlan(); setResultMode(false); } }} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-ink shadow-sm"><RotateCcw className="h-4 w-4" />重置方案</button>
                <button type="button" onClick={() => setResultMode(false)} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white"><ArrowLeft className="h-4 w-4" />返回修改</button>
              </div>
            </div>
            <MapWorkspace route={plan.route} plan={plan.content} selectedPointId={selectedPointId} activePointIndex={Math.max(0, plan.route.points.findIndex((item) => item.id === selectedPointId))} navigating={false} imageUrl={selectedCity.imageUrl} onSelectPoint={(point: RoutePoint) => setSelectedPointId(point.id)} onRegenerate={replan} onSimulateNavigation={() => notify('本功能仅演示路线顺序，不冒充实时导航。')} />
            {isReplanning && <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/25 backdrop-blur-sm"><div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 font-black text-ink shadow-soft"><Loader2 className="h-5 w-5 animate-spin text-river" />正在生成最终 AI 分析…</div></div>}
          </section>}
        </div>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return <div className="mb-5"><label htmlFor={htmlFor} className="mb-2 block text-sm font-black text-ink/72">{label}</label>{children}</div>;
}

function ChoiceGroup<T extends string>({ label, values, selected, onToggle }: { label: string; values: readonly T[]; selected: readonly T[]; onToggle: (item: T) => void }) {
  return <fieldset className="mb-5"><legend className="mb-2 text-sm font-black text-ink/72">{label}</legend><div className="flex flex-wrap gap-2">{values.map((item) => <button type="button" key={item} aria-pressed={selected.includes(item)} onClick={() => onToggle(item)} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition ${selected.includes(item) ? 'bg-jade text-white' : 'bg-white/70 text-ink/60'}`}>{selected.includes(item) && <Check className="h-3.5 w-3.5" />}{item}</button>)}</div></fieldset>;
}

