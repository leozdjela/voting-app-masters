import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local hardhat node
const RPC_URL = "http://127.0.0.1:8545";

// Private key from `npx hardhat node` (Account #0)
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Your deployed contract address
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Backend endpoint
const BACKEND_URL = "http://localhost:3001/auth/nullifier";

// Hardhat artifact
const artifactPath = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "Voting.sol",
  "Voting.json"
);

async function getNullifier(devUser, pollId) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ devUser, pollId }),
  });

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);

  const data = await res.json();
  return data.nullifier;
}

async function main() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi } = artifact;

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const voting = new Contract(CONTRACT_ADDRESS, abi, wallet);

  const devUser = "userA";
  const pollId = "poll2"; // promijeni na poll2 da ne naletiš na Already voted

  const nullifier = await getNullifier(devUser, pollId);
  console.log("Nullifier from backend:", nullifier);

  console.log("Before:", Number(await voting.countAt(0)), Number(await voting.countAt(1)));

  const tx = await voting.vote(0, nullifier);
  await tx.wait();

  console.log("After:", Number(await voting.countAt(0)), Number(await voting.countAt(1)));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});