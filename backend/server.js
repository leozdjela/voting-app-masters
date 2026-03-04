import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { ethers } from "ethers";
import { keccak256, toUtf8Bytes } from "ethers";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SERVER_SECRET = process.env.SERVER_SECRET;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

if (!GOOGLE_CLIENT_ID) throw new Error("Missing GOOGLE_CLIENT_ID in backend/.env");
if (!SERVER_SECRET) throw new Error("Missing SERVER_SECRET in backend/.env");
if (!SEPOLIA_RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL in backend/.env");
if (!RELAYER_PRIVATE_KEY) throw new Error("Missing RELAYER_PRIVATE_KEY in backend/.env");

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// učitaj ABI iz hardhat artifacts (root projekta)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactPath = path.join(__dirname, "abi", "Voting.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const ABI = artifact.abi;

const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

function isAddressLike(a) {
  return typeof a === "string" && a.startsWith("0x") && a.length === 42;
}

// --- helper: verify token + return sub
async function getGoogleSub(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const sub = payload?.sub;
  if (!sub) throw new Error("No sub in token");
  return sub;
}

// --- helper: nullifier vezan uz ugovor (1 glas po Google accountu po ugovoru)
function computeNullifier(sub, contractAddress) {
  const material = `${sub}|${contractAddress.toLowerCase()}|${SERVER_SECRET}`;
  return keccak256(toUtf8Bytes(material));
}

// Health/status (korisno za debug)
app.get("/status", async (_req, res) => {
  try {
    const net = await provider.getNetwork();
    const bal = await provider.getBalance(relayerWallet.address);
    res.json({
      ok: true,
      chainId: net.chainId.toString(),
      relayer: relayerWallet.address,
      relayerBalanceEth: ethers.formatEther(bal),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// POST /auth/nullifier (opcionalno - za UI provjeru "already voted")
// body: { idToken, contractAddress }
app.post("/auth/nullifier", async (req, res) => {
  try {
    const { idToken, contractAddress } = req.body || {};

    if (!idToken) return res.status(400).json({ error: "Missing idToken" });
    if (!contractAddress) return res.status(400).json({ error: "Missing contractAddress" });
    if (!isAddressLike(contractAddress)) return res.status(400).json({ error: "Bad contractAddress" });

    const sub = await getGoogleSub(idToken);
    const nullifier = computeNullifier(sub, contractAddress);

    res.json({ nullifier });
  } catch (e) {
    console.error("auth/nullifier error:", e);
    res.status(401).json({ error: "Invalid Google ID token" });
  }
});

// ✅ GASLESS VOTE
// POST /vote
// body: { idToken, contractAddress, optionIndex }
app.post("/vote", async (req, res) => {
  try {
    const { idToken, contractAddress, optionIndex } = req.body || {};

    if (!idToken) return res.status(400).json({ error: "Missing idToken" });
    if (!contractAddress) return res.status(400).json({ error: "Missing contractAddress" });
    if (!isAddressLike(contractAddress)) return res.status(400).json({ error: "Bad contractAddress" });

    const idx = Number(optionIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ error: "Bad optionIndex" });
    }

    // verify google token
    const sub = await getGoogleSub(idToken);

    // compute nullifier
    const nullifier = computeNullifier(sub, contractAddress);

    // contract instance (relayer signs tx)
    const contract = new ethers.Contract(contractAddress, ABI, relayerWallet);

    // (optional) pre-check on-chain da štedimo gas
    const used = await contract.usedNullifiers(nullifier);
    if (used) {
      return res.status(409).json({ error: "Already voted", nullifier });
    }

    // send vote tx
    const tx = await contract.vote(idx, nullifier);

    // možeš odlučiti čekati 1 confirm ili ne; ovdje čekamo 1 confirm radi boljeg UX-a
    const receipt = await tx.wait(1);

    return res.json({
      ok: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      nullifier,
    });
  } catch (e) {
    console.error("vote error:", e);

    const msg = e?.shortMessage || e?.message || String(e);

    // ako ugovor revert-a s Already voted ili Bad option index
    if (msg.toLowerCase().includes("already voted")) {
      return res.status(409).json({ error: "Already voted" });
    }
    if (msg.toLowerCase().includes("bad option index")) {
      return res.status(400).json({ error: "Bad option index" });
    }

    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Relayer address: ${relayerWallet.address}`);
});