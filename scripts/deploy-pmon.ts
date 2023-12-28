import { ethers } from "hardhat";
import { deployContract } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();

  const { address: pmonAddress } = await deployContract("PMON", [
    await deployer.getAddress(),
  ]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});