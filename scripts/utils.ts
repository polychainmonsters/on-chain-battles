import { ethers, upgrades } from "hardhat";

export async function deployContract(factoryName: string, args: any = []) {
  console.log(`Deploying ${factoryName}...`);
  const Factory = await ethers.getContractFactory(factoryName);
  const instance = await Factory.deploy(...args);
  const address = await instance.getAddress();
  console.log(`${factoryName} deployed to:`, address);
  return { instance, address };
}

export async function deployProxy(factoryName: string, args: any = []) {
  console.log(`Deploying ${factoryName}...`);
  const Factory = await ethers.getContractFactory(factoryName);
  const instance = await upgrades.deployProxy(Factory, args);
  const address = await instance.getAddress();
  console.log(`${factoryName} deployed to:`, address);
  return { instance, address };
}
