import http.server, socketserver, os

PORT = 52594
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        # serve files from current dir (web)
        root = os.path.dirname(__file__)
        path = path.lstrip('/')
        full = os.path.join(root, path)
        if os.path.isdir(full):
            full = os.path.join(full, 'index.html')
        return full

if __name__ == '__main__':
    os.chdir(os.path.dirname(__file__))
    with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
        print(f"Serving at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.server_close()
