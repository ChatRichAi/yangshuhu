#!/usr/bin/env python3
"""Native Messaging host for YangShuHu Chrome extension.
Supports:
  - getToken: Read OpenClaw Gateway config (one-shot via sendNativeMessage)
  - getCdpTargets: Fetch CDP /json endpoint (one-shot)
  - startScreencast: Proxy CDP screencast via WebSocket (persistent via connectNative)
"""

import json
import os
import struct
import sys
import socket
import base64
import threading
import logging

LOG_FILE = os.path.expanduser("~/ysh-screencast-debug.log")
logging.basicConfig(filename=LOG_FILE, level=logging.DEBUG,
                    format="%(asctime)s %(levelname)s %(message)s")


# ===== Native Messaging Protocol =====

def read_message():
    raw = sys.stdin.buffer.read(4)
    if not raw or len(raw) < 4:
        return None
    length = struct.unpack("I", raw)[0]
    if length > 1024 * 1024:
        return None
    return json.loads(sys.stdin.buffer.read(length))


def send_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


# ===== Action Handlers =====

def handle_get_token():
    config_path = os.path.expanduser("~/.openclaw/openclaw.json")
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    gw = config.get("gateway", {})
    auth = gw.get("auth", {})
    port = gw.get("port", 18789)
    send_message(
        {
            "ok": True,
            "token": auth.get("token", ""),
            "port": port,
            "url": f"ws://127.0.0.1:{port}",
        }
    )


def handle_cdp_targets(msg):
    """Fetch CDP /json endpoint via http.client (IPv4 explicit)."""
    import http.client
    from urllib.parse import urlparse

    url = msg.get("url", "http://127.0.0.1:18800/json")
    parsed = urlparse(url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 18800
    path = parsed.path or "/json"

    conn = http.client.HTTPConnection(host, port, timeout=5)
    conn.request("GET", path, headers={"Accept": "application/json"})
    resp = conn.getresponse()
    targets = json.loads(resp.read())
    conn.close()
    send_message({"ok": True, "targets": targets})


# ===== Minimal WebSocket Client (stdlib only) =====

def _recv_exact(sock, n):
    """Read exactly n bytes from socket."""
    buf = bytearray()
    while len(buf) < n:
        chunk = sock.recv(min(n - len(buf), 65536))
        if not chunk:
            raise ConnectionError("connection closed")
        buf.extend(chunk)
    return bytes(buf)


def ws_connect(host, port, path):
    """Perform WebSocket handshake, return connected socket."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((host, port))
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n"
        f"\r\n"
    )
    s.sendall(req.encode())
    resp = b""
    while b"\r\n\r\n" not in resp:
        resp += s.recv(4096)
    status_line = resp.split(b"\r\n")[0]
    if b"101" not in status_line:
        raise Exception(f"WebSocket handshake failed: {status_line.decode()}")
    return s


def ws_send_text(sock, text):
    """Send a masked text WebSocket frame."""
    payload = text.encode("utf-8")
    frame = bytearray()
    frame.append(0x81)  # FIN + text opcode
    mask = os.urandom(4)
    length = len(payload)
    if length < 126:
        frame.append(0x80 | length)
    elif length < 65536:
        frame.append(0x80 | 126)
        frame.extend(struct.pack(">H", length))
    else:
        frame.append(0x80 | 127)
        frame.extend(struct.pack(">Q", length))
    frame.extend(mask)
    frame.extend(bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
    sock.sendall(frame)


def ws_recv_frame(sock):
    """Receive one WebSocket frame. Returns (opcode, payload_bytes)."""
    header = _recv_exact(sock, 2)
    opcode = header[0] & 0x0F
    masked = bool(header[1] & 0x80)
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack(">H", _recv_exact(sock, 2))[0]
    elif length == 127:
        length = struct.unpack(">Q", _recv_exact(sock, 8))[0]
    mask_key = _recv_exact(sock, 4) if masked else None
    payload = _recv_exact(sock, length)
    if mask_key:
        payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))
    return opcode, payload


# ===== CDP Screencast Proxy (persistent mode) =====

def handle_screencast(msg):
    """Connect to CDP WebSocket, proxy screencast frames back to extension."""
    from urllib.parse import urlparse

    ws_url = msg.get("wsUrl", "")
    parsed = urlparse(ws_url)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 18800
    path = parsed.path or "/"

    logging.info(f"Connecting to CDP: {host}:{port}{path}")
    try:
        sock = ws_connect(host, port, path)
        logging.info("WebSocket connected")
    except Exception as e:
        logging.error(f"WebSocket connect failed: {e}")
        send_message({"type": "error", "error": f"CDP连接失败: {e}"})
        return

    # Start screencast
    cmd_id = 1
    ws_send_text(
        sock,
        json.dumps(
            {
                "id": cmd_id,
                "method": "Page.startScreencast",
                "params": {
                    "format": "jpeg",
                    "quality": 60,
                    "maxWidth": 800,
                    "maxHeight": 600,
                    "everyNthFrame": 2,
                },
            }
        ),
    )

    send_message({"type": "status", "status": "streaming", "message": "实时画面传输中"})
    logging.info("Screencast started, entering frame loop")

    # Background thread: read stdin for stop commands
    stop_event = threading.Event()

    def stdin_reader():
        while not stop_event.is_set():
            try:
                m = read_message()
                if m is None or m.get("action") == "stopScreencast":
                    stop_event.set()
                    break
            except Exception:
                stop_event.set()
                break

    t = threading.Thread(target=stdin_reader, daemon=True)
    t.start()

    # Main loop: receive CDP frames and forward to extension
    try:
        while not stop_event.is_set():
            sock.settimeout(1.0)
            try:
                opcode, payload = ws_recv_frame(sock)
            except socket.timeout:
                continue
            except Exception:
                break

            if opcode == 0x01:  # text frame
                data = json.loads(payload)
                method = data.get("method", "")
                if method == "Page.screencastFrame":
                    params = data["params"]
                    frame_data = params["data"]
                    logging.debug(f"Frame received, base64 length={len(frame_data)}")
                    # Ack frame to keep receiving
                    cmd_id += 1
                    ws_send_text(
                        sock,
                        json.dumps(
                            {
                                "id": cmd_id,
                                "method": "Page.screencastFrameAck",
                                "params": {"sessionId": params["sessionId"]},
                            }
                        ),
                    )
                    # Forward to extension
                    send_message(
                        {"type": "frame", "data": frame_data}
                    )
                    logging.debug("Frame forwarded to extension")
                else:
                    logging.debug(f"CDP message: {method or data.get('id','?')}")
            elif opcode == 0x08:  # close
                logging.info("WebSocket close frame received")
                break
    except Exception as loop_err:
        logging.error(f"Frame loop error: {loop_err}")
    finally:
        try:
            cmd_id += 1
            ws_send_text(
                sock,
                json.dumps(
                    {"id": cmd_id, "method": "Page.stopScreencast", "params": {}}
                ),
            )
            sock.close()
        except Exception:
            pass
        send_message(
            {"type": "status", "status": "disconnected", "message": "实时画面已断开"}
        )


# ===== Main =====

def main():
    msg = read_message()
    if not msg:
        return

    action = msg.get("action", "getToken")
    logging.info(f"Received action: {action}")
    try:
        if action == "startScreencast":
            handle_screencast(msg)  # persistent mode — does not return until stopped
        elif action == "getCdpTargets":
            handle_cdp_targets(msg)
        else:
            handle_get_token()
    except Exception as e:
        send_message({"ok": False, "error": str(e)})


if __name__ == "__main__":
    main()
