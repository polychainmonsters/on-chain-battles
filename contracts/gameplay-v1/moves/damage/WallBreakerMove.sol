// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "../../../abstract/MoveV1.sol";
import "../../lib/BaseDamage.sol";
import "../../lib/CriticalHit.sol";
import "../../lib/ElementalEffectiveness.sol";

contract WallBreakerMove is MoveV1 {
    uint8 public constant CONFUSED_EFFECT_DURATION = 2;

    IBaseStatusEffectV1 public confusedEffect;

    constructor(IBaseStatusEffectV1 _confusedEffect) {
        confusedEffect = _confusedEffect;
    }

    function execute(
        IMoveV1.MoveInput memory input
    ) external returns (IMoveV1.MoveOutput memory) {
        uint16 damage = BaseDamage.calculateBaseDamage(
            input.attacker,
            input.defender
        );

        uint16 elementalMultiplier;
        (damage, elementalMultiplier) = ElementalEffectiveness.applyElementalEffectiveness(
            damage,
            input.attacker.element,
            getSecondElement(input.attacker.element),
            input.defender.element
        );

        // 80% chance that wall is broken
        if (isRandomHit(input.randomness, "wallBreaker", 100)) {
            input.defenderStatusEffects = MoveLibV1.removeStatusEffectsByGroup(
                input.defenderStatusEffects,
                IBaseStatusEffectV1.StatusEffectGroup.WALL
            );

            logger.log(
                "SE-",
                address(this),
                input.defender.tokenId,
                uint256(IBaseStatusEffectV1.StatusEffectGroup.WALL)
            );

            input.defenderStatusEffects = MoveLibV1.addStatusEffect(
                input.defenderStatusEffects,
                IBaseStatusEffectV1.StatusEffectWrapper(
                    confusedEffect,
                    CONFUSED_EFFECT_DURATION
                )
            );

            logger.log(
                "SE+",
                address(confusedEffect),
                input.defender.tokenId,
                CONFUSED_EFFECT_DURATION
            );
        }

        bool isCriticalHit;
        (damage, isCriticalHit) = CriticalHit.applyCriticalHit(
            damage,
            input.randomness,
            input.attackerStatusEffects
        );

        logger.log(
            "DMG",
            address(this),
            input.attacker.tokenId,
            input.defender.tokenId,
            uint256(damage),
            uint256(elementalMultiplier),
            isCriticalHit
        );

        return
            MoveOutput(
                input.attackerStatusEffects,
                input.defenderStatusEffects,
                0,
                int16(damage)
            );
    }

    function moveType() external pure returns (MoveType) {
        return MoveType.Damage;
    }

    function getSecondElement(
        IMonsterV1.Element element
    ) internal pure returns (IMonsterV1.Element secondElement) {
        if (element == IMonsterV1.Element.Fire) {
            secondElement = IMonsterV1.Element.Toxic;
        } else if (element == IMonsterV1.Element.Nature) {
            secondElement = IMonsterV1.Element.Electric;
        } else if (element == IMonsterV1.Element.Water) {
            secondElement = IMonsterV1.Element.Mental;
        } else {
            secondElement = IMonsterV1.Element.None;
        }
    }
}
