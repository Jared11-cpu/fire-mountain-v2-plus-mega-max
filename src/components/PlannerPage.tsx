import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, LocateFixed, Loader2, Sparkles } from 'lucide-react';
import { budgetOptions, cities, dayOptions, examples, groupOptions, interestOptions, type CityName } from '../data/mockData';
import { generateTravelPlan, type PlannerInput, type TravelPlan } from '../utils/aiGenerator';
import { MapWorkspace } from './MapWorkspace';
import { generateSmartRoute } from '../services/mapService';
import { getBrowserLocation, makeMockLocation, mockLocationOptions } from '../services/locationService';
import type { RoutePoint, SmartRoute, UserLocation } from '../types/route';

type PlannerPageProps = {
  initialCity: CityName;
  initialPrompt?: string;
};

export function PlannerPage({ initialCity, initialPrompt = '' }: PlannerPageProps) {
  const [form, setForm] = useState<PlannerInput>({
    city: initialCity,
    days: 2,
    budget: 600,
    interests: ['拍照', '美食'],
    group: '朋友',
    prompt: initialPrompt || '我想去宜昌两天一夜，预算 600，喜欢拍照和美食。',
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<UserLocation>(() => makeMockLocation(initialCity));
  const [plan, setPlan] = useState<TravelPlan>(() => generateTravelPlan({
    city: initialCity,
    days: 2,
    budget: 600,
    interests: ['拍照', '美食'],
    group: '朋友',
    prompt: '我想去宜昌两天一夜，预算 600，喜欢拍照和美食。',
  }));
  const [smartRoute, setSmartRoute] = useState<SmartRoute>(() => generateSmartRoute({
    city: initialCity,
    days: 2,
    budget: 600,
    interests: ['拍照', '美食'],
    group: '朋友',
    prompt: '我想去宜昌两天一夜，预算 600，喜欢拍照和美食。',
  }, makeMockLocation(initialCity)));
  const [selectedPointId, setSelectedPointId] = useState<string>();
  const [resultMode, setResultMode] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [activePointIndex, setActivePointIndex] = useState(0);
  const [, setToast] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const navigationTimerRef = useRef<number>();
  const selectedCity = cities.find((city) => city.name === form.city) ?? cities[0];

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        window.clearInterval(navigationTimerRef.current);
      }
    };
  }, []);

  const toggleInterest = (item: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(item) ? prev.interests.filter((i) => i !== item) : [...prev.interests, item],
    }));
  };

  const generate = () => {
    setLoading(true);
    setToast('AI 正在理解需求、拆解路线、生成地图和沿途观察...');
    window.setTimeout(() => {
      const nextPlan = generateTravelPlan(form);
      const nextRoute = generateSmartRoute(form, location.city === form.city ? location : makeMockLocation(form.city));
      setPlan(nextPlan);
      setSmartRoute(nextRoute);
      setSelectedPointId(nextRoute.points[0]?.id);
      setActivePointIndex(0);
      setNavigating(false);
      setResultMode(true);
      setLoading(false);
      setToast(`已生成 ${form.city}${form.days}天路线地图与沿途观察`);
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80);
    }, 650);
  };

  const applyExample = (example: (typeof examples)[number]) => {
    const nextInput = {
      city: example.city,
      days: example.days,
      budget: example.budget,
      interests: example.interests,
      group: example.group,
      prompt: example.prompt,
    };
    const nextLocation = makeMockLocation(example.city);
    const nextRoute = generateSmartRoute(nextInput, nextLocation);
    setForm(nextInput);
    setLocation(nextLocation);
    setPlan(generateTravelPlan(nextInput));
    setSmartRoute(nextRoute);
    setSelectedPointId(nextRoute.points[0]?.id);
    setActivePointIndex(0);
    setNavigating(false);
    setResultMode(false);
    setToast(`已切换到示例：${example.label}`);
  };

  const updateCity = (city: CityName) => {
    setForm((prev) => ({ ...prev, city }));
    setResultMode(false);
    if (location.status !== 'success') {
      setLocation(makeMockLocation(city));
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocation((prev) => ({ ...prev, status: 'locating', message: '正在请求浏览器定位授权...' }));
    const nextLocation = await getBrowserLocation(form.city);
    setLocation(nextLocation);
    setLocating(false);
    setToast(nextLocation.message);
  };

  const chooseMockLocation = (name: string) => {
    const option = mockLocationOptions.find((item) => item.name === name);
    if (!option) return;
    const nextLocation: UserLocation = {
      ...option,
      status: 'mock',
      message: '已切换为手动 Mock 出发地。',
    };
    setLocation(nextLocation);
    setToast(`出发地已切换为 ${option.name}`);
  };

  const regenerateRoute = () => {
    const nextRoute = generateSmartRoute(form, location.city === form.city ? location : makeMockLocation(form.city));
    setSmartRoute(nextRoute);
    setSelectedPointId(nextRoute.points[0]?.id);
    setActivePointIndex(0);
    setNavigating(false);
    setToast('已重新生成 AI 路线地图');
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const copyRouteCopy = async () => {
    const text = smartRoute.sceneryAnalysis.socialCopy;
    try {
      await navigator.clipboard.writeText(text);
      setToast('沿途小红书文案已复制');
    } catch {
      setToast('浏览器暂不允许复制，请手动选中文案');
    }
  };

  const simulateNavigation = () => {
    if (navigationTimerRef.current) {
      window.clearInterval(navigationTimerRef.current);
    }
    setNavigating(true);
    setActivePointIndex(0);
    setSelectedPointId(smartRoute.points[0]?.id);
    let index = 0;
    navigationTimerRef.current = window.setInterval(() => {
      index += 1;
      if (index >= smartRoute.points.length) {
        window.clearInterval(navigationTimerRef.current);
        setNavigating(false);
        setToast('模拟导航已完成');
        return;
      }
      setActivePointIndex(index);
      setSelectedPointId(smartRoute.points[index].id);
    }, 900);
    setToast('正在模拟导航，Marker 将按路线高亮');
  };

  const selectRoutePoint = (point: RoutePoint) => {
    setSelectedPointId(point.id);
    const index = smartRoute.points.findIndex((item) => item.id === point.id);
    if (index >= 0) {
      setActivePointIndex(index);
    }
  };

  return (
    <main className="section-pad py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-river">AI Travel Planner</p>
            <h1 className="mt-2 font-display text-4xl font-black text-ink md:text-5xl">一句话生成完整湖北旅行方案</h1>
            <p className="mt-4 max-w-2xl text-ink/65">输入需求，生成路线、预算、打卡点和传播文案。</p>
          </div>
        </div>

        <div className={resultMode ? 'space-y-5' : 'mx-auto max-w-5xl'}>
          {!resultMode && <section className="glass rounded-[1.75rem] p-5 shadow-soft">
            <Field label="目的地城市">
              <div className="grid grid-cols-3 gap-2">
                {cities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => updateCity(city.name)}
                    className={`rounded-2xl px-3 py-3 text-sm font-black transition active:scale-95 ${
                      form.city === city.name ? 'bg-ink text-white' : 'bg-white/70 text-ink/70 hover:bg-white'
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="定位与出发地">
              <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <button
                    onClick={useCurrentLocation}
                    disabled={locating}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-river px-4 py-3 text-sm font-black text-white transition hover:bg-ink active:scale-95 disabled:opacity-70"
                  >
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                    使用当前位置
                  </button>
                  <select
                    value={location.name}
                    onChange={(event) => chooseMockLocation(event.target.value)}
                    className="focus-ring rounded-2xl border border-white/70 bg-white px-3 py-3 text-sm font-bold text-ink"
                  >
                    {mockLocationOptions.map((option) => (
                      <option key={option.name} value={option.name}>{option.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 rounded-2xl bg-ink/5 p-3 text-xs font-bold leading-6 text-ink/58">
                  <div className="text-ink">当前城市：{location.city} · 出发点：{location.name}</div>
                  <div>经纬度：{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>
                  <div>状态：{location.status} · {location.message}</div>
                </div>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="出行天数">
                <div className="grid grid-cols-3 gap-2">
                  {dayOptions.map((day) => (
                    <button
                      key={day}
                      onClick={() => setForm((prev) => ({ ...prev, days: day }))}
                      className={`rounded-2xl py-3 text-sm font-black transition active:scale-95 ${
                        form.days === day ? 'bg-river text-white' : 'bg-white/70 text-ink/70 hover:bg-white'
                      }`}
                    >
                      {day} 天
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="预算">
                <div className="rounded-3xl bg-white/70 p-3 shadow-sm">
                  <div className="flex items-center rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-sm focus-within:ring-4 focus-within:ring-jade/20">
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={form.budget}
                      onChange={(event) => setForm((prev) => ({ ...prev, budget: Math.max(0, Number(event.target.value) || 0) }))}
                      className="w-full bg-transparent text-lg font-black text-ink outline-none"
                      aria-label="自定义预算金额"
                    />
                    <span className="ml-2 shrink-0 text-sm font-black text-ink/45">元</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {budgetOptions.map((budget) => (
                      <button
                        key={budget}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, budget }))}
                        className={`rounded-xl px-2 py-2 text-xs font-black transition active:scale-95 ${
                          form.budget === budget ? 'bg-ink text-white' : 'bg-ink/5 text-ink/55 hover:bg-river/10 hover:text-river'
                        }`}
                      >
                        {budget}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>

            <Field label="兴趣偏好">
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleInterest(item)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold transition active:scale-95 ${
                      form.interests.includes(item) ? 'bg-jade text-white shadow-sm' : 'bg-white/75 text-ink/70 hover:bg-white'
                    }`}
                  >
                    {form.interests.includes(item) && <Check className="h-3.5 w-3.5" />}
                    {item}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="出行人群">
              <div className="grid grid-cols-5 gap-2">
                {groupOptions.map((group) => (
                  <button
                    key={group}
                    onClick={() => setForm((prev) => ({ ...prev, group }))}
                    className={`rounded-2xl py-3 text-sm font-black transition active:scale-95 ${
                      form.group === group ? 'bg-tower text-white' : 'bg-white/70 text-ink/70 hover:bg-white'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="自然语言输入">
              <textarea
                value={form.prompt}
                onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
                rows={4}
                className="focus-ring w-full resize-none rounded-3xl border border-white/70 bg-white/85 px-4 py-3 leading-7 text-ink shadow-sm"
                placeholder="例如：我想去宜昌两天一夜，预算 600，喜欢拍照和美食。"
              />
            </Field>

            <div className="mb-5 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example.label}
                  onClick={() => applyExample(example)}
                  className="rounded-full bg-river/10 px-3 py-2 text-xs font-black text-river transition hover:bg-river hover:text-white active:scale-95"
                >
                  {example.label}
                </button>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-4 font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-river active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              生成 AI 旅行方案
            </button>
          </section>}

          {resultMode && <section ref={resultRef} className="space-y-4 scroll-mt-28">
            <div className="flex flex-col justify-between gap-3 rounded-[1.5rem] bg-white/80 p-4 shadow-sm ring-1 ring-ink/5 md:flex-row md:items-center">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-river">AI ROUTE WORKSPACE</div>
                <h2 className="mt-1 font-display text-2xl font-black text-ink">{plan.title}</h2>
              </div>
              <button
                onClick={() => setResultMode(false)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white transition hover:bg-river active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                返回修改需求
              </button>
            </div>
            <MapWorkspace
              route={smartRoute}
              plan={plan}
              selectedPointId={selectedPointId}
              activePointIndex={activePointIndex}
              navigating={navigating}
              imageUrl={selectedCity.imageUrl}
              onSelectPoint={selectRoutePoint}
              onRegenerate={regenerateRoute}
              onCopySocial={copyRouteCopy}
              onSimulateNavigation={simulateNavigation}
            />

          </section>}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-sm font-black text-ink/72">{label}</span>
      {children}
    </label>
  );
}
