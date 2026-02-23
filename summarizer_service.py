"""
Local Abstract Summarizer Service for PaperQA Token Reduction.
Uses Falconsai/text_summarization (~250MB) to compress paper abstracts.
Start: python summarizer_service.py
Health: GET http://localhost:8020/health
"""

import sys
import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

# Lazy-load model on first request
_summarizer = None

def get_summarizer():
    global _summarizer
    if _summarizer is None:
        print("Loading summarization model (Falconsai/text_summarization)...")
        start = time.time()
        from transformers import pipeline
        _summarizer = pipeline("summarization", model="Falconsai/text_summarization", device=-1)
        print(f"Model loaded in {time.time() - start:.1f}s")
    return _summarizer

class SummarizerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            status = {"status": "ok", "model": "Falconsai/text_summarization", "port": 8020}
            if _summarizer is not None:
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
        if self.path == '/summarize':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                texts = data.get('texts', [])
                max_length = data.get('max_length', 80)
                min_length = data.get('min_length', 20)

                if not texts:
                    self._send_json(400, {"error": "No texts provided"})
                    return

                summarizer = get_summarizer()
                summaries = []

                for text in texts:
                    if not text or len(text.strip()) < 50:
                        # Too short to summarize
                        summaries.append(text or "")
                        continue
                    try:
                        # Truncate very long inputs (model max is 1024 tokens)
                        truncated = text[:2000]
                        result = summarizer(truncated, max_length=max_length, min_length=min_length, do_sample=False)
                        summaries.append(result[0]['summary_text'])
                    except Exception as e:
                        print(f"Summarization error for text ({len(text)} chars): {e}")
                        summaries.append(text)  # Fallback to original

                self._send_json(200, {
                    "summaries": summaries,
                    "count": len(summaries),
                    "model": "Falconsai/text_summarization"
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
        print(f"[Summarizer] {args[0]}")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8020
    server = HTTPServer(('0.0.0.0', port), SummarizerHandler)
    print(f"Summarizer service starting on port {port}...")
    print(f"Health: http://localhost:{port}/health")
    print(f"Model will be loaded on first /summarize request")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()
