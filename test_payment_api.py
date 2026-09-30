import json
import urllib.request

payload = {
    "listId": "LIST-1042",
    "customerName": "Mr. Larsen",
    "status": "COMPLETED",
    "items": [
        {"itemId": "A1", "status": "collected"}
    ]
}

request = urllib.request.Request(
    'http://localhost:3001/api/collections',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)

with urllib.request.urlopen(request, timeout=10) as response:
    print(response.read().decode('utf-8'))
