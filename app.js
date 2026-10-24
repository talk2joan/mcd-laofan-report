/*
 * 噢麦嘎｜2026 劳饭年度报告 —— 纯数据层（无 DOM 依赖）
 *
 * 职责：解包 MCP order-list 返回 → 规范化订单 → 统计 → 八型人格打分 → 生成海报数据卡。
 * 浏览器中挂载为 window.MCDReport；Node 中通过 require/import 使用（便于单元测试）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MCDReport = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ------------------------------------------------------------------ 人格配置 */

  // 顺序即平局时的优先级
  const PERSONA_ORDER = ["delivery", "midnight", "dessert", "classic", "explorer", "spotlight", "rush", "banma"];

  const PERSONAS = {
    banma: { name: "班马", type: "麦门打卡型", title: "一个人，活成了一个班。", subtitle: "白天上班，晚上上麦。", rule: "工作日下单占比高", image: "assets/persona-banma.jpg" },
    midnight: { name: "深夜黑马", type: "续命型", title: "别人收工，你开始给自己加餐。", subtitle: "夜色越深，麦门信号越强。", rule: "22:00—05:00 订单多", image: "assets/persona-midnight.jpg" },
    dessert: { name: "甜品治愈派", type: "情绪补给型", title: "心情可以打折，甜筒不能缺席。", subtitle: "甜不是答案，但很有效。", rule: "甜品出现频率高", image: "assets/persona-dessert.jpg" },
    rush: { name: "卡急马", type: "下班冲刺型", title: "下班铃一响，我踏马就来了。", subtitle: "把晚餐安排得比人生更快。", rule: "工作日 17:30—19:00 集中下单", image: "assets/persona-rush.jpg" },
    classic: { name: "麦门痴心人", type: "经典守护型", title: "不是不尝新，是这口旧爱值得反复。", subtitle: "每次都点它，是一种坚定。", rule: "同一单品反复复购", image: "assets/persona-classic.jpg" },
    explorer: { name: "麦门探险家", type: "尝鲜型", title: "菜单不是菜单，是未探索地图。", subtitle: "菜单是地图，你负责探索。", rule: "尝过的单品种类多", image: "assets/persona-explorer.jpg" },
    delivery: { name: "麦乐送常驻民", type: "到家型", title: "人可以不出门，快乐准时到家。", subtitle: "你的麦门地址，熟得像老朋友。", rule: "外送订单占比高", image: "assets/persona-delivery.jpg" },
    spotlight: { name: "麦门显眼包", type: "高光型", title: "这顿必须认真吃，仪式感不能输。", subtitle: "不是爱晒，是数据确实很有戏。", rule: "有明显高于日常的高光大单", image: "assets/persona-spotlight.jpg" }
  };

  const DESSERT_RE = /甜筒|麦旋风|圣代|派|冰淇淋|奶昔|新地|蛋挞|雪糕|甜品/;
  const DELIVERY_TYPES = new Set(["delivery", "外送", "麦乐送", "mds", "2"]);

  /* --------------------------------------------------------------- 演示数据生成 */

  // 确定性伪随机：同一人格每次生成相同的演示订单，方便复现与测试
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const MAINS = ["麦辣鸡腿堡", "巨无霸", "板烧鸡腿堡", "麦香鸡", "双层吉士汉堡", "麦香鱼"];
  const SIDES = ["薯条", "麦乐鸡", "麦辣鸡翅", "玉米杯"];
  const DRINKS = ["可乐", "雪碧", "咖啡", "柠檬红茶"];
  const DESSERTS = ["麦旋风", "原味甜筒", "香芋派", "草莓新地"];
  const EXOTIC = ["麦麦脆汁鸡", "不素之霸双层牛肉堡", "安格斯厚牛堡", "猪柳蛋麦满分", "扭扭薯条", "椒麻鸡腿堡", "麦咖啡拿铁", "麦辣鸡腿卷", "鸡块分享盒", "黑椒牛肉卷", "板烧鸡腿麦满分", "吉士汉堡", "香辣鸡翅", "青柠气泡饮", "流心芝士堡", "蜜桃乌龙"];

  // 每种人格的演示行为参数
  const DEMO_PROFILES = {
    banma:     { count: 36, seed: 11, weekday: 0.82, slots: [[19, 30, 40], [19, 50, 40], [12, 0, 50]], delivery: 0.15, dessert: 0.08, favorite: null, variety: 0.0, big: 0 },
    midnight:  { count: 36, seed: 22, weekday: 0.6, slots: [[22, 40, 70], [0, 50, 60], [1, 20, 30]], delivery: 0.45, dessert: 0.08, favorite: null, variety: 0.05, big: 0 },
    dessert:   { count: 36, seed: 33, weekday: 0.55, slots: [[15, 0, 50], [20, 0, 60]], delivery: 0.2, dessert: 0.9, favorite: null, variety: 0.05, big: 0 },
    rush:      { count: 36, seed: 44, weekday: 0.97, slots: [[18, 5, 20]], delivery: 0.1, dessert: 0.06, favorite: null, variety: 0.0, big: 0 },
    classic:   { count: 36, seed: 55, weekday: 0.62, slots: [[12, 30, 80], [19, 0, 80]], delivery: 0.2, dessert: 0.03, favorite: "巨无霸", variety: 0.0, big: 0 },
    explorer:  { count: 36, seed: 66, weekday: 0.6, slots: [[13, 0, 100], [19, 0, 100]], delivery: 0.25, dessert: 0.08, favorite: null, variety: 0.85, big: 0 },
    delivery:  { count: 36, seed: 77, weekday: 0.6, slots: [[12, 0, 60], [19, 30, 70]], delivery: 0.75, dessert: 0.1, favorite: null, variety: 0.05, big: 0 },
    spotlight: { count: 36, seed: 88, weekday: 0.62, slots: [[12, 30, 70], [19, 0, 80]], delivery: 0.2, dessert: 0.08, favorite: null, variety: 0.05, big: 4 }
  };

  function pad(n) { return String(n).padStart(2, "0"); }

  function buildDemoOrders(personaKey) {
    const p = DEMO_PROFILES[personaKey] || DEMO_PROFILES.banma;
    const rnd = mulberry32(p.seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const orders = [];
    // 均匀分布在 2026-01-03 ~ 2026-10-20
    const start = Date.UTC(2026, 0, 3);
    const span = Date.UTC(2026, 9, 20) - start;
    for (let i = 0; i < p.count; i++) {
      let day = new Date(start + (span * (i + rnd() * 0.8)) / p.count);
      const wantWeekday = rnd() < p.weekday;
      for (let guard = 0; guard < 7; guard++) {
        const wd = day.getUTCDay();
        const isWeekday = wd >= 1 && wd <= 5;
        if (isWeekday === wantWeekday) break;
        day = new Date(day.getTime() + 86400000);
      }
      const [h, m, jitter] = pick(p.slots);
      const minutes = h * 60 + m + Math.round((rnd() - 0.5) * jitter);
      const hh = ((Math.floor(minutes / 60) % 24) + 24) % 24;
      const mm = ((minutes % 60) + 60) % 60;
      const date = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
      const isDelivery = rnd() < p.delivery;

      const items = [];
      if (p.favorite && rnd() < 0.85) items.push(p.favorite);
      else if (rnd() < p.variety) items.push(EXOTIC[(i + Math.floor(rnd() * 3)) % EXOTIC.length]);
      else items.push(pick(MAINS));
      if (rnd() < 0.7) items.push(rnd() < p.variety ? pick(EXOTIC) : pick(SIDES));
      if (rnd() < 0.6) items.push(pick(DRINKS));
      if (rnd() < p.dessert) items.push(pick(DESSERTS));

      let amount = 28 + items.length * 9 + Math.round(rnd() * 10) + (isDelivery ? 9 : 0);
      if (i < p.big) { amount = 118 + Math.round(rnd() * 70); items.push("麦麦分享桶"); }
      orders.push({ createTime: `${date}T${pad(hh)}:${pad(mm)}:00+08:00`, orderType: isDelivery ? "delivery" : "pickup", realTotalAmount: amount, items });
    }
    return orders;
  }

  /* --------------------------------------------------------------- MCP 解包 */

  function parseJsonText(text) {
    if (typeof text !== "string") return text;
    const trimmed = text.trim();
    const candidates = [];
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) candidates.push(fenced[1]);
    candidates.push(trimmed);
    for (const ch of ["{", "["]) {
      const idx = trimmed.indexOf(ch);
      if (idx >= 0) candidates.push(trimmed.slice(idx));
    }
    for (const c of candidates) {
      try { return JSON.parse(c); } catch (_) { /* try next */ }
    }
    return null;
  }

  function unwrapMcpPayload(payload, depth = 0) {
    if (payload == null || depth > 6) return null;
    if (Array.isArray(payload)) return payload;
    if (typeof payload === "string") return unwrapMcpPayload(parseJsonText(payload), depth + 1);
    if (typeof payload !== "object") return null;
    if (Array.isArray(payload.content)) {
      const text = payload.content.find((part) => part && part.type === "text");
      return unwrapMcpPayload(text && text.text, depth + 1);
    }
    if (payload.result && typeof payload.result === "object") return unwrapMcpPayload(payload.result, depth + 1);
    if (payload.data !== undefined && (typeof payload.data === "object" || typeof payload.data === "string")) {
      return unwrapMcpPayload(payload.data, depth + 1) ?? payload.data;
    }
    return payload;
  }

  function extractOrderRows(payload) {
    if (payload && typeof payload === "object" && Array.isArray(payload.orders)) return payload.orders;
    const value = unwrapMcpPayload(payload);
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    for (const key of ["orders", "orderList", "list", "records", "items", "rows"]) {
      if (Array.isArray(value[key])) return value[key];
    }
    return value.orderId || value.createTime ? [value] : [];
  }

  function parseTime(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value);
    const s = String(value).trim();
    if (/^\d{10,13}$/.test(s)) return parseTime(Number(s));
    // "2026-01-08 18:42:00" 视为北京时间
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}+08:00`);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function normalizeOrders(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((o) => o && typeof o === "object")
      .map((o) => {
        const products = o.orderProductList || o.items || o.products || [];
        return {
          createTime: o.createTime || o.created_at || o.orderTime || null,
          orderType: String(o.orderType ?? o.beType ?? o.channel ?? "unknown"),
          realTotalAmount: Number(o.realTotalAmount ?? o.amount ?? o.totalAmount ?? 0),
          items: (Array.isArray(products) ? products : []).flatMap((item) => {
            if (typeof item === "string") return [item];
            if (!item || typeof item !== "object") return [];
            return [item.productName || item.name || "未命名单品"];
          })
        };
      });
  }

  /* --------------------------------------------------------------- 统计 */

  // 统一换算成北京时间的 {weekday, minutes}
  function beijingParts(date) {
    const t = new Date(date.getTime() + 8 * 3600 * 1000);
    return { weekday: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes(), ymd: t.toISOString().slice(0, 10) };
  }

  function fmtMinutes(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  // 30 分钟分桶取众数，返回桶内中位时刻
  function modeTime(minutesList) {
    if (!minutesList.length) return null;
    const buckets = new Map();
    for (const m of minutesList) {
      const b = Math.floor(m / 30);
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(m);
    }
    const best = [...buckets.values()].sort((a, b) => b.length - a.length)[0].sort((a, b) => a - b);
    return fmtMinutes(Math.floor(best[Math.floor((best.length - 1) / 2)] / 5) * 5);
  }

  function median(nums) {
    if (!nums.length) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function summarize(orders) {
    const valid = (orders || [])
      .map((o) => ({ ...o, date: parseTime(o.createTime) }))
      .filter((o) => o.date)
      .sort((a, b) => a.date - b.date);
    const total = valid.length;
    const parts = valid.map((o) => beijingParts(o.date));
    const isLate = (m) => m >= 22 * 60 || m < 5 * 60;
    const isRush = (p) => p.weekday >= 1 && p.weekday <= 5 && p.minutes >= 17 * 60 + 30 && p.minutes < 19 * 60;

    const workday = parts.filter((p) => p.weekday >= 1 && p.weekday <= 5).length;
    const lateParts = parts.filter((p) => isLate(p.minutes));
    const rushParts = parts.filter(isRush);
    const deliveryCount = valid.filter((o) => DELIVERY_TYPES.has(String(o.orderType).toLowerCase())).length;

    const itemCounts = new Map();     // 出现在多少单里（每单去重）
    valid.forEach((o) => new Set(o.items || []).forEach((it) => itemCounts.set(it, (itemCounts.get(it) || 0) + 1)));
    const ranked = [...itemCounts.entries()].sort((a, b) => b[1] - a[1]);
    const favorite = ranked[0];
    const itemSlots = valid.reduce((sum, o) => sum + new Set(o.items || []).size, 0);
    const top3 = ranked.slice(0, 3).reduce((s, [, c]) => s + c, 0);

    const dessertIdx = valid.map((o, i) => ((o.items || []).some((it) => DESSERT_RE.test(it)) ? i : -1)).filter((i) => i >= 0);
    const amounts = valid.map((o) => Number(o.realTotalAmount)).filter((n) => Number.isFinite(n) && n > 0);
    const med = median(amounts);
    const maxAmount = amounts.length ? Math.max(...amounts) : 0;

    // 深夜最晚一单：以 05:00 为一天的分界，越接近 05:00 越“晚”
    const latestNight = lateParts.length
      ? fmtMinutes(lateParts.map((p) => p.minutes).sort((a, b) => ((a - 300 + 1440) % 1440) - ((b - 300 + 1440) % 1440)).pop())
      : null;

    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      firstDate: parts[0]?.ymd || null,
      lastDate: parts.at(-1)?.ymd || null,
      workdayCount: workday, workdayRate: pct(workday),
      lateCount: lateParts.length, lateRate: pct(lateParts.length), latestNight,
      rushCount: rushParts.length, rushRate: pct(rushParts.length), rushTime: modeTime(rushParts.map((p) => p.minutes)),
      deliveryCount, deliveryRate: pct(deliveryCount),
      favoriteItem: favorite?.[0] || null, favoriteCount: favorite?.[1] || 0, favoriteRate: pct(favorite?.[1] || 0),
      top3Share: itemSlots ? Math.round((top3 / itemSlots) * 100) : 0,
      uniqueItems: itemCounts.size, onceItems: ranked.filter(([, c]) => c === 1).length,
      dessertCount: dessertIdx.length, dessertRate: pct(dessertIdx.length), dessertTime: modeTime(dessertIdx.map((i) => parts[i].minutes)),
      peakTime: modeTime(parts.map((p) => p.minutes)),
      maxAmount, medianAmount: Math.round(med),
      highlightCount: med ? amounts.filter((a) => a >= med * 1.8).length : 0,
      totalAmount: Math.round(amounts.reduce((s, a) => s + a, 0))
    };
  }

  /* --------------------------------------------------------------- 人格打分 */

  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

  function scorePersonas(stats) {
    if (!stats.total) return Object.fromEntries(PERSONA_ORDER.map((k) => [k, 0]));
    const ratio = stats.medianAmount ? stats.maxAmount / stats.medianAmount : 0;
    return {
      delivery: clamp((stats.deliveryRate - 30) * 2),
      midnight: clamp(stats.lateRate * 2.2),
      dessert: clamp(stats.dessertRate * 1.6),
      classic: clamp((stats.favoriteRate - 35) * 2.2),
      explorer: clamp(stats.total >= 8 ? (stats.uniqueItems / Math.sqrt(stats.total)) * 16 - 30 : 0),
      spotlight: clamp(stats.maxAmount >= 100 ? (ratio - 1.6) * 60 : 0),
      rush: clamp(stats.rushRate * 1.4),
      banma: clamp((stats.workdayRate - 62) * 3)
    };
  }

  function determinePersona(orders) {
    const stats = summarize(orders);
    const scores = scorePersonas(stats);
    if (!stats.total) return { key: "banma", score: 0, scores, reason: "暂无可用订单" };
    let key = PERSONA_ORDER[0];
    for (const k of PERSONA_ORDER) if (scores[k] > scores[key]) key = k;
    if (scores[key] === 0) key = "banma";
    const reasons = {
      delivery: `外送订单占比 ${stats.deliveryRate}%`,
      midnight: `22:00—05:00 下单 ${stats.lateCount} 单，占 ${stats.lateRate}%`,
      dessert: `${stats.dessertRate}% 的订单里有甜品`,
      classic: `${stats.favoriteItem} 出现在 ${stats.favoriteRate}% 的订单里`,
      explorer: `尝过 ${stats.uniqueItems} 种不同单品`,
      spotlight: `最高一单 ¥${stats.maxAmount}，是日常客单的 ${(stats.maxAmount / (stats.medianAmount || 1)).toFixed(1)} 倍`,
      rush: `工作日 17:30—19:00 下单 ${stats.rushCount} 次`,
      banma: `工作日下单占比 ${stats.workdayRate}%`
    };
    return { key, score: scores[key], scores, reason: reasons[key] };
  }

  /* --------------------------------------------------------------- 海报数据卡 */

  // 每张海报底部三张卡：[标签, 数值, 单位]
  function posterCards(stats, key) {
    const total = ["共下单", String(stats.total), "单"];
    const dash = (v) => (v == null || v === "" ? "—" : String(v));
    switch (key) {
      case "banma": return [["工作日下单", String(stats.workdayRate), "%"], ["打卡时段", dash(stats.peakTime), ""], total];
      case "midnight": return [["22:00 后下单", String(stats.lateCount), "单"], ["最晚一单", dash(stats.latestNight), ""], total];
      case "dessert": return [["甜品下单", String(stats.dessertCount), "次"], ["最甜时刻", dash(stats.dessertTime), ""], total];
      case "rush": return [["下班冲刺", String(stats.rushCount), "次"], ["冲刺时刻", dash(stats.rushTime), ""], total];
      case "classic": return [["本命单品", dash(stats.favoriteItem), ""], ["反复复购", String(stats.favoriteCount), "次"], ["Top3 占比", String(stats.top3Share), "%"]];
      case "explorer": return [["尝过单品", String(stats.uniqueItems), "种"], ["只尝一次", String(stats.onceItems), "种"], total];
      case "delivery": return [["外送占比", String(stats.deliveryRate), "%"], ["麦乐送", String(stats.deliveryCount), "单"], total];
      case "spotlight": return [["最高一单", `¥${stats.maxAmount}`, ""], ["高光时刻", String(stats.highlightCount), "次"], total];
      default: return [total, total, total];
    }
  }

  /* --------------------------------------------------------------- 组装 */

  function prepareReport(rawPayload, options = {}) {
    const rows = normalizeOrders(extractOrderRows(rawPayload));
    const usingDemo = rows.length === 0;
    const demoKey = options.demoPersona || "banma";
    const orders = usingDemo ? buildDemoOrders(demoKey) : rows;
    const stats = summarize(orders);
    const persona = determinePersona(orders);
    return { orders, usingDemo, demoKey: usingDemo ? demoKey : null, stats, persona, cards: posterCards(stats, persona.key) };
  }

  function shareText(report) {
    return shareTexts(report).moments;
  }

  // 三种渠道的分享文案（口径来自《传播手册》5.1）：朋友圈 / 小红书 / 群聊报数
  function shareTexts(report) {
    const p = PERSONAS[report.persona.key];
    const tag = report.usingDemo ? "（演示样本）" : "";
    const who = `「${p.name}·${p.type}」`;
    const evidence = report.cards
      .filter(([label]) => label !== "共下单")
      .map(([label, value, unit]) => `${label} ${value}${unit}`)
      .join("，");
    return {
      moments: `噢麦嘎，我的 2026 劳饭年度报告出来了${tag}：正式确诊为${who}。${p.title}${p.subtitle} #噢麦嘎 #劳饭年度报告`,
      xhs: `原来我不是爱吃麦，我是${who}麦门人${tag}。${evidence}，被数据抓得死死的。你是哪一型？评论区报出你的麦门型号 #噢麦嘎 #劳饭年度报告 #麦门`,
      group: `报数${tag}：我今年点了 ${report.stats.total} 单，${evidence}，正式确诊${who}。你们呢？`
    };
  }

  return {
    PERSONAS, PERSONA_ORDER, DEMO_PROFILES,
    buildDemoOrders, parseJsonText, unwrapMcpPayload, extractOrderRows, normalizeOrders, parseTime,
    summarize, scorePersonas, determinePersona, posterCards, prepareReport, shareText, shareTexts
  };
});
