import type { ActorState, Faction, GridPoint } from '../core/types';

export interface ActorStats {
    maxHp: number;
    hp: number;
    pAtk: number;
    mAtk: number;
    armor: number;
    resist: number;
    moveRange: number;
    attackRange: number;
}

export type StatusEffectType = "IGNITE" | "CORRODE" | "SLOW" | "STUN";

export interface StatusEffect {
    type: StatusEffectType;
    duration: number; // turns remaining
    value?: number; // e.g., armor reduction amount or dot magnitude
}

export interface Passive {
    name: string;
    description: string;
}

export abstract class Actor {
    public id: string;
    public name: string;
    public faction: Faction;
    public stats: ActorStats;
    public state: ActorState;
    public position: GridPoint | null; // null if benched/dead
    public cooldownTimer: number = 0;
    public statusEffects: StatusEffect[] = [];
    public passive?: Passive;

    constructor(id: string, name: string, faction: Faction, stats: ActorStats, passive?: Passive) {
        this.id = id;
        this.name = name;
        this.faction = faction;
        this.stats = { ...stats };
        this.passive = passive;
        this.state = "BENCHED"; // starts outside
        this.position = null;
    }

    // GDD 4.1/4.2: Dynamic Stat calculation based on status effects
    public get effectiveStats(): ActorStats {
        const eff = { ...this.stats };

        for (const effect of this.statusEffects) {
            if (effect.type === "CORRODE") {
                eff.armor = Math.max(0, eff.armor - (effect.value || 0));
            }
            if (effect.type === "SLOW") {
                eff.moveRange = Math.max(0, eff.moveRange - (effect.value || 0));
            }
            if (effect.type === "STUN") {
                eff.moveRange = 0;
            }
        }

        return eff;
    }

    public addStatusEffect(effect: StatusEffect) {
        // If same type exists, refresh duration or stack based on GDD rules
        const existing = this.statusEffects.find(e => e.type === effect.type);
        if (existing) {
            existing.duration = Math.max(existing.duration, effect.duration);
            if (effect.type === "CORRODE") {
                // Tomato's Corrode stacks up to 3 times (GDD 4.2/ingredients.md)
                // Assuming value is 10 per stack
                existing.value = Math.min(30, (existing.value || 0) + (effect.value || 0));
            }
        } else {
            this.statusEffects.push({ ...effect });
        }
    }

    public takeDamage(amount: number) {
        this.stats.hp = Math.max(0, this.stats.hp - amount);
        if (this.stats.hp === 0) {
            this.handleDeath();
        }
    }

    public heal(amount: number) {
        if (this.state !== "DEAD") {
            this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
        }
    }

    public handleDeath() {
        this.state = "DEAD";
        this.cooldownTimer = 2; // Fixed CD on death
        this.position = null; // Removed from grid
    }
}

export class BaseEntity extends Actor {
    // Note: Base occupies 2x2, position here denotes its bottom-left anchor (5,5)
    constructor(id: string) {
        super(id, "Base", "PLAYER", {
            maxHp: 100,
            hp: 100,
            pAtk: 10,  // Base turret attack
            mAtk: 0,
            armor: 0,
            resist: 0,
            moveRange: 0, // Cannot move
            attackRange: 2 // Has a 2 tile attack range
        });
        this.state = "IDLE";
        this.position = { x: 5, y: 5 }; // Anchor
    }

    public override handleDeath() {
        super.handleDeath();
        // Trigger Game Over in GameState later
    }
}
