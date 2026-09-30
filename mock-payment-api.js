const http = require('http');

const PORT = 3001;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.url === '/api/collections' && req.method === 'POST') {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const paymentId = `PAY-${Date.now()}`;

        console.log('Received payment payload:', payload.listId);

        sendJson(res, 202, {
          accepted: true,
          paymentId,
          status: 'ACCEPTED',
          listId: payload.listId,
          message: 'Collection accepted for payment processing',
          receivedAt: new Date().toISOString()
        });
      } catch (error) {
        sendJson(res, 400, {
          accepted: false,
          error: 'Invalid JSON payload',
          details: error.message
        });
      }
    });

    return;
  }

  if (req.url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', service: 'mock-payment-api' });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Mock payment API listening on http://localhost:${PORT}`);
});
