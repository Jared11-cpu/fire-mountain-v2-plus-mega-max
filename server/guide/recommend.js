import { rankCandidates } from '../ai/service.js';
import { searchPois } from '../amap/service.js';
import { assertText, httpError } from '../http.js';

const ALLOWED_CATEGORIES = new Set(['restaurant', 'shop', 'hotel', 'attraction']);

export async function recommendPlaces(env, input, forcedCategory) {
  const category = forcedCategory || String(input.category || 'restaurant');
  if (!ALLOWED_CATEGORIES.has(category)) throw httpError(400, 'category 仅支持 restaurant、shop、hotel、attraction');
  const city = assertText(input.city, '城市', { max: 50 });
  const keywords = assertText(input.keywords || defaultKeyword(category), '搜索关键词', { max: 120 });
  const params = new URLSearchParams({ city, keywords, pageSize: String(Math.max(1, Math.min(25, Number(input.limit) || 15))) });
  if (input.location) params.set('location', normalizeLocation(input.location));
  const facts = await searchPois(env, params, category);
  if (!facts.items.length) return { category, status: 'data_insufficient', generatedAt: facts.generatedAt, source: facts.source, recommendations: [], warnings: ['高德没有返回符合条件的真实地点，请调整城市、关键词或位置。'], dataNotice: facts.dataNotice };

  const ranking = await rankCandidates({ userPreferences: input.preferences || input.userPreferences || {}, candidates: facts.items }, env);
  const byId = new Map(facts.items.map((item) => [item.id, item]));
  const recommendations = ranking.ranked.map((rank) => ({ ...byId.get(rank.id), fitScore: rank.fitScore, recommendationReason: rank.reason }));
  return {
    category, status: ranking.status, source: 'amap+qwen', generatedAt: new Date().toISOString(),
    recommendations, warnings: ranking.warnings, candidateCount: facts.items.length, dataNotice: facts.dataNotice,
  };
}

function normalizeLocation(value) {
  if (typeof value === 'string') return value;
  if (value && Number.isFinite(Number(value.lng)) && Number.isFinite(Number(value.lat))) return `${Number(value.lng)},${Number(value.lat)}`;
  throw httpError(400, 'location 必须是“经度,纬度”或包含 lng、lat 的对象');
}

function defaultKeyword(category) {
  return category === 'restaurant' ? '餐厅' : category === 'shop' ? '特色商店' : category === 'hotel' ? '酒店' : '景点';
}
