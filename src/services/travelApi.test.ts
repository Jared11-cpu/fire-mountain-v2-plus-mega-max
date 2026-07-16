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

  it('enriches the existing plan without changing its page contract', async () => {
    const request = defaultTripRequest('武汉');
    const plan = generateTripPlan(request, null);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { analysis: '该路线匹配用户的美食与拍照偏好。' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recommendations: [{ id: 'poi-1', name: '真实湖北菜馆', district: '江汉区', address: '测试路1号', averageCost: 68, category: '湖南菜', recommendationReason: '预算匹配', location: { lng: 114.3, lat: 30.5 } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await enrichTripPlanWithBackend(plan, request);
    expect(result.analysis).toContain('匹配用户');
    expect(result.foods?.[0]).toMatchObject({ id: 'poi-1', name: '真实湖北菜馆', priceRange: '约 ¥68/人' });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual(['/api/ai/analyze', '/api/restaurants/guide']);
  });
});
