import type { GameEngine } from '../core/GameEngine';
import type { Actor } from '../entities/Actor';
import { type RecipeConfig, RecipeList } from '../data/Recipes';
import type { GridPoint } from '../core/types';

export class RecipeManager {
    private game: GameEngine;

    constructor(game: GameEngine) {
        this.game = game;
    }

    // Step 3.2: Check Graph Connectivity for adjacent matching heroes
    // GDD: As long as the participating members form an orthogonal chain, recipe is valid.
    public getAvailableRecipesForInitiator(initiator: Actor): { recipe: RecipeConfig, participants: Actor[], isAvailable: boolean, missing: string[] }[] {
        if (!initiator.position || initiator.faction !== "PLAYER") return [];

        const allRecipes: { recipe: RecipeConfig, participants: Actor[], isAvailable: boolean, missing: string[] }[] = [];

        // Find all contiguous player actors
        const connectedGroup = this.floodFillContiguousAllies(initiator.position);

        // For each recipe, check if the initiator is natively part of it
        for (const recipe of RecipeList) {
            if (!recipe.ingredients.includes(initiator.name)) continue;

            const matchResult = this.matchRecipeInGroup(initiator, connectedGroup, recipe.ingredients);

            const participants = matchResult.participants;
            const missing = [...matchResult.missingRequirements];

            if (this.game.heat < recipe.heatCost) {
                missing.push(`Not enough Heat (Requires ${recipe.heatCost})`);
            }

            allRecipes.push({
                recipe,
                participants,
                isAvailable: missing.length === 0,
                missing
            });
        }

        return allRecipes;
    }

    private floodFillContiguousAllies(startPos: GridPoint): Actor[] {
        const group: Actor[] = [];
        const visited: Set<string> = new Set();
        const queue: GridPoint[] = [startPos];

        visited.add(`${startPos.x},${startPos.y}`);

        const directions = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            const occupantId = this.game.grid.getOccupant(curr);
            const actor = occupantId ? this.game.entities.get(occupantId) : null;

            if (actor && actor.faction === "PLAYER" && actor.name !== "Base") {
                group.push(actor);

                for (const dir of directions) {
                    const nx = curr.x + dir.dx;
                    const ny = curr.y + dir.dy;
                    if (this.game.grid.isValid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                        const neighborOccupant = this.game.grid.getOccupant({ x: nx, y: ny });
                        if (neighborOccupant) {
                            visited.add(`${nx},${ny}`);
                            queue.push({ x: nx, y: ny });
                        }
                    }
                }
            }
        }

        return group;
    }

    // Attempt to extract exactly one of each required ingredient from the connected group.
    // Must include the initiator natively! Returns partial participants and what's missing.
    // GDD 3.2: Participants must form a contiguous orthogonal chain. "Adjacent" = Manhattan dist 1 only, no transitivity.
    private matchRecipeInGroup(initiator: Actor, group: Actor[], requiredNames: string[]): { participants: Actor[], missingRequirements: string[] } {
        let remainingReq = [...requiredNames];
        const matchParticipants: Actor[] = [];
        const missingRequirements: string[] = [];
        const usedIds: Set<string> = new Set();

        // Lock in the initiator first since they clicked the button
        matchParticipants.push(initiator);
        usedIds.add(initiator.id);
        const reqIdx = remainingReq.indexOf(initiator.name);
        if (reqIdx > -1) {
            remainingReq.splice(reqIdx, 1);
        }

        // Greedy match remaining ingredients from the connected group
        for (const req of remainingReq) {
            const found = group.find(a => a.name === req && !usedIds.has(a.id));
            if (found) {
                matchParticipants.push(found);
                usedIds.add(found.id);
            } else {
                missingRequirements.push(`缺少相邻的: ${req}`);
            }
        }

        // GDD 3.2 Strict Connectivity Check: Even if all ingredients are found,
        // the selected participants must themselves form a connected orthogonal subgraph.
        // "Adjacent" = Manhattan distance exactly 1, no transitivity.
        if (missingRequirements.length === 0 && matchParticipants.length > 1) {
            if (!this.isParticipantSubgraphConnected(matchParticipants)) {
                missingRequirements.push("参与者未形成连续正交相邻的连通图");
            }
        }

        return { participants: matchParticipants, missingRequirements };
    }

    // GDD 3.2: Validate that a set of participants forms a fully connected subgraph
    // using only direct orthogonal adjacency (Manhattan dist = 1). 
    // BFS from the first participant, only traversing through other participants.
    private isParticipantSubgraphConnected(participants: Actor[]): boolean {
        if (participants.length <= 1) return true;

        const positionedParticipants = participants.filter(p => p.position !== null);
        if (positionedParticipants.length !== participants.length) return false;

        // Build a set of participant positions for O(1) lookup
        const participantPositionSet = new Set<string>(
            positionedParticipants.map(p => `${p.position!.x},${p.position!.y}`)
        );

        const directions = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];
        const visited = new Set<string>();
        const startKey = `${positionedParticipants[0].position!.x},${positionedParticipants[0].position!.y}`;
        const queue: string[] = [startKey];
        visited.add(startKey);

        while (queue.length > 0) {
            const key = queue.shift()!;
            const [cx, cy] = key.split(',').map(Number);

            for (const dir of directions) {
                const nx = cx + dir.dx;
                const ny = cy + dir.dy;
                const neighborKey = `${nx},${ny}`;
                // Only traverse through positions occupied by OTHER participants
                if (!visited.has(neighborKey) && participantPositionSet.has(neighborKey)) {
                    visited.add(neighborKey);
                    queue.push(neighborKey);
                }
            }
        }

        // All participant positions must have been visited
        return visited.size === positionedParticipants.length;
    }

    // Execution phase, triggers UI lockdown and CD sequence
    public executeRecipe(recipe: RecipeConfig, participants: Actor[], targetPos?: GridPoint) {
        if (!this.game.consumeHeat(recipe.heatCost)) return;

        // 1. Resolve Combat Effect before people leave
        this.resolveRecipeCombat(recipe, participants, targetPos);

        // 3.4 CD & Bench sacrifice sequence
        // Send everyone to bench with fixed CD=2
        participants.forEach(p => {
            if (p.position) {
                const node = this.game.grid.getNodeByPoint(p.position);
                if (node) {
                    node.residualHeatTurns = 1; // GDD 3.2: 1 turn duration
                    node.occupantId = null;
                }
            }
            p.position = null;
            p.state = "DEAD";
            p.cooldownTimer = 2;
        });

        // GDD V2 explicitly removed the mandatory replacement lockdown.
        // The game should remain in PLAYER_MAIN to allow fluid actions.
        // this.game.changePhase("UI_LOCKDOWN");
    }

    private resolveRecipeCombat(recipe: RecipeConfig, participants: Actor[], targetPos?: GridPoint) {
        const logic = this.game.logicEngine;
        if (!targetPos) return;

        // 1. Strict Range Check: Target must be within castRange of ANY participant
        const inRange = participants.some(p =>
            p.position && this.game.grid.getManhattanDistance(p.position, targetPos) <= recipe.castRange
        );
        if (!inRange) return;

        // 2. Resolve specific effects based on ID
        if (recipe.id === "RECIPE_03") {
            // Tomato Stew scenario: 5x5 Rhombus (Manhattan <= 2)
            const totalMAtk = participants.reduce((sum, p) => sum + p.effectiveStats.mAtk, 0);
            const dummyAttacker = { effectiveStats: { pAtk: 0, mAtk: totalMAtk, resist: 0, armor: 0 } } as any;
            const aoeRadius = recipe.aoeRadius || 2;

            this.game.entities.forEach(enemy => {
                if (enemy.faction === "ENEMY" && enemy.position) {
                    const aoeDist = this.game.grid.getManhattanDistance(targetPos, enemy.position);
                    if (aoeDist <= aoeRadius) {
                        const originalPos = enemy.position;
                        const dmg = logic.calculateDamage(dummyAttacker, enemy, "MAGIC", 0.5);
                        enemy.takeDamage(dmg);

                        if (enemy.stats.hp <= 0) {
                            this.game.grid.setOccupant(originalPos, null);
                            this.game.addHeat(15);
                        } else {
                            // [强制钉死]
                            enemy.addStatusEffect({ type: "STUN", duration: 1 });
                        }
                    }
                }
            });
        }
        else if (recipe.id === "RECIPE_01") {
            // Potato Stew scenario: 3x3 Square (Chebyshev dist <= 1)
            const totalPAtk = participants.reduce((sum, p) => sum + p.effectiveStats.pAtk, 0);
            const dummyAttacker = { effectiveStats: { pAtk: totalPAtk, mAtk: 0, resist: 0, armor: 0 } } as any;
            const aoeRadius = recipe.aoeRadius || 1;
            const shape = recipe.aoeShape || "DIAMOND";

            this.game.entities.forEach(enemy => {
                if (enemy.faction === "ENEMY" && enemy.position) {
                    const dx = Math.abs(targetPos.x - enemy.position.x);
                    const dy = Math.abs(targetPos.y - enemy.position.y);
                    // SQUARE = 3x3 block (Chebyshev), DIAMOND = rhombus (Manhattan)
                    const inAoe = shape === "SQUARE"
                        ? Math.max(dx, dy) <= aoeRadius
                        : (dx + dy) <= aoeRadius;

                    if (inAoe) {
                        const dmg = logic.calculateDamage(dummyAttacker, enemy, "PHYSICAL", 1.2);
                        enemy.takeDamage(dmg);
                        if (enemy.stats.hp <= 0) {
                            this.game.killActor(enemy);
                        } else {
                            enemy.addStatusEffect({ type: "SLOW", duration: 1, value: 1 });
                        }
                    }
                }
            });
        }
        else if (recipe.id === "RECIPE_02") {
            // Chili Pork scenario: Single Target
            const targetId = this.game.grid.getOccupant(targetPos);
            const enemy = targetId ? this.game.entities.get(targetId) : null;
            if (enemy && enemy.faction === "ENEMY" && enemy.position) {
                const pork = participants.find(p => p.name === "Pork Scrap") || participants[0];
                const chili = participants.find(p => p.name === "Chili Pepper") || participants[0];

                const pDmg = logic.calculateDamage(pork, enemy, "PHYSICAL", 2.0);
                const mDmg = logic.calculateDamage(chili, enemy, "MAGIC", 2.0);

                enemy.takeDamage(pDmg + mDmg);

                if (enemy.stats.hp <= 0) {
                    this.game.killActor(enemy);
                } else {
                    // [重度点燃]
                    enemy.addStatusEffect({ type: "IGNITE", duration: 3, value: 30 });
                }
            }
        }
    }
}
