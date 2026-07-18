import { rankCandidates } from '../ai/service.js';
import { searchPois } from '../amap/service.js';
import { assertText, httpError } from '../http.js';

const ALLOWED_CATEGORIES = new Set(['restaurant', 'shop', 'hotel', 'attraction']);

export async function recommendPlaces(env, input, forcedCategory) {
  const category = forcedCategory || String(input.category || 'restaurant');
  if (!ALLOWED_CATEGORIES.has(category)) throw httpError(400, 'category 仅支持 restaurant、shop、hotel、attraction');
  const city = assertText(input.city, '城市', { max: 50 });
  const keywords = assertText(input.keywords || defaultKeyword(category), '搜索关键词', { max: 120 });
  const limit = Math.max(1, Math.min(25, Number(input.limit) || 15));
  const routePoints = normalizeRoutePoints(input.routePoints);
  const verifiedShops = category === 'restaurant' ? normalizeVerifiedShops(input.verifiedShops) : [];
  const facts = verifiedShops.length
    ? await searchVerifiedRestaurants(env, city, verifiedShops, routePoints, limit)
    : await searchSingleQuery(env, city, keywords, input.location, category, limit);
  if (!facts.items.length) return { category, status: 'data_insufficient', generatedAt: facts.generatedAt, source: facts.source, recommendations: [], warnings: ['高德没有返回符合条件的真实地点，请调整城市、关键词或位置。'], dataNotice: facts.dataNotice };

  const ranking = await rankCandidates({ userPreferences: { ...(input.preferences || input.userPreferences || {}), routePoints }, candidates: facts.items }, env);
  const byId = new Map(facts.items.map((item) => [item.id, item]));
  const recommendations = ranking.ranked.map((rank) => ({ ...byId.get(rank.id), fitScore: rank.fitScore, recommendationReason: rank.reason }));
  return {
    category, status: ranking.status, source: 'amap+qwen', generatedAt: new Date().toISOString(),
    recommendations, warnings: ranking.warnings, candidateCount: facts.items.length, dataNotice: facts.dataNotice,
  };
}

async function searchSingleQuery(env, city, keywords, location, category, limit) {
  const params = new URLSearchParams({ city, keywords, pageSize: String(limit) });
  if (location) params.set('location', normalizeLocation(location));
  return searchPois(env, params, category);
}

async function searchVerifiedRestaurants(env, city, verifiedShops, routePoints, limit) {
  const searches = await Promise.allSettled(verifiedShops.slice(0, limit).map(async (shop) => {
    const facts = await searchPois(env, new URLSearchParams({ city, keywords: shop.name, pageSize: '8' }), 'restaurant');
    const best = bestNameMatch(shop.name, facts.items);
    return best ? withRouteProximity({ ...best, verifiedShopName: shop.name }, routePoints) : null;
  }));
  const items = searches.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
  return {
    source: 'amap', category: 'restaurant', generatedAt: new Date().toISOString(), items,
    dataNotice: '店铺位置、评分、消费与营业信息来自本次高德动态查询；AI 仅基于这些事实和当前路线排序。',
  };
}

function bestNameMatch(expected, items) {
  const needle = normalizeName(expected);
  const best = items.map((item) => {
    const name = normalizeName(item.name);
    const score = name === needle ? 4 : name.includes(needle) ? 3 : needle.includes(name) ? 2 : 0;
    return { item, score };
  }).sort((left, right) => right.score - left.score)[0];
  return best?.score > 0 ? best.item : null;
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

function normalizeVerifiedShops(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((shop) => {
    const name = String(shop?.name || '').trim();
    return name ? [{ name: name.slice(0, 120) }] : [];
  });
}

function normalizeName(value) { return String(value || '').replace(/[\s·・（）()\-—]/gu, '').replace(/店$/u, '').toLowerCase(); }
function haversineMeters(lat1, lng1, lat2, lng2) { const radius = 6371000; const rad = (value) => Number(value) * Math.PI / 180; const dLat = rad(lat2 - lat1); const dLng = rad(lng2 - lng1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2; return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }

function normalizeLocation(value) {
  if (typeof value === 'string') return value;
  if (value && Number.isFinite(Number(value.lng)) && Number.isFinite(Number(value.lat))) return `${Number(value.lng)},${Number(value.lat)}`;
  throw httpError(400, 'location 必须是“经度,纬度”或包含 lng、lat 的对象');
}

function defaultKeyword(category) {
  return category === 'restaurant' ? '餐厅' : category === 'shop' ? '特色商店' : category === 'hotel' ? '酒店' : '景点';
}
