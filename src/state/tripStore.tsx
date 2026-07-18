import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CityName } from '../data/mockData';
import {
  addDaysIso,
  budgetTotal,
  buildFoodRecommendations,
  buildSocialCopy,
  calculateTimeline,
  CITY_NAMES,
  comparePlans,
  daysBetween,
  defaultTripRequest,
  generateTripPlan,
  getVerifiedDianpingShopUrl,
  isIsoDate,
  INTERESTS,
  normalizeRequest,
  parseTravelRequest,
  updatePlanDates,
  type BudgetItem,
  type ParsedTag,
  type PlannedRoutePoint,
  type PersistedAppState,
  type TripPlan,
  type TripRequest,
} from '../domain/trip';
import { enrichTripPlanWithBackend, parseTravelRequestWithAi, type AiTravelRequest } from '../services/travelApi';
import type { JournalEntry, RoutePoint } from '../types/route';

const STORAGE_KEY = 'chuyou-app-state-v2';
const LEGACY_JOURNAL_KEY = 'chuyou-journal-entries';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type ToastTone = 'info' | 'success' | 'error';
export type ToastMessage = { id: number; message: string; tone: ToastTone } | null;

export type TripState = {
  request: TripRequest;
  plan: TripPlan | null;
  journalEntries: JournalEntry[];
  parsedTags: ParsedTag[];
  parseWarnings: string[];
  saveStatus: SaveStatus;
  toast: ToastMessage;
  isReplanning: boolean;
  replanSummary: string;
};

type Action =
  | { type: 'request'; request: TripRequest }
  | { type: 'parsed'; request: TripRequest; tags: ParsedTag[]; warnings: string[] }
  | { type: 'plan'; plan: TripPlan | null }
  | { type: 'enriched'; planId: string; analysis?: string; foods?: TripPlan['foodRecommendations']; routePoints?: RoutePoint[] }
  | { type: 'journal'; entries: JournalEntry[] }
  | { type: 'save'; status: SaveStatus }
  | { type: 'toast'; toast: ToastMessage }
  | { type: 'replanning'; value: boolean }
  | { type: 'summary'; value: string }
  | { type: 'hydrate'; state: TripState };

function reducer(state: TripState, action: Action): TripState {
  switch (action.type) {
    case 'request': return { ...state, request: action.request };
    case 'parsed': return { ...state, request: action.request, parsedTags: action.tags, parseWarnings: action.warnings };
    case 'plan': return { ...state, plan: action.plan };
    case 'enriched': {
      if (!state.plan || state.plan.id !== action.planId) return state;
      const plan = action.routePoints?.length ? applyPersonalizedRoute(state.plan, action.routePoints) : state.plan;
      return { ...state, plan: { ...plan, updatedAt: new Date().toISOString(), content: action.analysis ? { ...plan.content, summary: action.analysis } : plan.content, foodRecommendations: action.foods ?? plan.foodRecommendations } };
    }
    case 'journal': return { ...state, journalEntries: action.entries };
    case 'save': return { ...state, saveStatus: action.status };
    case 'toast': return { ...state, toast: action.toast };
    case 'replanning': return { ...state, isReplanning: action.value };
    case 'summary': return { ...state, replanSummary: action.value };
    case 'hydrate': return action.state;
    default: return state;
  }
}

function readInitialState(): TripState {
  const fallbackRequest = defaultTripRequest();
  let persisted: PersistedAppState | null = null;
  try {
    persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PersistedAppState | null;
  } catch {
    persisted = null;
  }
  let legacyEntries: JournalEntry[] = [];
  try {
    legacyEntries = JSON.parse(localStorage.getItem(LEGACY_JOURNAL_KEY) ?? '[]') as JournalEntry[];
  } catch {
    legacyEntries = [];
  }
  const request = persisted?.version === 2 ? normalizeRequest(persisted.request) : fallbackRequest;
  const storedFoods = persisted?.version === 2 && persisted.plan
    ? persisted.plan.foodRecommendations?.filter((food) => getVerifiedDianpingShopUrl(food.dianpingUrl)) ?? []
    : [];
  const persistedPlan = persisted?.version === 2 && persisted.plan
    ? { ...persisted.plan, foodRecommendations: storedFoods.length ? storedFoods : buildFoodRecommendations(request) }
    : null;
  return {
    request,
    plan: persistedPlan,
    journalEntries: persisted?.version === 2 ? persisted.journalEntries : legacyEntries,
    parsedTags: [],
    parseWarnings: [],
    saveStatus: persisted ? 'saved' : 'idle',
    toast: null,
    isReplanning: false,
    replanSummary: '',
  };
}

type RequestPatch = Partial<TripRequest> & { startDate?: string; endDate?: string; days?: number };

type TripContextValue = TripState & {
  updateRequest: (patch: RequestPatch) => boolean;
  selectCity: (city: CityName) => void;
  parseText: (text?: string) => Promise<TripRequest>;
  generate: () => TripPlan;
  generateFromText: (text: string) => Promise<TripPlan>;
  replan: () => Promise<void>;
  setPlan: (plan: TripPlan | null) => void;
  patchPlan: (updater: (plan: TripPlan) => TripPlan) => void;
  updatePlanSettings: (patch: Partial<TripPlan['settings']>) => void;
  updateBudgetItems: (items: BudgetItem[]) => void;
  setBudgetTotal: (total: number) => void;
  setJournalEntries: (entries: JournalEntry[]) => void;
  resetPlan: () => void;
  notify: (message: string, tone?: ToastTone) => void;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, readInitialState);
  const hydrated = useRef(false);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now();
    dispatch({ type: 'toast', toast: { id, message, tone } });
    window.setTimeout(() => dispatch({ type: 'toast', toast: null }), 3200);
  }, []);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    dispatch({ type: 'save', status: 'saving' });
    const timer = window.setTimeout(() => {
      try {
        const payload: PersistedAppState = { version: 2, request: state.request, plan: state.plan, journalEntries: state.journalEntries };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        localStorage.removeItem(LEGACY_JOURNAL_KEY);
        dispatch({ type: 'save', status: 'saved' });
      } catch {
        dispatch({ type: 'save', status: 'error' });
        notify('自动保存失败，请检查浏览器存储空间。', 'error');
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [state.request, state.plan, state.journalEntries, notify]);

  const updateRequest = useCallback((patch: RequestPatch) => {
    let next = { ...state.request, ...patch } as TripRequest;
    if (patch.startDate !== undefined) {
      if (!isIsoDate(patch.startDate)) { notify('开始日期无效，请重新选择。', 'error'); return false; }
      next.endDate = addDaysIso(patch.startDate, next.days - 1);
    } else if (patch.endDate !== undefined) {
      if (!isIsoDate(patch.endDate) || patch.endDate < next.startDate) { notify('结束日期不能早于开始日期。', 'error'); return false; }
      next.days = Math.min(15, Math.max(1, daysBetween(next.startDate, patch.endDate)));
    } else if (patch.days !== undefined) {
      next.days = Math.min(15, Math.max(1, Math.round(Number(patch.days) || 1)));
      next.endDate = addDaysIso(next.startDate, next.days - 1);
    }
    next = normalizeRequest(next);
    dispatch({ type: 'request', request: next });
    if (state.plan) dispatch({ type: 'plan', plan: updatePlanDates(state.plan, next) });
    return true;
  }, [notify, state.plan, state.request]);

  const selectCity = useCallback((city: CityName) => {
    const next = defaultTripRequest(city);
    dispatch({ type: 'request', request: { ...next, startDate: state.request.startDate, endDate: addDaysIso(state.request.startDate, next.days - 1) } });
    notify(`已将统一目的地更新为${city}`, 'success');
  }, [notify, state.request.startDate]);

  const parseText = useCallback(async (text = state.request.freeText) => {
    const local = parseTravelRequest(text, state.request);
    try {
      const ai = await parseTravelRequestWithAi(text);
      const result = mergeAiTravelRequest(local, ai, text);
      dispatch({ type: 'parsed', request: result.request, tags: result.tags, warnings: result.warnings });
      notify(`千问已识别 ${result.tags.length} 项，请确认后生成。`, 'success');
      return result.request;
    } catch {
      dispatch({ type: 'parsed', request: local.request, tags: local.tags, warnings: [...local.warnings, 'AI 服务暂不可用，已使用本地规则识别。'] });
      notify(local.tags.length ? `已按本地规则识别 ${local.tags.length} 项。` : '未识别到新条件，请在表单中补充。', local.tags.length ? 'info' : 'error');
      return local.request;
    }
  }, [notify, state.request]);

  const enrichPlan = useCallback((plan: TripPlan, request: TripRequest) => {
    void enrichTripPlanWithBackend(plan, request).then((enrichment) => {
      dispatch({ type: 'enriched', planId: plan.id, ...enrichment });
      dispatch({ type: 'summary', value: enrichment.routePoints?.length ? '已按首页需求加载千问分析、高德真实个性化地点与餐厅推荐。' : '已加载千问方案分析与高德真实餐厅推荐。' });
      notify(enrichment.routePoints?.length ? '个性化地点与必经点已加入路线' : '千问分析与真实餐厅推荐已更新', 'success');
    }).catch(() => {
      dispatch({ type: 'summary', value: 'AI 或高德服务暂不可用，当前保留规则路线与核验提示。' });
      notify('在线增强暂不可用，已保留可用的规则方案', 'info');
    });
  }, [notify]);

  const generateForRequest = useCallback((request: TripRequest) => {
    const plan = generateTripPlan(request, state.plan);
    dispatch({ type: 'plan', plan });
    dispatch({ type: 'summary', value: '已生成基础路线，正在让千问按需求选择高德真实地点。' });
    notify(`已生成${request.destinationCity}${request.days}天基础路线，正在匹配个性化地点`, 'success');
    enrichPlan(plan, request);
    return plan;
  }, [enrichPlan, state.plan]);

  const generate = useCallback(() => generateForRequest(state.request), [generateForRequest, state.request]);

  const generateFromText = useCallback(async (text: string) => {
    const request = await parseText(text);
    return generateForRequest(request);
  }, [generateForRequest, parseText]);

  const replan = useCallback(async () => {
    if (state.isReplanning || !state.plan) return;
    dispatch({ type: 'replanning', value: true });
    dispatch({ type: 'summary', value: '规则引擎计算中…' });
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const next = generateTripPlan(state.request, state.plan);
    const difference = comparePlans(state.plan, next);
    dispatch({ type: 'plan', plan: next });
    dispatch({ type: 'summary', value: `${difference.message} 正在重新匹配个性化地点。` });
    dispatch({ type: 'replanning', value: false });
    enrichPlan(next, state.request);
    notify(difference.message, difference.changed ? 'success' : 'info');
  }, [enrichPlan, notify, state.isReplanning, state.plan, state.request]);

  const setPlan = useCallback((plan: TripPlan | null) => dispatch({ type: 'plan', plan }), []);
  const patchPlan = useCallback((updater: (plan: TripPlan) => TripPlan) => {
    if (!state.plan) return;
    dispatch({ type: 'plan', plan: { ...updater(state.plan), updatedAt: new Date().toISOString() } });
  }, [state.plan]);
  const updatePlanSettings = useCallback((patch: Partial<TripPlan['settings']>) => patchPlan((plan) => {
    const settings = { ...plan.settings, ...patch };
    let sourcePoints = plan.route.points.slice(0, settings.targetPointCount) as PlannedRoutePoint[];
    if (patch.targetDurationMinutes !== undefined && sourcePoints.length) {
      const travelTotal = sourcePoints.reduce((sum, point) => sum + point.travelMinutesToNext, 0);
      const currentStayTotal = sourcePoints.reduce((sum, point) => sum + point.durationMinutes, 0);
      const desiredStayTotal = Math.max(sourcePoints.length * 10, patch.targetDurationMinutes - travelTotal);
      const scale = currentStayTotal > 0 ? desiredStayTotal / currentStayTotal : 1;
      sourcePoints = sourcePoints.map((point) => {
        const durationMinutes = Math.max(10, Math.round(point.durationMinutes * scale));
        return { ...point, durationMinutes, stayMinutes: durationMinutes };
      });
    }
    const routePoints = calculateTimeline(sourcePoints, settings.departureTime);
    const actualDuration = routePoints.reduce((sum, point) => sum + point.durationMinutes + point.travelMinutesToNext, 0);
    return { ...plan, settings: { ...settings, targetPointCount: routePoints.length, targetDurationMinutes: actualDuration }, route: { ...plan.route, points: routePoints } };
  }), [patchPlan]);
  const updateBudgetItems = useCallback((items: BudgetItem[]) => {
    if (state.plan) dispatch({ type: 'plan', plan: { ...state.plan, budgetItems: items, updatedAt: new Date().toISOString() } });
  }, [state.plan]);
  const setBudgetTotal = useCallback((value: number) => {
    const total = Math.max(0, Math.round(Number(value) || 0));
    const request = { ...state.request, budget: total };
    dispatch({ type: 'request', request });
    if (state.plan) dispatch({ type: 'plan', plan: syncPlanTargetBudget(state.plan, request) });
  }, [state.plan, state.request]);
  const setJournalEntries = useCallback((entries: JournalEntry[]) => dispatch({ type: 'journal', entries }), []);
  const resetPlan = useCallback(() => {
    const next = defaultTripRequest();
    dispatch({ type: 'parsed', request: next, tags: [], warnings: [] });
    dispatch({ type: 'plan', plan: null });
    dispatch({ type: 'summary', value: '' });
    notify('方案已重置，真实手账和照片已保留。', 'success');
  }, [notify]);

  const value = useMemo<TripContextValue>(() => ({ ...state, updateRequest, selectCity, parseText, generate, generateFromText, replan, setPlan, patchPlan, updatePlanSettings, updateBudgetItems, setBudgetTotal, setJournalEntries, resetPlan, notify }), [generate, generateFromText, notify, parseText, patchPlan, replan, resetPlan, selectCity, setBudgetTotal, setJournalEntries, setPlan, state, updateBudgetItems, updatePlanSettings, updateRequest]);

  return <TripContext.Provider value={value}>{children}<GlobalStatus state={state} /></TripContext.Provider>;
}

function syncPlanTargetBudget(plan: TripPlan, request: TripRequest): TripPlan {
  const previousBudget = plan.requestSnapshot.budget;
  const total = request.budget;
  const replaceBudget = (text: string) => text.replace(new RegExp(`${previousBudget}\\s*元`, 'g'), `${total}元`);
  return {
    ...plan,
    updatedAt: new Date().toISOString(),
    requestSnapshot: request,
    content: {
      ...plan.content,
      title: replaceBudget(plan.content.title),
      summary: replaceBudget(plan.content.summary),
      socialCopy: buildSocialCopy(request),
      videoScript: plan.content.videoScript.map(replaceBudget),
    },
    route: {
      ...plan.route,
      title: replaceBudget(plan.route.title),
      sceneryAnalysis: { ...plan.route.sceneryAnalysis, socialCopy: buildSocialCopy(request) },
    },
  };
}

function applyPersonalizedRoute(plan: TripPlan, recommended: RoutePoint[]): TripPlan {
  const start = plan.route.startPoint;
  const uniqueRecommended = recommended.filter((point, index, rows) => point.id !== start.id && rows.findIndex((candidate) => candidate.id === point.id) === index);
  const source = [start, ...uniqueRecommended].map((point, index) => ({ ...point, day: index === 0 ? 1 : Math.min(plan.requestSnapshot.days, Math.ceil(index / Math.max(1, Math.ceil(uniqueRecommended.length / plan.requestSnapshot.days)))) }));
  const points = calculateTimeline(source, plan.settings.departureTime);
  const required = plan.requestSnapshot.requestedPlaces;
  return {
    ...plan,
    generationSource: 'qwen-amap',
    route: {
      ...plan.route,
      points,
      title: required.length ? `${plan.requestSnapshot.destinationCity}个性化路线｜必经 ${required.join('、')}` : `${plan.requestSnapshot.destinationCity} AI 个性化路线`,
      transportSuggestion: `${plan.route.transportSuggestion} 地点由高德实时检索，千问按本次首页需求排序。`,
    },
    settings: { ...plan.settings, targetPointCount: points.length, targetDurationMinutes: points.reduce((sum, point) => sum + point.durationMinutes + point.travelMinutesToNext, 0) },
  };
}

function GlobalStatus({ state }: { state: TripState }) {
  return (
    <>
      <div className="fixed bottom-4 left-4 z-[70] rounded-full border border-white/70 bg-white/90 px-3 py-2 text-xs font-black text-ink/65 shadow-soft backdrop-blur" aria-live="polite">
        {state.saveStatus === 'saving' ? '保存中…' : state.saveStatus === 'saved' ? '已保存' : state.saveStatus === 'error' ? '保存失败' : '尚未保存'}
      </div>
      <div className="pointer-events-none fixed inset-x-4 top-24 z-[80] flex justify-center" aria-live="polite" aria-atomic="true">
        {state.toast && <div className={`max-w-lg rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-soft ${state.toast.tone === 'error' ? 'bg-red-600' : state.toast.tone === 'success' ? 'bg-jade' : 'bg-ink'}`}>{state.toast.message}</div>}
      </div>
    </>
  );
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error('useTrip 必须在 TripProvider 内使用');
  return value;
}

export { STORAGE_KEY };

function mergeAiTravelRequest(local: ReturnType<typeof parseTravelRequest>, ai: AiTravelRequest, text: string) {
  const request = { ...local.request, freeText: text };
  const tags = [...local.tags];
  const warnings = [...local.warnings];
  if (ai.city && CITY_NAMES.includes(ai.city as CityName)) {
    request.destinationCity = ai.city as CityName;
    tags.push({ type: '城市', value: ai.city });
  } else if (ai.city) warnings.push(`当前页面暂只支持湖北演示城市，未自动切换到“${ai.city}”。`);
  if (ai.days) { request.days = Math.min(15, Math.max(1, Math.round(ai.days))); request.endDate = addDaysIso(request.startDate, request.days - 1); tags.push({ type: '天数', value: `${request.days}天` }); }
  if (ai.budgetPerPerson !== null) { request.budget = Math.max(0, Math.round(ai.budgetPerPerson)); tags.push({ type: '预算', value: `${request.budget}元` }); }
  const interests = ai.interests.filter((item): item is TripRequest['interests'][number] => INTERESTS.includes(item as TripRequest['interests'][number]));
  if (interests.length) { request.interests = [...new Set([...request.interests, ...interests])]; interests.forEach((item) => tags.push({ type: '兴趣', value: item })); }
  const dietaryRestrictions = new Set<TripRequest['dietaryRestrictions'][number]>(request.dietaryRestrictions);
  if (ai.dietaryNeeds.some((item) => /不辣|少辣/.test(item))) dietaryRestrictions.add('不吃辣');
  if (ai.dietaryNeeds.some((item) => /素食|吃素/.test(item))) dietaryRestrictions.add('素食');
  request.dietaryRestrictions = [...dietaryRestrictions];
  const specialNeeds = new Set<TripRequest['specialNeeds'][number]>(request.specialNeeds);
  if (/少走|行动不便|无障碍/.test(ai.mobility || '')) specialNeeds.add('行动不便');
  request.specialNeeds = [...specialNeeds];
  request.requestedPlaces = [...new Set([...request.requestedPlaces, ...(ai.requestedPlaces ?? [])])].slice(0, 10);
  request.avoidPlaces = [...new Set([...request.avoidPlaces, ...(ai.avoidPlaces ?? [])])].slice(0, 10);
  request.requestedPlaces.forEach((item) => tags.push({ type: '必经地点', value: item }));
  request.avoidPlaces.forEach((item) => tags.push({ type: '避开地点', value: item }));
  const uniqueTags = tags.filter((tag, index) => tags.findIndex((candidate) => candidate.type === tag.type && candidate.value === tag.value) === index);
  return { request: normalizeRequest(request), tags: uniqueTags, warnings: [...new Set(warnings)] };
}

