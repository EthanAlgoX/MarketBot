import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:19001');

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    ws.send(JSON.stringify({
      type: 'req',
      id: 'connect-1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'gateway-client', version: 'dev', platform: 'node', mode: 'ui' },
        role: 'operator',
        scopes: ['operator.admin'],
        auth: { token: 'test-token' }
      }
    }));
  }
});

ws.on('close', (code, reason) => {
  console.log('CLOSE', code, reason.toString());
});

ws.on('error', (err) => {
  console.error('ERROR', err);
});

setTimeout(() => {
  console.log('DONE');
  ws.close();
}, 5000);
