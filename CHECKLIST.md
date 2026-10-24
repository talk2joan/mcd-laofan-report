# 提交清单

## 必交文件 ✓
- [x] `README.md` - 项目说明、快速开始、技术架构
- [x] `SUBMISSION.md` - 参赛说明、创意来源、技术亮点
- [x] `LICENSE` - MIT 许可证

## 核心代码 ✓
- [x] `index.html` - 单页应用（自包含）
- [x] `app.js` - 数据层（订单解析、统计、人格判定）
- [x] `poster.js` - 海报渲染（Canvas 绘制）
- [x] `mcp_bridge.py` - 桥接服务（MCP 调用 + 静态页面）
- [x] `mcd_client.py` - 零依赖 MCP 客户端

## 测试与资源 ✓
- [x] `tests/app.test.js` - 单元测试（8 套演示数据 + 真实订单）
- [x] `assets/persona-*.jpg` - 八张人格海报（Seedream 生成）
- [x] `assets/mcdonalds-arches.png` - Logo

## 验证

### 1. 演示模式（无需 Token）
```bash
# 直接打开 index.html（file:// 或静态托管）
# 页面会自动加载八种人格的演示数据
# 点击右下角的人格缩略图可以切换
```

### 2. 真实订单模式
```bash
export MCD_MCP_TOKEN="your_token_here"
python mcp_bridge.py
# 浏览器打开 http://127.0.0.1:8765/
# 点击「读取我的订单」
```

### 3. 单元测试
```bash
node --test tests/app.test.js
# 预期输出：ℹ pass 7, ℹ fail 0
```

## 使用的 MCP 工具
- `order-list` - 读取用户订单历史
- `now-time-info` - 获取当前时间

## 安全设计
- CORS 白名单：只允许本机来源（127.0.0.1/localhost）
- 字段白名单：只返回 `{createTime, orderType, realTotalAmount, items[productName]}`
- Token 隔离：`MCD_MCP_TOKEN` 只在本机环境变量里

## 文件大小
- 总计：~17MB（含 8 张高清海报）
- 代码：~50KB
- 资源：~16.9MB（海报 JPEG）
