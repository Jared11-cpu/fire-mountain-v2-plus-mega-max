import { useState } from 'react';
import { Calculator, Camera, Check, Film, Loader2, MapPin, MessageSquareText, Route, Sparkles, Utensils } from 'lucide-react';
import { budgetOptions, cities, dayOptions, examples, groupOptions, interestOptions, type CityName } from '../data/mockData';
import { generateTravelPlan, type PlannerInput, type TravelPlan } from '../utils/aiGenerator';

type PlannerPageProps = {
  initialCity: CityName;
};

export function PlannerPage({ initialCity }: PlannerPageProps) {
  const [form, setForm] = useState<PlannerInput>({
    city: initialCity,
    days: 2,
    budget: 600,
    interests: ['拍照', '美食'],
    group: '朋友',
    prompt: '我想去宜昌两天一夜，预算 600，喜欢拍照和美食。',
  });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan>(() => generateTravelPlan({
    city: initialCity,
    days: 2,
    budget: 600,
    interests: ['拍照', '美食'],
    group: '朋友',
    prompt: '我想去宜昌两天一夜，预算 600，喜欢拍照和美食。',
  }));
  const [toast, setToast] = useState('已载入宜昌示例方案');
  const selectedCity = cities.find((city) => city.name === form.city) ?? cities[0];

  const toggleInterest = (item: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(item) ? prev.interests.filter((i) => i !== item) : [...prev.interests, item],
    }));
  };

  const generate = () => {
    setLoading(true);
    setToast('AI 正在理解需求、拆解路线和生成传播内容...');
    window.setTimeout(() => {
      setPlan(generateTravelPlan(form));
      setLoading(false);
      setToast(`已生成 ${form.city}${form.days}天旅行智能体方案`);
    }, 650);
  };

  const applyExample = (example: (typeof examples)[number]) => {
    setForm({
      city: example.city,
      days: example.days,
      budget: example.budget,
      interests: example.interests,
      group: example.group,
      prompt: example.prompt,
    });
    setPlan(generateTravelPlan({
      city: example.city,
      days: example.days,
      budget: example.budget,
      interests: example.interests,
      group: example.group,
      prompt: example.prompt,
    }));
    setToast(`已切换到示例：${example.label}`);
  };

  return (
    <main className="section-pad py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-river">AI Travel Planner</p>
            <h1 className="mt-2 font-display text-4xl font-black text-ink md:text-5xl">一句话生成完整湖北旅行方案</h1>
            <p className="mt-4 max-w-2xl text-ink/65">输入需求，生成路线、预算、打卡点和传播文案。</p>
          </div>
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-soft">{toast}</div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="glass rounded-[1.75rem] p-5 shadow-soft">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-river/10 text-river">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black text-ink">需求输入</h2>
                <p className="text-sm text-ink/55">选择条件或直接说人话</p>
              </div>
            </div>

            <Field label="目的地城市">
              <div className="grid grid-cols-3 gap-2">
                {cities.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => setForm((prev) => ({ ...prev, city: city.name }))}
                    className={`rounded-2xl px-3 py-3 text-sm font-black transition active:scale-95 ${
                      form.city === city.name ? 'bg-ink text-white' : 'bg-white/70 text-ink/70 hover:bg-white'
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
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
                <select
                  value={form.budget}
                  onChange={(event) => setForm((prev) => ({ ...prev, budget: Number(event.target.value) }))}
                  className="focus-ring w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3 font-bold text-ink shadow-sm"
                >
                  {budgetOptions.map((budget) => (
                    <option key={budget} value={budget}>{budget} 元</option>
                  ))}
                </select>
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
          </section>

          <section className="space-y-5">
            <div className="relative min-h-[260px] overflow-hidden rounded-[1.75rem] bg-ink shadow-soft">
              <img src={selectedCity.imageUrl} alt={`${selectedCity.name}风景`} className="absolute inset-0 h-full w-full object-cover opacity-85" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <div className="mb-3 inline-flex rounded-full bg-white/16 px-3 py-1 text-sm font-black backdrop-blur">{selectedCity.image}</div>
                <h2 className="font-display text-4xl font-black">{selectedCity.name}</h2>
                <p className="mt-2 text-white/72">{selectedCity.title}</p>
              </div>
            </div>

            <div className="dark-glass rounded-[1.75rem] p-6 text-white shadow-soft">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-jade">Generated Itinerary</p>
                  <h2 className="mt-2 font-display text-3xl font-black">{plan.title}</h2>
                  <p className="mt-3 leading-7 text-white/70">{plan.summary}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
                  <div className="text-3xl font-black text-jade">{form.budget}</div>
                  <div className="text-xs font-bold text-white/60">预算上限</div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {plan.days.map((day) => (
                <div key={day.day} className="glass rounded-[1.5rem] p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-river text-white">
                      <Route className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-black text-ink">{day.day}</h3>
                      <p className="text-sm font-bold text-river">{day.theme}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {day.items.map((item) => (
                      <div key={`${day.day}-${item.time}`} className="rounded-2xl bg-white/70 p-4">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-ink px-3 py-1 text-xs font-black text-white">{item.time}</span>
                          <span className="font-black text-ink">{item.place}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/62">{item.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <InfoPanel icon={MapPin} title="交通建议" items={plan.transport} />
              <InfoPanel icon={Utensils} title="美食推荐" items={plan.food} />
              <InfoPanel icon={Camera} title="拍照打卡点" items={plan.photoSpots} />
              <InfoPanel icon={MessageSquareText} title="避坑提醒" items={plan.warnings} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="glass rounded-[1.5rem] p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <Calculator className="h-6 w-6 text-river" />
                  <h3 className="font-display text-2xl font-black text-ink">预算明细表</h3>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/70">
                  {plan.budget.map((row) => (
                    <div key={row.item} className="grid grid-cols-[90px_90px_1fr] border-b border-white/70 bg-white/65 p-3 text-sm last:border-b-0">
                      <span className="font-black text-ink">{row.item}</span>
                      <span className="font-black text-tower">{row.amount} 元</span>
                      <span className="text-ink/60">{row.note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-[1.5rem] p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <Film className="h-6 w-6 text-tower" />
                  <h3 className="font-display text-2xl font-black text-ink">传播内容</h3>
                </div>
                <div className="rounded-2xl bg-white/70 p-4">
                  <div className="mb-2 text-sm font-black text-river">朋友圈 / 小红书文案</div>
                  <p className="leading-7 text-ink/70">{plan.socialCopy}</p>
                </div>
                <div className="mt-3 space-y-2">
                  {plan.videoScript.map((line) => (
                    <div key={line} className="rounded-2xl bg-ink/5 px-4 py-3 text-sm font-semibold leading-6 text-ink/70">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
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

function InfoPanel({ icon: Icon, title, items }: { icon: typeof MapPin; title: string; items: string[] }) {
  return (
    <div className="glass rounded-[1.5rem] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-6 w-6 text-river" />
        <h3 className="font-display text-2xl font-black text-ink">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold leading-6 text-ink/68">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
