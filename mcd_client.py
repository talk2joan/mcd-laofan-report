"""麦当劳 MCP 客户端（零依赖，仅 Python 标准库）。

通过 Streamable HTTP 直连麦当劳中国 MCP Server（https://mcp.mcd.cn），
实现 MCP 协议的 initialize / tools/list / tools/call，
并支持 fixtures 离线回放（无 Token 也能演示与自测）。

MCP 协议要点（2025-03-26 版本）：
- POST JSON-RPC 2.0 请求，响应可能是普通 JSON 或 SSE（text/event-stream）
- initialize 后服务端会通过 mcp-session-id 头下发会话 ID，后续请求需带回
- tools/call 的返回在 result.content[] 中，文本内容通常是 JSON 字符串

错误约定（与官方文档对齐）：
- HTTP 401 -> Token 无效、过期或未提供
- HTTP 429 -> 触发限流（每 Token 每分钟最多 600 次请求）
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

MCP_URL = "https://mcp.mcd.cn"
PROTOCOL_VERSION = "2025-03-26"
CLIENT_INFO = {"name": "mcd-laofan-report", "version": "1.0.0"}

# 离线回放目录（与本文件同级的 fixtures/）
FIXTURE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


class MCPError(Exception):
    """MCP 调用通用错误。"""


class AuthError(MCPError):
    """HTTP 401：Token 无效、过期或未提供。"""


class RateLimitError(MCPError):
    """HTTP 429：触发限流。"""


class ToolCallError(MCPError):
    """tools/call 返回 isError=true 或结果为空。"""


def _parse_sse(raw: str):
    """从 SSE 文本中提取最后一个 data: 负载（JSON）。"""
    data_lines = []
    for line in raw.splitlines():
        if line.startswith("data:"):
            data_lines.append(line[5:].strip())
        elif line.strip() == "" and data_lines:
            # event 边界：保留最近一段完整 data
            pass
    if not data_lines:
        return None
    payload = "\n".join(data_lines)
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


class MCDClient:
    """麦当劳 MCP 客户端。token 为空时自动进入离线（fixtures）模式。"""

    def __init__(self, token: str | None = None, url: str = MCP_URL,
                 timeout: int = 30, offline: bool | None = None):
        self.token = token if token is not None else os.environ.get("MCD_MCP_TOKEN", "")
        self.url = url
        self.timeout = timeout
        self.offline = bool(offline) if offline is not None else not self.token
        self.session_id = None
        self._id = 0
        self._call_log: list[dict] = []
        if not self.offline:
            self.initialize()

    # ------------------------------------------------------------------ 基础

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def _post(self, payload: dict):
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if self.session_id:
            headers["mcp-session-id"] = self.session_id
        req = urllib.request.Request(
            self.url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=headers, method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                ctype = resp.headers.get("Content-Type", "")
                sid = resp.headers.get("mcp-session-id")
                if sid:
                    self.session_id = sid
                raw = resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:500]
            except Exception:
                pass
            if e.code == 401:
                raise AuthError(f"401 Token 无效、过期或未提供：{body}")
            if e.code == 429:
                raise RateLimitError(f"429 触发限流（600 次/分钟）：{body}")
            raise MCPError(f"HTTP {e.code}: {body}")
        except urllib.error.URLError as e:
            raise MCPError(f"网络错误：{e}")
        if "text/event-stream" in ctype:
            return _parse_sse(raw)
        raw = raw.strip()
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return _parse_sse(raw)

    def _rpc(self, method: str, params: dict | None = None, notify: bool = False):
        msg = {"jsonrpc": "2.0", "method": method}
        if not notify:
            msg["id"] = self._next_id()
        if params is not None:
            msg["params"] = params
        resp = self._post(msg)
        if notify:
            return None
        if resp is None:
            raise MCPError(f"{method} 无响应")
        if "error" in resp:
            err = resp["error"]
            raise MCPError(f"{method} RPC 错误 {err.get('code')}: {err.get('message')}")
        return resp.get("result")

    # ------------------------------------------------------------- 协议方法

    def initialize(self):
        result = self._rpc("initialize", {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": CLIENT_INFO,
        })
        self._rpc("notifications/initialized", notify=True)
        return result

    def list_tools(self) -> list[dict]:
        result = self._rpc("tools/list")
        return (result or {}).get("tools", [])

    def call(self, name: str, arguments: dict | None = None):
        """调用工具，返回解析后的 Python 对象（优先解析 content 中的 JSON 文本）。"""
        if self.offline:
            return self._call_fixture(name, arguments or {})
        self._call_log.append({"tool": name, "args": arguments or {}})
        result = self._rpc("tools/call", {"name": name, "arguments": arguments or {}})
        if not result:
            raise ToolCallError(f"{name} 返回空结果")
        if result.get("isError"):
            raise ToolCallError(f"{name} 返回错误：{_content_to_text(result)[:500]}")
        return _content_to_object(result)

    # ------------------------------------------------------------- 离线模式

    def _call_fixture(self, name: str, arguments: dict):
        """从 fixtures 目录回放录制的真实响应。"""
        path = os.path.join(FIXTURE_DIR, f"{name}.json")
        if not os.path.exists(path):
            raise MCPError(
                f"离线模式缺少 fixtures/{name}.json。"
                "请先配置 MCD_MCP_TOKEN 并运行：python cli.py record"
            )
        with open(path, "r", encoding="utf-8") as f:
            fixture = json.load(f)
        if isinstance(fixture, dict) and "response" in fixture:
            return fixture["response"]
        return fixture

    @property
    def call_log(self) -> list[dict]:
        return list(self._call_log)


def _content_to_text(result: dict) -> str:
    parts = []
    for item in result.get("content", []):
        if item.get("type") == "text":
            parts.append(item.get("text", ""))
    return "\n".join(parts)


def _parse_json_text(text: str):
    """解析普通 JSON、代码围栏或 Markdown 外壳中的 JSON。"""
    text = (text or "").strip()
    candidates = [text]
    if "```" in text:
        fenced = text.split("```", 2)
        if len(fenced) >= 2:
            candidates.insert(0, fenced[1].removeprefix("json").strip())
    for start_char in ("{", "["):
        start = text.find(start_char)
        if start >= 0:
            candidates.append(text[start:])
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return text


def _content_to_object(result: dict):
    """MCP content -> Python 对象，兼容 Markdown 包裹的 JSON。"""
    parts = [item.get("text", "") for item in result.get("content", []) if item.get("type") == "text"]
    parsed = [_parse_json_text(part) for part in parts]
    if len(parsed) == 1:
        return parsed[0]
    return parsed


def check_token(token: str | None = None, url: str = MCP_URL) -> dict:
    """连通性自检：initialize + now-time-info。返回诊断信息。"""
    client = MCDClient(token=token, url=url)
    info = {
        "url": url,
        "offline": client.offline,
        "serverInfo": getattr(client, "_server_info", None),
    }
    try:
        t0 = time.time()
        now = client.call("now-time-info")
        info["latency_ms"] = round((time.time() - t0) * 1000)
        info["now"] = now
        tools = client.list_tools()
        info["tool_count"] = len(tools)
        info["ok"] = True
    except MCPError as e:
        info["ok"] = False
        info["error"] = str(e)
    return info
