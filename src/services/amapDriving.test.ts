import { describe, expect, it } from 'vitest';
import { classifyDrivingFailure, convertGpsPoint, extractDrivingPath, loadAmapJsApi, planAmapDrivingRoute, resetAmapJsApiLoader, splitDrivingPoints } from './amapDriving';

describe('AMap Driving helpers', () => {
  it('splits routes beyond the 16-waypoint limit while sharing segment endpoints', () => {
    const points = Array.from({ length: 40 }, (_, index) => [index, index] as [number, number]);
    const segments = splitDrivingPoints(points);
    expect(segments.map((segment) => segment.length)).toEqual([18, 18, 6]);
    expect(segments[0][segments[0].length - 1]).toEqual(segments[1][0]);
    expect(segments[1][segments[1].length - 1]).toEqual(segments[2][0]);
  });

  it('extracts the actual road geometry from route steps', () => {
    const path = extractDrivingPath({ steps: [{ path: [{ lng: 111, lat: 30 }, { lng: 111.1, lat: 30.1 }] }, { path: [[111.1, 30.1], [111.2, 30.2]] }] });
    expect(path).toEqual([[111, 30], [111.1, 30.1], [111.2, 30.2]]);
  });

  it('distinguishes authentication, network and empty-result failures', () => {
    expect(classifyDrivingFailure({ status: 'error', result: { info: 'INVALID_USER_KEY' } })).toBe('auth-error');
    expect(classifyDrivingFailure({ status: 'error', result: 'INVALID_USER_DOMAIN' })).toBe('auth-error');
    expect(classifyDrivingFailure({ status: 'error', error: new Error('network timeout') })).toBe('network-error');
    expect(classifyDrivingFailure({ status: 'no_data' })).toBe('no-data');
  });

  it('uses start, end and waypoints, then returns Driving distance and time', async () => {
    const searches: Array<{ start: [number, number]; end: [number, number]; waypoints: Array<[number, number]> }> = [];
    class Driving {
      search(start: [number, number], end: [number, number], options: { waypoints: Array<[number, number]> }, callback: (status: string, result: any) => void) {
        searches.push({ start, end, waypoints: options.waypoints });
        callback('complete', { routes: [{ distance: 12000, time: 1800, steps: [{ path: [start, ...options.waypoints, end] }] }] });
      }
    }
    const points = Array.from({ length: 20 }, (_, index) => ({ id: String(index), lng: index, lat: index, name: String(index) })) as any;
    const result = await planAmapDrivingRoute({ Driving, DrivingPolicy: { LEAST_TIME: 0 } }, points);
    expect(searches).toHaveLength(2);
    expect(searches[0].waypoints).toHaveLength(16);
    expect(searches[1].start).toEqual(searches[0].end);
    expect(result.distanceMeters).toBe(24000);
    expect(result.durationSeconds).toBe(3600);
  });

  it('uses road-access coordinates for Driving while preserving marker coordinates', async () => {
    let searchedStart: [number, number] | undefined;
    class Driving { search(start: [number, number], end: [number, number], _options: unknown, callback: (status: string, result: any) => void) { searchedStart = start; callback('complete', { routes: [{ distance: 1, time: 1, steps: [{ path: [start, end] }] }] }); } }
    const points = [{ id: 'a', lng: 114, lat: 30, roadAccessLng: 114.1, roadAccessLat: 30.1 }, { id: 'b', lng: 115, lat: 31 }] as any;
    await planAmapDrivingRoute({ Driving, DrivingPolicy: {} }, points);
    expect(searchedStart).toEqual([114.1, 30.1]);
    expect(points[0].lng).toBe(114);
  });

  it('does not insert the AMap script when the security code is missing', async () => {
    resetAmapJsApiLoader(); delete window.AMap; delete window._AMapSecurityConfig;
    await expect(loadAmapJsApi('web-js-key', '')).rejects.toMatchObject({ status: 'auth-error' });
    expect(document.querySelector('script[data-amap-js-api="2"]')).toBeNull();
  });

  it('converts a browser GPS point from WGS-84 before planning', async () => {
    const point = { id: 'gps', lng: 114, lat: 30, coordinateSystem: 'wgs84' } as any;
    const converted = await convertGpsPoint({ convertFrom: (_position: unknown, source: string, callback: Function) => callback('complete', { locations: [{ lng: 114.006, lat: 30.006 }] }) }, point);
    expect(converted).toMatchObject({ lng: 114.006, lat: 30.006, coordinateSystem: 'gcj02' });
  });
});
