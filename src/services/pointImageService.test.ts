import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPointCover, getCuratedPointCover } from './pointImageService';

afterEach(() => vi.unstubAllGlobals());

describe('pointImageService', () => {
  it('uses distinct landmark covers for the annotated Wuhan route', () => {
    const station = getCuratedPointCover('武汉站');
    const university = getCuratedPointCover('武汉大学');
    const bridge = getCuratedPointCover('武汉长江大桥');

    expect(decodeURIComponent(station?.imageUrl ?? '')).toContain('Wuhan Railway Station');
    expect(decodeURIComponent(university?.imageUrl ?? '')).toContain('Wuhan University');
    expect(decodeURIComponent(bridge?.imageUrl ?? '')).toContain('Wuhan Yangtze Bridge');
    expect(new Set([station?.imageUrl, university?.imageUrl, bridge?.imageUrl]).size).toBe(3);
  });

  it('loads a Wikimedia Commons cover for an unmapped route point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: { 1: { title: 'File:East Lake.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/east-lake.jpg', extmetadata: { Artist: { value: 'Example' }, LicenseShortName: { value: 'CC BY 4.0' } } }] } } } }), { status: 200 })));

    const cover = await fetchPointCover('武汉', '东湖');
    expect(cover).toMatchObject({ imageUrl: 'https://upload.wikimedia.org/east-lake.jpg', imageCredit: { author: 'Example', license: 'CC BY 4.0' } });
  });
});
