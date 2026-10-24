// 运行：node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../app.js");

test("八套演示数据分别判定为各自的人格", () => {
  for (const key of R.PERSONA_ORDER) {
    const report = R.prepareReport(null, { demoPersona: key });
    assert.equal(report.usingDemo, true);
    assert.equal(report.persona.key, key, `${key} 演示数据被判成了 ${report.persona.key}：${JSON.stringify(report.persona.scores)}`);
    assert.equal(report.cards.length, 3);
  }
});

test("演示数据是确定性的", () => {
  assert.deepEqual(R.buildDemoOrders("midnight"), R.buildDemoOrders("midnight"));
});

test("解包 MCP tools/call 返回的 content[].text（Markdown 包裹 JSON）", () => {
  const payload = {
    content: [{ type: "text", text: "## 历史订单\n```json\n{\"data\":{\"orderList\":[{\"orderId\":\"x\",\"createTime\":\"2026-03-01 22:30:00\",\"orderType\":\"2\",\"realTotalAmount\":\"45.5\",\"orderProductList\":[{\"productName\":\"麦旋风\",\"quantity\":1}]}]}}\n```" }]
  };
  const rows = R.normalizeOrders(R.extractOrderRows(payload));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].realTotalAmount, 45.5);
  assert.deepEqual(rows[0].items, ["麦旋风"]);
});

test("桥接返回 {orders:[...]} 与空订单 data:{}", () => {
  assert.equal(R.extractOrderRows({ ok: true, orders: [{ createTime: "2026-01-01T12:00:00+08:00" }] }).length, 1);
  const empty = R.prepareReport({ data: {} });
  assert.equal(empty.usingDemo, true);
});

test("无空格时间按北京时间解析，深夜统计正确", () => {
  const orders = R.normalizeOrders([
    { createTime: "2026-05-01 23:40:00", orderType: "pickup", realTotalAmount: 30, orderProductList: [{ productName: "巨无霸" }] },
    { createTime: "2026-05-02 01:23:00", orderType: "pickup", realTotalAmount: 30, orderProductList: [{ productName: "巨无霸" }] },
    { createTime: "2026-05-03 12:00:00", orderType: "pickup", realTotalAmount: 30, orderProductList: [{ productName: "薯条" }] }
  ]);
  const s = R.summarize(orders);
  assert.equal(s.lateCount, 2);
  assert.equal(s.latestNight, "01:23");
  assert.equal(s.favoriteItem, "巨无霸");
});

test("外送占比高的真实订单判定为麦乐送常驻民", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    createTime: `2026-06-${String(i + 1).padStart(2, "0")} 12:10:00`, orderType: i < 8 ? "delivery" : "pickup",
    realTotalAmount: 40, orderProductList: [{ productName: ["巨无霸", "麦香鸡", "薯条"][i % 3] }]
  }));
  const report = R.prepareReport({ orders: rows });
  assert.equal(report.usingDemo, false);
  assert.equal(report.persona.key, "delivery");
  assert.deepEqual(report.cards[0], ["外送占比", "80", "%"]);
});

test("分享文案对演示数据做标注", () => {
  assert.match(R.shareText(R.prepareReport(null, { demoPersona: "dessert" })), /演示样本/);
});
