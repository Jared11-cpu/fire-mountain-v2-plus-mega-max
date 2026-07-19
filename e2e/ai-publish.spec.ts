import { expect, test } from '@playwright/test';

test('publishes only the final AI and AMap plan', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/ai/parse-request')) return route.fulfill({ json: { data: { city: '武汉', startDate: null, days: 2, people: null, budgetPerPerson: 600, interests: ['历史文化'], dietaryNeeds: [], mobility: null, transportPreference: null, hotelPreference: null, departureDeadline: null, requestedPlaces: ['武汉长江大桥'], avoidPlaces: [], travelStyle: null } } });
    if (url.includes('/api/attractions/search')) return route.fulfill({ json: { items: [{ id: 'bridge', name: '武汉长江大桥', district: '武昌区', address: '长江之上', location: { lng: 114.288, lat: 30.55 }, photos: ['https://example.com/bridge.jpg'] }] } });
    if (url.includes('/api/ai/recommend')) return route.fulfill({ json: { data: { ranked: [{ id: 'bridge', reason: '用户明确要求', fitScore: 100 }] } } });
    if (url.includes('/api/restaurants/guide')) return route.fulfill({ json: { generatedAt: '2026-07-19T10:00:00.000Z', recommendations: [
      { id: 'food-1', name: '东湖家宴', district: '武昌区', address: '东湖路1号', averageCost: 62, rating: 4.6, category: '餐饮服务;中餐厅', recommendationReason: '靠近东湖，适合午餐', nearestRoutePoint: { name: '武汉长江大桥' }, routeDistanceMeters: 320, location: { lng: 114.30, lat: 30.55 } },
      { id: 'food-2', name: '江畔小馆', district: '武昌区', address: '临江大道', averageCost: 48, rating: 4.5, category: '餐饮服务;湖北菜', recommendationReason: '顺路且预算合适', nearestRoutePoint: { name: '武汉长江大桥' }, routeDistanceMeters: 510, location: { lng: 114.29, lat: 30.55 } },
      { id: 'food-3', name: '桥头热干面', district: '武昌区', address: '解放路', averageCost: 18, rating: 4.4, category: '餐饮服务;小吃快餐', recommendationReason: '适合早餐补给', nearestRoutePoint: { name: '武汉长江大桥' }, routeDistanceMeters: 680, location: { lng: 114.28, lat: 30.55 } },
      { id: 'food-4', name: '楚味藕汤馆', district: '武昌区', address: '彭刘杨路', averageCost: 76, rating: 4.7, category: '餐饮服务;湖北菜', recommendationReason: '本地菜选择', nearestRoutePoint: { name: '武汉长江大桥' }, routeDistanceMeters: 890, location: { lng: 114.27, lat: 30.55 } },
    ] } });
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

  await page.getByRole('tab', { name: '交通' }).click();
  await page.getByRole('radio', { name: '公交 / 地铁交通方式' }).click();
  await expect(page.getByText('规则引擎交通方案')).toHaveCount(0);
  const preferenceGroup = page.getByRole('radiogroup', { name: '公共交通路线偏好' });
  await expect(preferenceGroup).toBeVisible();
  for (const label of ['推荐', '时间短', '最省钱', '少换乘', '少步行', '地铁优先']) {
    const preference = preferenceGroup.getByRole('radio', { name: label });
    await expect(preference).toBeVisible();
    const dimensions = await preference.evaluate((element) => ({ height: element.getBoundingClientRect().height, fontSize: Number.parseFloat(getComputedStyle(element).fontSize) }));
    expect(dimensions.height).toBeGreaterThanOrEqual(44);
    expect(dimensions.fontSize).toBeGreaterThanOrEqual(13);
  }

  await page.getByRole('tab', { name: '美食' }).click();
  await expect(page.getByRole('region', { name: '路线餐饮 KPI' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '东湖家宴' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '楚味藕汤馆' })).toBeVisible();
  await expect(page.getByText('蔡林记（吉庆街店）')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '在大众点评查找东湖家宴' })).toHaveAttribute('href', /dianping\.com\/search\/keyword\/16\/0_/);
});
