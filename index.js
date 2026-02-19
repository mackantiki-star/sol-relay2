import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

/* ======================================
   SOL PRICE CACHE (30 MINUTES)
====================================== */

let solPriceSEK = null;
let solPriceTimestamp = 0;
const SOL_PRICE_CACHE_TIME = 30 * 60 * 1000; // 30 minutes

async function getSolPriceSEK() {
  const now = Date.now();

  if (solPriceSEK && now - solPriceTimestamp < SOL_PRICE_CACHE_TIME) {
    return solPriceSEK;
  }

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=sek"
  );

  if (!res.ok) {
    throw new Error("CoinGecko HTTP error");
  }

  const data = await res.json();

  if (!data.solana || !data.solana.sek) {
    throw new Error("Invalid CoinGecko response");
  }

  solPriceSEK = data.solana.sek;
  solPriceTimestamp = now;

  console.log("Updated SOL price (SEK):", solPriceSEK);

  return solPriceSEK;
}

/* ======================================
   HELIUS BALANCE
====================================== */

async function getSolBalance(address) {
  const rpcRes = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=462a99cb-e2d8-4b31-bdec-b621c47db906`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [address],
      }),
    }
  );

  if (!rpcRes.ok) {
    throw new Error("Helius HTTP error");
  }

  const rpcData = await rpcRes.json();

  if (!rpcData.result) {
    throw new Error("Invalid RPC response");
  }

  const lamports = rpcData.result.value;
  return lamports / 1_000_000_000;
}

/* ======================================
   WALLET ENDPOINT
====================================== */

app.get("/wallet/:address", async (req, res) => {
  try {
    const address = req.params.address;

    const [balanceSol, solPriceSEK] = await Promise.all([
      getSolBalance(address),
      getSolPriceSEK(),
    ]);

    const balanceSek = balanceSol * solPriceSEK;

    res.json({
      balanceSol,
      balanceSek,
      status: "ok",
    });
  } catch (err) {
    console.error("Relay error:", err);

    res.json({
      status: "degraded",
      error: "Relay fetch failed",
    });
  }
});

/* ======================================
   HEALTH CHECK
====================================== */

app.get("/", (req, res) => {
  res.send("SOL Relay running");
});

app.listen(PORT, () => {
  console.log("Relay running on port", PORT);
});
