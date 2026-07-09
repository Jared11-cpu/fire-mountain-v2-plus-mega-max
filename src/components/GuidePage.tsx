import { useState } from 'react';
import { Camera, MessageCircle, Mic2, UsersRound } from 'lucide-react';
import { attractions } from '../data/mockData';

const voiceTabs = [
  { id: 'normal', label: '通俗版讲解' },
  { id: 'youth', label: '年轻人版' },
  { id: 'family', label: '亲子版' },
  { id: 'video', label: '短视频口播' },
  { id: 'social', label: '朋友圈文案' },
  { id: 'photo', label: '拍照建议' },
] as const;

type VoiceId = (typeof voiceTabs)[number]['id'];

export function GuidePage() {
  const [selected, setSelected] = useState(attractions[0]);
  const [voice, setVoice] = useState<VoiceId>('normal');
  const [toast, setToast] = useState('已生成三峡大坝多风格讲解');

  const chooseAttraction = (name: string) => {
    const next = attractions.find((item) => item.name === name) ?? attractions[0];
    setSelected(next);
    setVoice('normal');
    setToast(`已切换到 ${next.name} AI 讲解`);
  };

  return (
    <main className="section-pad py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-river">Scenic AI Guide</p>
            <h1 className="mt-2 font-display text-4xl font-black text-ink md:text-5xl">景点 AI 多人群讲解</h1>
            <p className="mt-4 max-w-2xl text-ink/65">同一景点，切换不同人群的 AI 讲解语气。</p>
          </div>
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-white shadow-soft">{toast}</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {attractions.map((item) => (
              <button
                key={item.name}
                onClick={() => chooseAttraction(item.name)}
                className="group relative min-h-[190px] overflow-hidden rounded-[1.5rem] p-5 text-left text-white shadow-sm transition hover:-translate-y-1 active:scale-[0.98]"
              >
                <img src={item.imageUrl} alt={`${item.name}风景`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className={`absolute inset-0 ${selected.name === item.name ? 'bg-ink/50' : 'bg-ink/38'}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/20 to-transparent" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/18 px-3 py-1 text-xs font-black backdrop-blur">
                    {item.city}
                  </span>
                    <span className="text-sm font-black opacity-80">{item.image}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl font-black">{item.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white/16 px-2.5 py-1 text-xs font-bold backdrop-blur">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <section className="dark-glass overflow-hidden rounded-[1.8rem] p-0 text-white shadow-soft">
            <div className="relative min-h-[260px] p-6">
              <img src={selected.imageUrl} alt={`${selected.name}风景`} className="absolute inset-0 h-full w-full object-cover opacity-65" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/15" />
              <div className="relative">
            <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-jade">AI Narration Studio</p>
                <h2 className="mt-2 font-display text-4xl font-black">{selected.name}</h2>
                <p className="mt-3 max-w-2xl leading-7 text-white/64">{selected.intro}</p>
              </div>
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/10">
                  <Mic2 className="h-9 w-9 text-jade" />
                </div>
              </div>

            <div className="flex flex-wrap gap-2">
              {voiceTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setVoice(tab.id);
                    setToast(`已生成 ${selected.name} · ${tab.label}`);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-black transition active:scale-95 ${
                    voice === tab.id ? 'bg-jade text-ink' : 'bg-white/10 text-white/70 hover:bg-white/16'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
              </div>
            </div>

            <div className="grid gap-5 p-6 xl:grid-cols-[1fr_260px]">
              <div className="rounded-[1.5rem] bg-white/10 p-6">
                <div className="mb-4 flex items-center gap-3 text-jade">
                  <MessageCircle className="h-6 w-6" />
                  <span className="font-black">{voiceTabs.find((item) => item.id === voice)?.label}</span>
                </div>
                <p className="text-lg font-semibold leading-9 text-white/86">{selected.voices[voice]}</p>
              </div>
              <div className="space-y-4">
                <div className="rounded-[1.5rem] bg-white/10 p-5">
                  <UsersRound className="mb-4 h-6 w-6 text-jade" />
                  <div className="font-black">人群适配</div>
                  <p className="mt-2 text-sm leading-6 text-white/60">语气、长度、重点自动切换。</p>
                </div>
                <div className="rounded-[1.5rem] bg-white/10 p-5">
                  <Camera className="mb-4 h-6 w-6 text-jade" />
                  <div className="font-black">传播生成</div>
                  <p className="mt-2 text-sm leading-6 text-white/60">口播、文案、拍照建议同步产出。</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
