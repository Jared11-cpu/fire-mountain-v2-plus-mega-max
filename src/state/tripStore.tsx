import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReactNode } from 'react';
import type { CityName } from '../data/mockData';
import {
  addDaysIso,
  budgetTotal,
  calculateTimeline,
  comparePlans,
  daysBetween,
  defaultTripRequest,
  generateTripPlan,
  isIsoDate,
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
import type { JournalEntry } from '../types/route';

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
  return {
    request,
    plan: persisted?.version === 2 ? persisted.plan : null,
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
  parseText: (text?: string) => void;
  generate: () => TripPlan;
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

  const parseText = useCallback((text = state.request.freeText) => {
    const result = parseTravelRequest(text, state.request);
    dispatch({ type: 'parsed', request: result.request, tags: result.tags, warnings: result.warnings });
    notify(result.tags.length ? `已识别 ${result.tags.length} 项，请确认后生成。` : '未识别到新条件，请在表单中补充。', result.tags.length ? 'success' : 'info');
  }, [notify, state.request]);

  const generate = useCallback(() => {
    const plan = generateTripPlan(state.request, state.plan);
    dispatch({ type: 'plan', plan });
    dispatch({ type: 'summary', value: '已根据当前确认参数生成规则路线。' });
    notify(`已生成${state.request.destinationCity}${state.request.days}天规则路线`, 'success');
    return plan;
  }, [notify, state.plan, state.request]);

  const replan = useCallback(async () => {
    if (state.isReplanning || !state.plan) return;
    dispatch({ type: 'replanning', value: true });
    dispatch({ type: 'summary', value: '规则引擎计算中…' });
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    const next = generateTripPlan(state.request, state.plan);
    const difference = comparePlans(state.plan, next);
    dispatch({ type: 'plan', plan: next });
    dispatch({ type: 'summary', value: difference.message });
    dispatch({ type: 'replanning', value: false });
    notify(difference.message, difference.changed ? 'success' : 'info');
  }, [notify, state.isReplanning, state.plan, state.request]);

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
  const updateBudgetItems = useCallback((items: BudgetItem[]) => patchPlan((plan) => ({ ...plan, budgetItems: items, requestSnapshot: { ...plan.requestSnapshot, budget: budgetTotal(items) } })), [patchPlan]);
  const setBudgetTotal = useCallback((value: number) => {
    const total = Math.max(0, Math.round(Number(value) || 0));
    const currentTotal = state.plan ? budgetTotal(state.plan.budgetItems) : 0;
    let items = state.plan?.budgetItems ?? [];
    if (!items.length) {
      items = [{ id: `budget-${crypto.randomUUID()}`, item: '方案预算', amount: total, note: '' }];
    } else if (currentTotal > 0) {
      let assigned = 0;
      items = items.map((item, index) => {
        const remaining = Math.max(0, total - assigned);
        const amount = index === items.length - 1 ? remaining : Math.min(remaining, Math.round((item.amount / currentTotal) * total));
        assigned += amount;
        return { ...item, amount: Math.max(0, amount) };
      });
    } else {
      items = items.map((item, index) => ({ ...item, amount: index === 0 ? total : 0 }));
    }
    const request = { ...state.request, budget: total };
    dispatch({ type: 'request', request });
    if (state.plan) dispatch({ type: 'plan', plan: { ...state.plan, budgetItems: items, requestSnapshot: request, updatedAt: new Date().toISOString() } });
  }, [state.plan, state.request]);
  const setJournalEntries = useCallback((entries: JournalEntry[]) => dispatch({ type: 'journal', entries }), []);
  const resetPlan = useCallback(() => {
    const next = defaultTripRequest();
    dispatch({ type: 'parsed', request: next, tags: [], warnings: [] });
    dispatch({ type: 'plan', plan: null });
    dispatch({ type: 'summary', value: '' });
    notify('方案已重置，真实手账和照片已保留。', 'success');
  }, [notify]);

  const value = useMemo<TripContextValue>(() => ({ ...state, updateRequest, selectCity, parseText, generate, replan, setPlan, patchPlan, updatePlanSettings, updateBudgetItems, setBudgetTotal, setJournalEntries, resetPlan, notify }), [generate, notify, parseText, patchPlan, replan, resetPlan, selectCity, setBudgetTotal, setJournalEntries, setPlan, state, updateBudgetItems, updatePlanSettings, updateRequest]);

  return <TripContext.Provider value={value}>{children}<GlobalStatus state={state} /></TripContext.Provider>;
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

