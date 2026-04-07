import http.server
import json
import os
from urllib.parse import urlparse

DATA_FILE = "stored_credentials.json"
PORT = 5000

# Ensure data file exists
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)


def load_data():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


class CredentialRequestHandler(http.server.BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, indent=4).encode("utf-8")
        self._set_headers(status=status, content_type="application/json")
        self.wfile.write(body)

    def _send_html(self, html):
        body = html.encode("utf-8")
        self._set_headers(status=200, content_type="text/html; charset=utf-8")
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            data = load_data()
            html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta http-equiv="refresh" content="5">
                <title>Credential Storage</title>
                <style>
                    body {{ font-family: Arial, sans-serif; background: #f4f4f9; margin: 0; padding: 0; }}
                    .container {{ max-width: 900px; margin: 24px auto; padding: 20px; background: #fff; border-radius: 10px; box-shadow: 0 2px 14px rgba(0,0,0,0.08); }}
                    h1 {{ margin-top: 0; }}
                    .item {{ margin: 12px 0; padding: 14px; border-radius: 8px; background: #fafafa; border: 1px solid #e0e0e5; }}
                    .item pre {{ margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: Consolas, monospace; }}
                    .meta {{ color: #555; margin-bottom: 12px; }}
                    .empty {{ color: #777; margin: 16px 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Stored Credentials</h1>
                    <div class="meta">Entries: {len(data)} | Auto-refreshes every 5 seconds</div>
                    <p>Send JSON to <code>/api/credentials</code> to store new items.</p>
                    {self._render_items(data)}
                </div>
            </body>
            </html>
            """
            self._send_html(html)
        elif parsed.path == "/data" or parsed.path == "/api/credentials":
            data = load_data()
            self._send_json(data)
        elif parsed.path == "/api/health":
            stored = load_data()
            self._send_json({"status": "ok", "entries": len(stored)})
        else:
            self.send_error(404, "Not Found")

    def _render_items(self, data):
        if not data:
            return '<div class="empty">No data received yet. Send a POST to <code>/receive</code>.</div>'

        items_html = []
        for item in data:
            json_text = json.dumps(item, indent=2)
            items_html.append(f"<div class=\"item\"><pre>{json_text}</pre></div>")
        return "\n".join(items_html)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("/receive", "/api/credentials"):
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length)

        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_json({"error": "Invalid JSON"}, status=400)
            return

        if not payload or not isinstance(payload, dict):
            self._send_json({"error": "No JSON object provided"}, status=400)
            return

        stored = load_data()
        stored.append(payload)
        save_data(stored)

        self._send_json({"message": "Data stored successfully", "route": parsed.path}, status=200)

    def log_message(self, format, *args):
        return


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), CredentialRequestHandler)
    print(f"Serving on http://0.0.0.0:{PORT}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        print("Server stopped.")
