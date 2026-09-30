import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 3001
HOST = '0.0.0.0'


class PaymentApiHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            payload = {'status': 'ok', 'service': 'mock-payment-api'}
            self.send_response(200)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode('utf-8'))
            return

        self.send_response(404)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))

    def do_POST(self):
        if self.path != '/api/collections':
            self.send_response(404)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode('utf-8')) if raw else {}
        except Exception as exc:
            self.send_response(400)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'accepted': False, 'error': 'Invalid JSON payload', 'details': str(exc)}).encode('utf-8'))
            return

        payment_id = f"PAY-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
        response_body = {
            'accepted': True,
            'paymentId': payment_id,
            'status': 'ACCEPTED',
            'listId': payload.get('listId'),
            'customerName': payload.get('customerName'),
            'receivedAt': datetime.now(timezone.utc).isoformat(),
            'message': 'Collection accepted for payment processing'
        }

        self.send_response(202)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response_body).encode('utf-8'))


if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), PaymentApiHandler)
    print(f'Mock payment API listening on http://localhost:{PORT}')
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        while True:
            pass
    except KeyboardInterrupt:
        print('Stopping server...')
        server.shutdown()
        server.server_close()
