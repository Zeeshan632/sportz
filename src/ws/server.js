import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map()

function subscribe(matchId, socket){
  if(!matchSubscribers.has(matchId)){
    matchSubscribers.set(matchId, new Set())
  }

  matchSubscribers.get(matchId).add(socket)
}

function unsubscribe(matchId, socket){
  const subscribers = matchSubscribers.get(matchId)

  if(!subscribers) return;

  subscribers.delete(socket)
  
  if(subscribers.size === 0){
    matchSubscribers.delete(matchId)
  }
}

function cleanupSubscriptions(socket){
  for(const matchId of socket.subscriptions){
    unsubscribe(matchId, socket)
  }
}

function broadcastToMatch(matchId, payload){
  const subscribers = matchSubscribers.get(matchId)
  if(!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload)

  for(const client of subscribers){
    if(client.readyState === WebSocket.OPEN){
      client.send(message)
    }
  }
}

function handleMessage(socket, data){
  let message;

  try {
    message = JSON.parse(data.toString())
  }catch{
    sendJson(socket, {type: 'error', message: 'Invalid JSON'})
    return
  }

  if(message?.type === 'subscribe' && Number.isInteger(message.matchId)){
    subscribe(message.matchId, socket)
    socket.subscriptions.add(message.matchId)
    sendJson(socket, {type: 'subscribed', matchId: message.matchId})
    return
  }

  if(message?.type === 'unsubscribe' && Number.isInteger(message.matchId)){
    unsubscribe(message.matchId, socket)
    socket.subscriptions.delete(message.matchId)
    sendJson(socket, {type: 'unsubscribed', matchId: message.matchId})
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (let client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

// this functin will receive the http server instant created by express and we are passing it into the websocket so that it can attach itself to the same underlying server . The http server will then listen on that port and handle normal web requests while the websocket will use the same server to handle the upgraded requests
export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/ws',
    maxPayload: 1024 * 1024
  });
  // Validate upgrade requests before WebSocket handshake
  server.on('upgrade', async (req, socket, head) => {
    try {
      const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
      if (pathname !== '/ws') {
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

    socket.subscriptions = new Set();
    
    sendJson(socket, {type: 'welcome'});

    socket.on('message', (data) => {
      handleMessage(socket, data)
    })
    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      socket.terminate();
    });

    socket.on('close', () => {
      cleanupSubscriptions(socket)
    })
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
    broadcastToAll(wss, {type: 'match_created', data: match})
  }

  function broadcastCommentary(matchId, comment){
    broadcastToMatch(matchId, {type: 'commentary', data: comment})
  }

  return {broadcastMatchCreated, broadcastCommentary}
}
