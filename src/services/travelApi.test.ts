import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultTripRequest, generateTripPlan } from '../domain/trip';
import { enrichTripPlanWithBackend, parseTravelRequestWithAi } from './travelApi';

afterEach(() => vi.restoreAllMocks());

describe('travel backend integration', () => {
  it('uses the Qwen request parser through the existing same-origin backend', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { city: '武汉', days: 2, budgetPerPerson: 600, interests: ['美食'], dietaryNeeds: [], people: null, startDate: null, mobility: null, transportPreference: '地铁', hotelPreference: null, departureDeadline: null } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await parseTravelRequestWithAi('武汉两天，预算600，喜欢美食');
    expect(result).toMatchObject({ city: '武汉', days: 2, budgetPerPerson: 600 });
    expect(fetcher.mock.calls[0][0]).toBe('/api/ai/parse-request');
  });

  it('forces an explicitly requested AMap place into the personalized route', async () => {
    const request = { ...defaultTripRequest('武汉'), freeText: '武汉两天，必须去武汉长江大桥，喜欢历史和江景', requestedPlaces: ['武汉长江大桥'], interests: ['历史文化'] as const };
    const plan = generateTripPlan(request as never, null);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/attractions/search')) return new Response(JSON.stringify({ items: [{ id: 'bridge', name: '武汉长江大桥', district: '武昌区', address: '长江之上', location: { lng: 114.288, lat: 30.55 } }, { id: 'museum', name: '湖北省博物馆', district: '武昌区', location: { lng: 114.367, lat: 30.56 } }] }), { status: 200 });
      if (url.endsWith('/api/ai/recommend')) return new Response(JSON.stringify({ data: { status: 'ok', ranked: [{ id: 'museum', reason: '符合历史偏好', fitScore: 90 }, { id: 'bridge', reason: '用户明确要求', fitScore: 100 }], warnings: [] } }), { status: 200 });
      if (url.endsWith('/api/restaurants/guide')) return new Response(JSON.stringify({ recommendations: [{ id: 'poi-1', name: '真实湖北菜馆', district: '江汉区', address: '测试路1号', averageCost: 68, category: '湖北菜', recommendationReason: '预算匹配', location: { lng: 114.3, lat: 30.5 } }] }), { status: 200 });
      if (url.endsWith('/api/ai/analyze')) return new Response(JSON.stringify({ data: { analysis: '路线包含用户指定的武汉长江大桥，并补充历史文化地点。' } }), { status: 200 });
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 500 });
    });
    vi.stubGlobal('fetch', fetcher);
    const result = await enrichTripPlanWithBackend(plan, request as never);
    expect(result.analysis).toContain('武汉长江大桥');
    expect(result.routePoints?.[0]).toMatchObject({ name: '武汉长江大桥', lat: 30.55, lng: 114.288 });
    expect(result.routePoints?.[0].reason).toContain('首页明确提出的必经地点');
    expect(result.foods?.[0]).toMatchObject({ id: 'poi-1', name: '真实湖北菜馆', priceRange: '约 ¥68/人' });
    expect(fetcher.mock.calls.map((call) => String(call[0]))).toEqual(expect.arrayContaining([expect.stringContaining('/api/attractions/search'), '/api/ai/recommend', '/api/restaurants/guide', '/api/ai/analyze']));
    expect(fetcher.mock.calls.map((call) => String(call[0]))).toContain('/api/attractions/search?city=%E6%AD%A6%E6%B1%89&keywords=%E6%AD%A6%E6%B1%89%E9%95%BF%E6%B1%9F%E5%A4%A7%E6%A1%A5&pageSize=10&allTypes=1');
  });
});
