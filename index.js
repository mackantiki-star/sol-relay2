const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 10000;

// Get SOL price in SEK
async function getSolPriceSEK() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=sek"
  );
  const data = await res.json();
  return data.solana.sek;
}

// Get SOL balance from Solana RPC
async function getSolBalance(address) {
  const rpcRes = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address]
    })
  });

  const rpcData = await rpcRes.json();

  if (!rpcData.result) return 0;

  const lamports = rpcData.result.value;
  return lamports / 1000000000; // Convert to SOL
}

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
    res.json({
      status: "degraded",
      error: "Relay fetch failed"
    });
  }
});

app.listen(PORT, () => {
  console.log("Relay running on port " + PORT);
});
