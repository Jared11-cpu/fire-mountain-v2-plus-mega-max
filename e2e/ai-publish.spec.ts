import { expect, test } from '@playwright/test';

test('publishes only the final AI and AMap plan', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/ai/parse-request')) return route.fulfill({ json: { data: { city: '武汉', startDate: null, days: 2, people: null, budgetPerPerson: 600, interests: ['历史文化'], dietaryNeeds: [], mobility: null, transportPreference: null, hotelPreference: null, departureDeadline: null, requestedPlaces: ['武汉长江大桥'], avoidPlaces: [], travelStyle: null } } });
    if (url.includes('/api/attractions/search')) return route.fulfill({ json: { items: [{ id: 'bridge', name: '武汉长江大桥', district: '武昌区', address: '长江之上', location: { lng: 114.288, lat: 30.55 }, photos: ['https://example.com/bridge.jpg'] }] } });
    if (url.includes('/api/ai/recommend')) return route.fulfill({ json: { data: { ranked: [{ id: 'bridge', reason: '用户明确要求', fitScore: 100 }] } } });
    if (url.includes('/api/restaurants/guide')) return route.fulfill({ json: { generatedAt: '2026-07-19T10:00:00.000Z', recommendations: [] } });
    if (url.includes('/api/ai/analyze')) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return route.fulfill({ json: { data: { analysis: '最终千问分析：路线包含用户指定的武汉长江大桥。' } } });
    }
    if (url.includes('/api/route/plan')) return route.fulfill({ json: { paths: [{ durationMinutes: 12, distanceKm: 2.5, polyline: [[114.30, 30.54], [114.288, 30.55]], steps: [] }] } });
    return route.fulfill({ status: 503, json: { error: 'verification fallback' } });
  });

  await page.goto('/#/planner');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('用一句话描述旅行需求').fill('武汉两天，必须去武汉长江大桥');
  await page.getByRole('button', { name: 'AI 个性化生成方案' }).click();

  await expect(page.getByRole('heading', { name: '正在生成最终个性化方案' })).toBeVisible();
  await expect(page.getByRole('region', { name: '路线地图' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '路线地图' })).toBeVisible();
  await expect(page.getByText('最终千问分析：路线包含用户指定的武汉长江大桥。')).toBeVisible();

  await page.getByRole('tab', { name: '路线' }).click();
  await expect(page.getByText('自动保存')).toHaveCount(0);
  const transportMinutes = page.getByLabel('下一段交通分钟').first();
  await transportMinutes.fill('30');
  await transportMinutes.press('Enter');
  await expect(transportMinutes).toHaveValue('30');
  const timetableLink = page.getByRole('link', { name: '武汉站12306到发车次与到达时间' });
  await expect(timetableLink).toHaveText('12306 · 武汉站到发车次');
  await expect(timetableLink).toHaveAttribute('href', /station_code=WHN.*station_name=/);
  await expect(page.getByRole('link', { name: '武汉站高德地图位置' })).toHaveAttribute('href', /uri\.amap\.com\/marker/);
  await expect(page.getByRole('link', { name: '武汉站小红书相关游玩攻略' })).toHaveAttribute('href', /xiaohongshu\.com\/search_result/);
  await expect(page.getByText('铁路站点详情')).toHaveCount(0);
  await expect(page.getByText('站点介绍')).toHaveCount(0);
});
