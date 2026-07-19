import { describe, expect, it } from 'vitest';
import { baseRoutes } from '../data/routeData';
import type { TransportPlanResponse } from '../services/transportService';
import { compactTravelTip, getBudgetUsageVisual, getDianpingShopDetailUrl, getHourlyChartScale, getPointPrimaryDetailLink, getPointServiceLinks, getRailwayStationTimetableUrl, getVerifiedCtripDetailUrl, isDirectCtripDetailUrl, normalizeActualStayMinutes, normalizeTravelMinutes, recalculateEditableTimeline } from './MapWorkspace';
import { getFocusedTransportPath, getFocusedTransportSegmentPoints } from './RouteMap';

describe('getPointServiceLinks', () => {
  it('assigns every planned stop its own traceable representative cover', () => {
    for (const route of Object.values(baseRoutes)) {
      const covers = route.points.map((point) => point.imageUrl);
      expect(covers.every(Boolean), route.city).toBe(true);
      expect(new Set(covers).size, `${route.city} route covers`).toBe(route.points.length);
      for (const point of route.points) {
        expect(point.imageCredit?.sourceUrl, `${route.city} / ${point.name}`).toContain('commons.wikimedia.org/wiki/File:');
      }
    }
  });

  it('routes railway stations to official 12306 services', () => {
    const links = getPointServiceLinks({ name: '宜昌东站', city: '宜昌', type: 'start' }, '2026-07-19');

    expect(links.kind).toBe('railway');
    expect(links.detailUrl).toBeUndefined();
    expect(links.bookingUrl).toContain('12306.cn');
    expect(links.amapUrl).toContain(encodeURIComponent('宜昌 宜昌东站'));
    expect(links.timetableUrl).toBe('https://kyfw.12306.cn/otn/czxx/init?date=2026-07-19&station_code=HAN&station_name=%E5%AE%9C%E6%98%8C%E4%B8%9C%E7%AB%99');
  });

  it('uses only the station-specific timetable as the railway primary action', () => {
    expect(getPointPrimaryDetailLink({ name: '武汉站', city: '武汉', type: 'start' }, '2026-07-19')).toMatchObject({
      source: 'railway',
      label: '12306 · 武汉站到发车次',
      url: 'https://kyfw.12306.cn/otn/czxx/init?date=2026-07-19&station_code=WHN&station_name=%E6%AD%A6%E6%B1%89%E7%AB%99',
    });
  });

  it('builds direct 12306 station timetable links for every supported Hubei start station', () => {
    const expectedCodes = { 武汉站: 'WHN', 宜昌东站: 'HAN', 恩施站: 'ESN', 荆州站: 'JBN', 襄阳东站: 'EKN', 黄石北站: 'KSN' } as const;
    for (const [stationName, stationCode] of Object.entries(expectedCodes)) {
      const url = new URL(getRailwayStationTimetableUrl(stationName, '2026-07-19'));
      expect(url.origin + url.pathname).toBe('https://kyfw.12306.cn/otn/czxx/init');
      expect(url.searchParams.get('date')).toBe('2026-07-19');
      expect(url.searchParams.get('station_code')).toBe(stationCode);
      expect(url.searchParams.get('station_name')).toBe(stationName);
    }
  });

  it('routes every non-station point to Ctrip details and ticket search', () => {
    const links = getPointServiceLinks({ name: '坛子岭观景台', city: '宜昌', type: 'scenic' });

    expect(links.kind).toBe('attraction');
    expect(links.detailUrl).toBe('https://you.ctrip.com/sight/yichang313/46345.html');
    expect(links.bookingUrl).toContain('m.ctrip.com');
    expect(links.bookingUrl).toContain(encodeURIComponent('宜昌 坛子岭观景台'));
  });

  it('uses the verified Ctrip detail page for the Three Gorges visitor center', () => {
    const links = getPointServiceLinks({ name: '三峡游客中心', city: '宜昌', type: 'rest' });

    expect(links.detailUrl).toBe('https://you.ctrip.com/traffic/yichang313/g51289164.html');
    expect(links.bookingUrl).toContain(encodeURIComponent('宜昌 三峡游客中心'));
  });

  it('opens the exact Wuhan University detail page instead of a city guide', () => {
    const links = getPointServiceLinks({ name: '武汉大学', city: '武汉', type: 'scenic', lat: 30.538, lng: 114.365 });

    expect(links.detailUrl).toBe('https://you.ctrip.com/sight/145/1493507.html');
  });

  it('does not disguise another page as the detail page for an unmapped attraction', () => {
    const links = getPointServiceLinks({ name: '临时点位', city: '武汉', type: 'scenic', lat: 30.5, lng: 114.3 });

    expect(links.detailUrl).toBeUndefined();
    expect(links.amapUrl).toContain('uri.amap.com/marker');
    expect(links.amapUrl).toContain('position=114.3,30.5');
  });

  it('always provides a direct primary detail link with AMap as the honest fallback', () => {
    expect(getPointPrimaryDetailLink({ name: '武汉大学', city: '武汉', type: 'scenic' })).toMatchObject({
      source: 'ctrip',
      label: '携程 · 景点详情',
      url: 'https://you.ctrip.com/sight/145/1493507.html',
    });
    expect(getPointPrimaryDetailLink({ name: '临时点位', city: '武汉', type: 'scenic', lat: 30.5, lng: 114.3 })).toMatchObject({
      source: 'amap',
      label: '高德 · 地点信息',
    });
    expect(getPointPrimaryDetailLink({ name: '临时点位', city: '武汉', type: 'scenic', lat: 30.5, lng: 114.3 }).url).toContain('uri.amap.com/marker');
  });

  it('maps a Three Gorges sub-area to the verified direct Ctrip attraction page', () => {
    expect(getVerifiedCtripDetailUrl({ name: '三峡工程党建文化广场', type: 'scenic' })).toBe('https://you.ctrip.com/sight/yichang313/140201.html');
  });

  it('rejects Ctrip home, search, city guide, and category pages as detail links', () => {
    expect(isDirectCtripDetailUrl('https://www.ctrip.com/')).toBe(false);
    expect(isDirectCtripDetailUrl('https://you.ctrip.com/searchsite/sight/?query=test')).toBe(false);
    expect(isDirectCtripDetailUrl('https://you.ctrip.com/place/yichang313.html')).toBe(false);
    expect(isDirectCtripDetailUrl('https://you.ctrip.com/food/jingzhou413.html')).toBe(false);
  });

  it('binds every planned route point to a direct Ctrip page instead of the retired search route', () => {
    for (const route of Object.values(baseRoutes)) {
      for (const point of route.points) {
        const links = getPointServiceLinks(point);
        if (point.type !== 'start' && point.name !== '黄石港饼老店') {
          expect(isDirectCtripDetailUrl(links.detailUrl), `${point.city} / ${point.name}`).toBe(true);
          expect(links.detailUrl, `${point.city} / ${point.name}`).not.toContain('/searchsite/');
        }
        expect(links.bookingUrl, `${point.city} / ${point.name}`).toContain('m.ctrip.com/');
        expect(links.bookingUrl, `${point.city} / ${point.name}`).toContain(encodeURIComponent(`${point.city} ${point.name}`));
      }
    }
  });
});

describe('normalizeActualStayMinutes', () => {
  it('keeps actual stay entries within a full-day range', () => {
    expect(normalizeActualStayMinutes(75.4)).toBe(75);
    expect(normalizeActualStayMinutes(-8)).toBe(0);
    expect(normalizeActualStayMinutes(1600)).toBe(1440);
    expect(normalizeActualStayMinutes('')).toBe(0);
  });
});

describe('editable next-leg transport', () => {
  it('normalizes custom transport minutes', () => {
    expect(normalizeTravelMinutes(35.6)).toBe(36);
    expect(normalizeTravelMinutes(-1)).toBe(0);
    expect(normalizeTravelMinutes(2000)).toBe(1440);
  });

  it('updates every downstream arrival after a custom transport edit', () => {
    const source = baseRoutes.武汉.points.slice(0, 3).map((point, index) => ({
      ...point, arrivalTime: '', durationMinutes: [10, 20, 30][index], travelMinutesToNext: [30, 5, 0][index],
    }));
    const result = recalculateEditableTimeline(source as never, '08:30');

    expect(result.map((point) => point.arrivalTime)).toEqual(['08:45', '09:25', '09:50']);
    expect(result[0].travelMinutesToNext).toBe(30);
  });
});

describe('compactTravelTip', () => {
  it('replaces verbose generated guidance with a concise note', () => {
    expect(compactTravelTip('记录这一站是否符合“武汉两天一夜，预算600元，喜欢拍照和美食”的原始期待。', '记下最喜欢的细节。')).toBe('记下最喜欢的细节。');
    expect(compactTravelTip('围绕“拍照”主题记录武汉大学，现场遵守拍摄与开放规定。', '拍下武汉大学的代表性画面。')).toBe('拍下武汉大学的代表性画面。');
  });

  it('caps long custom tips without producing a dense paragraph', () => {
    const tip = compactTravelTip('这是一个非常非常长的拍摄建议，需要在卡片里保持简洁并避免占用过多空间。', '拍下代表性画面。', 16);
    expect(tip.length).toBeLessThanOrEqual(16);
    expect(tip).toMatch(/…$/);
  });
});

describe('getHourlyChartScale', () => {
  it('adds readable padding around the observed temperature range', () => {
    const scale = getHourlyChartScale([
      { time: '2026-07-14T10:00', temperature: 34, rainProbability: 0, code: 1 },
      { time: '2026-07-14T11:00', temperature: 38, rainProbability: 20, code: 2 },
    ]);

    expect(scale).toEqual({ temperatureMin: 33, temperatureMax: 39 });
  });

  it('keeps a non-zero range when every hour has the same temperature', () => {
    const scale = getHourlyChartScale([
      { time: '2026-07-14T10:00', temperature: 35, rainProbability: 0, code: 0 },
      { time: '2026-07-14T11:00', temperature: 35, rainProbability: 0, code: 0 },
    ]);

    expect(scale.temperatureMax).toBeGreaterThan(scale.temperatureMin);
  });
});

describe('getDianpingShopDetailUrl', () => {
  it('accepts only direct Dianping shop detail pages', () => {
    expect(getDianpingShopDetailUrl('https://www.dianping.com/shop/l3LoOn1gi2ggY01E')).toBe('https://www.dianping.com/shop/l3LoOn1gi2ggY01E');
    expect(getDianpingShopDetailUrl('https://m.dianping.com/shop/128523373')).toBe('https://m.dianping.com/shop/128523373');
  });

  it('rejects search, homepage, and unrelated links', () => {
    expect(getDianpingShopDetailUrl('https://www.dianping.com/search/keyword/16/0_test')).toBeUndefined();
    expect(getDianpingShopDetailUrl('https://www.dianping.com/')).toBeUndefined();
    expect(getDianpingShopDetailUrl('https://example.com/shop/123')).toBeUndefined();
  });
});

describe('getBudgetUsageVisual', () => {
  it('calculates usage from actual spending divided by the planned budget', () => {
    expect(getBudgetUsageVisual(150, 600)).toMatchObject({ percent: 25, clampedPercent: 25, fillPercent: 25, difference: 450 });
    expect(getBudgetUsageVisual(400, 600)).toMatchObject({ percent: 67, fillPercent: 67, difference: 200 });
    expect(getBudgetUsageVisual(600, 600)).toMatchObject({ percent: 100, clampedPercent: 100, fillPercent: 100, difference: 0 });
    expect(getBudgetUsageVisual(720, 600)).toMatchObject({ percent: 120, clampedPercent: 100, fillPercent: 100, difference: -120 });
  });

  it('uses one solid card color: green at zero, yellow at 60%, and red from 80%', () => {
    expect(getBudgetUsageVisual(0, 600).color).toBe('hsl(152 72% 36%)');
    expect(getBudgetUsageVisual(360, 600).color).toBe('hsl(44 82% 48%)');
    expect(getBudgetUsageVisual(480, 600).color).toBe('hsl(4 76% 46%)');
    expect(getBudgetUsageVisual(600, 600).color).toBe('hsl(2 76% 42%)');
    expect(getBudgetUsageVisual(0, 600)).not.toHaveProperty('background');
  });

  it('deepens the red as spending exceeds the budget', () => {
    expect(getBudgetUsageVisual(900, 600).color).toBe('hsl(357 77% 33%)');
    expect(getBudgetUsageVisual(1200, 600).color).toBe('hsl(352 78% 24%)');
    expect(getBudgetUsageVisual(1800, 600).color).toBe(getBudgetUsageVisual(1200, 600).color);
  });
});

describe('getFocusedTransportPath', () => {
  it('returns only the selected segment geometry for map focus', () => {
    const plan = {
      source: 'transport-api',
      freshness: 'live-query',
      segments: [
        { id: 'segment-1', legs: [{ polyline: [[111, 30], [111.1, 30.1]] }] },
        { id: 'segment-2', legs: [{ polyline: [[112, 31], [112.1, 31.1]] }, { polyline: [[112.1, 31.1], [112.2, 31.2]] }] },
      ],
    } as TransportPlanResponse;

    expect(getFocusedTransportPath(plan, 'segment-2')).toEqual([[112, 31], [112.1, 31.1], [112.1, 31.1], [112.2, 31.2]]);
    expect(getFocusedTransportPath(plan, 'missing')).toEqual([]);
    expect(getFocusedTransportPath({ ...plan, source: 'rules-fallback', freshness: 'estimate' } as TransportPlanResponse, 'segment-2')).toEqual([]);
  });

  it('maps a focused transport segment back to its adjacent route points', () => {
    const route = { points: baseRoutes.宜昌.points.slice(0, 3) } as never;
    const plan = { segments: [{ id: 'first' }, { id: 'second' }] } as TransportPlanResponse;

    expect(getFocusedTransportSegmentPoints(route, plan, 'second').map((point) => point.name)).toEqual(baseRoutes.宜昌.points.slice(1, 3).map((point) => point.name));
    expect(getFocusedTransportSegmentPoints(route, plan, 'missing')).toEqual([]);
  });
});
