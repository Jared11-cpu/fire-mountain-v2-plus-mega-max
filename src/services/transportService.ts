import type { PlannedRoutePoint, TripRequest } from '../domain/trip';

export type TransportMode = '步行' | '公交' | '地铁' | '驾车' | '网约车' | '景区专线' | '公共交通';
export type TransportSource = 'transport-api' | 'rules-v1' | 'rules-fallback';
export type TransportFreshness = 'vehicle-realtime' | 'live-query' | 'estimate';
export type TransitStrategy = 'recommended' | 'fastest' | 'economy' | 'fewest-transfers' | 'least-walking' | 'subway-first';
export type TransitLegMode = 'walk' | 'bus' | 'subway' | 'railway' | 'taxi' | 'shuttle';

export type TransportLeg = {
  id: string;
  mode: TransitLegMode;
  lineName?: string;
  lineType?: string;
  departureStop?: string;
  arrivalStop?: string;
  entrance?: string;
  exit?: string;
  viaStops: string[];
  durationMinutes: number;
  distanceKm: number;
  fare?: number;
  serviceStartTime?: string;
  serviceEndTime?: string;
  polyline: Array<[number, number]>;
};

export type TransportSegment = {
  id: string;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  distanceKm: number;
  mode: TransportMode;
  costEstimate: string;
  fare?: number;
  instruction: string;
  liveStatus?: string;
  legs: TransportLeg[];
};

export type TransportPlanRequest = {
  city: string;
  departureDate: string;
  departureTime: string;
  strategy: TransitStrategy;
  travelerType: TripRequest['travelerType'];
  specialNeeds: TripRequest['specialNeeds'];
  points: Array<Pick<PlannedRoutePoint, 'id' | 'name' | 'lat' | 'lng' | 'arrivalTime' | 'durationMinutes' | 'travelMinutesToNext'>>;
};

export type TransportPlanResponse = {
  source: TransportSource;
  sourceLabel: string;
  generatedAt: string;
  isRealtime: boolean;
  freshness: TransportFreshness;
  totalMinutes: number;
  totalDistanceKm: number;
  totalFare?: number;
  summary: string;
  segments: TransportSegment[];
  notices: string[];
};

export type TransportChoiceId = 'transit' | 'driving';

export type TransportChoice = {
  id: TransportChoiceId;
  label: string;
  caption: string;
  plan: TransportPlanResponse;
};

export type TransportComparison = {
  options: TransportChoice[];
  recommendedOptionId: TransportChoiceId;
  reason: string;
  cautions: string[];
  analysisSource: 'qwen-amap' | 'rules';
  generatedAt: string;
};

export interface TransportPlanProvider {
  readonly id: string;
  plan(request: TransportPlanRequest, signal?: AbortSignal): Promise<TransportPlanResponse>;
}

export class HttpTransportPlanProvider implements TransportPlanProvider {
  readonly id = 'transport-api';
  constructor(private readonly endpoint: string, private readonly fetcher: typeof fetch = fetch) {}
  async plan(request: TransportPlanRequest, signal?: AbortSignal) {
    const response = await this.fetcher(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal });
    if (!response.ok) throw new Error(`交通 API HTTP ${response.status}`);
    const data = await response.json() as TransportPlanResponse;
    if (!Array.isArray(data.segments) || typeof data.summary !== 'string') throw new Error('交通 API 返回格式不正确');
    return {
      ...data,
      source: 'transport-api' as const,
      isRealtime: data.freshness === 'vehicle-realtime',
      freshness: data.freshness ?? 'live-query',
      sourceLabel: data.sourceLabel || '动态公共交通查询',
    };
  }
}

export class RulesTransportPlanProvider implements TransportPlanProvider {
  readonly id = 'rules-v1';
  async plan(request: TransportPlanRequest) { return buildRulesTransportPlan(request); }
}

export async function resolveTransportPlan(request: TransportPlanRequest, options: { endpoint?: string; fetcher?: typeof fetch; signal?: AbortSignal } = {}) {
  const endpoint = (options.endpoint ?? (import.meta.env.VITE_TRANSPORT_API_URL as string | undefined)?.trim()) || defaultTransportEndpoint();
  if (!endpoint) return new RulesTransportPlanProvider().plan(request);
  try { return await new HttpTransportPlanProvider(endpoint, options.fetcher).plan(request, options.signal); }
  catch (error) {
    if (options.signal?.aborted) throw error;
    const fallback = await new RulesTransportPlanProvider().plan(request);
    return { ...fallback, source: 'rules-fallback' as const, sourceLabel: '动态查询失败 · 规则降级', notices: [`动态交通服务暂不可用：${error instanceof Error ? error.message : '未知错误'}。`, ...fallback.notices] };
  }
}

type TransportComparisonOptions = {
  transitEndpoint?: string;
  routeEndpoint?: string;
  adviceEndpoint?: string;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
};

type AmapDrivingPath = {
  durationMinutes: number;
  distanceKm: number;
  tolls?: number;
  polyline?: Array<[number, number]>;
  steps?: Array<{ instruction?: string }>;
};

type AmapDrivingResponse = {
  generatedAt?: string;
  paths?: AmapDrivingPath[];
};

export async function resolveTransportComparison(request: TransportPlanRequest, options: TransportComparisonOptions = {}): Promise<TransportComparison> {
  const fetcher = options.fetcher ?? fetch;
  const transitEndpoint = options.transitEndpoint ?? ((import.meta.env.VITE_TRANSPORT_API_URL as string | undefined)?.trim() || defaultTransportEndpoint());
  const routeEndpoint = options.routeEndpoint ?? defaultSameOriginEndpoint('/api/route/plan');
  const adviceEndpoint = options.adviceEndpoint ?? defaultSameOriginEndpoint('/api/ai/transport-advice');
  const [transit, driving] = await Promise.all([
    resolveTransportPlan(request, { endpoint: transitEndpoint, fetcher, signal: options.signal }),
    resolveDrivingTransportPlan(request, { endpoint: routeEndpoint, fetcher, signal: options.signal }),
  ]);
  const choices: TransportChoice[] = [
    { id: 'transit', label: '公交 / 地铁', caption: '站口、换乘与步行', plan: transit },
    { id: 'driving', label: '驾车', caption: '道路、用时与过路费', plan: driving },
  ];
  const fallback = fallbackTransportAdvice(choices, request);
  if (!adviceEndpoint) return { ...fallback, options: choices, generatedAt: new Date().toISOString() };
  try {
    const response = await fetcher(adviceEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: options.signal,
      body: JSON.stringify({
        options: choices.map(({ id, label, plan }) => ({ id, label, totalMinutes: plan.totalMinutes, totalDistanceKm: plan.totalDistanceKm, totalFare: plan.totalFare, freshness: plan.freshness, segments: plan.segments.length })),
        userPreference: strategyLabel(request.strategy), specialNeeds: request.specialNeeds,
      }),
    });
    if (!response.ok) throw new Error(`AI 交通分析 HTTP ${response.status}`);
    const result = await response.json() as { recommendedOptionId?: string; reason?: string; cautions?: string[] };
    if (!choices.some((choice) => choice.id === result.recommendedOptionId) || !result.reason) throw new Error('AI 交通分析格式不正确');
    return {
      options: choices,
      recommendedOptionId: result.recommendedOptionId as TransportChoiceId,
      reason: result.reason,
      cautions: Array.isArray(result.cautions) ? result.cautions.slice(0, 2) : [],
      analysisSource: 'qwen-amap',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { ...fallback, options: choices, generatedAt: new Date().toISOString() };
  }
}

export async function resolveDrivingTransportPlan(request: TransportPlanRequest, options: { endpoint?: string; fetcher?: typeof fetch; signal?: AbortSignal } = {}): Promise<TransportPlanResponse> {
  const endpoint = options.endpoint ?? defaultSameOriginEndpoint('/api/route/plan');
  const fetcher = options.fetcher ?? fetch;
  if (!endpoint) return buildRulesDrivingPlan(request);
  try {
    const pathResults = await Promise.all(request.points.slice(0, -1).map(async (point, index) => {
      const next = request.points[index + 1];
      const response = await fetcher(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: options.signal,
        body: JSON.stringify({ mode: 'driving', strategy: 0, origin: { name: point.name, lng: point.lng, lat: point.lat }, destination: { name: next.name, lng: next.lng, lat: next.lat } }),
      });
      if (!response.ok) throw new Error(`高德驾车 API HTTP ${response.status}`);
      const data = await response.json() as AmapDrivingResponse;
      const path = data.paths?.[0];
      if (!path || !Number.isFinite(path.durationMinutes) || !Number.isFinite(path.distanceKm)) throw new Error('高德驾车 API 返回格式不正确');
      return { point, next, path };
    }));
    const segments = pathResults.map(({ point, next, path }): TransportSegment => {
      const departureTime = shiftClock(point.arrivalTime, point.durationMinutes);
      const tollCopy = path.tolls === undefined ? '费用以导航为准' : path.tolls > 0 ? `过路费 ¥${path.tolls}` : '无过路费';
      return {
        id: `${point.id}-${next.id}-driving`, from: point.name, to: next.name, departureTime,
        arrivalTime: shiftClock(departureTime, path.durationMinutes), durationMinutes: path.durationMinutes,
        distanceKm: path.distanceKm, mode: '驾车', costEstimate: tollCopy,
        ...(path.tolls === undefined ? {} : { fare: path.tolls }),
        instruction: path.steps?.map((step) => step.instruction).filter(Boolean).slice(0, 3).join('；') || '按高德本次道路规划行驶，出发前再次刷新路况。',
        liveStatus: '高德动态道路规划',
        legs: [{ id: `${point.id}-${next.id}-drive`, mode: 'taxi', lineName: '驾车路线', viaStops: [], durationMinutes: path.durationMinutes, distanceKm: path.distanceKm, polyline: path.polyline?.length ? path.polyline : [] }],
      };
    });
    const totalFare = segments.reduce((sum, segment) => sum + (segment.fare ?? 0), 0);
    const totalMinutes = segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
    const totalDistanceKm = round1(segments.reduce((sum, segment) => sum + segment.distanceKm, 0));
    return {
      source: 'transport-api', sourceLabel: '高德动态驾车规划', generatedAt: new Date().toISOString(), isRealtime: false, freshness: 'live-query',
      totalMinutes, totalDistanceKm, ...(segments.some((segment) => segment.fare !== undefined) ? { totalFare: round1(totalFare) } : {}),
      summary: `高德已规划 ${segments.length} 段驾车路线，预计 ${totalMinutes} 分钟、约 ${totalDistanceKm} 公里。`, segments,
      notices: ['用时与道路来自本次高德查询，不代表持续实时导航；出发前请再次刷新拥堵与临时管制。'],
    };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const fallback = buildRulesDrivingPlan(request);
    return { ...fallback, source: 'rules-fallback', sourceLabel: '驾车查询失败 · 规则估算', notices: [`高德驾车服务暂不可用：${error instanceof Error ? error.message : '未知错误'}。`, ...fallback.notices] };
  }
}

function defaultTransportEndpoint() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('github.io')) return '';
  return `${window.location.origin}/api/transit/plan`;
}

function defaultSameOriginEndpoint(path: string) {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('github.io')) return '';
  return `${window.location.origin}${path}`;
}

export function toTransportPlanRequest(request: TripRequest, points: PlannedRoutePoint[], departureTime: string, strategy: TransitStrategy = 'recommended'): TransportPlanRequest {
  return {
    city: request.destinationCity,
    departureDate: request.startDate,
    departureTime,
    strategy,
    travelerType: request.travelerType,
    specialNeeds: request.specialNeeds,
    points: points.map(({ id, name, lat, lng, arrivalTime, durationMinutes, travelMinutesToNext }) => ({ id, name, lat, lng, arrivalTime, durationMinutes, travelMinutesToNext })),
  };
}

export function buildRulesTransportPlan(request: TransportPlanRequest): TransportPlanResponse {
  const segments = request.points.slice(0, -1).map((point, index): TransportSegment => {
    const next = request.points[index + 1];
    const distanceKm = haversine(point.lat, point.lng, next.lat, next.lng);
    const durationMinutes = Math.max(1, point.travelMinutesToNext);
    const mode = chooseMode(distanceKm, durationMinutes, request.specialNeeds);
    const legMode: TransitLegMode = mode === '步行' ? 'walk' : mode === '景区专线' ? 'shuttle' : mode === '网约车' ? 'taxi' : 'bus';
    return {
      id: `${point.id}-${next.id}`,
      from: point.name,
      to: next.name,
      departureTime: shiftClock(point.arrivalTime, point.durationMinutes),
      arrivalTime: next.arrivalTime,
      durationMinutes,
      distanceKm: Math.round(distanceKm * 10) / 10,
      mode,
      costEstimate: costRange(mode, distanceKm),
      instruction: instructionFor(mode, durationMinutes, request.travelerType),
      legs: [{ id: `${point.id}-${next.id}-estimate`, mode: legMode, viaStops: [], durationMinutes, distanceKm: Math.round(distanceKm * 10) / 10, polyline: [] }],
    };
  });
  const totalMinutes = segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const totalDistanceKm = Math.round(segments.reduce((sum, segment) => sum + segment.distanceKm, 0) * 10) / 10;
  const longSegments = segments.filter((segment) => segment.durationMinutes >= 60).length;
  const notices = ['当前未配置可用的动态公交代理，线路、时间与费用为规则估算，不能替代导航。', '在 Sites 中配置 AMAP_WEB_SERVICE_KEY，并让前端指向 /api/transit/plan 后即可返回公交与地铁线路。'];
  if (request.specialNeeds.includes('行动不便')) notices.unshift('已优先减少步行；上下车点仍需核验无障碍设施。');
  return { source: 'rules-v1', sourceLabel: '规则引擎交通方案', generatedAt: new Date().toISOString(), isRealtime: false, freshness: 'estimate', totalMinutes, totalDistanceKm, summary: `共 ${segments.length} 段交通，预计 ${totalMinutes} 分钟、约 ${totalDistanceKm} 公里${longSegments ? `；其中 ${longSegments} 段为跨区长距离交通` : ''}。`, segments, notices };
}

export function buildRulesDrivingPlan(request: TransportPlanRequest): TransportPlanResponse {
  const segments = request.points.slice(0, -1).map((point, index): TransportSegment => {
    const next = request.points[index + 1];
    const straightDistance = haversine(point.lat, point.lng, next.lat, next.lng);
    const distanceKm = round1(straightDistance * 1.28);
    const durationMinutes = Math.max(8, Math.round(distanceKm / (distanceKm > 30 ? 55 : 32) * 60));
    const departureTime = shiftClock(point.arrivalTime, point.durationMinutes);
    return {
      id: `${point.id}-${next.id}-drive-estimate`, from: point.name, to: next.name, departureTime,
      arrivalTime: shiftClock(departureTime, durationMinutes), durationMinutes, distanceKm, mode: '驾车',
      costEstimate: '油费与过路费待导航', instruction: '当前为规则估算，恢复高德服务后将显示真实道路、用时与过路费。',
      legs: [{ id: `${point.id}-${next.id}-drive-estimate-leg`, mode: 'taxi', lineName: '驾车估算', viaStops: [], durationMinutes, distanceKm, polyline: [] }],
    };
  });
  const totalMinutes = segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
  const totalDistanceKm = round1(segments.reduce((sum, segment) => sum + segment.distanceKm, 0));
  return { source: 'rules-v1', sourceLabel: '驾车规则估算', generatedAt: new Date().toISOString(), isRealtime: false, freshness: 'estimate', totalMinutes, totalDistanceKm, summary: `驾车估算共 ${segments.length} 段，约 ${totalMinutes} 分钟、${totalDistanceKm} 公里。`, segments, notices: ['当前未取得高德驾车路线，里程与时间仅为直线距离换算，不能替代导航。'] };
}

function fallbackTransportAdvice(choices: TransportChoice[], request: TransportPlanRequest): Omit<TransportComparison, 'options' | 'generatedAt'> {
  const transit = choices.find((choice) => choice.id === 'transit')!;
  const driving = choices.find((choice) => choice.id === 'driving')!;
  const preferTransit = request.strategy === 'economy' || request.strategy === 'subway-first' || request.strategy === 'fewest-transfers';
  const reliableTransit = transit.plan.freshness !== 'estimate';
  const reliableDriving = driving.plan.freshness !== 'estimate';
  const recommendedOptionId: TransportChoiceId = preferTransit && reliableTransit ? 'transit' : reliableDriving && (!reliableTransit || driving.plan.totalMinutes < transit.plan.totalMinutes * 0.78) ? 'driving' : 'transit';
  const selected = recommendedOptionId === 'driving' ? driving : transit;
  const reason = `${selected.label}预计 ${selected.plan.totalMinutes} 分钟、约 ${selected.plan.totalDistanceKm} 公里，较符合当前“${strategyLabel(request.strategy)}”偏好。`;
  return { recommendedOptionId, reason, cautions: ['千问分析暂不可用，当前推荐按高德返回值与偏好规则生成。'], analysisSource: 'rules' };
}

function strategyLabel(value: TransitStrategy) { return ({ recommended: '综合推荐', fastest: '时间短', economy: '最省钱', 'fewest-transfers': '少换乘', 'least-walking': '少步行', 'subway-first': '地铁优先' } as const)[value]; }
function round1(value: number) { return Math.round(value * 10) / 10; }

export function transportModeForLegs(legs: TransportLeg[]): TransportMode {
  if (legs.some((leg) => leg.mode === 'subway')) return '地铁';
  if (legs.some((leg) => leg.mode === 'bus')) return '公交';
  if (legs.some((leg) => leg.mode === 'railway' || leg.mode === 'shuttle')) return '景区专线';
  if (legs.some((leg) => leg.mode === 'taxi')) return '网约车';
  return '步行';
}

function chooseMode(distanceKm: number, minutes: number, specialNeeds: TripRequest['specialNeeds']): TransportMode {
  if (minutes >= 60 || distanceKm >= 25) return '景区专线';
  if (distanceKm <= 1.8 && !specialNeeds.includes('行动不便')) return '步行';
  if (distanceKm <= 8) return '公共交通';
  return '网约车';
}
function costRange(mode: TransportMode, distanceKm: number) { if (mode === '步行') return '¥0'; if (mode === '公共交通' || mode === '公交' || mode === '地铁') return '¥2–8'; if (mode === '景区专线') return '¥20–80/人'; const low = Math.max(12, Math.round(distanceKm * 2)); return `¥${low}–${low + 15}`; }
function instructionFor(mode: TransportMode, minutes: number, travelerType: TripRequest['travelerType']) { if (mode === '步行') return '沿主路步行，过路口时以实际信号灯为准。'; if (mode === '公共交通' || mode === '公交' || mode === '地铁') return '当前为规则估算，接入动态公交代理后显示具体线路、站点与换乘。'; if (mode === '景区专线') return '建议提前预约景区直通车或正规包车，并为山路预留机动时间。'; return travelerType === '老人' || travelerType === '家庭' ? '建议预约可放行李车辆，上车前确认落客点与步行距离。' : `建议提前 10 分钟叫车，为拥堵预留约 ${Math.max(10, Math.round(minutes * 0.2))} 分钟。`; }
function shiftClock(value: string, delta: number) { const [hour, minute] = value.split(':').map(Number); const total = (((hour || 0) * 60 + (minute || 0) + delta) % 1440 + 1440) % 1440; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) { const radius = 6371; const radians = (value: number) => value * Math.PI / 180; const dLat = radians(lat2 - lat1); const dLng = radians(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2; return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
