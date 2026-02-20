import { Actor, type Passive } from './Actor';

export type EnemyAITraits = "DEFAULT" | "SIEGE" | "BLOODHOUND";

export abstract class Enemy extends Actor {
    public aiTrait: EnemyAITraits = "DEFAULT";

    constructor(id: string, name: string, stats: any, trait: EnemyAITraits, passive?: Passive) {
        super(id, name, "ENEMY", stats, passive);
        this.aiTrait = trait;
    }
}

export class Slime extends Enemy {
    constructor(id: string) {
        super(id, "Slime", {
            maxHp: 30,
            hp: 30,
            pAtk: 10,
            mAtk: 0,
            armor: 0,
            resist: 0,
            moveRange: 2,
            attackRange: 1
        }, "DEFAULT", {
            name: "🟢 [粘液]",
            description: "普通的软泥怪，没有什么特殊能力。"
        });
    }
}

export class Siege extends Enemy {
    constructor(id: string) {
        super(id, "Siege", {
            maxHp: 200,
            hp: 200,
            pAtk: 40,
            mAtk: 0,
            armor: 60,
            resist: 10,
            moveRange: 1,
            attackRange: 1
        }, "SIEGE", {
            name: "🏗️ [攻城]",
            description: "对老家(Base)造成 2 倍伤害。"
        });
    }
}

export class Assassin extends Enemy {
    constructor(id: string) {
        super(id, "Assassin", {
            maxHp: 60,
            hp: 60,
            pAtk: 35,
            mAtk: 0,
            armor: 10,
            resist: 50,
            moveRange: 4,
            attackRange: 1
        }, "BLOODHOUND", {
            name: "🗡️ [猎犬]",
            description: "优先攻击血量最低的目标。"
        });
    }
}
