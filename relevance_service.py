"""
Local Relevance Ranking Service for PaperQA Token Reduction.
Uses cross-encoder/ms-marco-MiniLM-L-6-v2 (~80MB) to rank papers by relevance.
Start: python relevance_service.py
Health: GET http://localhost:8021/health
"""

import sys
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Lazy-load model on first request
_ranker = None

def get_ranker():
    global _ranker
    if _ranker is None:
        print("Loading ranking model (cross-encoder/ms-marco-MiniLM-L-6-v2)...")
        start = time.time()
        from sentence_transformers import CrossEncoder
        _ranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)
        print(f"Model loaded in {time.time() - start:.1f}s")
    return _ranker

class RankerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            status = {"status": "ok", "model": "cross-encoder/ms-marco-MiniLM-L-6-v2", "port": 8021}
            if _ranker is not None:
                status["model_loaded"] = True
            else:
                status["model_loaded"] = False
                status["note"] = "Model will load on first request"
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(status).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/rank':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 10 * 1024 * 1024:  # 10 MB limit
                self._send_json(413, {"error": "Request body too large"})
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                query = data.get('query', '')
                documents = data.get('documents', [])

                if not query or not documents:
                    self._send_json(400, {"error": "query and documents required"})
                    return

                # Limit documents to prevent memory exhaustion
                documents = documents[:500]
                documents = [doc[:2000] for doc in documents]

                ranker = get_ranker()

                # Create query-document pairs for cross-encoder
                pairs = [[query, doc] for doc in documents]
                scores = ranker.predict(pairs)

                # Build ranked results sorted by score descending
                rankings = sorted(
                    [{"index": i, "score": float(scores[i])} for i in range(len(scores))],
                    key=lambda x: x["score"],
                    reverse=True
                )

                self._send_json(200, {
                    "rankings": rankings,
                    "count": len(rankings),
                    "model": "cross-encoder/ms-marco-MiniLM-L-6-v2"
                })

            except json.JSONDecodeError:
                self._send_json(400, {"error": "Invalid JSON"})
            except Exception as e:
                self._send_json(500, {"error": str(e)})
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _send_json(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[Ranker] {format % args}" if args else f"[Ranker] {format}")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8021
    server = HTTPServer(('0.0.0.0', port), RankerHandler)
    print(f"Relevance ranking service starting on port {port}...")
    print(f"Health: http://localhost:{port}/health")
    print(f"Model will be loaded on first /rank request")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()
