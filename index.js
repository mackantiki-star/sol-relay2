import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

/* ---------------------------
   SOL Price Cache (10 minutes)
----------------------------*/

let cachedPrice = null;
let lastPriceFetch = 0;

async function getSolPriceSEK() {
  const now = Date.now();

  // 10 minutes = 600000 ms
  if (cachedPrice && now - lastPriceFetch < 600000) {
    return cachedPrice;
  }

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=sek"
  );

  if (!res.ok) {
    throw new Error("CoinGecko HTTP error");
  }

  const data = await res.json();

  if (!data.solana || !data.solana.sek) {
    throw new Error("CoinGecko rate limited or invalid response");
  }

  cachedPrice = data.solana.sek;
  lastPriceFetch = now;

  return cachedPrice;
}

/* ---------------------------
   Get SOL balance from Helius RPC
----------------------------*/

async function getSolBalance(address) {
  const rpcRes = await fetch(
    "https://mainnet.helius-rpc.com/?api-key=462a99cb-e2d8-4b31-bdec-b621c47db906",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address]
      })
    }
  );

  if (!rpcRes.ok) {
    throw new Error("Helius HTTP error");
  }

  const rpcData = await rpcRes.json();

  if (rpcData.error) {
    throw new Error(
      "Helius RPC error: " + JSON.stringify(rpcData.error)
    );
  }

  if (!rpcData.result) {
    throw new Error("No result from RPC");
  }

  const lamports = rpcData.result.value;
  return lamports / 1000000000;
}

/* ---------------------------
   Wallet Endpoint
----------------------------*/

app.get("/wallet/:address", async (req, res) => {
  try {
    const address = req.params.address;

    const [balanceSol, solPriceSek] = await Promise.all([
      getSolBalance(address),
      getSolPriceSEK()
    ]);

    const balanceSek = balanceSol * solPriceSek;

    res.json({
      balanceSol,
      balanceSek,
      status: "ok"
    });
  } catch (err) {
    console.error("Relay error:", err);

    res.json({
      status: "degraded",
      error: "Relay fetch failed"
    });
  }
});

/* ---------------------------
   Root Health Check
----------------------------*/

app.get("/", (req, res) => {
  res.send("SOL Relay running");
});

app.listen(PORT, () => {
  console.log("Relay running on port", PORT);
});
