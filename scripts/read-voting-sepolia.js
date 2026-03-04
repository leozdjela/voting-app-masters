import dotenv from "dotenv";
dotenv.config({ override: true });

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC = process.env.SEPOLIA_RPC_URL;
const ADDR = "0x81B71696ab9aDd9268E31c9C2Aa797FFa28E4F31";

// učitaj artifact ručno (bez import assert)
const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "Voting.sol", "Voting.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

async function main() {
  if (!RPC) throw new Error("Missing SEPOLIA_RPC_URL in .env");

  const provider = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(ADDR, artifact.abi, provider);

  const q = await c.question();
  const n = await c.optionsCount();

  console.log("Contract:", ADDR);
  console.log("Question:", q);
  console.log("OptionsCount:", n.toString());

  for (let i = 0; i < Number(n); i++) {
    const opt = await c.optionAt(i);
    const cnt = await c.countAt(i);
    console.log(`- [${i}] ${opt}: ${cnt.toString()}`);
  }
}

main().catch((e) => {
  console.error("READ FAILED:", e);
  process.exit(1);
});