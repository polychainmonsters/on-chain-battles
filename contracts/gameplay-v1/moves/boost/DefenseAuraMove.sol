// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "../../../abstract/MoveV1.sol";
import {LogActions} from "../../lib/LogActions.sol";

contract DefenseAuraMove is MoveV1 {
    IBaseStatusEffectV1 public defenseAuraEffect;

    constructor(IBaseStatusEffectV1 _defenseAuraEffect) {
        defenseAuraEffect = _defenseAuraEffect;
    }

    function execute(
        MoveInput memory input
    ) external onlyExecutor returns (MoveOutput memory) {
        input.attackerStatusEffects = MoveLibV1.addStatusEffect(
            input.attackerStatusEffects,
            IBaseStatusEffectV1.StatusEffectWrapper(
                defenseAuraEffect,
                type(uint8).max
            )
        );

        uint8 numberOfDefenseAuras = 0;
        for (uint8 i = 0; i < input.attackerStatusEffects.length; i++) {
            if (
                input.attackerStatusEffects[i].statusEffect == defenseAuraEffect
            ) {
                numberOfDefenseAuras++;
            }
        }

        // auras are a special case we we log the apply right after the add because the frontend must
        // show the apply only once
        logger.log(
            uint256(LogActions.Action.ApplyMonsterStatusEffect),
            address(this),
            input.attacker.tokenId,
            defenseAuraEffect.extraData(numberOfDefenseAuras)
        );

        return
            MoveOutput(
                input.attackerStatusEffects,
                input.defenderStatusEffects,
                0,
                0
            );
    }

    function moveType() external pure returns (MoveType) {
        return MoveType.Boost;
    }
}
