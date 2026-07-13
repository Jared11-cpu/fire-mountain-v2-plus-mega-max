import { expect, test } from '@playwright/test';

test('HashRouter direct refresh and browser history', async ({ page }) => {
  await page.goto('/#/planner');
  await expect(page.getByRole('heading', { name: '懂你，也懂湖北' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('开始日期')).toBeVisible();
  await page.getByRole('button', { name: '旅行手账' }).click();
  await expect(page).toHaveURL(/#\/journal$/);
  await expect(page.getByText('0 条真实记录')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/planner$/);
  await page.goto('/#/about');
  await page.reload();
  await expect(page.getByRole('heading', { name: '系统架构图' })).toBeVisible();
});

test('natural language acceptance case stays synchronized', async ({ page }) => {
  await page.goto('/#/planner');
  const prompt = page.getByLabel('用一句话描述旅行需求');
  await prompt.fill('恩施三天两夜，预算1000元，喜欢峡谷和拍照，不吃辣');
  await page.getByRole('button', { name: '识别条件' }).click();
  await expect(page.getByText('城市：恩施')).toBeVisible();
  await expect(page.getByText('天数：3天')).toBeVisible();
  await expect(page.getByText('预算：1000元')).toBeVisible();
  await expect(page.getByText('兴趣：自然风光')).toBeVisible();
  await expect(page.getByText('饮食限制：不吃辣')).toBeVisible();
  await expect(page.getByLabel('天数')).toHaveValue('3');
  await expect(page.getByLabel('预算（元）')).toHaveValue('1000');
});

test('edits survive detail tab switches and refresh', async ({ page }) => {
  await page.goto('/#/planner');
  await page.getByRole('button', { name: '规则引擎生成演示' }).click();
  await page.getByRole('button', { name: '行程记录' }).click();
  const note = page.getByLabel('当日备注').first();
  await note.fill('切换标签后必须保留');
  await page.getByRole('button', { name: '天气' }).click();
  await page.getByRole('button', { name: '行程记录' }).click();
  await expect(page.getByLabel('当日备注').first()).toHaveValue('切换标签后必须保留');
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole('button', { name: '行程记录' }).click();
  await expect(page.getByLabel('当日备注').first()).toHaveValue('切换标签后必须保留');
});

test('overview metrics are directly editable and persist', async ({ page }) => {
  await page.goto('/#/planner');
  await page.getByRole('button', { name: '规则引擎生成演示' }).click();
  await expect(page.getByText('当前为规则引擎生成演示', { exact: false })).toHaveCount(0);
  await expect(page.getByText('RULES-BASED TRAVEL PLANNER', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已根据当前确认参数生成规则路线。', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '分享' })).toHaveCount(0);

  await page.getByLabel('总览点位').fill('4');
  await page.getByLabel('总览点位').press('Enter');
  await page.getByLabel('总览预计时长').fill('6.5');
  await page.getByLabel('总览预计时长').press('Enter');
  await page.getByLabel('总览预算总计').fill('750');
  await page.getByLabel('总览预算总计').press('Enter');
  await page.getByLabel('总览出发日期').fill('2026-08-01');
  await page.waitForTimeout(500);

  await page.reload();
  await expect(page.getByLabel('总览点位')).toHaveValue('4');
  await expect(page.getByLabel('总览预计时长')).toHaveValue('6.5');
  await expect(page.getByLabel('总览预算总计')).toHaveValue('750');
  await expect(page.getByLabel('总览出发日期')).toHaveValue('2026-08-01');
});

