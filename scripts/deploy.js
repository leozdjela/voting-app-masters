import hre from "hardhat";

async function main() {
  const question = "Treba li se produziti radno vrijeme knjiznice?";
  const options = ["DA", "NE"];

  const publicClient = await hre.viem.getPublicClient();
  const [walletClient] = await hre.viem.getWalletClients();

  const voting = await hre.viem.deployContract("Voting", [question, options], {
    client: { wallet: walletClient, public: publicClient },
  });

  console.log("Voting deployed to:", voting.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});