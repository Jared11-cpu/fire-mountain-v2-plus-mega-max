import type { FoodRecommendation, TripPlan, TripRequest } from '../domain/trip';
import type { RoutePoint } from '../types/route';

export type AiTravelRequest = {
  city: string | null;
  startDate: string | null;
  days: number | null;
  people: number | null;
  budgetPerPerson: number | null;
  interests: string[];
  dietaryNeeds: string[];
  mobility: string | null;
  transportPreference: string | null;
  hotelPreference: string | null;
  departureDeadline: string | null;
  requestedPlaces: string[];
  avoidPlaces: string[];
  travelStyle: string | null;
};

export async function parseTravelRequestWithAi(text: string): Promise<AiTravelRequest> {
  const response = await fetch(apiUrl('/api/ai/parse-request'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const payload = await readPayload(response, 'AI 需求识别失败');
  if (!payload.data || typeof payload.data !== 'object') throw new Error('AI 需求识别返回格式不正确');
  return payload.data as AiTravelRequest;
}

export async function enrichTripPlanWithBackend(plan: TripPlan, request: TripRequest): Promise<{ analysis?: string; foods?: FoodRecommendation[]; routePoints?: RoutePoint[] }> {
  const [places, foods] = await Promise.allSettled([recommendAttractions(request), recommendRestaurants(request)]);
  const routePoints = places.status === 'fulfilled' ? places.value : [];
  const analysisRoute = routePoints.length ? [{ ...plan.route.startPoint }, ...routePoints] : plan.route.points;
  const analysis = await analyzeTrip({ ...plan, route: { ...plan.route, points: analysisRoute as TripPlan['route']['points'] } }, request).catch(() => '');
  const result: { analysis?: string; foods?: FoodRecommendation[]; routePoints?: RoutePoint[] } = {};
  if (analysis) result.analysis = analysis;
  if (foods.status === 'fulfilled' && foods.value.length) result.foods = foods.value;
  if (routePoints.length) result.routePoints = routePoints;
  if (!result.analysis && !result.foods && !result.routePoints) throw new Error('AI 与高德个性化服务暂时不可用');
  return result;
}

async function analyzeTrip(plan: TripPlan, request: TripRequest) {
  const response = await fetch(apiUrl('/api/ai/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: '请只依据 context，用一段简洁中文分析这个旅行方案如何匹配用户需求；不得补充 context 中没有的价格、营业时间、线路或地点。',
      context: {
        request: {
          city: request.destinationCity, days: request.days, budget: request.budget, interests: request.interests,
          travelerType: request.travelerType, dietaryRestrictions: request.dietaryRestrictions, specialNeeds: request.specialNeeds,
          prompt: request.freeText, requestedPlaces: request.requestedPlaces, avoidPlaces: request.avoidPlaces,
        },
        route: plan.route.points.map((point) => ({ name: point.name, arrivalTime: point.time, stayMinutes: point.stayMinutes, estimatedCost: point.estimatedCost ?? null })),
        transportSuggestion: plan.route.transportSuggestion,
      },
    }),
  });
  const payload = await readPayload(response, 'AI 方案分析失败');
  return typeof payload.data?.analysis === 'string' ? payload.data.analysis.trim() : '';
}

async function recommendAttractions(request: TripRequest): Promise<RoutePoint[]> {
  const interestTerms: Record<string, string> = { 自然风光: '景区', 历史文化: '博物馆', 拍照: '城市地标', Citywalk: '历史街区', 美食: '特色街区' };
  const required = request.requestedPlaces.slice(0, 6);
  const queryTerms = [...new Set([...required, ...request.interests.map((item) => interestTerms[item]).filter(Boolean), '热门景点'])].slice(0, 7);
  const searches = await Promise.allSettled(queryTerms.map(async (query) => {
    const params = new URLSearchParams({ city: request.destinationCity, keywords: query, pageSize: '10' });
    if (required.includes(query)) params.set('allTypes', '1');
    const response = await fetch(apiUrl(`/api/attractions/search?${params}`));
    const payload = await readPayload(response, `“${query}”地点检索失败`);
    return { query, items: Array.isArray(payload.items) ? payload.items as Array<Record<string, any>> : [] };
  }));
  const rows: Array<Record<string, any>> = searches.flatMap((result) => result.status === 'fulfilled' ? result.value.items.map((item) => ({ ...item, sourceQuery: result.value.query })) : []);
  const candidates = [...new Map(rows.filter(validPoi).map((item) => [String(item.id), item])).values()]
    .filter((item) => !request.avoidPlaces.some((name) => String(item.name).includes(name)))
    .slice(0, 50);
  if (!candidates.length) return [];

  const requiredRows = required.map((query) => bestRequiredMatch(query, candidates)).filter(Boolean) as Array<Record<string, any>>;
  const byId = new Map(candidates.map((item) => [String(item.id), item]));
  let ranked: Array<Record<string, any>> = [];
  try {
    const rankingResponse = await fetch(apiUrl('/api/ai/recommend'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPreferences: { prompt: request.freeText, city: request.destinationCity, days: request.days, interests: request.interests, travelerType: request.travelerType, specialNeeds: request.specialNeeds, requiredPlaces: required, avoidPlaces: request.avoidPlaces },
        candidates,
      }),
    });
    const rankingPayload = await readPayload(rankingResponse, 'AI 景点排序失败');
    ranked = (Array.isArray(rankingPayload.data?.ranked) ? rankingPayload.data.ranked : [])
      .map((rank: Record<string, any>) => ({ ...byId.get(String(rank.id)), recommendationReason: rank.reason, fitScore: rank.fitScore }))
      .filter(validPoi);
  } catch { ranked = []; }
  const targetCount = Math.min(10, Math.max(4, request.days * 3));
  const selected = [...new Map([...requiredRows, ...ranked, ...candidates].map((item) => [String(item.id), item])).values()].slice(0, targetCount);
  return selected.map((item, index) => toRoutePoint(item, request, index));
}

function validPoi(item: Record<string, any> | undefined | null) {
  return Boolean(item?.id && item?.name && Number.isFinite(Number(item?.location?.lng)) && Number.isFinite(Number(item?.location?.lat)));
}

function bestRequiredMatch(query: string, candidates: Array<Record<string, any>>) {
  const needle = normalizePlaceName(query);
  const best = candidates
    .map((item) => { const name = normalizePlaceName(String(item.name)); return { item, score: name === needle ? 4 : name.includes(needle) ? 3 : needle.includes(name) ? 2 : item.sourceQuery === query ? 1 : 0 }; })
    .sort((a, b) => b.score - a.score)[0];
  return best?.score > 0 ? best.item : undefined;
}

function normalizePlaceName(value: string) {
  return value
    .replace(/[\s·（）()]/g, '')
    .replace(/^(武汉|宜昌|恩施|荆州|襄阳|黄石)(市)?/, '')
    .replace(/(风景名胜区|风景区|旅游区|景区)$/g, '');
}

function toRoutePoint(item: Record<string, any>, request: TripRequest, index: number): RoutePoint {
  const requested = request.requestedPlaces.some((name) => normalizePlaceName(String(item.name)).includes(normalizePlaceName(name)) || normalizePlaceName(name).includes(normalizePlaceName(String(item.name))));
  return {
    id: `amap-${String(item.id)}`, name: String(item.name), type: 'scenic', city: request.destinationCity,
    lng: Number(item.location.lng), lat: Number(item.location.lat), coordinateSystem: 'gcj02', time: '', stayMinutes: requested ? 90 : 60,
    reason: requested ? `这是你在首页明确提出的必经地点，已通过高德真实地点检索加入路线。${item.recommendationReason ? ` ${item.recommendationReason}` : ''}` : String(item.recommendationReason || `${item.district || request.destinationCity}的真实候选地点，符合本次个性化需求。`),
    photoTip: `围绕“${request.interests[0] || '旅行'}”主题记录${item.name}，现场遵守拍摄与开放规定。`,
    recordTip: `记录这一站是否符合“${request.freeText.slice(0, 40)}”的原始期待。`,
    day: Math.min(request.days, Math.floor(index / Math.max(1, Math.ceil(Math.min(10, Math.max(4, request.days * 3)) / request.days))) + 1),
    openingHours: item.openingHours || undefined,
  };
}

async function recommendRestaurants(request: TripRequest): Promise<FoodRecommendation[]> {
  const response = await fetch(apiUrl('/api/restaurants/guide'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: request.destinationCity,
      keywords: `${request.destinationCity}特色菜`,
      limit: 6,
      preferences: {
        budgetPerPerson: Math.max(1, Math.round(request.budget / Math.max(1, request.days))),
        interests: request.interests,
        dietaryNeeds: request.dietaryRestrictions,
        mobility: request.specialNeeds.includes('行动不便') ? '少步行' : null,
      },
    }),
  });
  const payload = await readPayload(response, '餐厅指导失败');
  const rows: Array<Record<string, any>> = Array.isArray(payload.recommendations) ? payload.recommendations : [];
  const checkedAt = new Date().toISOString().slice(0, 10);
  return rows.slice(0, 6).filter((item) => item && item.id && item.name).map((item) => {
    const location = item.location && Number.isFinite(Number(item.location.lng)) && Number.isFinite(Number(item.location.lat))
      ? `${Number(item.location.lng)},${Number(item.location.lat)}` : '';
    const sourceUrl = location
      ? `https://uri.amap.com/marker?position=${encodeURIComponent(location)}&name=${encodeURIComponent(String(item.name))}`
      : `https://uri.amap.com/search?keyword=${encodeURIComponent(`${request.destinationCity} ${item.name}`)}`;
    const tags = [item.category, item.recommendationReason].filter(Boolean).map(String).slice(0, 2);
    return {
      id: String(item.id),
      name: String(item.name),
      area: [item.district, item.address].filter(Boolean).join(' · ') || request.destinationCity,
      priceRange: Number.isFinite(Number(item.averageCost)) ? `约 ¥${Number(item.averageCost)}/人` : '消费以商家最新信息为准',
      businessStatus: '非实时，出发前核验' as const,
      tags,
      dianpingUrl: `https://www.dianping.com/search/keyword/0/0_${encodeURIComponent(`${request.destinationCity} ${item.name}`)}`,
      source: { name: '高德动态查询 + 千问排序', url: sourceUrl, checkedAt },
    };
  });
}

async function readPayload(response: Response, message: string): Promise<any> {
  let payload: any = null;
  try { payload = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(payload?.error || `${message}（HTTP ${response.status}）`);
  return payload;
}

function apiUrl(path: string) {
  const base = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}
