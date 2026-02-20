import { Actor } from './Actor';

export class Potato extends Actor {
    constructor(id: string) {
        super(id, "Potato", "PLAYER", {
            maxHp: 180,
            hp: 180,
            pAtk: 25,
            mAtk: 0,
            armor: 22,
            resist: 0,
            moveRange: 2,
            attackRange: 1
        }, {
            name: "🍎 [沉重打击]",
            description: "普攻命中后使目标下回合的 移动力 (Move) -1。"
        });
    }
}

export class PorkScrap extends Actor {
    constructor(id: string) {
        super(id, "Pork Scrap", "PLAYER", {
            maxHp: 80,
            hp: 80,
            pAtk: 45,
            mAtk: 0,
            armor: 10,
            resist: 10,
            moveRange: 2,
            attackRange: 1
        }, {
            name: "🥩 [穿刺]",
            description: "普攻无视目标 50% 物理护甲。"
        });
    }
}

export class ChiliPepper extends Actor {
    constructor(id: string) {
        super(id, "Chili Pepper", "PLAYER", {
            maxHp: 40,
            hp: 40,
            pAtk: 0,
            mAtk: 30,
            armor: 0,
            resist: 15,
            moveRange: 4,
            attackRange: 2
        }, {
            name: "🌶️ [点燃]",
            description: "普攻附带 15 点真伤 Dot，持续 2 回合。"
        });
    }
}

export class Tomato extends Actor {
    constructor(id: string) {
        super(id, "Tomato", "PLAYER", {
            maxHp: 60,
            hp: 60,
            pAtk: 0,
            mAtk: 20,
            armor: 5,
            resist: 20,
            moveRange: 3,
            attackRange: 2
        }, {
            name: "🍋 [腐蚀]",
            description: "普攻削减 10 点护甲，持续 1 回合。可叠 3 层。"
        });
    }
}
