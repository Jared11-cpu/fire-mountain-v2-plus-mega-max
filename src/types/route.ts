import type { CityName } from '../data/mockData';

export type RoutePointType = 'start' | 'scenic' | 'food' | 'photo' | 'rest' | 'hotel' | 'end';

export type RoutePoint = {
  id: string;
  name: string;
  type: RoutePointType;
  city: CityName;
  lat: number;
  lng: number;
  roadAccessLat?: number;
  roadAccessLng?: number;
  coordinateSystem?: 'wgs84' | 'gcj02';
  time: string;
  stayMinutes: number;
  reason: string;
  photoTip: string;
  recordTip: string;
  day?: number;
  openingHours?: string;
  estimatedCost?: number;
  transportMode?: 'walk' | 'drive' | 'transit';
  imageUrl?: string;
  imageCredit?: { author: string; license: string; sourceUrl: string };
};

export type JournalEntry = {
  id: string;
  pointId: string;
  pointName: string;
  city: CityName;
  day: number;
  note: string;
  visitedAt: string;
  lat?: number;
  lng?: number;
  photoIds: string[];
};

export type SceneryAnalysis = {
  highlights: string[];
  bestPhotoTimes: string[];
  videoShots: string[];
  socialCopy: string;
  crowdTips: Record<string, string>;
};

export type SmartRoute = {
  id: string;
  title: string;
  city: CityName;
  startPoint: RoutePoint;
  points: RoutePoint[];
  totalDistanceKm: number;
  estimatedTime: string;
  transportSuggestion: string;
  recommendedStartTime: string;
  avoidTips: string[];
  sceneryAnalysis: SceneryAnalysis;
};

export type LocationStatus = 'idle' | 'locating' | 'success' | 'denied' | 'unsupported' | 'mock';

export type UserLocation = {
  city: CityName;
  name: string;
  lat: number;
  lng: number;
  status: LocationStatus;
  message: string;
};
