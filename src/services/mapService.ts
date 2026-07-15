import type { PlannerInput } from '../utils/aiGenerator';
import { baseRoutes, mockStartPoints } from '../data/routeData';
import type { RoutePoint, SmartRoute, UserLocation } from '../types/route';

export function generateSmartRoute(input: PlannerInput, location?: UserLocation): SmartRoute {
  const base = baseRoutes[input.city];
  const startPoint = locationToRoutePoint(location, input) ?? mockStartPoints[input.city];
  const promptTag = input.prompt.includes('短视频') ? '短视频记录' : input.prompt.includes('咖啡') ? '咖啡街区' : input.interests[0] ?? '旅行';

  return {
    ...base,
    id: `${base.id}-${input.days}-${input.budget}-${input.interests.join('-')}`,
    title: `${base.title}｜${promptTag} ${input.budget}元版`,
    startPoint,
    points: [startPoint, ...base.points],
    totalDistanceKm: Number((base.totalDistanceKm + (startPoint.type === 'start' ? 0 : 2.4)).toFixed(1)),
    transportSuggestion: `${base.transportSuggestion} 系统已按${input.group}出行和“${input.interests.join('、') || '轻松游'}”偏好调整停留节奏。`,
  };
}

export function getPointTypeLabel(type: RoutePoint['type']) {
  const labels: Record<RoutePoint['type'], string> = {
    start: '起点',
    scenic: '景点',
    food: '美食',
    photo: '拍照',
    rest: '休息',
    hotel: '住宿',
    end: '终点',
  };
  return labels[type];
}

function locationToRoutePoint(location: UserLocation | undefined, input: PlannerInput): RoutePoint | undefined {
  if (!location) return undefined;
  return {
    id: `user-location-${location.name}`,
    name: location.name,
    type: 'start',
    city: input.city,
    lat: location.lat,
    lng: location.lng,
    coordinateSystem: location.status === 'success' ? 'wgs84' : 'gcj02',
    time: '08:30',
    stayMinutes: 10,
    reason: location.status === 'success' ? '浏览器定位获取的真实出发点，后续可接入高德路径规划。' : '手动选择的 Mock 出发点，用于演示路线生成。',
    photoTip: '拍一张出发地照片，作为路线记录视频开场。',
    recordTip: '记录出发前的预算、偏好和当天关键词。',
  };
}
