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

  wss.on('connection', async(socket, req) => {
    if(wsArcjet){
      try {
        const decision = await wsArcjet.protect(req)
        if(decision.isDenied()){
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit() ? 'Rate limit exceeded' : 'Access denied';
          socket.close(code, reason);
          return;
        }
      }catch(err){
        console.error('Error during wsArcjet handshake:', err);
        socket.close(1011, 'Server security error');
        return
      }
    }
    
    socket.isAlive = true;
    socket.on('pong', () => {socket.isAlive = true})

    sendJson(socket, {type: 'welcome'})
    socket.on('error', console.error)
  })

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
