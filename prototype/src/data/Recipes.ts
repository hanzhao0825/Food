export type TargetMode = "ANCHOR_AOE" | "SINGLE_TARGET" | "GLOBAL_AOE";

export interface RecipeConfig {
    id: string;
    aliasName: string;
    description: string;
    ingredients: string[];
    heatCost: number;
    targetMode: TargetMode;
    castRange: number; // Max distance from participant to target point
    aoeRadius?: number; // Radius for ANCHOR_AOE
    aoeShape?: "SQUARE" | "DIAMOND"; // SQUARE=Chebyshev(3x3), DIAMOND=Manhattan(rhombus)
}

export const RecipeList: RecipeConfig[] = [
    {
        id: "RECIPE_01",
        aliasName: "土豆炖肉 (Potato + Pork)",
        description: "范围物理打击 + [微量减速]（本回合移动力直接扣除 1 格）。",
        ingredients: ["Potato", "Pork Scrap"],
        heatCost: 40,
        targetMode: "ANCHOR_AOE",
        castRange: 0,
        aoeRadius: 1,
        aoeShape: "SQUARE"  // 3x3 网格 (Chebyshev dist <= 1)
    },
    {
        id: "RECIPE_02",
        aliasName: "辣椒小炒肉 (Chili + Pork)",
        description: "同时进行物理和魔法两次独立结算，附带 [重度点燃]（每回合流血 30点 真实魔法伤害，持续 3回合）。",
        ingredients: ["Chili Pepper", "Pork Scrap"],
        heatCost: 60,
        targetMode: "SINGLE_TARGET",
        castRange: 1
    },
    {
        id: "RECIPE_03",
        aliasName: "番茄乱炖辣汤 (Tomato+Chili+Potato)",
        description: "5x5 菱形区域魔法伤害，附带 [强制钉死]（受击敌军本回合移动力直接定死为 0）。",
        ingredients: ["Tomato", "Chili Pepper", "Potato"],
        heatCost: 100,
        targetMode: "ANCHOR_AOE",
        castRange: 2,
        aoeRadius: 2,
        aoeShape: "DIAMOND" // 5x5 菱形 (Manhattan dist <= 2)
    }
];
