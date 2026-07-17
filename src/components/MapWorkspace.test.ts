import { describe, expect, it } from 'vitest';
import { baseRoutes } from '../data/routeData';
import { compactTravelTip, getBudgetUsageVisual, getDianpingShopDetailUrl, getHourlyChartScale, getPointServiceLinks } from './MapWorkspace';

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
    const links = getPointServiceLinks({ name: '宜昌东站', city: '宜昌', type: 'start' });

    expect(links.kind).toBe('railway');
    expect(links.detailUrl).toContain('12306.cn');
    expect(links.bookingUrl).toContain('12306.cn');
    expect(links.amapUrl).toContain(encodeURIComponent('宜昌 宜昌东站'));
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

  it('falls back to an exact coordinate marker for an unmapped attraction', () => {
    const links = getPointServiceLinks({ name: '临时点位', city: '武汉', type: 'scenic', lat: 30.5, lng: 114.3 });

    expect(links.detailUrl).toContain('uri.amap.com/marker');
    expect(links.detailUrl).toContain('position=114.3,30.5');
  });

  it('binds every planned route point to a direct Ctrip page instead of the retired search route', () => {
    for (const route of Object.values(baseRoutes)) {
      for (const point of route.points) {
        const links = getPointServiceLinks(point);
        expect(links.detailUrl, `${point.city} / ${point.name}`).toContain('you.ctrip.com/');
        expect(links.detailUrl, `${point.city} / ${point.name}`).not.toContain('/searchsite/');
        expect(links.bookingUrl, `${point.city} / ${point.name}`).toContain('m.ctrip.com/');
        expect(links.bookingUrl, `${point.city} / ${point.name}`).toContain(encodeURIComponent(`${point.city} ${point.name}`));
      }
    }
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
    expect(getBudgetUsageVisual(150, 600)).toMatchObject({ percent: 25, clampedPercent: 25, difference: 450 });
    expect(getBudgetUsageVisual(600, 600)).toMatchObject({ percent: 100, clampedPercent: 100, difference: 0 });
    expect(getBudgetUsageVisual(720, 600)).toMatchObject({ percent: 120, clampedPercent: 100, difference: -120 });
  });

  it('moves the usage color from green through yellow to red as spending rises', () => {
    expect(getBudgetUsageVisual(0, 600).color).toBe('hsl(145 78% 55%)');
    expect(getBudgetUsageVisual(300, 600).color).toBe('hsl(73 78% 55%)');
    expect(getBudgetUsageVisual(600, 600).color).toBe('hsl(0 78% 55%)');
  });
});
