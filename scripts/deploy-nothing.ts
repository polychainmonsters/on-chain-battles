import { ethers } from "hardhat";
import { deployContract } from "./utils";

async function main() {
  await deployContract("Nothing", []);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
