import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, Loader2, MapPin, Trash2, UploadCloud, X } from 'lucide-react';
import { cities, type CityName } from '../data/mockData';
import { clearJournal, compressPhoto, deletePhoto, loadPhoto, savePhoto } from '../services/journalStorage';
import { useTrip } from '../state/tripStore';
import type { JournalEntry } from '../types/route';

type PendingPhoto = { id: string; file: File; preview: string; progress: number; status: 'pending' | 'compressing' | 'saved' | 'error'; error?: string };

export function JournalPage() {
  const { journalEntries: entries, setJournalEntries, plan, notify } = useTrip();
  const [mode, setMode] = useState<'real' | 'example'>('real');
  const [draft, setDraft] = useState({ pointName: '', note: '', city: '武汉' as CityName, visitedAt: new Date().toISOString().slice(0, 10) });
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let alive = true;
    const ids = entries.flatMap((entry) => entry.photoIds);
    Promise.all(ids.map(async (id) => [id, await loadPhoto(id)] as const)).then((rows) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      rows.forEach(([id, blob]) => { if (blob) next[id] = URL.createObjectURL(blob); });
      setPhotoUrls((old) => { Object.values(old).forEach(URL.revokeObjectURL); return next; });
    }).catch(() => notify('IndexedDB 照片读取失败，文字记录仍可使用。', 'error'));
    return () => { alive = false; };
  }, [entries, notify]);

  useEffect(() => () => pending.forEach((item) => URL.revokeObjectURL(item.preview)), [pending]);

  const stats = useMemo(() => ({ places: new Set(entries.map((entry) => entry.pointName)).size, cities: new Set(entries.map((entry) => entry.city)).size, photos: entries.reduce((sum, entry) => sum + entry.photoIds.length, 0) }), [entries]);
  const examplePoints = plan?.route.points ?? [];

  const chooseFiles = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if (pending.length + selected.length > 6) { setFormError('每次最多选择 6 张图片。'); return; }
    const tooLarge = selected.find((file) => file.size > 10 * 1024 * 1024);
    if (tooLarge) { setFormError(`${tooLarge.name} 超过 10MB 原图上限。`); return; }
    setPending((current) => [...current, ...selected.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), progress: 0, status: 'pending' as const }))]);
    setFormError('');
  };

  const removePending = (id: string) => setPending((items) => { const target = items.find((item) => item.id === id); if (target) URL.revokeObjectURL(target.preview); return items.filter((item) => item.id !== id); });

  const saveRecord = async () => {
    if (!draft.pointName.trim()) { setFormError('请填写地点。'); return; }
    if (!draft.visitedAt) { setFormError('请选择日期。'); return; }
    if (!draft.note.trim() && pending.length === 0) { setFormError('请填写文字记录或至少选择一张照片。'); return; }
    setSaving(true); setFormError('');
    const savedIds: string[] = [];
    try {
      for (const photo of pending) {
        setPending((items) => items.map((item) => item.id === photo.id ? { ...item, status: 'compressing', progress: 5 } : item));
        const compressed = await compressPhoto(photo.file, (progress) => setPending((items) => items.map((item) => item.id === photo.id ? { ...item, progress } : item)));
        if (compressed.size > 1.5 * 1024 * 1024) notify(`${photo.file.name} 压缩后仍超过建议的 1.5MB。`, 'info');
        const photoId = await savePhoto(compressed);
        savedIds.push(photoId);
        setPending((items) => items.map((item) => item.id === photo.id ? { ...item, status: 'saved', progress: 100 } : item));
      }
      const entry: JournalEntry = { id: crypto.randomUUID(), pointId: `real-${crypto.randomUUID()}`, pointName: draft.pointName.trim(), city: draft.city, day: 1, note: draft.note.trim(), visitedAt: draft.visitedAt, photoIds: savedIds };
      setJournalEntries([entry, ...entries]);
      pending.forEach((item) => URL.revokeObjectURL(item.preview));
      setPending([]); setDraft((value) => ({ ...value, pointName: '', note: '' }));
      notify('真实足迹已保存。', 'success');
    } catch (error) {
      await Promise.all(savedIds.map(deletePhoto));
      const message = `IndexedDB 保存失败：${error instanceof Error ? error.message : '未知错误'}。请检查浏览器存储权限和剩余容量。`;
      setFormError(message); notify(message, 'error');
    } finally { setSaving(false); }
  };

  const removeEntry = async (entry: JournalEntry) => {
    try { await Promise.all(entry.photoIds.map(deletePhoto)); setJournalEntries(entries.filter((item) => item.id !== entry.id)); notify('记录已删除。', 'success'); }
    catch { notify('删除照片失败，记录未更改。', 'error'); }
  };

  const clearAll = async () => {
    if (!window.confirm('清空全部真实足迹和照片？此操作无法撤销。')) return;
    try { await clearJournal(entries); setJournalEntries([]); notify('真实足迹已清空。', 'success'); } catch { notify('清空失败，请重试。', 'error'); }
  };

  return <main className="section-pad py-10"><div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-black uppercase tracking-[.2em] text-river">Travel Journal</p><h1 className="mt-2 font-display text-4xl font-black">示例路线 ≠ 真实足迹</h1><p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-ink/55">只有你主动保存的文字或照片才计入足迹统计；规划中的默认点位始终标注为示例路线。</p></div><div className="grid grid-cols-3 gap-2">{[['地点', stats.places], ['城市', stats.cities], ['照片', stats.photos]].map(([label, value]) => <div key={label} className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm"><div className="font-display text-2xl font-black">{value}</div><div className="text-xs font-bold text-ink/45">{label}</div></div>)}</div></div>

    <div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
      <section className="glass rounded-[2rem] p-5 shadow-soft"><h2 className="font-display text-2xl font-black">新增真实记录</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="地点 *" htmlFor="journal-place"><input id="journal-place" value={draft.pointName} onChange={(event) => setDraft({ ...draft, pointName: event.target.value })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3" /></Field><Field label="日期 *" htmlFor="journal-date"><input id="journal-date" type="date" value={draft.visitedAt} onChange={(event) => setDraft({ ...draft, visitedAt: event.target.value })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3" /></Field><Field label="城市" htmlFor="journal-city"><select id="journal-city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value as CityName })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3">{cities.map((city) => <option key={city.name}>{city.name}</option>)}</select></Field></div><Field label="文字记录（与照片至少填一项）" htmlFor="journal-note"><textarea id="journal-note" rows={4} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3" /></Field>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-river/40 bg-white/70 px-4 py-4 font-black text-river"><ImagePlus className="h-5 w-5" />选择照片<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { chooseFiles(event.target.files); event.currentTarget.value = ''; }} /></label><p className="mt-2 text-xs font-bold leading-5 text-ink/45">每次最多6张，原图每张≤10MB；保存前压缩至最长边1920px、WebP质量0.82，压缩后建议≤1.5MB。照片仅存本机 IndexedDB。</p>
        {pending.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{pending.map((photo) => <div key={photo.id} className="relative overflow-hidden rounded-2xl bg-white p-2 shadow-sm"><img src={photo.preview} alt="待上传预览" className="aspect-square w-full rounded-xl object-cover" /><button type="button" aria-label="删除待上传照片" onClick={() => removePending(photo.id)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white"><X className="h-4 w-4" /></button><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-jade" style={{ width: `${photo.progress}%` }} /></div><div className="mt-1 text-[10px] font-bold text-ink/50">{photo.status === 'compressing' ? `压缩 ${photo.progress}%` : photo.status === 'saved' ? '已写入' : '等待保存'}</div></div>)}</div>}
        {formError && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{formError}</p>}
        <button type="button" disabled={saving} onClick={saveRecord} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-4 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}{saving ? '保存中…' : '保存记录'}</button>
      </section>

      <section className="rounded-[2rem] bg-white p-5 shadow-soft"><div className="flex items-center justify-between gap-3"><div className="flex rounded-full bg-mist p-1" role="tablist">{(['real', 'example'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={`rounded-full px-4 py-2 text-sm font-black ${mode === item ? 'bg-ink text-white' : 'text-ink/55'}`}>{item === 'real' ? `真实足迹 ${entries.length}` : `示例路线 ${examplePoints.length}`}</button>)}</div>{entries.length > 0 && mode === 'real' && <button type="button" onClick={clearAll} className="text-xs font-black text-red-600">清空真实记录</button>}</div>
        <div className="mt-5 space-y-4">{mode === 'real' ? entries.length ? entries.map((entry) => <article key={entry.id} className="rounded-3xl border border-ink/10 p-4"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-black text-jade"><CheckCircle2 className="h-4 w-4" />用户真实足迹</div><h3 className="mt-2 font-display text-2xl font-black">{entry.pointName}</h3><p className="mt-1 text-xs font-bold text-ink/45">{entry.city} · {entry.visitedAt}</p></div><button type="button" aria-label={`删除${entry.pointName}`} onClick={() => removeEntry(entry)} className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></div>{entry.note && <p className="mt-3 text-sm font-semibold leading-6 text-ink/65">{entry.note}</p>}{entry.photoIds.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{entry.photoIds.map((id) => photoUrls[id] ? <img key={id} src={photoUrls[id]} alt={`${entry.pointName}真实记录`} className="aspect-square w-full rounded-xl object-cover" /> : <div key={id} className="grid aspect-square place-items-center rounded-xl bg-mist"><Camera className="h-5 w-5 text-ink/25" /></div>)}</div>}</article>) : <div className="grid min-h-[280px] place-items-center rounded-3xl bg-mist/50 p-8 text-center"><div><MapPin className="mx-auto h-9 w-9 text-river" /><h3 className="mt-3 font-display text-2xl font-black">0 条真实记录</h3><p className="mt-2 text-sm font-bold text-ink/45">保存第一条文字或照片后才会计入统计。</p></div></div> : examplePoints.length ? examplePoints.map((point, index) => <article key={point.id} className="rounded-3xl border border-dashed border-river/30 bg-river/5 p-4"><div className="text-xs font-black text-river">示例路线 · 不计入足迹</div><h3 className="mt-2 font-display text-xl font-black">{index + 1}. {point.name}</h3><p className="mt-1 text-xs font-bold text-ink/50">第{point.day ?? 1}天 · {point.time}</p></article>) : <p className="rounded-3xl bg-mist p-6 text-sm font-bold text-ink/50">尚未生成示例路线。</p>}</div>
      </section>
    </div>
  </div></main>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div><label htmlFor={htmlFor} className="mb-2 block text-sm font-black text-ink/65">{label}</label>{children}</div>; }
