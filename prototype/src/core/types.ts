export type TurnPhase = "DEPLOYMENT" | "PLAYER_MAIN" | "UI_LOCKDOWN" | "ENEMY_RESOLVE" | "ENVIRONMENT";

export type ActorState = "IDLE" | "MOVED" | "ACTIONED" | "BENCHED" | "DEAD";

export type Faction = "PLAYER" | "ENEMY";

export interface GridPoint {
    x: number;
    y: number;
}

export interface GridNode {
    pos: GridPoint;
    occupantId: string | null;
    isBase: boolean;
    residualHeatTurns: number;
}

export interface CombatAction {
    attackerId: string;
    targetId: string;
    actionType: "ATTACK" | "SKILL" | "COUNTER_ATTACK";
    skillId?: string;
    damageType: "PHYSICAL" | "MAGIC" | "TRUE_DAMAGE";
    baseDamage: number;
    canBeCountered: boolean;
}
