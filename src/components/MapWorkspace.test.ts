import { describe, expect, it } from 'vitest';
import { baseRoutes } from '../data/routeData';
import { getDianpingSearchUrl, getHourlyChartScale, getPointServiceLinks } from './MapWorkspace';

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

describe('getDianpingSearchUrl', () => {
  it('uses the Dianping city id and a dish plus area keyword', () => {
    const url = getDianpingSearchUrl('宜昌', '凉虾与萝卜饺子', '解放路 / 西坝');

    expect(url).toContain('/search/keyword/179/');
    expect(url).toContain(encodeURIComponent('凉虾与萝卜饺子 解放路'));
  });

  it('maps every supported destination to its own city search', () => {
    expect(getDianpingSearchUrl('武汉', '热干面', '粮道街')).toContain('/keyword/16/');
    expect(getDianpingSearchUrl('恩施', '合渣', '女儿城')).toContain('/keyword/1368/');
    expect(getDianpingSearchUrl('荆州', '早堂面', '沙市')).toContain('/keyword/184/');
    expect(getDianpingSearchUrl('襄阳', '牛肉面', '樊城')).toContain('/keyword/180/');
    expect(getDianpingSearchUrl('黄石', '港饼', '黄石港区')).toContain('/keyword/177/');
  });
});
