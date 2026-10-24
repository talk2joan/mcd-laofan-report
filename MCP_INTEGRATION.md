# MCP 集成说明

## 架构

```text
麦当劳 MCP Server
        ↓
本地 mcp_bridge.py（读取 MCD_MCP_TOKEN）
        ↓
report.html / app.js
        ↓
订单规范化 → 统计 → 人格判定 → 海报展示
```

## 启动桥接

Windows PowerShell：

```powershell
$env:MCD_MCP_TOKEN="你的 Token"
& "C:\Users\Joan\.workbuddy\binaries\python\versions\3.13.12\python.exe" "mcp_bridge.py"
```

默认监听：`http://127.0.0.1:8765`

健康检查：`GET /health`
订单接口：`GET /api/orders`

## 数据处理

桥接服务调用 `order-list`，仅向浏览器返回：

- `createTime`
- `orderType`
- `realTotalAmount`
- `orderProductList.productName`
- `orderProductList.quantity`

支持普通 JSON、代码块 JSON 和 Markdown 外壳 JSON。空结果会返回 `isDemo: true`，页面自动回退到演示数据。

## 安全

不要将 Token 写入 HTML、JavaScript、README 或 GitHub。不要把真实订单响应、手机号、地址或订单号提交到公开仓库。
