import { describe, expect, it } from 'vitest';
import { addDaysIso, budgetTotal, buildFoodRecommendations, buildSocialCopy, calculateTimeline, daysBetween, decodeSharePlan, defaultTripRequest, encodeSharePlan, generateTripPlan, parseLocalDate, parseTravelRequest } from './trip';
import type { RoutePoint } from '../types/route';

describe('buildFoodRecommendations', () => {
  it('returns verified merchant detail links instead of category search links', () => {
    const foods = buildFoodRecommendations(defaultTripRequest('宜昌'));

    expect(foods).toHaveLength(2);
    expect(foods[0].name).toContain('郑信记凉虾');
    expect(foods.every((food) => /dianping\.com\/shop\//.test(food.dianpingUrl))).toBe(true);
    expect(foods.every((food) => !food.dianpingUrl.includes('/search/keyword/'))).toBe(true);
  });
});

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

  it.each(['预算1200', '预算1200元', '1200块', '人均1200'])('识别预算写法 %s', (budgetText) => {
    expect(parseTravelRequest(`武汉三天，${budgetText}`).request.budget).toBe(1200);
  });

  it('每次从文本重新生成标签，同时保留手动日期', () => {
    const base = { ...defaultTripRequest('武汉'), budget: 888, dietaryRestrictions: ['素食'] as const, specialNeeds: ['行动不便'] as const, startDate: '2026-07-14', endDate: '2026-07-15' };
    const result = parseTravelRequest('武汉三天，预算1200，喜欢历史文化和美食，不吃辣，带儿童，雨天方案', base as never);
    expect(result.request).toMatchObject({ budget: 1200, travelerType: '家庭', startDate: '2026-07-14', endDate: '2026-07-16' });
    expect(result.request.interests).toEqual(['美食', '历史文化']);
    expect(result.request.dietaryRestrictions).toEqual(['不吃辣']);
    expect(result.request.specialNeeds).toEqual(['带儿童', '雨天方案']);
  });

  it('未明确输入带儿童时不自动改为家庭', () => {
    expect(parseTravelRequest('武汉亲子美食三日游').request.travelerType).toBe('朋友');
  });

  it('把首页明确地点保存为必经约束，并容忍三峡口语描述', () => {
    const bridge = parseTravelRequest('我想去武汉两天，必须经过武汉长江大桥，喜欢历史和江景');
    expect(bridge.request.requestedPlaces).toContain('武汉长江大桥');
    expect(bridge.tags).toContainEqual({ type: '必经地点', value: '武汉长江大桥' });
    expect(parseTravelRequest('我想去宜昌看三峡奇景').request.requestedPlaces).toContain('三峡');
  });

  it('只输入具体地点时也能推断目的城市', () => {
    expect(parseTravelRequest('我想去看三峡奇景，两天，喜欢山水').request.destinationCity).toBe('宜昌');
    expect(parseTravelRequest('必须经过武汉长江大桥').request.destinationCity).toBe('武汉');
  });
});

describe('dates, timeline and plan integrity', () => {
  it('计算日期并支持反算天数', () => {
    expect(addDaysIso('2026-07-13', 2)).toBe('2026-07-15');
    expect(daysBetween('2026-07-13', '2026-07-15')).toBe(3);
  });

  it('纯日期按本地年月日构造，不发生 UTC 少一天', () => {
    const date = parseLocalDate('2026-07-14');
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 7, 14]);
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

  it('复制文案随当前城市、天数、预算和兴趣更新', () => {
    const request = { ...defaultTripRequest('武汉'), days: 3, budget: 1200, interests: ['历史文化', '美食'] as const };
    const copy = buildSocialCopy(request as never);
    expect(copy).toContain('武汉3天');
    expect(copy).toContain('1200元');
    expect(copy).toContain('历史文化、美食');
    expect(generateTripPlan(request as never).route.sceneryAnalysis.socialCopy).toBe(copy);
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
