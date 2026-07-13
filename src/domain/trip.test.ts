import { describe, expect, it } from 'vitest';
import { addDaysIso, budgetTotal, calculateTimeline, daysBetween, decodeSharePlan, defaultTripRequest, encodeSharePlan, generateTripPlan, parseTravelRequest } from './trip';
import type { RoutePoint } from '../types/route';

describe('parseTravelRequest', () => {
  const cases = [
    ['武汉一日游，预算300元，喜欢美食', '武汉', 1, 300],
    ['宜昌两天一夜，600元以内，朋友拍照', '宜昌', 2, 600],
    ['恩施三天两夜，预算1000元，喜欢峡谷和拍照，不吃辣', '恩施', 3, 1000],
    ['荆州四天，家庭历史文化游', '荆州', 4, 600],
    ['襄阳两日游，情侣Citywalk，预算800元', '襄阳', 2, 800],
    ['黄石一日游，学生喜欢自然风光，预算200元', '黄石', 1, 200],
  ] as const;

  it.each(cases)('解析 %s', (text, city, days, budget) => {
    const result = parseTravelRequest(text);
    expect(result.request.destinationCity).toBe(city);
    expect(result.request.days).toBe(days);
    expect(result.request.budget).toBe(budget);
    expect(new Set(result.request.interests).size).toBe(result.request.interests.length);
  });

  it('满足恩施验收文本的规范化标签', () => {
    const result = parseTravelRequest('恩施三天两夜，预算1000元，喜欢峡谷和拍照，不吃辣');
    expect(result.request).toMatchObject({ destinationCity: '恩施', days: 3, budget: 1000 });
    expect(result.request.interests).toEqual(['自然风光', '拍照']);
    expect(result.request.dietaryRestrictions).toContain('不吃辣');
  });
});

describe('dates, timeline and plan integrity', () => {
  it('计算日期并支持反算天数', () => {
    expect(addDaysIso('2026-07-13', 2)).toBe('2026-07-15');
    expect(daysBetween('2026-07-13', '2026-07-15')).toBe(3);
  });

  it('时间线严格递增，恩施远距离路段不少于90分钟', () => {
    const points: RoutePoint[] = [
      point('station', '恩施站', 30.336, 109.486),
      point('canyon', '恩施大峡谷', 30.4267, 109.1693),
      point('city', '恩施女儿城', 30.274, 109.493),
    ];
    const timeline = calculateTimeline(points, '08:00');
    expect(timeline[0].arrivalTime).toBe('08:15');
    expect(timeline[0].travelMinutesToNext).toBeGreaterThanOrEqual(90);
    for (let index = 1; index < timeline.length; index += 1) {
      expect(toMinutes(timeline[index].arrivalTime)).toBeGreaterThan(toMinutes(timeline[index - 1].arrivalTime) + timeline[index - 1].durationMinutes);
    }
  });

  it('兴趣和标题不重复，预算增删总计正确', () => {
    const request = { ...defaultTripRequest(), interests: ['拍照', '拍照'] as never };
    const plan = generateTripPlan(request);
    expect(plan.requestSnapshot.interests).toEqual(['拍照']);
    expect(plan.route.title).not.toContain('拍照 × 拍照');
    expect(budgetTotal([{ id: '1', item: 'A', amount: 20, note: '' }, { id: '2', item: 'B', amount: 30, note: '' }])).toBe(50);
  });

  it('分享载荷可恢复且排除真实足迹字段', () => {
    const plan = generateTripPlan(defaultTripRequest('武汉'));
    const encoded = encodeSharePlan(plan);
    expect(decodeSharePlan(encoded).requestSnapshot.destinationCity).toBe('武汉');
    expect(encoded).not.toContain('journalEntries');
  });
});

function point(id: string, name: string, lat: number, lng: number): RoutePoint {
  return { id, name, city: '恩施', lat, lng, type: id === 'station' ? 'start' : 'scenic', time: '', stayMinutes: 45, reason: '', photoTip: '', recordTip: '', transportMode: 'drive' };
}
function toMinutes(value: string) { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; }
