import { rankCandidates } from '../ai/service.js';
import { searchPois, searchPoisAround } from '../amap/service.js';
import { assertText, httpError } from '../http.js';

const ALLOWED_CATEGORIES = new Set(['restaurant', 'shop', 'hotel', 'attraction']);

export async function recommendPlaces(env, input, forcedCategory) {
  const category = forcedCategory || String(input.category || 'restaurant');
  if (!ALLOWED_CATEGORIES.has(category)) throw httpError(400, 'category 仅支持 restaurant、shop、hotel、attraction');
  const city = assertText(input.city, '城市', { max: 50 });
  const keywords = assertText(input.keywords || defaultKeyword(category), '搜索关键词', { max: 120 });
  const limit = Math.max(1, Math.min(25, Number(input.limit) || 15));
  const routePoints = normalizeRoutePoints(input.routePoints);
  const facts = category === 'restaurant' && routePoints.length
    ? await searchRestaurantsAlongRoute(env, routePoints, limit, input.radiusMeters)
    : await searchSingleQuery(env, city, keywords, input.location, category, limit);
  if (!facts.items.length) return { category, status: 'data_insufficient', generatedAt: facts.generatedAt, source: facts.source, recommendations: [], warnings: ['高德没有返回符合条件的真实地点，请调整城市、关键词或位置。'], dataNotice: facts.dataNotice };

  let ranking;
  try {
    ranking = await rankCandidates({ userPreferences: { ...(input.preferences || input.userPreferences || {}), routePoints, requestedCount: limit }, candidates: facts.items }, env);
  } catch {
    ranking = { status: 'data_insufficient', ranked: [], warnings: ['AI 排序暂不可用，当前按高德周边距离展示。'] };
  }
  const byId = new Map(facts.items.map((item) => [item.id, item]));
  const ranked = ranking.ranked.map((rank) => ({ ...byId.get(rank.id), fitScore: rank.fitScore, recommendationReason: rank.reason }));
  const rankedIds = new Set(ranked.map((item) => item.id));
  const nearby = facts.items.filter((item) => !rankedIds.has(item.id)).map((item) => ({ ...item, recommendationReason: `高德实时检索到的路线周边餐饮，靠近${item.nearestRoutePoint?.name || '当前路线'}。` }));
  const recommendations = [...ranked, ...nearby].slice(0, limit);
  return {
    category, status: ranking.status, source: 'amap+qwen', generatedAt: new Date().toISOString(),
    recommendations, warnings: ranking.warnings, candidateCount: facts.items.length, dataNotice: facts.dataNotice,
  };
}

async function searchRestaurantsAlongRoute(env, routePoints, limit, radiusValue) {
  const radius = Math.max(300, Math.min(5000, Number(radiusValue) || 1500));
  const candidateLimit = Math.min(50, Math.max(limit * 3, routePoints.length * 4));
  const pageSize = Math.min(10, Math.max(5, Math.ceil(candidateLimit / routePoints.length) + 2));
  const searches = await Promise.allSettled(routePoints.map(async (point) => {
    const params = new URLSearchParams({ location: `${point.lng},${point.lat}`, radius: String(radius), pageSize: String(pageSize), types: '050000' });
    const facts = await searchPoisAround(env, params, 'restaurant');
    return { point, items: facts.items };
  }));
  const groups = searches.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const selected = [];
  const seen = new Set();
  for (let row = 0; selected.length < candidateLimit && groups.some((group) => row < group.items.length); row += 1) {
    for (const group of groups) {
      const item = group.items[row];
      if (!item || !item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      selected.push(withRouteProximity(item, routePoints));
      if (selected.length >= candidateLimit) break;
    }
  }
  return {
    source: 'amap', category: 'restaurant', generatedAt: new Date().toISOString(), items: selected,
    dataNotice: `已按当前路线的${routePoints.length}个地点分别搜索${radius}米内真实餐饮；AI 只基于这些事实排序。`,
  };
}

async function searchSingleQuery(env, city, keywords, location, category, limit) {
  const params = new URLSearchParams({ city, keywords, pageSize: String(limit) });
  if (location) params.set('location', normalizeLocation(location));
  return searchPois(env, params, category);
}

function withRouteProximity(item, routePoints) {
  if (!item.location || !routePoints.length) return item;
  const nearest = routePoints
    .map((point) => ({ point, distance: haversineMeters(item.location.lat, item.location.lng, point.lat, point.lng) }))
    .sort((left, right) => left.distance - right.distance)[0];
  return { ...item, nearestRoutePoint: { id: nearest.point.id, name: nearest.point.name, day: nearest.point.day }, routeDistanceMeters: Math.round(nearest.distance) };
}

function normalizeRoutePoints(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((point, index) => {
    const lng = Number(point?.lng); const lat = Number(point?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [{ id: String(point.id || `route-${index}`), name: String(point.name || `路线点${index + 1}`).slice(0, 120), lng, lat, day: Number(point.day) || 1 }];
  });
}

function haversineMeters(lat1, lng1, lat2, lng2) { const radius = 6371000; const rad = (value) => Number(value) * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }

function normalizeLocation(value) {
  if (typeof value === 'string') return value;
  if (value && Number.isFinite(Number(value.lng)) && Number.isFinite(Number(value.lat))) return `${Number(value.lng)},${Number(value.lat)}`;
  throw httpError(400, 'location 必须是“经度,纬度”或包含 lng、lat 的对象');
}

function defaultKeyword(category) {
  return category === 'restaurant' ? '餐厅' : category === 'shop' ? '特色商店' : category === 'hotel' ? '酒店' : '景点';
}
