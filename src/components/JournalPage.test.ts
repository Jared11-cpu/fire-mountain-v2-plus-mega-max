import { describe, expect, it } from 'vitest';
import { buildJournalMapRoute, buildJournalPosterSvg, layoutJournalPosterPoints } from './JournalPage';
import type { JournalEntry } from '../types/route';

function entry(id: string, pointName: string, lng = 114.3055, lat = 30.5928): JournalEntry {
  return { id, pointId: id, pointName, city: '武汉', day: 1, note: '今天的江风很好。', visitedAt: '2026-07-14', lat, lng, photoIds: [] };
}

describe('journal handwritten route poster', () => {
  it('turns real journal entries into an AMap route with ordered markers and notes', () => {
    const route = buildJournalMapRoute([entry('1', '武汉站', 114.4244, 30.6072), entry('2', '昙华林', 114.302, 30.552)], undefined, 'real');

    expect(route?.points).toHaveLength(2);
    expect(route?.points[0]).toMatchObject({ id: '1', name: '武汉站', type: 'start' });
    expect(route?.points[1]).toMatchObject({ id: '2', name: '昙华林', type: 'end', recordTip: '今天的江风很好。' });
  });

  it('projects every entry into the Hubei poster and separates overlapping pins', () => {
    const points = layoutJournalPosterPoints([entry('1', '长江大桥'), entry('2', '黄鹤楼')]);
    expect(points).toHaveLength(2);
    expect(points.every((point) => point.x >= 138 && point.x <= 674 && point.y >= 96 && point.y <= 376)).toBe(true);
    expect(Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)).toBeGreaterThan(20);
  });

  it('builds an A4 PNG-ready SVG containing the route, outline and escaped notes', () => {
    const svg = buildJournalPosterSvg([entry('1', '黄鹤楼 & 长江')], 'real');
    expect(svg).toContain('width="1240" height="1754"');
    expect(svg).toContain('我的旅行路线手账');
    expect(svg).toContain('湖北轮廓示意');
    expect(svg).toContain('黄鹤楼 &amp; 长江');
    expect(svg).not.toContain('黄鹤楼 & 长江');
  });
});
