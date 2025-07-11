import express from "express";
import cors from "cors";
import fs from "fs";
import { ethers } from "ethers";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const DB_FILE = "./staking.json";

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/:action", async (req, res) => {
  const { address, tokenId, timestamp, signature } = req.body;
  const { action } = req.params;

  const message = `${action}:${tokenId}:${timestamp}`;
  const recovered = ethers.verifyMessage(message, signature);

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return res.status(400).json({ error: "Invalid signature" });
  }

  const db = loadDB();
  db[tokenId] = db[tokenId] || { xp: 0 };

  if (action === "stake") {
    db[tokenId].stakedAt = timestamp;
  } else if (action === "unstake") {
    if (db[tokenId].stakedAt) {
      const hours = Math.floor((timestamp - db[tokenId].stakedAt) / (1000 * 60 * 60));
      db[tokenId].xp += hours;
      delete db[tokenId].stakedAt;
    }
  }

  saveDB(db);
  res.json({ success: true });
});

app.get("/api/xp/:tokenId", (req, res) => {
  const db = loadDB();
  const token = db[req.params.tokenId];
  if (!token) {
    return res.json({ xp: 0 });
  }
  let xp = token.xp || 0;
  if (token.stakedAt) {
    const hours = Math.floor((Date.now() - token.stakedAt) / (1000 * 60 * 60));
    xp += hours;
  }
  res.json({ xp });
});

app.listen(4000, () => {
  console.log("API running on http://localhost:4000");
});
