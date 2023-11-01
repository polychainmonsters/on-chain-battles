import { ethers } from "hardhat";
import chalk from "chalk";
import { MonsterApiV1, MatchMakerV2, EventLoggerV1 } from "../typechain-types";
import {
  attacks,
  monsterIds,
  monsters,
  translateEffectByAddress,
  translateElement,
  translateMoveByAddress,
} from "./utils/fixtures";
import { getCommitHash } from "./utils/commit";
import { getContractInstance } from "./utils/contracts";
import { promptManager } from "./prompt/PromptManager";
import { logger } from "./logger/Logger";

type StatusEffect = {
  name: string;
  remainingTurns: number;
};

let pendingReveal = "";
let isGameOver: boolean = false;
let selfAddress: string;
let matchId: bigint;
let firstMonsterId: bigint;
let secondMonsterId: bigint;
let firstOpponentMonsterId: bigint;
let secondOpponentMonsterId: bigint;
let firstAttackDone = false;
let currentRound = 0;
let activeMonsterId: bigint = BigInt(0);
let activeOpponentMonsterId: bigint = BigInt(0);
let statusEffectsByMonsterId: Map<bigint, StatusEffect[]> = new Map();

const GAS_LIMIT = 3_000_000;
const MODE = 2;

const logMonsterStatus = async (
  monsterId: bigint,
  round: bigint,
  element: bigint,
  hp: bigint,
  attack: bigint,
  defense: bigint,
  speed: bigint,
) => {
  if (!matchId || monsterId == BigInt(0)) {
    return;
  }

  let isOpponent =
    monsterId == firstOpponentMonsterId || monsterId == secondOpponentMonsterId;

  if (monsterId == firstMonsterId || monsterId == secondMonsterId) {
    isOpponent = false;
  }

  logger.log(
    `Monster Status Log: ${
      isOpponent ? "Opponent" : "You"
    } Monster ID: ${monsterId} Round: ${round} Element: ${translateElement(
      Number(element),
    )} HP: ${hp} Attack: ${attack} Defense: ${defense} Speed: ${speed}`,
  );
};

async function chooseAttack(
  challenger: string,
  opponent: string,
  matchMakerV2: MatchMakerV2,
) {
  if (isGameOver) {
    return;
  }
  const selectedAttack = await promptManager.createPrompt(
    "select",
    "Select an attack:",
    Object.keys(attacks),
  );

  logger.log(`Selected attack: ${selectedAttack}`);
  // @ts-ignore
  const attackAddress = attacks[Object.keys(attacks)[selectedAttack]];
  if (!attackAddress) {
    logger.log(chalk.redBright(`Attack ${selectedAttack} not found`));
  }
  const commit = await getCommitHash(attackAddress!);
  lastAttack = attackAddress!;

  const commitTx = await matchMakerV2.commit(matchId, commit, {
    gasLimit: GAS_LIMIT,
  });
  await commitTx.wait();
  pendingReveal = attackAddress!;
}

async function setupEventListener(matchMakerV2: MatchMakerV2): Promise<bigint> {
  return new Promise<bigint>(async (resolve) => {
    // @ts-ignore
    matchMakerV2.runner.provider.pollingInterval = 5000;

    setInterval(() => {
      return new Promise(async (resolve) => {
        try {
          // query the current match from the matchmaker
          const [
            _matchId,
            [
              [challenger, challengerFirstMonsterId, challengerSecondMonsterId],
              [opponent, opponentFirstMonsterId, opponentSecondMonsterId],
              _,
              __,
              phase,
              ____,
              rounds,
            ],
            [],
            [],
          ] = await matchMakerV2.getMatchByUser(selfAddress);

          if (!matchId) {
            matchId = _matchId;

            if (challenger === selfAddress) {
              firstMonsterId = challengerFirstMonsterId;
              secondMonsterId = challengerSecondMonsterId;
              activeMonsterId = challengerFirstMonsterId;
              activeOpponentMonsterId = opponentFirstMonsterId;
              firstOpponentMonsterId = opponentFirstMonsterId;
              secondOpponentMonsterId = opponentSecondMonsterId;
            } else {
              firstMonsterId = opponentFirstMonsterId;
              secondMonsterId = opponentSecondMonsterId;
              activeMonsterId = opponentFirstMonsterId;
              activeOpponentMonsterId = challengerFirstMonsterId;
              firstOpponentMonsterId = challengerFirstMonsterId;
              secondOpponentMonsterId = challengerSecondMonsterId;
            }

            for (const monsterId of [
              challengerFirstMonsterId,
              challengerSecondMonsterId,
              opponentFirstMonsterId,
              opponentSecondMonsterId,
            ]) {
              const [tokenId, element, hp, attack, defense, speed] =
                await matchMakerV2.monsters(monsterId);

              logMonsterStatus(
                monsterId,
                BigInt(0),
                element,
                hp,
                attack,
                defense,
                speed,
              );
            }
          }

          if (pendingReveal && phase === BigInt(1)) {
            const revealTx = await matchMakerV2.reveal(
              matchId,
              pendingReveal,
              ethers.encodeBytes32String("secret"),
              {
                gasLimit: GAS_LIMIT,
              },
            );
            pendingReveal = "";
            logger.log(`Reveal tx was ${revealTx.hash}`);
            await revealTx.wait();
          }

          for (const monsterId of [
            challengerFirstMonsterId,
            challengerSecondMonsterId,
            opponentFirstMonsterId,
            opponentSecondMonsterId,
          ]) {
            if (!statusEffectsByMonsterId.has(monsterId)) {
              statusEffectsByMonsterId.set(monsterId, []);
            }
          }

          if (
            rounds > BigInt(currentRound) ||
            (!firstAttackDone &&
              activeMonsterId !== BigInt(0) &&
              activeOpponentMonsterId !== BigInt(0))
          ) {
            currentRound = Number(rounds);
            logger.log(`Round: ${currentRound}`);
            firstAttackDone = true;

            await chooseAttack(challenger, opponent, matchMakerV2);
          }
        } catch (e: any) {
          logger.log(
            chalk.redBright(`Error from choose attack modal: ${e.message}`),
          );
        }
      });
    }, 2000);

    const eventLogger =
      await getContractInstance<EventLoggerV1>("EventLoggerV1");
    // @ts-ignore
    eventLogger.runner.provider.pollingInterval = 5000;

    eventLogger.on(
      "LogEvent" as unknown as any,
      async (_matchId: bigint, name: string, data: string[]) => {
        if (matchId !== _matchId) {
          return;
        }

        logger.log(
          `Token Log Event Match ID: ${matchId} Name: ${name} Data: ${data}`,
        );
      },
    );
  });
}

let lastAttack = "";

async function startMatchmaking(selectedMonsters: string[]) {
  // const { default: chalk } = await import("chalk");

  const matchMakerV2 = await getContractInstance<MatchMakerV2>("MatchMakerV2");
  const [addressInQueue] = await matchMakerV2.queuedTeams(0);
  if (addressInQueue == ethers.ZeroAddress) {
    logger.log(`Waiting for another player...`);
  }

  logger.log(`Joining...`);
  try {
    const tx = await matchMakerV2.createAndJoin(
      MODE,
      selectedMonsters[0],
      selectedMonsters[1],
      {
        gasLimit: GAS_LIMIT,
      },
    );
    await tx.wait();
  } catch (err: any) {
    logger.log(chalk.redBright(err.message));
  }
}

async function createMonster(api: MonsterApiV1, monsterName: string) {
  const txResult = await api.createMonsterByName(
    monsterIds.get(monsterName) || BigInt(0),
  );
  return getMonsterIdFromTxReceipt(await txResult.wait());
}

function getMonsterIdFromTxReceipt(txReceipt: any) {
  const monsterCreatedLog = txReceipt?.logs?.find(
    (log: any) => log.fragment?.name === "MonsterCreated",
  );
  return monsterCreatedLog?.args[0];
}

async function main() {
  selfAddress = (await ethers.getSigners())[0].address;

  const matchMakerV2 = await getContractInstance<MatchMakerV2>("MatchMakerV2");
  setupEventListener(matchMakerV2);

  const selectedMonsters = await promptManager.createPrompt(
    "multiSelect",
    "Choose 2 monsters:",
    monsters,
    2,
  );
  logger.log(`Selected monsters: ${selectedMonsters.join(", ")}`);
  startMatchmaking(selectedMonsters);
}

// Start the CLI application
main();
