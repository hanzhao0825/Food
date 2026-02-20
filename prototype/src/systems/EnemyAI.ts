import type { GameEngine } from '../core/GameEngine';
import type { Enemy } from '../entities/Enemies';
import type { GridPoint } from '../core/types';
import type { Actor } from '../entities/Actor';
import type { LogicEngine } from '../core/LogicEngine';

export class EnemyAI {
    private game: GameEngine;
    private logic: LogicEngine;

    constructor(game: GameEngine, logicEngine: LogicEngine) {
        this.game = game;
        this.logic = logicEngine;
    }

    public async act(enemy: Enemy) {
        if (!enemy.position || enemy.state === "DEAD") return;

        // 1. Determine Target
        let targetPoint: GridPoint | null = null;
        let targetActor: Actor | null = null;

        if (enemy.aiTrait === "BLOODHOUND") {
            // Find lowest HP player
            let lowestHp = Infinity;
            this.game.entities.forEach(actor => {
                if (actor.faction === "PLAYER" && actor.name !== "Base" && actor.position && actor.stats.hp > 0) {
                    if (actor.stats.hp < lowestHp) {
                        lowestHp = actor.stats.hp;
                        targetActor = actor;
                        targetPoint = actor.position;
                    }
                }
            });
        }

        // Fallback to Base if no lowest HP found or if Default/Siege
        if (!targetPoint) {
            // Target is one of the base points closest to enemy
            let minDist = Infinity;
            this.game.grid.basePoints.forEach(bp => {
                const dist = this.game.grid.getManhattanDistance(enemy.position!, bp);
                if (dist < minDist) {
                    minDist = dist;
                    targetPoint = bp;
                }
            });
            targetActor = this.game.entities.get(this.game.base.id) || null;
        }

        // 2. Simple shortest path towards targetPoint (GDD constraint: blocking check)
        // If movement blocked, attack the blocker. If opportunistic attack available, take it.
        const path = this.findPathAStar(enemy.position, targetPoint!);

        // Move along path up to moveRange
        let stepsToTake = Math.min(enemy.stats.moveRange, path.length);
        let currentPos = enemy.position;

        for (let i = 0; i < stepsToTake; i++) {
            const nextNode = path[i];
            const occupantId = this.game.grid.getOccupant(nextNode);

            if (occupantId) {
                const occupant = this.game.entities.get(occupantId);
                if (occupant && occupant.faction === "PLAYER") {
                    // Blocked by player unit. Stop moving and attack it.
                    targetActor = occupant;
                    break;
                }
            } else {
                // Move safely
                this.game.grid.setOccupant(currentPos, null);
                this.game.grid.setOccupant(nextNode, enemy.id);
                currentPos = nextNode;
                enemy.position = currentPos;

                // trigger re-render and delay for coroutine visual effect
                if (this.game.onStateChange) this.game.onStateChange();
                await new Promise(r => setTimeout(r, 200));
            }
        }

        // 3. Attack Execution
        // If the intended target is within attack range, attack it.
        // Otherwise, opportunistic attack: attack any adjacent player
        let executedAttack = false;

        if (targetActor && targetActor.position && this.game.grid.getManhattanDistance(currentPos, targetActor.position) <= enemy.stats.attackRange) {
            this.logic.processAttackResolution(enemy, targetActor);
            executedAttack = true;
        } else {
            // Opportunistic
            let hitAnyone = false;
            this.game.grid.forEachNode(node => {
                if (hitAnyone) return;
                if (node.occupantId && this.game.grid.getManhattanDistance(currentPos, node.pos) <= enemy.stats.attackRange) {
                    const adj = this.game.entities.get(node.occupantId);
                    if (adj && adj.faction === "PLAYER") {
                        this.logic.processAttackResolution(enemy, adj);
                        hitAnyone = true;
                        executedAttack = true;
                    }
                }
            });
        }

        if (executedAttack) {
            // Pause slightly after attack so player associates the hit
            if (this.game.onStateChange) this.game.onStateChange();
            await new Promise(r => setTimeout(r, 300));
        }

        enemy.state = "ACTIONED";
    }

    // Simplified A* without diagonal. Manhattan heuristic.
    private findPathAStar(start: GridPoint, target: GridPoint): GridPoint[] {
        // Omitting full A*. Using a greedy BFS to find path towards target
        // For prototype speed and safety against infinite loops.
        const path: GridPoint[] = [];
        let curr = start;

        for (let s = 0; s < 20; s++) { // Max iteration fallback
            if (curr.x === target.x && curr.y === target.y) break;

            const directions = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];
            let bestNext: GridPoint | null = null;
            let bestDist = Infinity;

            for (const dir of directions) {
                const nx = curr.x + dir.dx;
                const ny = curr.y + dir.dy;

                if (this.game.grid.isValid(nx, ny)) {
                    const distToTarget = this.game.grid.getManhattanDistance({ x: nx, y: ny }, target);
                    if (distToTarget < bestDist) {
                        bestDist = distToTarget;
                        bestNext = { x: nx, y: ny };
                    }
                }
            }
            if (bestNext) {
                path.push(bestNext);
                curr = bestNext;
            } else {
                break;
            }
        }

        return path;
    }
}
