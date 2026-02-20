import { GridMap } from './GridMap';
import type { GridPoint } from './types';
import type { Actor } from '../entities/Actor';

export class PathFinder {
    private grid: GridMap;
    // Map of id -> Entity for collision detection
    private getEntity: (id: string) => Actor | undefined;

    constructor(grid: GridMap, getEntity: (id: string) => Actor | undefined) {
        this.grid = grid;
        this.getEntity = getEntity;
    }

    // Get all valid movement destinations for a player entity using BFS
    // Friends can be passed through, but end node cannot be occupied
    // Enemies and Base are strict obstacles
    public getValidMoveNodes(start: GridPoint, moveRange: number, faction: string, avoidBase: boolean = true): GridPoint[] {
        const results: GridPoint[] = [];
        const visited: Set<string> = new Set();
        const queue: { pos: GridPoint, steps: number }[] = [];

        queue.push({ pos: start, steps: 0 });
        visited.add(`${start.x},${start.y}`);

        const directions = [
            { dx: 0, dy: 1 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: -1, dy: 0 }
        ];

        while (queue.length > 0) {
            const current = queue.shift()!;

            // Add if end position is unoccupied
            const occupantId = this.grid.getOccupant(current.pos);
            const isSelf = current.pos.x === start.x && current.pos.y === start.y;

            if (isSelf || !occupantId) {
                // To avoid duplicate self insert, we only insert if not self or we handle self natively by the caller
                if (!isSelf) {
                    results.push(current.pos);
                }
            }

            if (current.steps < moveRange) {
                for (const dir of directions) {
                    const nx = current.pos.x + dir.dx;
                    const ny = current.pos.y + dir.dy;
                    const neighborStr = `${nx},${ny}`;

                    if (!this.grid.isValid(nx, ny) || visited.has(neighborStr)) {
                        continue;
                    }

                    const nextNode = this.grid.getNode(nx, ny);
                    if (!nextNode) continue;

                    // Collision check
                    let canPass = true;
                    if (nextNode.isBase && avoidBase) {
                        canPass = false; // Cannot pass through Base unless specified
                    } else if (nextNode.occupantId) {
                        const nextEntity = this.getEntity(nextNode.occupantId);
                        // Can pass through friendlies but not enemies
                        if (nextEntity && nextEntity.faction !== faction) {
                            canPass = false;
                        }
                    }

                    if (canPass) {
                        visited.add(neighborStr);
                        queue.push({ pos: { x: nx, y: ny }, steps: current.steps + 1 });
                    }
                }
            }
        }

        return results;
    }

    // Get attackable enemies based on Manhattan range (ignoring line of sight)
    public getValidAttackTargets(attacker: Actor): Actor[] {
        if (!attacker.position) return [];
        const targets: Actor[] = [];
        const attackRange = attacker.stats.attackRange;

        // Iterate over grid (simplistic approach)
        this.grid.forEachNode(node => {
            if (node.occupantId && node.occupantId !== attacker.id) {
                const target = this.getEntity(node.occupantId);
                if (target && target.faction !== attacker.faction && target.state !== "DEAD" && target.state !== "BENCHED" && target.position) {
                    const dist = this.grid.getManhattanDistance(attacker.position!, target.position);
                    if (dist <= attackRange) {
                        targets.push(target);
                    }
                }
            }
        });

        // Add base logic, if attacking player is Enemy, and Base is within range
        // Since Base takes 2x2, we check distance to any of its occupied tiles
        if (attacker.faction === "ENEMY" && attacker.position) {
            let baseInRange = false;
            for (const p of this.grid.basePoints) {
                if (this.grid.getManhattanDistance(attacker.position, p) <= attackRange) {
                    baseInRange = true;
                    break;
                }
            }
            if (baseInRange) {
                const baseEntity = this.getEntity("base_01");
                if (baseEntity && baseEntity.stats.hp > 0) {
                    targets.push(baseEntity);
                }
            }
        }

        return targets;
    }
}
