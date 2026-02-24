import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-mocha";
import "@nomicfoundation/hardhat-ethers-chai-matchers";
import "@nomicfoundation/hardhat-viem";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
};

export default config;