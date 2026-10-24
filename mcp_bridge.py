"""Local-only bridge for the McDonald's MCP order-list call.

Run with: MCD_MCP_TOKEN=... python mcp_bridge.py
The browser receives only normalized order data; the token stays server-side.
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys

CLIENT_DIR = Path(__file__).resolve().parents[1] / "mcd-group-strategist" / "skills" / "mcd-group-strategist" / "scripts"
sys.path.insert(0, str(CLIENT_DIR.resolve()))
from mcd_client import MCDClient, MCPError  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("MCD_BRIDGE_PORT", "8765"))


def normalize_order_list(payload):
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except json.JSONDecodeError:
            for marker in ("[", "{"):
                start = payload.find(marker)
                if start >= 0:
                    try:
                        payload = json.loads(payload[start:])
                        break
                    except json.JSONDecodeError:
                        continue
    if isinstance(payload, dict) and isinstance(payload.get("data"), (dict, list)):
        payload = payload["data"]
    if isinstance(payload, dict):
        for key in ("orders", "orderList", "list", "records", "items"):
            if isinstance(payload.get(key), list):
                payload = payload[key]
                break
    if not isinstance(payload, list):
        return []
    rows = []
    for order in payload:
        if not isinstance(order, dict):
            continue
        rows.append({
            "createTime": order.get("createTime"),
            "orderType": order.get("orderType") or order.get("beType") or "unknown",
            "realTotalAmount": order.get("realTotalAmount"),
            "orderProductList": [
                {"productName": item.get("productName"), "quantity": item.get("quantity", 1)}
                for item in (order.get("orderProductList") or []) if isinstance(item, dict)
            ],
        })
    return rows


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "service": "mcd-laofan-mcp-bridge", "tokenConfigured": bool(os.environ.get("MCD_MCP_TOKEN"))})
            return
        if self.path != "/api/orders":
            self._json(404, {"ok": False, "error": "Not found"})
            return
        token = os.environ.get("MCD_MCP_TOKEN", "")
        if not token:
            self._json(401, {"ok": False, "error": "MCD_MCP_TOKEN 未配置"})
            return
        try:
            client = MCDClient(token=token)
            payload = client.call("order-list", {})
            orders = normalize_order_list(payload)
            self._json(200, {"ok": True, "orders": orders, "source": "mcp", "dataWindow": "MCP 返回的可用订单窗口", "isDemo": len(orders) == 0})
        except MCPError as exc:
            self._json(502, {"ok": False, "error": str(exc)})
        except Exception as exc:  # defensive boundary for local bridge
            self._json(500, {"ok": False, "error": f"桥接服务异常：{exc}"})

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    print(f"MCP bridge listening on http://{HOST}:{PORT}")
    print("Set MCD_MCP_TOKEN in this terminal before starting; token is never sent to the browser.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
