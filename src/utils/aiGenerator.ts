import type { CityName } from '../data/mockData';

export type PlannerInput = {
  city: CityName;
  days: number;
  budget: number;
  interests: string[];
  group: string;
  prompt: string;
};

export type ItineraryItem = {
  time: string;
  place: string;
  reason: string;
};

export type TravelPlan = {
  title: string;
  summary: string;
  days: Array<{ day: string; theme: string; items: ItineraryItem[] }>;
  transport: string[];
  food: string[];
  budget: Array<{ item: string; amount: number; note: string }>;
  photoSpots: string[];
  warnings: string[];
  socialCopy: string;
  videoScript: string[];
};

export type BusinessInput = {
  name: string;
  spots: string;
  target: string;
};

export type BusinessPlan = {
  route: string[];
  welcome: string;
  reminders: string[];
  food: string[];
  videoScript: string[];
  redbook: string;
  replies: string[];
};

const cityAssets: Record<CityName, {
  hero: string;
  places: string[];
  foods: string[];
  photo: string[];
  culture: string;
}> = {
  宜昌: {
    hero: '三峡江景慢旅行',
    places: ['三峡大坝', '屈原故里', '滨江公园', '清江画廊', '西坝不夜城', '三峡人家'],
    foods: ['凉虾', '萝卜饺子', '肥鱼火锅', '三游神仙鸡'],
    photo: ['坛子岭观景台', '长江边落日步道', '西坝夜市灯牌', '清江画廊游船甲板'],
    culture: '长江、三峡工程与楚辞文化',
  },
  武汉: {
    hero: '江城 Citywalk 灵感线',
    places: ['黄鹤楼', '粮道街', '昙华林', '江汉路', '东湖', '黎黄陂路'],
    foods: ['热干面', '豆皮', '糊汤粉', '藕汤', '手冲咖啡'],
    photo: ['黄鹤楼红墙', '长江大桥桥头', '黎黄陂路街角', '东湖凌波门'],
    culture: '长江码头、近代建筑与街巷烟火',
  },
  恩施: {
    hero: '峡谷云海短视频线',
    places: ['恩施大峡谷', '云龙地缝', '土司城', '女儿城', '屏山峡谷', '鹿院坪'],
    foods: ['土家腊肉', '合渣', '炕土豆', '油茶汤'],
    photo: ['七星寨栈道', '云龙地缝瀑布', '屏山峡谷玻璃水', '女儿城夜景'],
    culture: '喀斯特地貌与土家族风情',
  },
  荆州: {
    hero: '楚文化古城沉浸线',
    places: ['荆州古城墙', '荆州博物馆', '张居正故居', '宾阳楼', '关公义园', '沙市洋码头'],
    foods: ['早堂面', '鱼糕', '公安锅盔', '米圆子'],
    photo: ['宾阳楼城门', '护城河倒影', '古城墙转角', '博物馆楚器展厅'],
    culture: '楚文化、三国故事与古城防御体系',
  },
  襄阳: {
    hero: '汉江古城侠气线',
    places: ['襄阳古城', '唐城影视基地', '古隆中', '汉江边', '北街', '习家池'],
    foods: ['襄阳牛肉面', '黄酒', '缠蹄', '豆腐面'],
    photo: ['唐城夜景', '襄阳城墙', '汉江桥畔', '北街巷口'],
    culture: '古城、三国智慧与汉江生活',
  },
  黄石: {
    hero: '矿冶湖山周末线',
    places: ['黄石国家矿山公园', '仙岛湖', '东方山', '磁湖', '华新水泥旧址', '团城山公园'],
    foods: ['黄石港饼', '太子豆腐', '湖鲜', '烧烤'],
    photo: ['矿山公园巨型矿坑', '仙岛湖观景台', '磁湖岸线', '工业遗产红砖墙'],
    culture: '矿冶工业遗产与湖山城市景观',
  },
};

const pick = <T,>(items: T[], index: number) => items[index % items.length];

export function generateTravelPlan(input: PlannerInput): TravelPlan {
  const asset = cityAssets[input.city];
  const keyword = input.interests[0] ?? '轻松旅行';
  const secondary = input.interests[1] ?? asset.culture;
  const promptHint = input.prompt.includes('咖啡') ? '咖啡街区' : input.prompt.includes('短视频') ? '短视频镜头' : keyword;
  const pace = input.budget <= 300 ? '高性价比' : input.budget >= 1000 ? '舒适进阶' : '轻预算';
  const title = `${input.city}${input.days}天 ${pace}${asset.hero}：${keyword} x ${promptHint}`;

  const days = Array.from({ length: input.days }, (_, index) => {
    const base = index * 2;
    const morning = pick(asset.places, base);
    const afternoon = pick(asset.places, base + 1);
    const evening = pick(asset.places, base + 2);
    return {
      day: `Day ${index + 1}`,
      theme: index === 0 ? `${asset.culture}初体验` : `${secondary}深度探索`,
      items: [
        {
          time: '09:00',
          place: morning,
          reason: `作为${input.city}高识别度目的地，适合用作第一站建立城市印象；${input.group}出行强度可控。`,
        },
        {
          time: '12:00',
          place: pick(asset.foods, index),
          reason: `午餐选择本地代表味道，人均预算可压在 ${Math.max(35, Math.round(input.budget / input.days / 6))} 元左右。`,
        },
        {
          time: '14:30',
          place: afternoon,
          reason: `匹配“${keyword}”偏好，下午光线和游览节奏更适合拍摄、讲解与沉浸体验。`,
        },
        {
          time: '18:30',
          place: evening,
          reason: `傍晚安排低压力路线，方便补拍照片、吃夜宵，也能减少跨区交通消耗。`,
        },
      ],
    };
  });

  const lodging = input.days > 1 ? Math.round(input.budget * 0.32) : 0;
  const ticket = Math.round(input.budget * 0.24);
  const food = Math.round(input.budget * 0.28);
  const traffic = Math.max(40, input.budget - lodging - ticket - food);

  return {
    title,
    summary: `系统已识别目的地为${input.city}，核心偏好是${input.interests.join('、') || '轻松游'}，预算为 ${input.budget} 元。方案优先保证路线顺路、内容可拍、消费可控，并自动生成可传播文案。`,
    days,
    transport: [
      `城市内优先采用地铁/公交 + 网约车短驳，减少景点之间的无效折返。`,
      input.budget <= 600 ? '跨区移动建议避开早晚高峰，打车只用于最后 2 公里。' : '可为核心景区预留专车或景区直通车，提升舒适度。',
      `每天最多安排 3 个核心点位，给${input.group}留出拍照、休息和临时探索时间。`,
    ],
    food: asset.foods.map((item, index) => `${item}：建议安排在 ${index < 2 ? '午餐/下午茶' : '晚餐/夜宵'}，兼顾本地特色和出片度。`),
    budget: [
      { item: '交通', amount: traffic, note: '市内公共交通、短途打车与景区接驳' },
      { item: '门票/体验', amount: ticket, note: '核心景点门票、讲解或游船体验' },
      { item: '餐饮', amount: food, note: '本地小吃、正餐与咖啡饮品' },
      { item: '住宿', amount: lodging, note: input.days > 1 ? '经济舒适型民宿或酒店' : '一日游不安排住宿' },
    ],
    photoSpots: asset.photo.map((spot) => `${spot}：适合拍摄${input.interests.includes('拍照') ? '人像与环境同框' : '城市记忆点'}。`),
    warnings: [
      '热门景区请提前查看官方开放时间和预约规则。',
      '不要把行程排满，湖北山水和城市街区都需要留出机动时间。',
      input.budget <= 300 ? '预算较紧时，优先保留交通和正餐，减少临时打卡消费。' : '舒适预算下仍建议提前锁定住宿，避免节假日涨价。',
    ],
    socialCopy: `这次把${input.city}玩成了一个 AI 生成的旅行智能体：${input.days}天、${input.budget}元、${input.interests.join('和') || '随性'}路线，白天看${asset.culture}，晚上把本地美食和街景装进口袋。`,
    videoScript: [
      `镜头 1：用${pick(asset.photo, 0)}做开场，字幕“${input.city}${input.days}天怎么玩”。`,
      `镜头 2：快速切换${asset.places.slice(0, 3).join('、')}，每个点保留 1 秒节奏。`,
      `镜头 3：插入${pick(asset.foods, 0)}特写，旁白强调预算 ${input.budget} 元也能玩得完整。`,
      `镜头 4：结尾回到${pick(asset.photo, 1)}，给出“收藏这条湖北路线”的行动提示。`,
    ],
  };
}

export function generateBusinessPlan(input: BusinessInput): BusinessPlan {
  const target = input.target || '家庭';
  const spots = input.spots
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedSpots = spots.length > 0 ? spots : ['附近核心景区', '本地夜市', '城市公园'];
  const name = input.name || '江畔民宿';

  return {
    route: [
      `09:30 从${name}出发，前往${normalizedSpots[0]}，安排轻讲解和第一组打卡照片。`,
      `12:00 推荐本地餐馆，给${target}客群准备少排队、口味稳定的餐饮选择。`,
      `14:30 前往${normalizedSpots[1] ?? normalizedSpots[0]}，加入咖啡/茶饮/亲子休息点。`,
      `18:00 返回${name}，推送夜宵、洗衣、停车和次日交通提醒。`,
    ],
    welcome: `欢迎入住${name}。我是您的 AI 住客服务助手，已根据${target}客群偏好整理好周边路线、美食、拍照点和避坑提醒，需要一日游方案可以直接告诉我出发时间。`,
    reminders: [
      '入住后请先确认门锁、热水、Wi-Fi 和停车信息。',
      `前往${normalizedSpots[0]}建议提前查看预约与天气，雨天自动切换室内路线。`,
      `${target}客群建议预留午休或咖啡休息时间，避免行程过密。`,
    ],
    food: [
      '早餐：推荐步行 10 分钟内的本地粉面馆，适合快速出发。',
      '午餐：优先选择景区外 1-2 公里餐馆，降低排队和溢价。',
      '夜宵：可推送本地烧烤、小吃街或外卖清单，附营业时间。',
    ],
    videoScript: [
      `开场：镜头从${name}门牌推进到房间窗景，字幕“住进湖北旅行的起点”。`,
      `转场：展示${normalizedSpots.slice(0, 2).join('、')}路线地图，强调“老板已帮你规划好”。`,
      `服务镜头：AI 自动回复入住提醒、周边美食和打车建议。`,
      `结尾：客人回到民宿休息，字幕“下一站，让 AI 帮你少做攻略”。`,
    ],
    redbook: `来湖北旅行，不想临时刷攻略可以住在${name}。我们把${normalizedSpots.join('、')}做成了住客专属一日游，还准备了美食清单、拍照点和避坑提醒，适合${target}轻松出行。`,
    replies: [
      '问：附近怎么玩？答：告诉我您的出发时间和预算，我可以推荐半日/一日路线。',
      '问：适合带老人或孩子吗？答：可以，我会优先推荐少爬坡、可休息、交通近的点位。',
      '问：下雨怎么办？答：系统会切换到博物馆、咖啡馆、室内展馆和本地美食路线。',
    ],
  };
}
