import { describe, expect, it, vi } from 'vitest';
import { defaultTripRequest, generateTripPlan } from '../domain/trip';
import { resolveTransportPlan, toTransportPlanRequest, type TransportPlanResponse } from './transportService';

function requestFixture() {
  const request = defaultTripRequest('宜昌');
  const plan = generateTripPlan(request);
  return toTransportPlanRequest(request, plan.route.points, plan.settings.departureTime);
}

describe('transportService', () => {
  it('未配置 API 时生成分段规则交通方案', async () => {
    const result = await resolveTransportPlan(requestFixture(), { endpoint: '' });
    expect(result.source).toBe('rules-v1');
    expect(result.isRealtime).toBe(false);
    expect(result.segments).toHaveLength(5);
    expect(result.segments.every((segment) => segment.arrivalTime > segment.departureTime)).toBe(true);
    expect(result.notices[0]).toContain('未配置实时交通 API');
  });

  it('配置后端地址时使用交通 API 响应', async () => {
    const apiResult: TransportPlanResponse = { source: 'transport-api', sourceLabel: '测试交通 API', generatedAt: new Date().toISOString(), isRealtime: true, totalMinutes: 20, totalDistanceKm: 8, summary: '实时路线可用', segments: [{ id: 'a-b', from: 'A', to: 'B', departureTime: '09:00', arrivalTime: '09:20', durationMinutes: 20, distanceKm: 8, mode: '网约车', costEstimate: '¥20–30', instruction: '按实时路线行驶', liveStatus: '道路畅通' }], notices: [] };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(apiResult), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
    const result = await resolveTransportPlan(requestFixture(), { endpoint: 'https://example.test/transport', fetcher });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.source).toBe('transport-api');
    expect(result.isRealtime).toBe(true);
    expect(result.segments[0].liveStatus).toBe('道路畅通');
  });

  it('交通 API 失败时明确降级为规则方案', async () => {
    const fetcher = vi.fn(async () => new Response('error', { status: 503 })) as unknown as typeof fetch;
    const result = await resolveTransportPlan(requestFixture(), { endpoint: 'https://example.test/transport', fetcher });
    expect(result.source).toBe('rules-fallback');
    expect(result.sourceLabel).toContain('规则降级');
    expect(result.notices[0]).toContain('HTTP 503');
  });
});

