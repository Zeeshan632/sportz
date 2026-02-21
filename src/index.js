import http from "http";
import express from "express";
import { matchesRouter } from "./routes/matches.js";
import { attachWebsocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(securityMiddleware());

app.get("/", (req, res) => {
  res.json({ message: "Hello — Express server is running." });
});

app.use("/matches", matchesRouter);

const { broadcastMatchCreated } = attachWebsocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server running on ${baseUrl}`);
  console.log(`Websocket running on ${baseUrl.replace("http", "ws")}/ws`);
});
