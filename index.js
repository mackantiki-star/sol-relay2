import express from "express";
import fetch from "node-fetch";
import { WebSocketServer } from "ws";

const app = express();
const PORT = process.env.PORT || 3000;

const walletCache = new Map();

async function fetchWallet(address) {
  try {
    // Dummy data until you wire real RPC
    const data = {
      balanceSol: 12.34,
      balanceSek: 12345,
      pnlTodaySek: 234,
      tradeCountToday: 167,
      status: "ok"
    };

    walletCache.set(address, data);
    return data;
  } catch {
    return walletCache.get(address) || { status: "degraded" };
  }
}

app.get("/wallet/:address", async (req, res) => {
  const data = await fetchWallet(req.params.address);
  res.json(data);
});

const server = app.listen(PORT, () =>
  console.log("Relay running on", PORT)
);

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  ws.on("message", async msg => {
    const { wallet } = JSON.parse(msg);

    const send = async () => {
      const data = await fetchWallet(wallet);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    send();
    const interval = setInterval(send, 5000);

    ws.on("close", () => clearInterval(interval));
  });
});
