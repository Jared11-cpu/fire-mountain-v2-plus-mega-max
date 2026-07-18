import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Camera, Download, ImagePlus, Loader2, MapPin, Pencil, Route as RouteIcon, Save, Trash2, UploadCloud, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cities, type CityName } from '../data/mockData';
import { parseLocalDate, type TripPlan } from '../domain/trip';
import { clearJournal, compressPhoto, deletePhoto, loadPhoto, savePhoto } from '../services/journalStorage';
import { useTrip } from '../state/tripStore';
import type { JournalEntry, RoutePoint, SmartRoute } from '../types/route';
import { RouteMap } from './RouteMap';

type PendingPhoto = { id: string; file: File; preview: string; progress: number; status: 'pending' | 'compressing' | 'saved' | 'error'; error?: string };
type JournalMapEntry = JournalEntry & { photoUrl?: string; isExample?: boolean };

const cityCoordinates: Record<CityName, [number, number]> = {
  武汉: [114.3055, 30.5928], 宜昌: [111.2865, 30.6919], 恩施: [109.4882, 30.2722],
  荆州: [112.2397, 30.3352], 襄阳: [112.1224, 32.009], 黄石: [115.0389, 30.1995],
};

export function buildCompletedJournalEntries(entries: JournalEntry[], plan: TripPlan | null): JournalEntry[] {
  if (!plan) return entries;
  const completedPointIds = new Set(plan.dailyRecords.flatMap((record) => record.checkedPointIds));
  return plan.route.points.filter((point) => completedPointIds.has(point.id)).map((point) => {
    const existing = entries.find((entry) => entry.pointId === point.id)
      ?? entries.find((entry) => entry.pointName.trim() === point.name.trim());
    const day = point.day ?? 1;
    const record = plan.dailyRecords.find((item) => item.day === day);
    return {
      id: existing?.id ?? `itinerary-${point.id}`,
      pointId: point.id,
      pointName: point.name,
      city: point.city,
      day,
      note: existing?.note || record?.note || '',
      visitedAt: record?.date ?? plan.requestSnapshot.startDate,
      lat: point.lat,
      lng: point.lng,
      photoIds: existing?.photoIds ?? [],
    };
  });
}

function mergeCompletedJournalEntries(entries: JournalEntry[], plan: TripPlan) {
  const synced = buildCompletedJournalEntries(entries, plan);
  const completedPointIds = new Set(synced.map((entry) => entry.pointId));
  const completedNames = new Set(synced.map((entry) => entry.pointName.trim()));
  const unrelated = entries.filter((entry) => !completedPointIds.has(entry.pointId) && !completedNames.has(entry.pointName.trim()));
  return [...synced, ...unrelated];
}

export function JournalPage() {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const { journalEntries: entries, setJournalEntries, plan, patchPlan, notify } = useTrip();
  const [mode, setMode] = useState<'real' | 'example'>('real');
  const [draft, setDraft] = useState({ pointName: '', note: '', city: '武汉' as CityName, visitedAt: new Date().toISOString().slice(0, 10) });
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const pendingRef = useRef<PendingPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [exportingPoster, setExportingPoster] = useState(false);
  const [formError, setFormError] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => { pendingRef.current = pending; }, [pending]);
  useEffect(() => () => pendingRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  useEffect(() => {
    let alive = true;
    const ids = entries.flatMap((entry) => entry.photoIds);
    Promise.all(ids.map(async (id) => [id, await loadPhoto(id)] as const)).then((rows) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      rows.forEach(([id, blob]) => { if (blob) next[id] = URL.createObjectURL(blob); });
      setPhotoUrls((old) => { Object.values(old).forEach(URL.revokeObjectURL); return next; });
    }).catch((error) => {
      console.error('Journal photo load failed', error);
      notify('IndexedDB 照片读取失败，文字记录仍可使用。', 'error');
    });
    return () => { alive = false; };
  }, [entries, notify]);

  const completedEntries = useMemo(() => buildCompletedJournalEntries(entries, plan), [entries, plan]);
  useEffect(() => {
    if (!plan) return;
    const merged = mergeCompletedJournalEntries(entries, plan);
    if (JSON.stringify(merged) !== JSON.stringify(entries)) setJournalEntries(merged);
  }, [entries, plan, setJournalEntries]);

  const stats = useMemo(() => ({ places: new Set(completedEntries.map((entry) => entry.pointName)).size, cities: new Set(completedEntries.map((entry) => entry.city)).size, photos: completedEntries.reduce((sum, entry) => sum + entry.photoIds.length, 0) }), [completedEntries]);
  const examplePoints = plan?.route.points ?? [];
  const realMapEntries: JournalMapEntry[] = completedEntries.map((entry) => ({ ...entry, photoUrl: entry.photoIds.map((id) => photoUrls[id]).find(Boolean) }));
  const exampleMapEntries: JournalMapEntry[] = examplePoints.map((point) => ({ id: `example-${point.id}`, pointId: point.id, pointName: point.name, city: point.city, day: point.day ?? 1, note: point.recordTip, visitedAt: plan?.requestSnapshot.startDate ?? new Date().toISOString().slice(0, 10), lat: point.lat, lng: point.lng, photoIds: [], photoUrl: point.imageUrl, isExample: true }));
  const visibleEntries = mode === 'real' ? realMapEntries : exampleMapEntries;

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
        const photoId = await savePhoto(compressed); savedIds.push(photoId);
        setPending((items) => items.map((item) => item.id === photo.id ? { ...item, status: 'saved', progress: 100 } : item));
      }
      const matchedPoint = plan?.route.points.find((point) => point.name === draft.pointName.trim());
      const [fallbackLng, fallbackLat] = cityCoordinates[draft.city];
      const entry: JournalEntry = { id: crypto.randomUUID(), pointId: matchedPoint?.id ?? `real-${crypto.randomUUID()}`, pointName: draft.pointName.trim(), city: draft.city, day: matchedPoint?.day ?? 1, note: draft.note.trim(), visitedAt: draft.visitedAt, lat: matchedPoint?.lat ?? fallbackLat, lng: matchedPoint?.lng ?? fallbackLng, photoIds: savedIds };
      if (matchedPoint) patchPlan((value) => ({ ...value, dailyRecords: value.dailyRecords.map((record) => record.day === (matchedPoint.day ?? 1) && !record.checkedPointIds.includes(matchedPoint.id) ? { ...record, checkedPointIds: [...record.checkedPointIds, matchedPoint.id] } : record) }));
      setJournalEntries([entry, ...entries]);
      pending.forEach((item) => URL.revokeObjectURL(item.preview));
      setPending([]); setDraft((value) => ({ ...value, pointName: '', note: '' })); setMode('real');
      notify('这一页旅行手账已保存。', 'success');
    } catch (error) {
      await Promise.all(savedIds.map(deletePhoto));
      const message = `IndexedDB 保存失败：${error instanceof Error ? error.message : '未知错误'}。请检查浏览器存储权限和剩余容量。`;
      setFormError(message); notify(message, 'error');
    } finally { setSaving(false); }
  };

  const removeEntry = async (entry: JournalEntry) => {
    try { await Promise.all(entry.photoIds.map(deletePhoto)); setJournalEntries(entries.filter((item) => item.id !== entry.id)); notify('记录已删除。', 'success'); }
    catch (error) { console.error('Journal entry delete failed', error); notify('删除照片失败，记录未更改。', 'error'); }
  };

  const clearAll = async () => {
    if (!window.confirm('清空全部已完成景点和照片？此操作无法撤销。')) return;
    try { await clearJournal(entries); patchPlan((value) => ({ ...value, dailyRecords: value.dailyRecords.map((record) => ({ ...record, checkedPointIds: [] })) })); setJournalEntries([]); notify('已完成景点与旅行记录已清空。', 'success'); }
    catch (error) { console.error('Journal clear failed', error); notify('清空失败，请重试。', 'error'); }
  };

  const savePoster = async () => {
    if (visibleEntries.length === 0) return;
    setExportingPoster(true);
    try {
      await downloadJournalPoster(visibleEntries, mode);
      notify('手写路线海报已保存为 PNG。', 'success');
    } catch (error) {
      console.error('Journal poster export failed', error);
      notify('海报生成失败，请稍后重试。', 'error');
    } finally { setExportingPoster(false); }
  };

  if (entryId) return <JournalDetail entry={entries.find((entry) => entry.id === entryId)} photoUrls={photoUrls} onBack={() => navigate('/journal')} onSave={(updated) => setJournalEntries(entries.map((item) => item.id === updated.id ? updated : item))} onDelete={async (entry) => { await removeEntry(entry); navigate('/journal'); }} notify={notify} />;

  return <main aria-label="旅行手账地图" className="relative h-[calc(100vh-10.25rem)] min-h-[690px] overflow-hidden bg-[#d8eee8]">
    <JournalRouteMap entries={visibleEntries} mode={mode} sourceRoute={plan?.route} onOpen={(id) => mode === 'real' && navigate(`/journal/${id}`)} />

    <section className="pointer-events-none absolute left-4 right-4 top-4 z-50 flex items-start justify-between gap-4">
      <div className="pointer-events-auto max-w-[min(640px,calc(100vw-2rem))] rounded-[1.4rem] border border-white/65 bg-white/88 p-3 shadow-[0_18px_55px_rgba(18,34,42,.2)] backdrop-blur-xl md:p-4">
        <div className="flex flex-wrap items-center gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black tracking-[.2em] text-river"><RouteIcon className="h-4 w-4"/>MY HUBEI ROUTE</div><h1 className="journal-handwriting mt-1 text-2xl font-black md:text-3xl">我的旅行路线手账</h1></div><div className="ml-auto hidden grid-cols-3 gap-1.5 sm:grid">{[['地点', stats.places], ['城市', stats.cities], ['照片', stats.photos]].map(([label, value]) => <div key={label} className="min-w-14 rounded-xl bg-ink/[.05] px-2 py-1.5 text-center"><b className="block text-sm">{value}</b><span className="text-[9px] font-bold text-ink/45">{label}</span></div>)}</div></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><div className="flex rounded-full bg-ink/[.06] p-1" role="tablist">{(['real', 'example'] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={`rounded-full px-3 py-2 text-[11px] font-black transition ${mode === item ? 'bg-ink text-white shadow-sm' : 'text-ink/55'}`}>{item === 'real' ? `已完成景点 ${completedEntries.length}` : `完整行程 ${examplePoints.length}`}</button>)}</div><button type="button" onClick={() => setShowComposer(true)} className="inline-flex items-center gap-1.5 rounded-full bg-river px-3 py-2 text-[11px] font-black text-white"><BookOpen className="h-3.5 w-3.5"/>记录行程景点</button><button type="button" disabled={visibleEntries.length === 0 || exportingPoster} onClick={savePoster} className="inline-flex items-center gap-1.5 rounded-full bg-tower px-3 py-2 text-[11px] font-black text-white disabled:opacity-40"><Download className="h-3.5 w-3.5"/>{exportingPoster ? '正在绘制…' : '保存海报'}</button>{completedEntries.length > 0 && mode === 'real' && <button type="button" onClick={clearAll} className="rounded-full px-3 py-2 text-[11px] font-black text-red-600">清空记录</button>}</div>
      </div>
    </section>

    {showComposer && <aside aria-label="新增旅行记录" className="absolute bottom-4 right-4 top-4 z-[60] w-[min(390px,calc(100vw-2rem))] overflow-y-auto rounded-[1.6rem] border border-white/70 bg-[#fffdf7]/94 p-5 shadow-[0_28px_80px_rgba(18,34,42,.28)] backdrop-blur-xl"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-tower"/><h2 className="font-display text-2xl font-black">记录行程景点</h2></div><button type="button" aria-label="关闭新增手账" onClick={() => setShowComposer(false)} className="grid h-9 w-9 place-items-center rounded-full bg-ink/5"><X className="h-4 w-4"/></button></div><p className="mt-3 rounded-2xl bg-river/[.06] px-3 py-2 text-xs font-bold leading-5 text-river">选择 AI 行程中的实际景点，保存后会自动标记完成并显示在对应地图位置。</p><div className="mt-5 grid gap-4"><Field label="AI 行程景点 *" htmlFor="journal-place">{plan ? <select id="journal-place" value={draft.pointName} onChange={(event) => { const point = plan.route.points.find((item) => item.name === event.target.value); setDraft({ ...draft, pointName: event.target.value, city: point?.city ?? draft.city }); }} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3"><option value="">请选择行程景点</option>{plan.route.points.map((point) => <option key={point.id} value={point.name}>{point.name}</option>)}</select> : <input id="journal-place" value={draft.pointName} onChange={(event) => setDraft({ ...draft, pointName: event.target.value })} placeholder="例如：黄鹤楼" className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3" />}</Field><Field label="日期 *" htmlFor="journal-date"><input id="journal-date" type="date" value={draft.visitedAt} onChange={(event) => setDraft({ ...draft, visitedAt: event.target.value })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3" /></Field><Field label="城市" htmlFor="journal-city"><select id="journal-city" value={draft.city} disabled={Boolean(plan)} onChange={(event) => setDraft({ ...draft, city: event.target.value as CityName })} className="focus-ring w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-ink/[.04]">{cities.map((city) => <option key={city.name}>{city.name}</option>)}</select></Field><Field label="手账心得" htmlFor="journal-note"><textarea id="journal-note" rows={5} value={draft.note} placeholder="当时看见了什么、听见了什么？" onChange={(event) => setDraft({ ...draft, note: event.target.value })} className="journal-handwriting focus-ring w-full resize-none rounded-2xl border border-ink/10 bg-white px-4 py-3 text-lg leading-7" /></Field></div>
      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-river/40 bg-white/70 px-4 py-4 font-black text-river"><ImagePlus className="h-5 w-5" />选择照片<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { chooseFiles(event.target.files); event.currentTarget.value = ''; }} /></label>
      {pending.length > 0 && <div className="mt-4 grid grid-cols-2 gap-3">{pending.map((photo) => <div key={photo.id} className="relative overflow-hidden rounded-2xl bg-white p-2 shadow-sm"><img src={photo.preview} alt="待上传预览" className="aspect-square w-full rounded-xl object-cover" /><button type="button" aria-label="删除待上传照片" onClick={() => removePending(photo.id)} className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white"><X className="h-4 w-4" /></button><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-jade" style={{ width: `${photo.progress}%` }} /></div></div>)}</div>}
      {formError && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{formError}</p>}<button type="button" disabled={saving} onClick={saveRecord} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-4 font-black text-white disabled:opacity-60">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}{saving ? '保存中…' : '保存这一页'}</button>
    </aside>}
  </main>;
}

function JournalRouteMap({ entries, mode, sourceRoute, onOpen }: { entries: JournalMapEntry[]; mode: 'real' | 'example'; sourceRoute?: SmartRoute; onOpen: (id: string) => void }) {
  const orderedEntries = useMemo(() => orderJournalEntries(entries, sourceRoute), [entries, sourceRoute]);
  const route = useMemo(() => buildJournalMapRoute(orderedEntries, sourceRoute, mode), [orderedEntries, sourceRoute, mode]);
  const [selectedId, setSelectedId] = useState<string | undefined>(orderedEntries[0]?.id);
  useEffect(() => { setSelectedId(orderedEntries[0]?.id); }, [mode, orderedEntries[0]?.id]);
  const selectedIndex = Math.max(0, route?.points.findIndex((point) => point.id === selectedId) ?? 0);

  if (!route) return <div className="grid h-full min-h-[690px] place-items-center bg-[#e3eee9]"><div className="rounded-3xl bg-white/90 px-8 py-7 text-center text-ink/45 shadow-xl backdrop-blur"><MapPin className="mx-auto h-10 w-10 text-river/45" /><p className="mt-3 font-black">{mode === 'real' ? '还没有已完成景点，请先在 AI 行程的“每日记录”中完成一站。' : '请先生成一条行程路线。'}</p></div></div>;

  return <div className="relative h-full min-h-[690px] overflow-hidden bg-white">
    <RouteMap route={route} selectedPointId={selectedId} activePointIndex={selectedIndex} navigating={false} journalCards={orderedEntries.map(({ id, note, photoUrl }) => ({ id, note, photoUrl }))} onSelectPoint={(point) => { setSelectedId(point.id); if (mode === 'real') onOpen(point.id); }} mapOnly />
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink/88 px-4 py-2 text-[11px] font-black text-white shadow-lg backdrop-blur">{mode === 'real' ? '点击地点卡片翻开并编辑完整手账' : '示例路线仅供查看'} · {orderedEntries.length} 站</div>
  </div>;
}

function orderJournalEntries(entries: JournalMapEntry[], sourceRoute?: SmartRoute) {
  const pointOrder = new Map(sourceRoute?.points.map((point, index) => [point.id, index]) ?? []);
  return entries.slice().sort((left, right) => left.visitedAt.localeCompare(right.visitedAt) || left.day - right.day || (pointOrder.get(left.pointId) ?? 999) - (pointOrder.get(right.pointId) ?? 999));
}

export function buildJournalMapRoute(entries: JournalMapEntry[], sourceRoute: SmartRoute | undefined, mode: 'real' | 'example'): SmartRoute | null {
  const valid = entries.filter((entry) => Number.isFinite(entry.lng) && Number.isFinite(entry.lat));
  if (!valid.length) return null;
  const points: RoutePoint[] = valid.map((entry, index) => {
    const sourcePoint = sourceRoute?.points.find((point) => point.id === entry.pointId);
    return {
      ...(sourcePoint ?? {}), id: entry.id, name: entry.pointName, city: entry.city, lat: entry.lat!, lng: entry.lng!, coordinateSystem: sourcePoint?.coordinateSystem ?? 'gcj02',
      type: index === 0 ? 'start' : index === valid.length - 1 ? 'end' : sourcePoint?.type ?? 'scenic', time: sourcePoint?.time ?? '09:00', stayMinutes: sourcePoint?.stayMinutes ?? 30,
      reason: entry.note || sourcePoint?.reason || '旅行手账中的真实抵达记录。', photoTip: entry.photoIds.length ? `已保存 ${entry.photoIds.length} 张照片。` : sourcePoint?.photoTip || '可以补充这一站的照片。', recordTip: entry.note || sourcePoint?.recordTip || '这一站等待你的心得。', imageUrl: entry.photoUrl ?? sourcePoint?.imageUrl,
    } as RoutePoint;
  });
  return {
    id: `journal-${mode}-${valid.map((entry) => entry.id).join('-')}`, title: mode === 'real' ? '我的旅行手账路线' : sourceRoute?.title ?? '行程示例路线', city: points[0].city, startPoint: points[0], points,
    totalDistanceKm: sourceRoute?.totalDistanceKm ?? 0, estimatedTime: sourceRoute?.estimatedTime ?? '按足迹顺序连接', transportSuggestion: sourceRoute?.transportSuggestion ?? '手账路线仅用于回顾', recommendedStartTime: sourceRoute?.recommendedStartTime ?? '09:00', avoidTips: sourceRoute?.avoidTips ?? [],
    sceneryAnalysis: sourceRoute?.sceneryAnalysis ?? { highlights: [], bestPhotoTimes: [], videoShots: [], socialCopy: '', crowdTips: {} },
  };
}

function JournalPaperMap({ entries, onOpen }: { entries: JournalMapEntry[]; onOpen: (id: string) => void }) {
  const points = layoutJournalPosterPoints(entries);
  const route = points.map((point) => `${point.x},${point.y}`).join(' ');
  return <div className="journal-notebook-lines absolute inset-0 overflow-auto px-4 pb-5 pt-16 md:px-7">
    <div className="relative mx-auto max-w-[780px] overflow-hidden rounded-[1.2rem] border border-river/15 bg-[#fffdf5]/90 shadow-[0_18px_50px_rgba(18,34,42,.10)]">
      <svg viewBox="0 0 800 520" role="img" aria-label="湖北轮廓与旅行足迹路线图" className="block w-full">
        <defs><filter id="journal-rough"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5"/></filter><pattern id="journal-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#0e6b72" strokeOpacity=".055" strokeWidth="1"/></pattern></defs>
        <rect width="800" height="520" fill="#fffdf5"/><rect width="800" height="520" fill="url(#journal-grid)"/>
        <text x="42" y="48" fill="#0e6b72" fontSize="13" fontWeight="800" letterSpacing="4">HUBEI · TRAVEL NOTES</text>
        <text x="758" y="48" fill="#1c2f38" fillOpacity=".42" fontSize="12" textAnchor="end">湖北轮廓示意 · 非导航地图</text>
        <path d={HUBEI_OUTLINE_PATH} fill="#dceee5" stroke="#0e6b72" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#journal-rough)"/>
        <path d="M155 292 C235 278 296 308 359 292 C430 274 512 314 650 277" fill="none" stroke="#63aeb8" strokeWidth="8" strokeOpacity=".55" strokeLinecap="round" filter="url(#journal-rough)"/>
        <text x="606" y="270" fill="#0e6b72" fillOpacity=".55" fontSize="12">长江</text>
        {points.length > 1 && <><polyline points={route} fill="none" stroke="#fffdf5" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/><polyline points={route} fill="none" stroke="#c94f3d" strokeWidth="5" strokeDasharray="12 10" strokeLinecap="round" strokeLinejoin="round" filter="url(#journal-rough)"/></>}
        {points.map((point, index) => <g key={point.entry.id} className="cursor-pointer" onClick={() => onOpen(point.entry.id)} role="button" aria-label={`${point.entry.pointName}，第${index + 1}站`}>
          <circle cx={point.x} cy={point.y} r="18" fill="#fffdf5" stroke="#0e6b72" strokeWidth="3"/><circle cx={point.x} cy={point.y} r="13" fill="#0e6b72"/><text x={point.x} y={point.y + 5} fill="white" fontSize="13" fontWeight="900" textAnchor="middle">{index + 1}</text>
          <text x={point.x + point.labelDx} y={point.y + point.labelDy} fill="#1c2f38" fontSize="13" fontWeight="800" textAnchor={point.labelDx < 0 ? 'end' : 'start'} paintOrder="stroke" stroke="#fffdf5" strokeWidth="5">{point.entry.pointName}</text>
        </g>)}
        {entries.length === 0 && <g><MapPin x="374" y="218" width="52" height="52" color="#0e6b72" opacity=".3"/><text x="400" y="300" fill="#1c2f38" fillOpacity=".45" fontSize="22" fontFamily="KaiTi, STKaiti, serif" textAnchor="middle">第一站，等你落笔。</text></g>}
        <path d="M54 466 Q167 445 271 466 T489 464 T746 456" fill="none" stroke="#c94f3d" strokeOpacity=".45" strokeWidth="2"/>
        <text x="54" y="493" fill="#1c2f38" fillOpacity=".5" fontSize="13" fontFamily="KaiTi, STKaiti, serif">走过的地方，会在纸上重新相遇。</text>
      </svg>
    </div>
    {entries.length > 0 && <div className="mx-auto mt-4 grid max-w-[780px] gap-3 md:grid-cols-2">{entries.slice(0, 8).map((entry, index) => <button key={entry.id} type="button" onClick={() => onOpen(entry.id)} className={`flex min-w-0 items-center gap-3 rounded-2xl border border-ink/10 bg-white/90 p-3 text-left shadow-sm ${index % 2 ? 'rotate-[.4deg]' : 'rotate-[-.4deg]'}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-river font-black text-white">{index + 1}</span>{entry.photoUrl && <img src={entry.photoUrl} alt="" className="h-14 w-14 rounded-xl object-cover"/>}<span className="min-w-0"><strong className="block truncate">{entry.pointName}</strong><em className="journal-handwriting mt-1 line-clamp-2 block text-sm not-italic text-ink/55">{entry.note || '这一站等待你的心得。'}</em></span></button>)}</div>}
  </div>;
}

const HUBEI_OUTLINE_PATH = 'M130 262 C112 220 137 175 190 163 C220 112 288 118 323 86 C372 104 414 82 458 108 C502 92 551 113 571 150 C623 162 674 188 665 229 C697 254 677 297 639 309 C626 352 579 369 533 354 C498 386 442 379 410 353 C365 378 316 365 293 340 C239 354 192 331 184 302 C153 300 133 282 130 262 Z';
type PosterPoint = { entry: JournalMapEntry; x: number; y: number; labelDx: number; labelDy: number };

export function layoutJournalPosterPoints(entries: JournalMapEntry[]): PosterPoint[] {
  const placed: PosterPoint[] = [];
  entries.forEach((entry, index) => {
    const [fallbackLng, fallbackLat] = cityCoordinates[entry.city];
    const lng = entry.lng ?? fallbackLng;
    const lat = entry.lat ?? fallbackLat;
    let x = 150 + ((lng - 108.3) / 7.9) * 520;
    let y = 120 + ((33.4 - lat) / 4.4) * 260;
    const collisions = placed.filter((point) => Math.hypot(point.x - x, point.y - y) < 26).length;
    if (collisions) { const angle = collisions * 2.15 + index * .65; x += Math.cos(angle) * (24 + collisions * 7); y += Math.sin(angle) * (24 + collisions * 7); }
    x = Math.max(138, Math.min(674, x)); y = Math.max(96, Math.min(376, y));
    placed.push({ entry, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, labelDx: x > 520 ? -25 : 25, labelDy: index % 2 ? 28 : -24 });
  });
  return placed;
}

function escapeSvg(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char); }
function truncatePosterText(value: string, max = 28) { const normalized = value.replace(/\s+/g, ' ').trim(); return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized; }

export function buildJournalPosterSvg(entries: JournalMapEntry[], mode: 'real' | 'example') {
  const points = layoutJournalPosterPoints(entries);
  const route = points.map((point) => `${point.x},${point.y}`).join(' ');
  const markers = points.map((point, index) => `<g><circle cx="${point.x}" cy="${point.y}" r="24" fill="#fffaf0" stroke="#0e6b72" stroke-width="5"/><circle cx="${point.x}" cy="${point.y}" r="17" fill="#0e6b72"/><text x="${point.x}" y="${point.y + 7}" text-anchor="middle" fill="#fff" font-size="20" font-weight="900">${index + 1}</text><text x="${point.x + point.labelDx}" y="${point.y + point.labelDy}" text-anchor="${point.labelDx < 0 ? 'end' : 'start'}" fill="#1c2f38" font-size="20" font-weight="800" paint-order="stroke" stroke="#fffaf0" stroke-width="7">${escapeSvg(truncatePosterText(point.entry.pointName, 12))}</text></g>`).join('');
  const cards = entries.slice(0, 10).map((entry, index) => { const column = index % 2; const row = Math.floor(index / 2); const x = 85 + column * 545; const y = 1020 + row * 118; return `<g transform="translate(${x} ${y}) rotate(${column ? 0.5 : -0.5})"><rect width="510" height="96" rx="20" fill="#fffdf7" stroke="#1c2f38" stroke-opacity=".12" stroke-width="2"/><circle cx="45" cy="48" r="25" fill="#0e6b72"/><text x="45" y="56" text-anchor="middle" fill="#fff" font-size="21" font-weight="900">${index + 1}</text><text x="85" y="38" fill="#1c2f38" font-size="23" font-weight="900">${escapeSvg(truncatePosterText(entry.pointName, 16))}</text><text x="85" y="70" fill="#1c2f38" fill-opacity=".62" font-size="18" font-family="KaiTi, STKaiti, serif">${escapeSvg(truncatePosterText(entry.note || '这一站，值得被记住。'))}</text></g>`; }).join('');
  const citiesText = Array.from(new Set(entries.map((entry) => entry.city))).join(' · ') || '等待出发';
  const dates = entries.map((entry) => entry.visitedAt).filter(Boolean).sort();
  const lastDate = dates[dates.length - 1];
  const dateText = dates.length ? dates[0] === lastDate ? dates[0] : `${dates[0]} — ${lastDate}` : new Date().toISOString().slice(0, 10);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754"><defs><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#0e6b72" stroke-opacity=".045" stroke-width="1"/></pattern><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="2" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="2"/></filter></defs><rect width="1240" height="1754" fill="#f7f1e4"/><rect x="38" y="38" width="1164" height="1678" rx="38" fill="#fffaf0" stroke="#1c2f38" stroke-opacity=".14" stroke-width="3"/><rect x="38" y="38" width="1164" height="1678" rx="38" fill="url(#grid)"/><text x="86" y="112" fill="#0e6b72" font-size="20" font-weight="900" letter-spacing="8">MY HUBEI ROUTE</text><text x="86" y="186" fill="#1c2f38" font-size="58" font-weight="900" font-family="KaiTi, STKaiti, serif">我的旅行路线手账</text><text x="88" y="230" fill="#1c2f38" fill-opacity=".55" font-size="19">${escapeSvg(mode === 'real' ? '已完成景点' : '完整行程')} · ${entries.length} 站 · ${escapeSvg(citiesText)}</text><text x="1154" y="112" text-anchor="end" fill="#1c2f38" fill-opacity=".45" font-size="18">${escapeSvg(dateText)}</text><g transform="translate(0 245) scale(1.55)"><path d="${HUBEI_OUTLINE_PATH}" fill="#dceee5" stroke="#0e6b72" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#rough)"/><path d="M155 292 C235 278 296 308 359 292 C430 274 512 314 650 277" fill="none" stroke="#63aeb8" stroke-width="8" stroke-opacity=".55" stroke-linecap="round"/>${points.length > 1 ? `<polyline points="${route}" fill="none" stroke="#fffaf0" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${route}" fill="none" stroke="#c94f3d" stroke-width="6" stroke-dasharray="13 11" stroke-linecap="round" stroke-linejoin="round"/>` : ''}${markers}</g><text x="1154" y="976" text-anchor="end" fill="#1c2f38" fill-opacity=".4" font-size="17">湖北轮廓示意 · 足迹按记录顺序连接 · 非导航地图</text>${cards}<path d="M88 1630 Q284 1598 454 1632 T824 1620 T1150 1610" fill="none" stroke="#c94f3d" stroke-opacity=".45" stroke-width="3"/><text x="88" y="1677" fill="#1c2f38" fill-opacity=".56" font-size="25" font-family="KaiTi, STKaiti, serif">走过的地方，会在纸上重新相遇。</text><text x="1152" y="1677" text-anchor="end" fill="#0e6b72" font-size="18" font-weight="800">楚游智导 · 旅行手账</text></svg>`;
}

async function downloadJournalPoster(entries: JournalMapEntry[], mode: 'real' | 'example') {
  const svg = buildJournalPosterSvg(entries, mode);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('SVG poster render failed')); image.src = svgUrl; });
    const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('PNG export failed')), 'image/png', .94));
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `我的湖北旅行路线手账-${new Date().toISOString().slice(0, 10)}.png`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally { URL.revokeObjectURL(svgUrl); }
}

function JournalDetail({ entry, photoUrls, onBack, onSave, onDelete, notify }: { entry?: JournalEntry; photoUrls: Record<string, string>; onBack: () => void; onSave: (entry: JournalEntry) => void; onDelete: (entry: JournalEntry) => Promise<void>; notify: ReturnType<typeof useTrip>['notify'] }) {
  if (!entry) return <main className="section-pad py-12"><div className="mx-auto max-w-3xl text-center"><h1 className="font-display text-4xl font-black">没有找到这一页手账</h1><button type="button" onClick={onBack} className="mt-6 rounded-full bg-ink px-5 py-3 font-black text-white">返回旅行手账</button></div></main>;
  return <JournalDetailEditor entry={entry} photoUrls={photoUrls} onBack={onBack} onSave={onSave} onDelete={onDelete} notify={notify} />;
}

function JournalDetailEditor({ entry, photoUrls, onBack, onSave, onDelete, notify }: { entry: JournalEntry; photoUrls: Record<string, string>; onBack: () => void; onSave: (entry: JournalEntry) => void; onDelete: (entry: JournalEntry) => Promise<void>; notify: ReturnType<typeof useTrip>['notify'] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ pointName: entry.pointName, city: entry.city, visitedAt: entry.visitedAt, note: entry.note });
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);
  const newPhotosRef = useRef<{ file: File; preview: string }[]>([]);
  const [savingChanges, setSavingChanges] = useState(false);
  const visiblePhotoIds = entry.photoIds.filter((id) => !removedPhotoIds.includes(id));
  const photos = visiblePhotoIds.map((id) => ({ id, url: photoUrls[id] })).filter((item): item is { id: string; url: string } => Boolean(item.url));

  useEffect(() => { newPhotosRef.current = newPhotos; }, [newPhotos]);
  useEffect(() => () => newPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview)), []);

  const cancelEditing = () => {
    newPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
    setNewPhotos([]); setRemovedPhotoIds([]); setDraft({ pointName: entry.pointName, city: entry.city, visitedAt: entry.visitedAt, note: entry.note }); setEditing(false);
  };
  const saveChanges = async () => {
    if (!draft.pointName.trim() || !draft.visitedAt) { notify('地点和日期不能为空。', 'error'); return; }
    setSavingChanges(true);
    const savedIds: string[] = [];
    try {
      for (const photo of newPhotos) savedIds.push(await savePhoto(await compressPhoto(photo.file)));
      await Promise.all(removedPhotoIds.map(deletePhoto));
      onSave({ ...entry, pointName: draft.pointName.trim(), city: draft.city, visitedAt: draft.visitedAt, note: draft.note.trim(), photoIds: [...visiblePhotoIds, ...savedIds] });
      newPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview));
      setNewPhotos([]); setRemovedPhotoIds([]); setEditing(false); notify('手账详细内容已更新。', 'success');
    } catch (error) {
      await Promise.all(savedIds.map(deletePhoto));
      console.error('Journal detail update failed', error); notify('手账修改保存失败，请检查浏览器存储空间。', 'error');
    } finally { setSavingChanges(false); }
  };

  return <main className="section-pad py-10"><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"><ArrowLeft className="h-4 w-4"/>返回路线手账</button><div className="flex gap-2">{editing ? <><button type="button" onClick={cancelEditing} className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm">取消</button><button type="button" disabled={savingChanges} onClick={saveChanges} className="inline-flex items-center gap-2 rounded-full bg-river px-4 py-2 text-sm font-black text-white shadow-sm"><Save className="h-4 w-4"/>{savingChanges ? '保存中…' : '保存修改'}</button></> : <><button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white"><Pencil className="h-4 w-4"/>编辑这一页</button><button type="button" aria-label="删除这一页手账" onClick={() => window.confirm('确定删除这一页手账和照片吗？') && onDelete(entry)} className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-600"><Trash2 className="h-4 w-4"/></button></>}</div></div><article className="journal-a4-page journal-notebook-lines relative mt-6 overflow-hidden rounded-[1.5rem] border border-ink/10 px-8 pb-14 pt-8 shadow-[0_30px_90px_rgba(18,34,42,.16)] md:px-14 md:pt-12">
    <div className="absolute bottom-0 left-9 top-0 w-px bg-tower/20" />
    <section className="relative z-10 overflow-hidden rounded-[1.25rem] bg-ink/[.04]">{photos.length > 0 || newPhotos.length > 0 ? <div className="grid grid-cols-2 gap-2">{photos.map(({ id, url }, index) => <div key={id} className="relative"><img src={url} alt={`${entry.pointName}记录照片${index + 1}`} className="aspect-[4/3] w-full object-cover" />{editing && <button type="button" aria-label="移除照片" onClick={() => setRemovedPhotoIds([...removedPhotoIds, id])} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"><X className="h-4 w-4"/></button>}</div>)}{newPhotos.map((photo, index) => <div key={photo.preview} className="relative"><img src={photo.preview} alt={`新增照片${index + 1}`} className="aspect-[4/3] w-full object-cover"/><button type="button" aria-label="移除新增照片" onClick={() => { URL.revokeObjectURL(photo.preview); setNewPhotos(newPhotos.filter((item) => item !== photo)); }} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white"><X className="h-4 w-4"/></button></div>)}</div> : <div className="grid aspect-[16/7] place-items-center text-center text-ink/30"><div><Camera className="mx-auto h-9 w-9"/><p className="mt-2 text-sm font-black">这一页没有照片</p></div></div>}{editing && <label className="flex cursor-pointer items-center justify-center gap-2 border-t border-dashed border-river/30 bg-white/70 px-4 py-4 text-sm font-black text-river"><ImagePlus className="h-4 w-4"/>添加照片<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []); setNewPhotos([...newPhotos, ...files.slice(0, Math.max(0, 6 - visiblePhotoIds.length - newPhotos.length)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]); event.currentTarget.value = ''; }}/></label>}</section>
    <header className="relative z-10 mt-8 border-b-2 border-ink/10 pb-6 pl-4"><div className="text-xs font-black uppercase tracking-[.22em] text-river">My Hubei Travel Note</div>{editing ? <div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="地点" htmlFor="detail-place"><input id="detail-place" value={draft.pointName} onChange={(event) => setDraft({ ...draft, pointName: event.target.value })} className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 font-black"/></Field><Field label="日期" htmlFor="detail-date"><input id="detail-date" type="date" value={draft.visitedAt} onChange={(event) => setDraft({ ...draft, visitedAt: event.target.value })} className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3"/></Field><Field label="城市" htmlFor="detail-city"><select id="detail-city" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value as CityName })} className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3">{cities.map((city) => <option key={city.name}>{city.name}</option>)}</select></Field></div> : <><h1 className="journal-handwriting mt-2 text-5xl font-black leading-tight">{entry.pointName}</h1><div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-ink/45"><span>{entry.city}</span><span>·</span><time>{formatJournalDate(entry.visitedAt)}</time></div></>}</header>
    <section className="relative z-10 min-h-[360px] pl-4 pt-6">{editing ? <textarea aria-label="手账心得" rows={12} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className="journal-handwriting w-full resize-none rounded-2xl border border-ink/10 bg-white/75 p-5 text-2xl leading-[2rem] text-ink/76"/> : <p className="journal-handwriting whitespace-pre-wrap text-2xl leading-[2rem] text-ink/76">{entry.note || '这一站没有留下文字，但照片已经替我记住了当时的光。'}</p>}</section>
  </article></div></main>;
}

function formatJournalDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(parseLocalDate(value.slice(0, 10))); }
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div><label htmlFor={htmlFor} className="mb-2 block text-sm font-black text-ink/65">{label}</label>{children}</div>; }
