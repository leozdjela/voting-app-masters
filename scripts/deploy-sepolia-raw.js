dotenv.config({ path: new URL("../.env", import.meta.url) });
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// root .env je 1 level iznad scripts/
dotenv.config({ path: path.join(__dirname, "..", ".env") });

console.log("RPC FROM ENV:", process.env.SEPOLIA_RPC_URL);

async function main() {
  const RPC = process.env.SEPOLIA_RPC_URL;
  const PK = process.env.DEPLOYER_PRIVATE_KEY;

  if (!RPC) throw new Error("Missing SEPOLIA_RPC_URL in .env");
  if (!PK) throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env");

  // učitaj artifact ručno (bez import assert)
  const artifactPath = new URL("../artifacts/contracts/Voting.sol/Voting.json", import.meta.url);
  const artifactRaw = fs.readFileSync(artifactPath, "utf8");
  const artifact = JSON.parse(artifactRaw);

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PK, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log("Deployer:", wallet.address);
  console.log("Balance (ETH):", ethers.formatEther(balance));

  const question = "Treba li se produžiti radno vrijeme knjižnice?";
  const options = ["DA", "NE"];

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("Deploying Voting to Sepolia...");
  const contract = await factory.deploy(question, options);

  console.log("Tx hash:", contract.deploymentTransaction().hash);
  console.log("Waiting for confirmations...");
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("✅ Voting deployed to:", addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});