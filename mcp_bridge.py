"""噢麦嘎｜劳饭年度报告 —— 本地 MCP 只读桥接。

    MCD_MCP_TOKEN=xxx python mcp_bridge.py        # 然后打开 http://127.0.0.1:8765/

- Token 只从环境变量读取，只在本进程内使用，从不发给浏览器、不落盘；
- 只调用只读工具：order-list（历史订单）、now-time-info（报告生成时间）；
- 向浏览器只返回 createTime / orderType / realTotalAmount / 商品名与数量，
  不返回 orderId、门店、地址、手机号等字段；
- 只监听 127.0.0.1，CORS 只放行本机来源，其他网站无法读取你的订单。
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from mcd_client import AuthError, MCDClient, MCPError  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("MCD_BRIDGE_PORT", "8765"))
# 只允许本机页面跨域访问（file:// 打开时 Origin 为 "null"）
ALLOWED_ORIGIN = re.compile(r"^(null|https?://(127\.0\.0\.1|localhost)(:\d+)?)$")
STATIC_FILES = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/poster.js": "poster.js"}
ORDER_LIST_KEYS = ("orders", "orderList", "list", "records", "items", "rows")


def _maybe_json(value):
    if not isinstance(value, str):
        return value
    text = value.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    candidates = ([fenced.group(1)] if fenced else []) + [text]
    candidates += [text[text.find(c):] for c in "{[" if c in text]
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return value


def extract_orders(payload, depth: int = 0) -> list:
    """从 order-list 的各种包装（JSON 字符串 / data / result / 列表键）里取出订单数组。"""
    payload = _maybe_json(payload)
    if depth > 6 or payload is None:
        return []
    if isinstance(payload, list):
        return [o for o in payload if isinstance(o, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ORDER_LIST_KEYS:
        if isinstance(payload.get(key), list):
            return [o for o in payload[key] if isinstance(o, dict)]
    for key in ("data", "result"):
        if key in payload:
            return extract_orders(payload[key], depth + 1)
    return [payload] if payload.get("createTime") else []


def sanitize_order(order: dict) -> dict:
    """白名单脱敏：只保留生成报告需要的字段。"""
    products = order.get("orderProductList") or []
    return {
        "createTime": order.get("createTime"),
        "orderType": str(order.get("orderType") or order.get("beType") or "unknown"),
        "realTotalAmount": order.get("realTotalAmount"),
        "orderProductList": [
            {"productName": p.get("productName"), "quantity": p.get("quantity", 1)}
            for p in products if isinstance(p, dict)
        ],
    }


def normalize_order_list(payload) -> list:
    return [sanitize_order(o) for o in extract_orders(payload)]


def build_report_payload(client) -> dict:
    """调用 MCP 只读工具并组装给前端的数据。"""
    orders = normalize_order_list(client.call("order-list", {}))
    try:
        now = client.call("now-time-info", {})
    except MCPError:
        now = None
    return {
        "ok": True,
        "source": "mcp",
        "tools": ["order-list", "now-time-info"],
        "orders": orders,
        "generatedAt": now if isinstance(now, (dict, str)) else None,
        "dataWindow": "order-list 返回的近期到店/外送订单",
        "isDemo": len(orders) == 0,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "mcd-laofan-bridge/1.0"

    def _cors(self):
        origin = self.headers.get("Origin")
        if origin and ALLOWED_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send(self, status: int, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict):
        self._send(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        origin = self.headers.get("Origin")
        if origin and not ALLOWED_ORIGIN.match(origin):
            self._json(403, {"ok": False, "error": "只允许本机页面访问"})
            return
        if path == "/health":
            self._json(200, {"ok": True, "service": "mcd-laofan-mcp-bridge", "tokenConfigured": bool(os.environ.get("MCD_MCP_TOKEN"))})
            return
        if path in ("/api/report", "/api/orders"):
            self._report()
            return
        self._static(path)

    def _report(self):
        token = os.environ.get("MCD_MCP_TOKEN", "")
        if not token:
            self._json(401, {"ok": False, "error": "MCD_MCP_TOKEN 未配置：请在启动桥接的终端里设置环境变量"})
            return
        try:
            self._json(200, build_report_payload(MCDClient(token=token)))
        except AuthError:
            self._json(401, {"ok": False, "error": "MCP Token 无效或已过期，请到 open.mcd.cn/mcp 重新获取"})
        except MCPError as exc:
            self._json(502, {"ok": False, "error": f"MCP 调用失败：{exc}"})
        except Exception as exc:  # 本地桥接的兜底边界，错误信息不含 Token
            self._json(500, {"ok": False, "error": f"桥接服务异常：{type(exc).__name__}"})

    def _static(self, path: str):
        rel = STATIC_FILES.get(path)
        if rel is None and path.startswith("/assets/") and ".." not in path:
            rel = path.lstrip("/")
        target = (ROOT / rel).resolve() if rel else None
        if not target or not target.is_file() or ROOT not in target.parents:
            self._json(404, {"ok": False, "error": "Not found"})
            return
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self._send(200, target.read_bytes(), ctype)

    def log_message(self, *_args):
        return


def main():
    # Windows 中文控制台默认 GBK，避免打印中文时崩溃
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print(f"[错误] 端口 {PORT} 已被占用。可能已有桥接在运行，或设置 MCD_BRIDGE_PORT 换一个端口。")
        sys.exit(1)
    print(f"噢麦嘎 MCP 桥接已启动：http://{HOST}:{PORT}/")
    print("Token 已配置" if os.environ.get("MCD_MCP_TOKEN") else "[提示] 未检测到 MCD_MCP_TOKEN，页面将只能使用演示数据")
    server.serve_forever()


if __name__ == "__main__":
    main()
