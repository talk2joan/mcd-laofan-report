const DEMO_ORDERS = [
  { createTime: "2026-01-08T18:42:00+08:00", orderType: "pickup", realTotalAmount: 42, items: ["麦辣鸡腿堡", "薯条", "可乐"] },
  { createTime: "2026-01-19T19:16:00+08:00", orderType: "delivery", realTotalAmount: 58, items: ["巨无霸", "麦辣鸡翅", "可乐"] },
  { createTime: "2026-02-03T20:31:00+08:00", orderType: "pickup", realTotalAmount: 36, items: ["麦香鸡", "薯条"] },
  { createTime: "2026-02-17T18:58:00+08:00", orderType: "delivery", realTotalAmount: 64, items: ["麦辣鸡腿堡", "麦旋风", "薯条"] },
  { createTime: "2026-03-11T21:04:00+08:00", orderType: "pickup", realTotalAmount: 47, items: ["麦辣鸡腿堡", "薯条", "咖啡"] },
  { createTime: "2026-04-09T18:22:00+08:00", orderType: "pickup", realTotalAmount: 39, items: ["麦辣鸡腿堡", "可乐"] },
  { createTime: "2026-05-27T19:45:00+08:00", orderType: "delivery", realTotalAmount: 71, items: ["巨无霸", "薯条", "麦旋风"] },
  { createTime: "2026-06-18T18:37:00+08:00", orderType: "pickup", realTotalAmount: 43, items: ["麦辣鸡腿堡", "薯条"] },
  { createTime: "2026-07-06T20:12:00+08:00", orderType: "pickup", realTotalAmount: 52, items: ["麦辣鸡腿堡", "麦香鸡", "可乐"] },
  { createTime: "2026-08-14T18:51:00+08:00", orderType: "delivery", realTotalAmount: 62, items: ["麦辣鸡腿堡", "薯条", "咖啡"] },
  { createTime: "2026-09-22T19:07:00+08:00", orderType: "pickup", realTotalAmount: 45, items: ["麦辣鸡腿堡", "薯条"] },
  { createTime: "2026-10-12T18:28:00+08:00", orderType: "pickup", realTotalAmount: 49, items: ["麦辣鸡腿堡", "麦旋风"] }
];

const PERSONAS = {
  banma: { name: "班马", type: "麦门打卡型", title: "一个人，活成了一个班。", subtitle: "白天上班，晚上上麦。", stats: ["工作日下单占比 68%", "全年共下单 88 单", "最常出现时间：工作日 18:00 后"], image: "assets/persona-banma.jpg" },
  midnight: { name: "深夜黑马", type: "续命型", title: "别人结束一天，你开始给自己加餐。", subtitle: "夜色越深，麦门信号越强。", stats: ["22:00 后下单 18 单", "最晚一单：凌晨 01:23 AM", "全年共下单 36 单"], image: "assets/persona-midnight.jpg" },
  dessert: { name: "甜筒治愈派", type: "情绪补给型", title: "今天的情绪，先交给一支甜筒。", subtitle: "甜不是答案，但很有效。", stats: ["甜品订单占比 42%", "最爱单品：麦旋风", "全年共下单 31 单"], image: "assets/persona-dessert.jpg" },
  rush: { name: "卡急马", type: "下班冲刺型", title: "下班铃一响，麦门准时开场。", subtitle: "把晚餐安排得比人生更快。", stats: ["18:00—20:00 下单 27 单", "平均下单间隔 9 天", "全年共下单 44 单"], image: "assets/persona-rush.jpg" },
  classic: { name: "麦门痴心人", type: "经典守护型", title: "本命不需要解释，经典自有回响。", subtitle: "每次都点它，是一种坚定。", stats: ["本命单品：麦辣鸡腿堡", "本命出现 46 次", "全年共下单 73 单"], image: "assets/persona-classic.jpg" },
  explorer: { name: "麦门探险家", type: "尝鲜型", title: "新品上架，就是你的出发信号。", subtitle: "菜单是地图，你负责探索。", stats: ["尝试单品 29 种", "新品尝鲜 16 次", "全年共下单 54 单"], image: "assets/persona-explorer.jpg" },
  delivery: { name: "麦乐送常驻民", type: "到家型", title: "不出门，也能准时抵达麦门。", subtitle: "你的麦门地址，熟得像老朋友。", stats: ["外送订单占比 79%", "最常配送至同一地址", "全年共下单 62 单"], image: "assets/persona-delivery.jpg" },
  spotlight: { name: "麦门显眼包", type: "高光型", title: "每一单都值得登上今日高光。", subtitle: "不是爱晒，是数据确实很有戏。", stats: ["单笔最高 ¥128", "分享过 6 次年度报告", "全年共下单 91 单"], image: "assets/persona-spotlight.jpg" }
};

function normalizeOrders(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((o) => ({
    createTime: o.createTime || o.created_at || null,
    orderType: o.orderType || o.channel || "unknown",
    realTotalAmount: Number(o.realTotalAmount ?? o.amount ?? 0),
    items: (o.orderProductList || o.items || []).flatMap((item) => [item.productName || item.name || "未命名单品"])
  }));
}

function unwrapMcpPayload(payload) {
  if (payload == null) return null;
  if (Array.isArray(payload)) return payload;
  if (typeof payload === "string") {
    const fenced = payload.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
    const candidate = fenced ? fenced[1] : payload;
    try { return JSON.parse(candidate); } catch (_) {
      const start = Math.min(...[candidate.indexOf("{"), candidate.indexOf("[")].filter((n) => n >= 0));
      if (Number.isFinite(start)) { try { return JSON.parse(candidate.slice(start)); } catch (_) {} }
      return null;
    }
  }
  if (payload.data && typeof payload.data === "object") return payload.data;
  if (payload.result && typeof payload.result === "object") return unwrapMcpPayload(payload.result);
  if (payload.content && Array.isArray(payload.content)) {
    const text = payload.content.find((part) => part.type === "text")?.text;
    return unwrapMcpPayload(text);
  }
  return payload;
}

function extractOrderRows(payload) {
  const value = unwrapMcpPayload(payload);
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of ["orders", "orderList", "list", "records", "items"]) {
    if (Array.isArray(value[key])) return value[key];
  }
  return value.orderId || value.createTime ? [value] : [];
}

function summarize(orders) {
  const valid = orders.filter((o) => o.createTime && !Number.isNaN(new Date(o.createTime).getTime()));
  const workday = valid.filter((o) => { const day = new Date(o.createTime).getDay(); return day >= 1 && day <= 5; }).length;
  const late = valid.filter((o) => new Date(o.createTime).getHours() >= 22 || new Date(o.createTime).getHours() < 2).length;
  const delivery = valid.filter((o) => ["delivery", "外送", "麦乐送"].includes(String(o.orderType).toLowerCase())).length;
  const itemCounts = new Map();
  valid.flatMap((o) => o.items || []).forEach((item) => itemCounts.set(item, (itemCounts.get(item) || 0) + 1));
  const favorite = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = valid.length;
  const amounts = valid.map((o) => Number(o.realTotalAmount)).filter(Number.isFinite);
  return {
    total, workdayRate: total ? Math.round(workday / total * 100) : 0,
    lateCount: late, deliveryRate: total ? Math.round(delivery / total * 100) : 0,
    favoriteItem: favorite?.[0] || null, favoriteCount: favorite?.[1] || 0,
    maxAmount: amounts.length ? Math.max(...amounts) : 0,
    latest: valid.at(-1)?.createTime || null
  };
}

function determinePersona(orders) {
  const stats = summarize(orders);
  if (!stats.total) return { key: "banma", reason: "暂无可用订单，当前使用演示样本" };
  if (stats.deliveryRate >= 65) return { key: "delivery", reason: `外送订单占比 ${stats.deliveryRate}%` };
  if (stats.lateCount >= Math.max(3, Math.ceil(stats.total * 0.35))) return { key: "midnight", reason: `深夜订单 ${stats.lateCount} 单` };
  if (stats.workdayRate >= 65) return { key: "banma", reason: `工作日下单占比 ${stats.workdayRate}%` };
  if (stats.favoriteItem && /甜筒|麦旋风|派|圣代/.test(stats.favoriteItem)) return { key: "dessert", reason: `高频甜品：${stats.favoriteItem}` };
  if (stats.maxAmount >= 100) return { key: "spotlight", reason: `最高单笔 ¥${stats.maxAmount}` };
  if (stats.favoriteCount >= Math.max(4, Math.ceil(stats.total * 0.55))) return { key: "classic", reason: `本命单品出现 ${stats.favoriteCount} 次` };
  if (new Set(orders.flatMap((o) => o.items || [])).size >= 12) return { key: "explorer", reason: "尝试单品种类较多" };
  return { key: "rush", reason: "下班时段消费较集中" };
}

function formatStats(stats, personaKey) {
  const total = stats.total || 0;
  const common = [`全年共下单 ${total} 单`];
  if (personaKey === "midnight") common.unshift(`22:00 后下单 ${stats.lateCount} 单`);
  if (personaKey === "banma") common.unshift(`工作日下单占比 ${stats.workdayRate}%`, "最常出现时间：工作日 18:00 后");
  if (personaKey === "delivery") common.unshift(`外送订单占比 ${stats.deliveryRate}%`, "最常配送至同一地址");
  if (personaKey === "dessert" && stats.favoriteItem) common.unshift(`最爱单品：${stats.favoriteItem}`, `甜品相关订单 ${stats.favoriteCount} 单`);
  if (personaKey === "classic" && stats.favoriteItem) common.unshift(`本命单品：${stats.favoriteItem}`, `本命出现 ${stats.favoriteCount} 次`);
  if (personaKey === "spotlight") common.unshift(`单笔最高 ¥${stats.maxAmount}`);
  if (personaKey === "explorer") common.unshift(`尝试单品 ${stats.uniqueItems || 0} 种`);
  if (personaKey === "rush") common.unshift("18:00—20:00 下单集中", "平均下单间隔待计算");
  return common.slice(0, 3);
}

function prepareReport(rawPayload, fallback = DEMO_ORDERS) {
  const rows = normalizeOrders(extractOrderRows(rawPayload));
  const usingDemo = rows.length === 0;
  const orders = usingDemo ? fallback : rows;
  const stats = summarize(orders);
  stats.uniqueItems = new Set(orders.flatMap((o) => o.items || [])).size;
  const persona = determinePersona(orders);
  return { orders, usingDemo, stats, persona, displayStats: formatStats(stats, persona.key) };
}

window.MCDReport = { DEMO_ORDERS, PERSONAS, unwrapMcpPayload, extractOrderRows, normalizeOrders, summarize, determinePersona, formatStats, prepareReport };
