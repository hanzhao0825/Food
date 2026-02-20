import { Actor, BaseEntity } from '../entities/Actor';
import type { GameEngine } from './GameEngine';

export class LogicEngine {
    private game: GameEngine;

    constructor(game: GameEngine) {
        this.game = game;
    }

    // Process physical/magic combat formula: Max(1, Atk - Def)
    public calculateDamage(attacker: Actor, defender: Actor, damageType: "PHYSICAL" | "MAGIC" | "TRUE_DAMAGE", baseCoefficient: number = 1.0, ignoreArmorPercent: number = 0): number {
        const attackerStats = attacker.effectiveStats;
        const defenderStats = defender.effectiveStats;

        if (damageType === "TRUE_DAMAGE") {
            return Math.max(1, (attackerStats.pAtk + attackerStats.mAtk) * baseCoefficient);
        }

        if (damageType === "PHYSICAL") {
            let def = defenderStats.armor;
            if (ignoreArmorPercent > 0) {
                def = def * (1 - ignoreArmorPercent);
            }
            return Math.max(1, Math.floor(attackerStats.pAtk * baseCoefficient - def));
        }

        if (damageType === "MAGIC") {
            return Math.max(1, Math.floor(attackerStats.mAtk * baseCoefficient - defenderStats.resist));
        }

        return 1;
    }

    // GDD 4.3 伤害单向结算与堆栈 (Resolution Stack - No Counter)
    public processAttackResolution(attacker: Actor, defender: Actor) {
        // Step 1: Attacker deals damage
        this.executeHit(attacker, defender);

        // Generate Heat for hitting
        if (attacker.name === "Base") {
            this.game.addHeat(10);
        } else if (attacker.faction === "PLAYER") {
            this.game.addHeat(5);
        }

        // Step 2: Death check Intervention
        if (defender.stats.hp <= 0) {
            this.handleKill(attacker, defender);
            return;
        }

        // Action finished (handled by caller typically, or set here if automated)
        attacker.state = "ACTIONED";
    }

    private executeHit(dealer: Actor, receiver: Actor) {
        const dealerStats = dealer.effectiveStats;

        // Flavor check: Pork Scrap gets 50% armor pen
        let armorPen = 0;
        if (dealer.name === "Pork Scrap") armorPen = 0.5;

        // Identify damage type based on highest stat. 
        let dtype: "PHYSICAL" | "MAGIC" = dealerStats.pAtk > dealerStats.mAtk ? "PHYSICAL" : "MAGIC";

        let rawDmg = this.calculateDamage(dealer, receiver, dtype, 1.0, armorPen);

        // GDD enemies.md: Siege deals double damage to Base
        if (dealer.name === "Siege" && receiver instanceof BaseEntity) {
            rawDmg *= 2;
        }

        // Apply Status Effects (Flavors) from Normal Attacks (GDD 4.2 / ingredients.md)
        if (dealer.name === "Chili Pepper") {
            receiver.addStatusEffect({ type: "IGNITE", duration: 2, value: 15 });
        }
        if (dealer.name === "Tomato") {
            receiver.addStatusEffect({ type: "CORRODE", duration: 1, value: 10 });
        }
        if (dealer.name === "Potato") {
            receiver.addStatusEffect({ type: "SLOW", duration: 1, value: 1 });
        }

        receiver.takeDamage(rawDmg);

        if (receiver.stats.hp <= 0) {
            this.game.killActor(receiver);
        }
    }

    private handleKill(killer: Actor, _victim: Actor) {
        // Heat is awarded inside killActor; just give extra for player attackers
        if (killer.faction === "PLAYER" && killer.name !== "Base") {
            // already handled in killActor
        }
    }
}
