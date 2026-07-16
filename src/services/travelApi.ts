import type { FoodRecommendation, TripPlan, TripRequest } from '../domain/trip';

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

export async function enrichTripPlanWithBackend(plan: TripPlan, request: TripRequest): Promise<{ analysis?: string; foods?: FoodRecommendation[] }> {
  const [analysis, foods] = await Promise.allSettled([analyzeTrip(plan, request), recommendRestaurants(request)]);
  const result: { analysis?: string; foods?: FoodRecommendation[] } = {};
  if (analysis.status === 'fulfilled' && analysis.value) result.analysis = analysis.value;
  if (foods.status === 'fulfilled' && foods.value.length) result.foods = foods.value;
  if (!result.analysis && !result.foods) throw new Error('AI 与真实餐厅服务暂时不可用');
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
        },
        route: plan.route.points.map((point) => ({ name: point.name, arrivalTime: point.time, stayMinutes: point.stayMinutes, estimatedCost: point.estimatedCost ?? null })),
        transportSuggestion: plan.route.transportSuggestion,
      },
    }),
  });
  const payload = await readPayload(response, 'AI 方案分析失败');
  return typeof payload.data?.analysis === 'string' ? payload.data.analysis.trim() : '';
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
