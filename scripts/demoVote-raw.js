import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, Contract, ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = "http://127.0.0.1:8545";
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// adresa koju si dobio iz deploya
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const artifactPath = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "Voting.sol",
  "Voting.json"
);

async function main() {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi } = artifact;

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const voting = new Contract(CONTRACT_ADDRESS, abi, wallet);

  // 1) početno stanje
  const before0 = await voting.countAt(0);
  const before1 = await voting.countAt(1);
  console.log("Before vote:", Number(before0), Number(before1));

  // 2) generiranje "test nullifiera" (simulacija backenda)
  const nullifierA = ethers.keccak256(ethers.toUtf8Bytes("userA|poll1|secret"));

  // 3) prvi glas - treba proći
  console.log("Casting first vote...");
  const tx = await voting.vote(0, nullifierA);
  await tx.wait();

  const after0 = await voting.countAt(0);
  const after1 = await voting.countAt(1);
  console.log("After 1st vote:", Number(after0), Number(after1));

  // 4) drugi glas s istim nullifierom - mora failati
  console.log("Casting second vote with same nullifier (should fail)...");
  try {
    const tx2 = await voting.vote(1, nullifierA);
    await tx2.wait();
    console.log("ERROR: second vote unexpectedly succeeded");
  } catch (e) {
    console.log("Second vote failed as expected (Already voted).");
  }

  const final0 = await voting.countAt(0);
  const final1 = await voting.countAt(1);
  console.log("Final:", Number(final0), Number(final1));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});