import { ethers, network, upgrades } from "hardhat";
import fs from "fs";
import { deployContract, deployProxy } from "./utils";
import {
  EventLoggerV1,
  LeaderboardManagerV1,
  MatchMakerV3,
} from "../typechain-types";
import { parseEther } from "viem";

async function main() {
  const output: any = {
    contracts: {},
    attacks: {},
    effects: {},
  };

  const [deployer] = await ethers.getSigners();

  const { address: contractApiV1Address } =
    await deployContract("ContractApiV1");
  output.contracts.ContractApiV1 = contractApiV1Address;

  if (!process.env.USERNAMES) {
    const { address: usernamesV1Address } = await deployContract(
      "UsernamesV1",
      [await deployer.getAddress()],
    );
    output.contracts.UsernamesV1 = usernamesV1Address;
  } else {
    output.contracts.UsernamesV1 = process.env.USERNAMES;
  }

  const { address: monsterApiV1Address } = await deployContract("MonsterApiV1");
  const { address: moveExecutorV1Address } = await deployContract(
    "MoveExecutorV1",
    [await deployer.getAddress()],
  );

  output.contracts.MonsterApiV1 = monsterApiV1Address;
  output.contracts.MoveExecutorV1 = moveExecutorV1Address;

  const { address: eventLoggerV1Address, instance: eventLoggerV1 } =
    await deployContract("EventLoggerV1", [await deployer.getAddress(), false]);

  output.contracts.EventLoggerV1 = eventLoggerV1Address;

  const matchMakerContract =
    network.name === "sapphire" ? "MatchMakerV3Confidential" : "MatchMakerV3";
  console.log(`Deploying ${matchMakerContract}...`);

  const { address: matchMakerV3Address, instance: matchMakerV3 } =
    await deployProxy(matchMakerContract, [
      monsterApiV1Address,
      moveExecutorV1Address,
      eventLoggerV1Address,
    ]);

  if (process.env.LEADERBOARD) {
    output.contracts.LeaderboardV1 = process.env.LEADERBOARD;
  } else {
    const { address: leaderboardV1Address } = await deployProxy(
      "LeaderboardV1",
      [matchMakerV3Address, output.contracts.UsernamesV1],
    );
    output.contracts.LeaderboardV1 = leaderboardV1Address;
  }

  console.log(`Setting leaderboard on match maker...`);
  await (matchMakerV3 as unknown as MatchMakerV3).setLeaderboard(
    output.contracts.LeaderboardV1,
  );

  const { address: leaderboardManagerAddress, instance: leaderboardManager } =
    await deployProxy("LeaderboardManagerV1", [await deployer.getAddress()]);

  if (process.env.LEADERBOARD_MANAGER) {
    output.contracts.LeaderboardManagerV1 = process.env.LEADERBOARD_MANAGER;
  } else {
    await (
      leaderboardManager as unknown as LeaderboardManagerV1
    ).setLeaderboard("1", output.contracts.LeaderboardV1);
    output.contracts.LeaderboardManagerV1 = leaderboardManagerAddress;
  }

  console.log(`Permitting match maker to use move executor`);
  const moveExecutorV1 = await ethers.getContractAt(
    "MoveExecutorV1",
    moveExecutorV1Address,
  );
  await moveExecutorV1.grantRole(
    await moveExecutorV1.PERMITTED_ROLE(),
    matchMakerV3Address,
  );

  await (eventLoggerV1 as EventLoggerV1).addWriter(matchMakerV3Address);
  await (eventLoggerV1 as EventLoggerV1).addWriter(
    await moveExecutorV1.getAddress(),
  );

  output.contracts.MatchMakerV3 = matchMakerV3Address;

  const ConfusedEffect = await ethers.getContractFactory("ConfusedEffect");
  const confusedEffect = await ConfusedEffect.deploy();

  const { address: damageOverTimeEffectAddress } = await deployContract(
    "DamageOverTimeEffect",
  );
  const { address: damageOverTimeMoveAddress } = await deployContract(
    "DamageOverTimeMove",
    [damageOverTimeEffectAddress, 50],
  );
  const { address: foggedEffectAddress } = await deployContract("FoggedEffect");
  const { address: controlMoveAddress } = await deployContract("ControlMove", [
    foggedEffectAddress,
  ]);
  const { address: purgeBuffsMoveAddress } = await deployContract(
    "PurgeBuffsMove",
    [50],
  );
  const { address: wallBreakerMoveAddress } = await deployContract(
    "WallBreakerMove",
    [await confusedEffect.getAddress(), 80],
  );

  const { address: cleansingShieldMoveAddress } = await deployContract(
    "CleansingShieldMove",
  );
  const { address: cloudCoverEffectAddress } = await deployContract(
    "CloudCoverEffect",
    [40],
  );
  const { address: cloudCoverMoveAddress } = await deployContract(
    "CloudCoverMove",
    [cloudCoverEffectAddress],
  );
  const { address: elementalWallEffectAddress } = await deployContract(
    "ElementalWallEffect",
    [wallBreakerMoveAddress],
  );
  const { address: elementalWallMoveAddress } = await deployContract(
    "ElementalWallMove",
    [elementalWallEffectAddress],
  );
  const { address: tailwindEffectAddress } =
    await deployContract("TailwindEffect");
  const { address: tailwindMoveAddress } = await deployContract(
    "TailwindMove",
    [tailwindEffectAddress],
  );

  const { address: attackAuraEffectAddress } =
    await deployContract("AttackAuraEffect");
  const { address: attackAuraMoveAddress } = await deployContract(
    "AttackAuraMove",
    [attackAuraEffectAddress],
  );

  const { address: defenseAuraEffectAddress } =
    await deployContract("DefenseAuraEffect");
  const { address: defenseAuraMoveAddress } = await deployContract(
    "DefenseAuraMove",
    [defenseAuraEffectAddress],
  );

  const { address: healMoveAddress } = await deployContract("HealMove");

  const { address: speedAuraEffectAddress } =
    await deployContract("SpeedAuraEffect");
  const { address: speedAuraMoveAddress } = await deployContract(
    "SpeedAuraMove",
    [speedAuraEffectAddress],
  );

  const { address: confusedControlMove } = await deployContract(
    "ConfusedControlMove",
    [controlMoveAddress],
  );
  await confusedEffect.addConfusedMove(controlMoveAddress, confusedControlMove);

  const { address: confusedDamageOverTimeMove } = await deployContract(
    "ConfusedDamageOverTimeMove",
    [damageOverTimeMoveAddress],
  );
  await confusedEffect.addConfusedMove(
    damageOverTimeMoveAddress,
    confusedDamageOverTimeMove,
  );

  const { address: confusedPurgeBuffsMove } = await deployContract(
    "ConfusedPurgeBuffsMove",
    [purgeBuffsMoveAddress],
  );
  await confusedEffect.addConfusedMove(
    purgeBuffsMoveAddress,
    confusedPurgeBuffsMove,
  );

  const { address: confusedWallBreakerMove } = await deployContract(
    "ConfusedWallBreakerMove",
    [wallBreakerMoveAddress],
  );
  await confusedEffect.addConfusedMove(
    wallBreakerMoveAddress,
    confusedWallBreakerMove,
  );

  const { address: timeoutMoveAddress } = await deployContract(
    "TimeoutMove",
    [],
  );
  const { address: confusedTimeoutMove } = await deployContract(
    "ConfusedTimeoutMove",
    [timeoutMoveAddress],
  );
  await confusedEffect.addConfusedMove(timeoutMoveAddress, confusedTimeoutMove);

  await (matchMakerV3 as unknown as MatchMakerV3).setMode(
    "1",
    process.env.TIMEOUT || "47",
    timeoutMoveAddress,
  );

  await (matchMakerV3 as unknown as MatchMakerV3).setMode(
    "2",
    "182",
    timeoutMoveAddress,
  );

  output.effects.DamageOverTimeEffect = damageOverTimeEffectAddress;
  output.attacks.DamageOverTimeMove = damageOverTimeMoveAddress;
  output.effects.FoggedEffect = foggedEffectAddress;
  output.attacks.ControlMove = controlMoveAddress;
  output.attacks.PurgeBuffsMove = purgeBuffsMoveAddress;
  output.attacks.WallBreakerMove = wallBreakerMoveAddress;
  output.attacks.CleansingShieldMove = cleansingShieldMoveAddress;
  output.attacks.TimeoutMove = timeoutMoveAddress;
  output.effects.CloudCoverEffect = cloudCoverEffectAddress;
  output.attacks.CloudCoverMove = cloudCoverMoveAddress;
  output.effects.ElementalWallEffect = elementalWallEffectAddress;
  output.attacks.ElementalWallMove = elementalWallMoveAddress;
  output.effects.TailwindEffect = tailwindEffectAddress;
  output.attacks.TailwindMove = tailwindMoveAddress;
  output.effects.AttackAuraEffect = attackAuraEffectAddress;
  output.attacks.AttackAuraMove = attackAuraMoveAddress;
  output.effects.DefenseAuraEffect = defenseAuraEffectAddress;
  output.attacks.DefenseAuraMove = defenseAuraMoveAddress;
  output.attacks.HealMove = healMoveAddress;
  output.effects.SpeedAuraEffect = speedAuraEffectAddress;
  output.attacks.SpeedAuraMove = speedAuraMoveAddress;
  output.effects.ConfusedEffect = await confusedEffect.getAddress();
  output.attacks.ConfusedControlMove = confusedControlMove;
  output.attacks.ConfusedDamageOverTimeMove = confusedDamageOverTimeMove;
  output.attacks.ConfusedPurgeBuffsMove = confusedPurgeBuffsMove;
  output.attacks.ConfusedWallBreakerMove = confusedWallBreakerMove;
  output.attacks.ConfusedTimeoutMove = confusedTimeoutMove;

  // iterate through all attacks and effects and set the event emitter
  for (const key of Object.keys(output.attacks)) {
    console.log(`Setting event emitter for ${key}...`);
    const attackContract = await ethers.getContractAt(key, output.attacks[key]);
    await attackContract.setLogger(eventLoggerV1Address);
    await attackContract.addExecutor(moveExecutorV1Address);
    console.log(`Permitting contract for event logger...`);
    await (eventLoggerV1 as EventLoggerV1).addWriter(
      await attackContract.getAddress(),
    );
  }

  for (const key of [
    "ControlMove",
    "DamageOverTimeMove",
    "PurgeBuffsMove",
    "WallBreakerMove",
    "TimeoutMove",
  ]) {
    console.log(`Setting confused executor for ${key}...`);
    const attackContract = await ethers.getContractAt(key, output.attacks[key]);
    const confusedAttackContract = await ethers.getContractAt(
      "Confused" + key,
      output.attacks["Confused" + key],
    );
    await attackContract.addExecutor(await confusedAttackContract.getAddress());
    console.log(`Setting executor for Tailwind for attack ${key}...`);
    const tailwindEffect = await ethers.getContractAt(
      "TailwindEffect",
      tailwindEffectAddress,
    );
    await tailwindEffect.addExecutor(await attackContract.getAddress());
  }

  for (const key of Object.keys(output.effects)) {
    console.log(`Setting event emitter for ${key}...`);
    const effectContract = await ethers.getContractAt(key, output.effects[key]);
    await effectContract.setLogger(eventLoggerV1Address);
    console.log(`Permitting contract for event logger...`);
    await (eventLoggerV1 as EventLoggerV1).addWriter(
      await effectContract.getAddress(),
    );
    console.log(`Setting executor for ${key}...`);
    await effectContract.addExecutor(moveExecutorV1Address);
  }

  // deploy packs
  const { address: elementalEchoesTokenUriAddress } = await deployContract(
    "ElementalEchoesTokenUriProvider",
    [
      "https://drive.polychainmonsters.com/ipfs/QmUMZiwsJyNDkK67WjXi7zKixxUjFLXezq11mSK7e5wDPT/",
      "https://drive.polychainmonsters.com/ipfs/QmYqnHSys9m8dPDWpjPWqnP95FBZCxdpxii3VvzaLqCpss",
    ],
  );

  output.contracts.ElementalEchoesTokenUriProvider =
    elementalEchoesTokenUriAddress;

  const { address: boosterPacksAddress } = await deployProxy("BoosterPacks", [
    "BoosterPacks",
    "PACK",
    parseEther("0.001"), // pack price
    parseEther("0.00001"), // fee
    10_000, // max supply
    "0x275C1D7a6AD547209f5E29B8f89D370A9E8079eC", // fee receiver
    elementalEchoesTokenUriAddress,
  ]);

  output.contracts.BoosterPacks = boosterPacksAddress;

  const { address: appVersionsAddress } = await deployContract(
    "AppVersionsV1",
    [await deployer.getAddress()],
  );

  output.contracts.AppVersionsV1 = appVersionsAddress;

  // Writing to a JSON file
  fs.writeFileSync(
    `${__dirname}/../tmp/contracts.generated.${network.name}.json`,
    JSON.stringify(output, null, 2),
  );

  // iterate through the generated contracts and register them all on the contract api
  const contractApiV1 = await ethers.getContractAt(
    "ContractApiV1",
    contractApiV1Address,
  );
  for (const key of Object.keys(output)) {
    for (const subKey of Object.keys(output[key])) {
      console.log(`Registering ${subKey} at contract api...`);
      await contractApiV1.setContract(
        parseInt(process.env.VERSION || "0"),
        subKey,
        output[key][subKey],
      );
    }
  }

  console.log("All addresses have been written to deployed_contracts.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
