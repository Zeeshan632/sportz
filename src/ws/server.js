import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (let client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

// this functin will receive the http server instant created by express and we are passing it into the websocket so that it can attach itself to the same underlying server . The http server will then listen on that port and handle normal web requests while the websocket will use the same server to handle the upgraded requests
export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024 * 1024
  });
  // Validate upgrade requests before WebSocket handshake
  server.on('upgrade', async (req, socket, head) => {
    try {
      if (req.url !== '/ws') {
        socket.destroy();
        return;
      }

      if (wsArcjet) {
        try {
          const decision = await wsArcjet.protect(req);
          if (decision.isDenied()) {
            const isRate = decision.reason && typeof decision.reason.isRateLimit === 'function' && decision.reason.isRateLimit();
            const status = isRate ? 429 : 403;
            const phrase = isRate ? 'Too Many Requests' : 'Forbidden';
            const body = isRate ? 'Rate limit exceeded' : 'Access denied';
            const res = `HTTP/1.1 ${status} ${phrase}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`;
            socket.write(res);
            socket.destroy();
            return;
          }
        } catch (err) {
          console.error('Error during wsArcjet pre-handshake:', err);
          try {
            const body = 'Server security error';
            const res = `HTTP/1.1 500 Internal Server Error\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`;
            socket.write(res);
          } catch (e) {
            // ignore
          }
          socket.destroy();
          return;
        }
      }

      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } catch (err) {
      console.error('Unexpected error in upgrade handler:', err);
      try { socket.destroy(); } catch (e) {}
    }
  });

  wss.on('connection', (socket, req) => {
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true });

    sendJson(socket, {type: 'welcome'});
    socket.on('error', console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((socket) => {
      if(socket.isAlive === false) return socket.terminate();
      socket.isAlive = false;
      socket.ping()
    })
  }, 30000)

  wss.on('close', () => {clearInterval(interval)})
  
  function broadcastMatchCreated(match){
    broadcast(wss, {type: 'match_created', data: match})
  }

  return {broadcastMatchCreated}
}
