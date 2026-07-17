import type { RoutePoint } from '../types/route';

export type PointCover = Pick<RoutePoint, 'imageUrl' | 'imageCredit'> & { imageUrl: string; imageCredit: NonNullable<RoutePoint['imageCredit']> };

function commonsCover(fileName: string, author = 'Wikimedia Commons', license = '许可见来源页'): PointCover {
  const fileTitle = fileName.replace(/ /g, '_');
  return {
    imageUrl: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}?width=1280`,
    imageCredit: {
      author,
      license,
      sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileTitle)}`,
    },
  };
}

const CURATED_COVERS: ReadonlyArray<{ matches: (name: string) => boolean; cover: PointCover }> = [
  { matches: (name) => /武汉站|武汉火车站/.test(name), cover: commonsCover('20240621 West facade of Wuhan Railway Station.jpg') },
  { matches: (name) => /武汉大学|珞珈山/.test(name), cover: commonsCover('Wuhan University Administration Building.jpg', 'Howchou', 'CC BY 4.0') },
  { matches: (name) => /武汉长江大桥|长江大桥/.test(name), cover: commonsCover('20240621 First Wuhan Yangtze Bridge 04.jpg', 'Windmemories', 'CC BY-SA 4.0') },
  { matches: (name) => /武汉古建筑|江汉关/.test(name), cover: commonsCover('20230208 Hankow Customs House.jpg') },
  { matches: (name) => /黄鹤楼/.test(name), cover: commonsCover('CN - Hubei - Wuhan - Kranichpagode.jpg') },
  { matches: (name) => /昙华林/.test(name), cover: commonsCover('Tanhualin.JPG') },
];

export function getCuratedPointCover(name: string) {
  return CURATED_COVERS.find((item) => item.matches(name.trim()))?.cover;
}

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    url?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

export async function fetchPointCover(city: string, pointName: string, signal?: AbortSignal): Promise<PointCover | undefined> {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: '5',
    gsrsearch: `${city} ${pointName}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1280',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal });
  if (!response.ok) return undefined;
  const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
  const page = Object.values(payload.query?.pages ?? {}).find((item) => item.imageinfo?.[0]?.thumburl || item.imageinfo?.[0]?.url);
  const info = page?.imageinfo?.[0];
  if (!page?.title || !info) return undefined;
  const metadata = info.extmetadata ?? {};
  const clean = (value?: string) => value?.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  return {
    imageUrl: info.thumburl ?? info.url ?? '',
    imageCredit: {
      author: clean(metadata.Artist?.value) || 'Wikimedia Commons',
      license: clean(metadata.LicenseShortName?.value) || '许可见来源页',
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    },
  };
}
