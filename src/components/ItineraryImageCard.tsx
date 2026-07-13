import { Download, Image as ImageIcon, Maximize2 } from 'lucide-react';
import { useMemo } from 'react';
import type { TravelPlan } from '../utils/aiGenerator';
import type { SmartRoute } from '../types/route';

type ItineraryImageCardProps = {
  plan: TravelPlan;
  route: SmartRoute;
};

export function ItineraryImageCard({ plan, route }: ItineraryImageCardProps) {
  const svg = useMemo(() => buildItinerarySvg(plan, route), [plan, route]);
  const imageSrc = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);

  const downloadImage = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${route.city}-AI行程图片.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openImage = () => {
    const win = window.open();
    if (!win) return;
    win.document.write(`<title>${route.city} AI 行程图片</title><img src="${imageSrc}" style="width:100%;height:auto;display:block;background:#eef5f1" />`);
    win.document.close();
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-ink/10 bg-[#fffdf7] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-river/10 px-3 py-1 text-xs font-black tracking-[0.16em] text-river">
            <ImageIcon className="h-4 w-4" />
            AI ITINERARY IMAGE
          </div>
          <h3 className="mt-2 font-display text-2xl font-black text-ink">行程图片卡</h3>
          <p className="mt-1 text-sm text-ink/55">把规则引擎生成的日程、地图路线和沿途记录点整理成一张适合路演展示/朋友圈分享的图片。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openImage}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-ink shadow-sm ring-1 ring-ink/10 transition hover:bg-ink hover:text-white active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
            打开大图
          </button>
          <button
            onClick={downloadImage}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-river active:scale-95"
          >
            <Download className="h-4 w-4" />
            下载 SVG 图片
          </button>
        </div>
      </div>
      <div className="bg-[#edf6f2] p-3 md:p-5">
        <img
          src={imageSrc}
          alt={`${route.city} AI 行程图片卡`}
          className="mx-auto block w-full max-w-6xl rounded-[1.25rem] bg-white shadow-xl ring-1 ring-ink/10"
        />
      </div>
    </section>
  );
}

function buildItinerarySvg(plan: TravelPlan, route: SmartRoute) {
  const width = 1440;
  const height = 900;
  const stops = route.points.slice(0, 6);
  const dayItems = plan.days.flatMap((day) => day.items.map((item) => ({ ...item, day: day.day }))).slice(0, 6);
  const totalBudget = plan.budget.reduce((sum, item) => sum + item.amount, 0);
  const routePath = [
    [815, 650],
    [900, 545],
    [980, 500],
    [1068, 410],
    [1160, 360],
    [1265, 258],
  ];
  const path = routePath.slice(0, stops.length).map(([x, y]) => `${x},${y}`).join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fbf8"/>
      <stop offset="45%" stop-color="#eef7f3"/>
      <stop offset="100%" stop-color="#f7efe0"/>
    </linearGradient>
    <linearGradient id="river" x1="0" x2="1">
      <stop offset="0%" stop-color="#75d7e8"/>
      <stop offset="100%" stop-color="#1b70a6"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#102a43" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="96" height="${height}" fill="#102a43"/>
  <text x="48" y="78" text-anchor="middle" fill="#fff" font-size="26" font-weight="900" font-family="Arial, sans-serif">楚</text>
  ${sidebarItem(48, 178, 'AI')}
  ${sidebarItem(48, 265, '概览')}
  ${sidebarItem(48, 352, '路线')}
  ${sidebarItem(48, 439, '记录')}

  <rect x="96" y="0" width="594" height="${height}" fill="#fff" filter="url(#shadow)"/>
  <text x="138" y="80" fill="#102a43" font-size="28" font-weight="900" font-family="Arial, sans-serif">楚游智导 AI</text>
  <text x="138" y="113" fill="#6b7a88" font-size="16" font-weight="700" font-family="Arial, sans-serif">一句话生成你的湖北旅行智能体</text>
  <rect x="510" y="58" rx="22" ry="22" width="136" height="44" fill="#102a43"/>
  <text x="578" y="86" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="Arial, sans-serif">图片行程</text>

  <text x="138" y="176" fill="#102a43" font-size="40" font-weight="900" font-family="Arial, sans-serif">${esc(route.city)} AI 行程</text>
  <text x="138" y="216" fill="#1b70a6" font-size="18" font-weight="800" font-family="Arial, sans-serif">${esc(trim(plan.title, 28))}</text>
  ${metric(138, 250, `${route.totalDistanceKm}km`, '路线距离')}
  ${metric(292, 250, route.recommendedStartTime, '建议出发')}
  ${metric(446, 250, `¥${totalBudget}`, '预计预算')}

  <text x="138" y="356" fill="#102a43" font-size="28" font-weight="900" font-family="Arial, sans-serif">行程</text>
  ${dayItems.map((item, index) => itineraryRow(138, 386 + index * 72, index + 1, item.time, item.place, item.reason)).join('')}

  <rect x="138" y="828" width="510" height="40" rx="20" fill="#edf6f2"/>
  <text x="160" y="854" fill="#496270" font-size="16" font-weight="800" font-family="Arial, sans-serif">${esc(trim(route.sceneryAnalysis.socialCopy, 42))}</text>

  <rect x="690" y="0" width="750" height="${height}" fill="#d9f3ee"/>
  <path d="M690 150 C820 210 860 120 985 170 C1120 226 1180 125 1440 170 L1440 0 L690 0 Z" fill="#8fe0d5" opacity="0.85"/>
  <path d="M690 710 C800 650 890 760 1010 680 C1160 580 1260 660 1440 600 L1440 900 L690 900 Z" fill="#b9e7c5" opacity="0.9"/>
  <path d="M700 565 C835 480 935 545 1045 445 C1160 340 1275 375 1426 265" fill="none" stroke="url(#river)" stroke-width="76" stroke-linecap="round" opacity="0.38"/>
  <path d="M740 735 C875 600 970 590 1088 505 C1218 412 1288 345 1405 225" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" opacity="0.9"/>
  <polyline points="${path}" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="${path}" fill="none" stroke="#0e6b72" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12"/>
  ${stops.map((stop, index) => marker(routePath[index][0], routePath[index][1], index + 1, stop.name, colorFor(stop.type))).join('')}

  <rect x="735" y="54" width="352" height="118" rx="28" fill="#ffffff" opacity="0.94" filter="url(#shadow)"/>
  <text x="763" y="95" fill="#1b70a6" font-size="15" font-weight="900" font-family="Arial, sans-serif">AI ROUTE MAP</text>
  <text x="763" y="129" fill="#102a43" font-size="26" font-weight="900" font-family="Arial, sans-serif">${esc(trim(route.title, 18))}</text>
  <text x="763" y="154" fill="#607381" font-size="15" font-weight="700" font-family="Arial, sans-serif">${esc(trim(route.transportSuggestion, 30))}</text>

  <rect x="1085" y="672" width="296" height="160" rx="28" fill="#102a43" opacity="0.94" filter="url(#shadow)"/>
  <text x="1115" y="714" fill="#24a46f" font-size="15" font-weight="900" font-family="Arial, sans-serif">沿途 AI 观察</text>
  ${wrap(route.sceneryAnalysis.highlights[0] ?? route.sceneryAnalysis.socialCopy, 22).slice(0, 3).map((line, index) => `<text x="1115" y="${750 + index * 28}" fill="#fff" font-size="18" font-weight="800" font-family="Arial, sans-serif">${esc(line)}</text>`).join('')}
  <text x="1115" y="818" fill="#b8c8d2" font-size="14" font-weight="700" font-family="Arial, sans-serif">规则引擎演示内容仅供旅行参考</text>
</svg>`;
}

function sidebarItem(x: number, y: number, label: string) {
  return `<rect x="15" y="${y - 25}" width="66" height="50" rx="18" fill="${label === 'AI' ? '#1b70a6' : '#ffffff'}" opacity="${label === 'AI' ? '1' : '0.08'}"/><text x="${x}" y="${y + 6}" text-anchor="middle" fill="#fff" font-size="15" font-weight="900" font-family="Arial, sans-serif">${esc(label)}</text>`;
}

function metric(x: number, y: number, value: string, label: string) {
  return `<rect x="${x}" y="${y}" width="132" height="74" rx="22" fill="#edf6f2"/><text x="${x + 20}" y="${y + 33}" fill="#102a43" font-size="22" font-weight="900" font-family="Arial, sans-serif">${esc(value)}</text><text x="${x + 20}" y="${y + 56}" fill="#687a86" font-size="13" font-weight="700" font-family="Arial, sans-serif">${esc(label)}</text>`;
}

function itineraryRow(x: number, y: number, index: number, time: string, place: string, reason: string) {
  const reasonLines = wrap(reason, 30).slice(0, 2);
  return `<circle cx="${x + 16}" cy="${y + 14}" r="16" fill="#1b70a6"/><text x="${x + 16}" y="${y + 20}" text-anchor="middle" fill="#fff" font-size="14" font-weight="900" font-family="Arial, sans-serif">${index}</text><text x="${x + 46}" y="${y + 2}" fill="#d65a31" font-size="15" font-weight="900" font-family="Arial, sans-serif">${esc(time)}</text><text x="${x + 46}" y="${y + 27}" fill="#102a43" font-size="21" font-weight="900" font-family="Arial, sans-serif">${esc(trim(place, 15))}</text>${reasonLines.map((line, i) => `<text x="${x + 46}" y="${y + 51 + i * 20}" fill="#687a86" font-size="14" font-weight="700" font-family="Arial, sans-serif">${esc(line)}</text>`).join('')}`;
}

function marker(x: number, y: number, index: number, name: string, color: string) {
  return `<circle cx="${x}" cy="${y}" r="22" fill="#fff" opacity="0.95"/><circle cx="${x}" cy="${y}" r="16" fill="${color}"/><text x="${x}" y="${y + 6}" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="Arial, sans-serif">${index}</text><rect x="${x - 54}" y="${y + 28}" width="108" height="30" rx="15" fill="#fff" opacity="0.92"/><text x="${x}" y="${y + 49}" text-anchor="middle" fill="#102a43" font-size="14" font-weight="900" font-family="Arial, sans-serif">${esc(trim(name, 7))}</text>`;
}

function colorFor(type: string) {
  if (type === 'start') return '#24a46f';
  if (type === 'food') return '#d65a31';
  if (type === 'photo') return '#db4f92';
  if (type === 'end') return '#7c3aed';
  if (type === 'rest') return '#64748b';
  return '#1b70a6';
}

function wrap(text: string, max: number) {
  const chars = Array.from(text);
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += max) {
    lines.push(chars.slice(i, i + max).join(''));
  }
  return lines;
}

function trim(text: string, max: number) {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

function esc(text: string | number) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
