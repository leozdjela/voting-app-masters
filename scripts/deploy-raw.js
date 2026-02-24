import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) RPC lokalnog hardhat node-a
const RPC_URL = "http://127.0.0.1:8545";

// 2) PRIVATE KEY: zalijepi prvi Private Key koji ti ispiše `npx hardhat node`
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// 3) Učitaj compiled artifact (ABI + bytecode) iz Hardhat artifacts foldera
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
  const { abi, bytecode } = artifact;

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const question = "Treba li se produziti radno vrijeme knjiznice?";
  const options = ["DA", "NE"];

  const factory = new ContractFactory(abi, bytecode, wallet);

  console.log("Deploying Voting contract...");
  const contract = await factory.deploy(question, options);

  console.log("Tx hash:", contract.deploymentTransaction().hash);
  await contract.waitForDeployment();

  console.log("Voting deployed to:", await contract.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});