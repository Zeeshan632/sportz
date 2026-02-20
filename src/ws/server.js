import { WebSocket, WebSocketServer } from "ws";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (let client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) return;
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

  wss.on('connection', (socket) => {
    sendJson(socket, {type: 'welcome'})

    socket.on('error', console.error)
  })

  function broadcastMatchCreated(match){
    broadcast(wss, {type: 'match_created', data: match})
  }

  return {broadcastMatchCreated}
}
