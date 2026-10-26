# 🍟 噢麦嘎｜2026 劳饭年度报告

> **今年的你，正式确诊为哪一型麦门人？**
>
> 读取你的麦当劳订单，从时间、渠道、单品、金额里算出你的麦门人格，生成一张能直接发朋友圈的 3:4 年度海报。

<p align="center">
  <a href="https://talk2joan.github.io/mcd-laofan-report/"><img src="https://img.shields.io/badge/🎮_在线试玩-Demo模式免Token-FFC72C?style=for-the-badge&logo=mcdonalds&logoColor=white" alt="在线试玩"/></a>
  <a href="https://github.com/talk2joan/mcd-laofan-report/stargazers"><img src="https://img.shields.io/github/stars/talk2joan/mcd-laofan-report?style=for-the-badge&color=FFC72C&logo=github" alt="GitHub stars"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-00784A?style=for-the-badge" alt="MIT license"/></a>
</p>

<p align="center">
  <b>3 秒试玩</b>：打开在线版 → 点「八型图鉴」任意一张海报 → 立刻看到你的人格报告（演示数据）。
</p>

### 🎨 麦门八型人格海报样张

<p align="center">
  <img src="assets/persona-banma.jpg" width="180" alt="班马"/>
  <img src="assets/persona-midnight.jpg" width="180" alt="深夜黑马"/>
  <img src="assets/persona-dessert.jpg" width="180" alt="甜品治愈派"/>
  <img src="assets/persona-rush.jpg" width="180" alt="卡急马"/>
</p>
<p align="center">
  <img src="assets/persona-classic.jpg" width="180" alt="麦门痴心人"/>
  <img src="assets/persona-explorer.jpg" width="180" alt="麦门探险家"/>
  <img src="assets/persona-delivery.jpg" width="180" alt="麦乐送常驻民"/>
  <img src="assets/persona-spotlight.jpg" width="180" alt="麦门显眼包"/>
</p>

**在线体验**：[talk2joan.github.io/mcd-laofan-report](https://talk2joan.github.io/mcd-laofan-report/)  
**参赛赛道**：麦当劳程序员创意开发大赛 · 麦当劳 MCP 只读开发

---

## 你会得到什么

- **一张年度海报**（3:4 竖版，PNG），底部三张卡是你的真实数字，配色和排版都做过了，保存直接发朋友圈
- **麦门八型人格鉴定**：班马、深夜黑马、甜品治愈派、卡急马、麦门痴心人、麦门探险家、麦乐送常驻民、麦门显眼包
- **20+ 项订单指标**：下单总数、工作日占比、深夜下单、本命单品、探索度、高光时刻……
- **三种分享文案**：朋友圈 / 小红书 / 群聊报数，复制就能发

**核心特点**：

- 订单只在你本机计算，不上传任何服务器
- 基于麦当劳 MCP `order-list` 和 `now-time-info` 只读获取
- 零后端，纯前端 JS + Canvas 渲染海报
- 也可以导入 `order-list` 返回的 JSON，或先看八型演示

---

## 怎么玩（3 种方式，按门槛从低到高）

### 🎮 方式零：演示模式（推荐先点这个，免 Token）

没有 Token 也能 10 秒看到完整效果：

1. 打开 [在线版](https://talk2joan.github.io/mcd-laofan-report/)
2. 滑到「八型图鉴」，点任意一张人格海报
3. 用该人格的演示订单跑一遍完整算法，海报和页面会标注「演示样本」

**看完觉得有意思再 Star，想要自己的报告再往下走。**

### 🛰️ 方式一：在线版 + 本机桥接（看自己的真实订单）

1. 在 [open.mcd.cn/mcp](https://open.mcd.cn/mcp) 用手机号登录，申请 MCP Token
2. 下载本项目，在项目目录启动本机桥接（只需要 Python 3.8+，零依赖）：

```bash
# macOS / Linux
export MCD_MCP_TOKEN="你的 Token"
python3 mcp_bridge.py

# Windows PowerShell
$env:MCD_MCP_TOKEN="你的 Token"
python mcp_bridge.py
```

3. 浏览器打开 [http://127.0.0.1:8765/](http://127.0.0.1:8765/)，点「读取我的订单」

也可以直接打开 [talk2joan.github.io/mcd-laofan-report](https://talk2joan.github.io/mcd-laofan-report/)，它会请求你本机的 `127.0.0.1:8765`（需要先启动桥接）。Token 和订单都不经过 GitHub，全程留在本地。

**桥接做了什么**：

- 调用麦当劳 MCP 的 `order-list`（历史订单）和 `now-time-info`（报告时间）
- 只返回 `createTime`、`orderType`、`realTotalAmount`、商品名与数量给浏览器
- 不返回 `orderId`、门店、地址、手机号等字段
- 只监听 `127.0.0.1`，CORS 只放行本机页面和本项目 GitHub Pages，其他网站无法读取你的订单
- Token 只从环境变量读取，只在本进程内使用，从不发给浏览器、不落盘

### 📦 方式二：导入 JSON（离线验证）

如果你已经通过其他方式拿到了 `order-list` 的原始返回（JSON 格式），可以在页面上点「导入订单 JSON」直接上传，全部在浏览器本地计算。

---

## 技术实现

### 架构

```
┌─────────────────┐
│  浏览器（前端）  │
│  index.html     │  ← 用户看到的页面，零后端
│  app.js         │  ← 订单解析、20+ 指标计算、八型打分
│  poster.js      │  ← Canvas 渲染海报（把真实数字画进预设的卡片位置）
└────────┬────────┘
         │ HTTP GET /api/report
         ▼
┌─────────────────┐
│ mcp_bridge.py   │  ← 本机桥接（可选，只在方式一/二时需要）
│  只读 MCP       │  ← 调用 order-list + now-time-info
│  脱敏 + CORS   │  ← 丢掉敏感字段，只放行白名单来源
└────────┬────────┘
         │ MCP over HTTPS
         ▼
┌─────────────────┐
│ 麦当劳 MCP      │
│ mcp.mcd.cn      │
└─────────────────┘
```

### 核心文件

- **`app.js`**：数据层，导出 `prepareReport()`、`shareTexts()` 等 11 个函数
  - `summarize()`：从订单数组算出 20+ 项指标
  - `determinePersona()`：按八套规则打分（0–100），最高分当选
  - `posterCards()`：为每种人格准备底部三张数据卡的内容
- **`poster.js`**：视觉层，导出 `renderPoster(canvas, { image, cards, demo })`
  - 加载人格海报底图（由 Seedream 生成，版式一致）
  - 用纸色圆角矩形盖住原图卡片，重绘真实数字
  - 演示样本右上角加红色「演示」角标
- **`mcp_bridge.py`**：本机桥接（可选）
  - 只调用 `order-list` 和 `now-time-info`
  - 返回前丢掉 `orderId`、`storeId`、`deliveryAddress`、`mobile` 等字段
  - CORS 白名单：`null`（file://）、`127.0.0.1`、`localhost`、`talk2joan.github.io`
  - 支持 `Access-Control-Allow-Private-Network: true`（Chrome 私有网络访问）
- **`index.html`**：单页应用
  - Hero 视觉、八型图鉴、报告主体（海报 + 证据 + 分享文案）、怎么做到的、结案页
  - 三种数据源切换：MCP 桥接 / 导入 JSON / 演示样本
  - 三种分享渠道切换：朋友圈 / 小红书 / 群聊报数

### 麦门八型规则

每种人格按订单行为独立打分（0–100），最高分当选：

| 人格 | 英文 key | 判定逻辑 |
|------|----------|---------|
| 班马 | `banma` | 工作日下单占比 ≥ 70% |
| 深夜黑马 | `midnight` | 22:00 后下单占比 ≥ 50% |
| 甜品治愈派 | `dessert` | 甜品（甜筒/圣代/派）下单占比 ≥ 30% |
| 卡急马 | `rush` | 17:00–19:30 下班冲刺占比 ≥ 35% |
| 麦门痴心人 | `classic` | 单品复购 Top 1 占比 ≥ 25% |
| 麦门探险家 | `explorer` | 只尝一次的单品数 ≥ 独特单品数的 50% |
| 麦乐送常驻民 | `delivery` | 外送订单占比 ≥ 60% |
| 麦门显眼包 | `spotlight` | 高于中位数 1.8 倍的"高光时刻"订单数 ≥ 总数的 20% |

### 海报渲染细节

八张人格海报由 Seedream 生成（Prompt 见 `传播手册.md`），版式一致：

- 宽高比 3:4，底部 76%–88.5% 高度处有三张数据卡
- 每张卡横跨约 28% 宽度，位置在 7–35% / 37–65% / 67–94%
- `poster.js` 用纸色圆角矩形盖住原图卡片内容，重绘 `[标签, 数值, 单位]`
- 演示样本右上角加红色「演示」角标，避免误传

---

## 安全与隐私

1. **只读取**：本机桥接调用麦当劳 MCP 的 `order-list` 和 `now-time-info`，不下单、不支付、不领券
2. **先脱敏**：只留下单时间、渠道、金额、商品名；订单号、门店、地址、手机号在桥接里就被丢掉
3. **本地算**：20+ 项指标、八型打分全部在你的浏览器里完成，不上传任何服务器，包括 GitHub
4. **出海报**：把你的真实数字画进人格海报，一键保存 PNG，配好三种渠道的分享文案

**桥接白名单**：

- 默认只放行：`null`（file://）、`127.0.0.1`、`localhost`、`talk2joan.github.io`
- 自己 fork 部署时，可通过环境变量 `MCD_BRIDGE_ORIGINS` 追加来源（逗号分隔，完整 `https://域名`）

**为什么在线版安全**：

- 在线页面运行在你的浏览器里，请求的是你本机的 `127.0.0.1:8765`
- Token 和订单都不经过 GitHub，全程留在本地
- 桥接的 CORS 白名单只放行了 `talk2joan.github.io`，其他网站无法读取你的订单
- Chrome 私有网络访问（https 公网页面 → 127.0.0.1）需要桥接显式返回 `Access-Control-Allow-Private-Network: true`，本桥接已支持

---

## 开发与测试

```bash
# 单元测试（Node.js 内置 test runner，零依赖）
node --test tests/

# 本机启动桥接
export MCD_MCP_TOKEN="你的 Token"  # 或 Windows: $env:MCD_MCP_TOKEN="..."
python3 mcp_bridge.py

# 打开 http://127.0.0.1:8765/
```

**测试覆盖**：

- 八套演示数据分别判定为各自的人格
- 演示数据是确定性的（同一 key 多次调用返回相同订单）
- 解包 MCP `tools/call` 返回的 `content[].text`（Markdown 包裹 JSON）
- 三渠道分享文案带人格、证据与演示标注
- `shareText()` 默认返回朋友圈文案

---

## 项目结构

```
mcd-laofan-report/
├── index.html          # 单页应用
├── app.js              # 数据层（订单解析、指标计算、八型打分）
├── poster.js           # 视觉层（Canvas 渲染海报）
├── mcp_bridge.py       # 本机桥接（可选，只在方式一/二时需要）
├── mcd_client.py       # MCP 客户端（mcp_bridge.py 的依赖）
├── tests/
│   └── app.test.js     # 单元测试
├── assets/
│   ├── persona-*.jpg   # 八张人格海报底图（Seedream 生成）
│   └── mcdonalds-arches.png  # 麦当劳金拱门 logo
├── 传播手册.md          # 产品定位、八型规则、视觉规范、分享钩子
├── PRD.md              # 完整产品需求文档
├── PLAN.md             # 开发计划与里程碑
├── 技术设计.md          # 架构、数据契约、MCP 集成方案
├── 提交清单.md          # 参赛必交文件检查表
└── README.md           # 本文件
```

---

## 参赛信息

- **赛道**：麦当劳程序员创意开发大赛 · 麦当劳 MCP 只读开发
- **作品名称**：噢麦嘎｜2026 劳饭年度报告
- **一句话介绍**：读取你的麦当劳订单，从时间、渠道、单品、金额里算出你的麦门人格，生成一张能直接发朋友圈的年度海报
- **独立参赛**：非麦当劳官方产品，不代表官方立场
- **"劳饭"命名说明**：打工人对自己劳动餐的自嘲，不指向餐品品质

**必交文件**：

- [x] 完整可运行代码（本仓库）
- [x] README（本文件）
- [x] 演示视频 / 截图（`assets/` 目录，海报样张）
- [x] PRD / 设计文档（`PRD.md`、`技术设计.md`、`传播手册.md`）
- [x] 开源协议（MIT License）

---

## 致谢

- **麦当劳 MCP 团队**，提供了 `order-list` 和 `now-time-info` 只读工具
- **Anthropic Claude**（Kiro），完成了从产品设计到代码实现的全流程开发
- **WorkBuddy**，前期需求梳理、技术选型和架构设计阶段提供了大量协助
- **Seedream**，生成了八张人格海报底图，统一版式和配色方案（Prompt 见 `传播手册.md`）
- 参赛小伙伴们，2026 年继续麦

---

## License

MIT License. 详见 [LICENSE](LICENSE) 文件。

**免责声明**：

- 独立参赛作品，非麦当劳官方产品，不代表官方立场
- "劳饭"是打工人对自己劳动餐的自嘲，不指向餐品品质
- 报告仅供娱乐，不构成营养或消费建议
- 餐品与订单信息以麦当劳官方渠道为准
- 演示数据均已在海报与页面上标注
