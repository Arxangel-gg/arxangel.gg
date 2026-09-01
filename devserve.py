"""Local dev server for the ARXANGEL site with caching DISABLED.
Serves ./site so edits to JS/CSS modules are always picked up on reload.
(Production is GitHub Pages, which ignores _headers — cache-busting there is the
?v= token bumped by tools/arx.py. This server is dev only.)"""
import functools
import http.server
import socketserver

PORT = 8124


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory="site")

with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"ARXANGEL dev server (no-cache) on http://127.0.0.1:{PORT}")
    httpd.serve_forever()
