# MCP 集成说明

## 使用的 MCP Server

| 项 | 值 |
|---|---|
| Server | 麦当劳中国 MCP Server |
| 接入地址 | `https://mcp.mcd.cn` |
| 传输方式 | Streamable HTTP（JSON-RPC 2.0，兼容 SSE 响应） |
| 鉴权 | `Authorization: Bearer ${MCD_MCP_TOKEN}`，Token 只从环境变量读取 |
| 配置示例 | [`mcp-config.example.json`](./mcp-config.example.json) |

## 使用的 Tool

| Tool | 类型 | 用途 |
|---|---|---|
| `order-list` | 只读 | 读取用户近期到店 / 外送订单，作为年度报告的唯一数据源 |
| `now-time-info` | 只读 | 获取服务端当前时间，标注报告生成时间与数据窗口 |

本作品不调用任何下单、支付、领券、取消订单等写操作。

## 调用流程

```text
浏览器 index.html
   │  GET /api/report（仅允许 127.0.0.1 / localhost 来源）
   ▼
mcp_bridge.py（本机 127.0.0.1:8765）
   │  mcd_client.py：initialize → tools/call order-list → tools/call now-time-info
   ▼
麦当劳 MCP Server（https://mcp.mcd.cn）
   │  返回订单 JSON（可能包在 text content / data / result 中）
   ▼
mcp_bridge.py：extract_orders → sanitize_order（字段白名单）
   │  只返回 createTime / orderType / realTotalAmount / items[].productName / quantity
   ▼
app.js：规范化 → 时间、渠道、单品、金额统计 → 八型人格打分
   ▼
poster.js：Canvas 把真实数字画到人格海报卡片上，可导出 PNG
```

关键实现：

- `mcd_client.py`：零依赖 MCP 客户端，处理 `initialize`、`tools/call`、SSE 解析、401/429 提示。
- `mcp_bridge.py`：`build_report_payload()` 调用两个 Tool，`sanitize_order()` 做字段白名单，`ALLOWED_ORIGIN` 限制只有本机页面能读取。
- `app.js`：`prepareReport()` 输入订单数组，输出人格、三张数据卡和分享文案；`tests/app.test.js` 覆盖八种人格判定。

## 启动

```bash
# macOS / Linux
export MCD_MCP_TOKEN="<你在 open.mcd.cn/mcp 申请的 Token>"
python mcp_bridge.py
```

```powershell
# Windows PowerShell
$env:MCD_MCP_TOKEN="<你在 open.mcd.cn/mcp 申请的 Token>"
python mcp_bridge.py
```

浏览器打开 `http://127.0.0.1:8765/`，点击「读取我的订单」。

接口：

- `GET /health`：桥接状态与 Token 是否已配置（不返回 Token 本身）
- `GET /api/report`：调用 MCP 并返回脱敏订单（`/api/orders` 为兼容别名）

## 回退与边界

- 未配置 Token、MCP 不可用或订单为空时，页面使用八套确定性演示数据，海报左上角标注「演示样本 · 非真实订单」，不会把演示数据伪装成真实报告。
- `order-list` 只返回近期订单，报告中的数据窗口以接口实际返回为准。

## 业务价值

麦当劳 App 里的订单记录是一张流水账。本作品把 `order-list` 的原始订单转成「你是哪种麦门人格」的可分享海报：用户获得一份有趣的年度回顾，品牌获得一次基于真实消费行为的自发传播。全部统计在本机完成，订单不经过任何第三方服务器。

## 安全

- 不要把 Token 写入 HTML、JavaScript、README 或提交到 GitHub。
- 不要提交真实订单响应、手机号、地址或订单号。`fixtures/` 已在 `.gitignore` 中排除。
