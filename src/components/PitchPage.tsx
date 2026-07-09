import { ArrowUpRight, BrainCircuit, HandCoins, Layers3, Rocket, Users } from 'lucide-react';
import { cities } from '../data/mockData';

const sections = [
  {
    title: '项目背景',
    body: '湖北资源丰富，但旅行决策仍依赖碎片攻略。',
  },
  {
    title: '用户痛点',
    body: '游客怕踩坑，景区讲解同质化，商家缺少数字工具。',
  },
  {
    title: '解决方案',
    body: '一句话生成路线、讲解、预算、内容和商家服务。',
  },
  {
    title: 'AI 创新点',
    body: '自然语言需求转成多场景文旅交付物。',
  },
  {
    title: 'Vibe Coding 创新点',
    body: '从旅行想法到可执行行程、可传播内容快速转化。',
  },
  {
    title: '社会价值',
    body: '降低攻略成本，帮助中小文旅商家数字化。',
  },
  {
    title: '落地场景',
    body: '小程序、游客中心、民宿管家、城市文旅看板。',
  },
  {
    title: '未来规划',
    body: '接入大模型、地图 API、景区数据和商家 CRM。',
  },
];

const models = [
  'C 端游客：会员订阅，高级路线规划',
  'B 端景区：AI 讲解系统服务',
  '民宿酒店：AI 住客服务助手',
  '文旅部门：城市文旅数据看板与传播方案',
  '本地商户：广告推荐和联名路线服务',
];

export function PitchPage() {
  return (
    <main className="section-pad py-10">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-ink p-7 text-white shadow-soft md:p-10">
          <img src={cities[1].imageUrl} alt="武汉黄鹤楼风景" className="absolute inset-0 h-full w-full object-cover opacity-48" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-river/35" />
          <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-jade">Roadshow Deck</p>
              <h1 className="mt-3 font-display text-5xl font-black leading-tight md:text-6xl">楚游智导 AI</h1>
              <p className="mt-5 max-w-xl text-xl font-semibold leading-9 text-white/72">湖北文旅 AI 智能体平台。</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'AI 创新', icon: BrainCircuit },
                  { label: '社会价值', icon: Users },
                  { label: '创业可行', icon: Rocket },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl bg-white/10 p-4">
                      <Icon className="mb-3 h-6 w-6 text-jade" />
                      <div className="font-black">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-6">
              <div className="mb-5 flex items-center gap-3">
                <Layers3 className="h-7 w-7 text-jade" />
                <h2 className="font-display text-2xl font-black">从想法到交付物</h2>
              </div>
              <div className="space-y-3">
                {['一句话旅行需求', 'AI 结构化理解', '路线/预算/讲解生成', '短视频/朋友圈内容', '城市小程序原型'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                    <span className="font-bold">{item}</span>
                    <span className="rounded-full bg-jade px-3 py-1 text-xs font-black text-ink">0{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title} className="glass rounded-[1.5rem] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-black text-ink">{section.title}</h2>
                <ArrowUpRight className="h-5 w-5 text-river" />
              </div>
              <p className="leading-8 text-ink/68">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[1.75rem] bg-gradient-to-br from-river via-[#207D78] to-tower p-6 text-white shadow-soft">
          <div className="mb-5 flex items-center gap-3">
            <HandCoins className="h-7 w-7 text-white" />
            <h2 className="font-display text-3xl font-black">商业模式</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {models.map((item) => (
              <div key={item} className="rounded-2xl bg-white/16 p-4 font-bold leading-7 backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
