import type { GameEngine } from '../core/GameEngine';
import type { GridPoint } from '../core/types';
import { Slime, Siege, Assassin } from '../entities/Enemies';

export class WaveSpawner {
    private game: GameEngine;
    private idCounter: number = 0;

    constructor(game: GameEngine) {
        this.game = game;
    }

    // According to Level_01_Prototype.md: Fixed 8-turn schedule
    public spawnWaveForTurn(turn: number) {
        switch (turn) {
            case 0: // 开局预设: 北面较远 (5,10) (6,10) — 2x 软泥怪
                this.spawn("Slime", { x: 5, y: 10 });
                this.spawn("Slime", { x: 6, y: 10 });
                break;
            case 1: // Turn 1 [铺垫]: 北面两角 (3,11) (8,11) — 2x 软泥怪
                this.spawn("Slime", { x: 3, y: 11 });
                this.spawn("Slime", { x: 8, y: 11 });
                break;
            case 2: // Turn 2 [成群]: 东面 (11,5)x2 + 南面 (5,0)x2 — 4x 软泥怪
                this.spawn("Slime", { x: 11, y: 5 });
                this.spawn("Slime", { x: 11, y: 6 });
                this.spawn("Slime", { x: 5, y: 0 });
                this.spawn("Slime", { x: 6, y: 0 });
                break;
            case 3: // Turn 3 [重装来袭]: 西面 (0,5) — 1x 攻城锤
                this.spawn("Siege", { x: 0, y: 5 });
                break;
            case 4: // Turn 4 [施压]: 北面 (4,11)(5,11)(6,11) — 3x 软泥怪
                this.spawn("Slime", { x: 4, y: 11 });
                this.spawn("Slime", { x: 5, y: 11 });
                this.spawn("Slime", { x: 6, y: 11 });
                break;
            case 5: // Turn 5 [特种绞杀]: 东面两角 (11,2)(11,8) — 2x 突刺虫
                this.spawn("Assassin", { x: 11, y: 2 });
                this.spawn("Assassin", { x: 11, y: 8 });
                break;
            case 6: // Turn 6 [收拢围攻]: 北面 (4,11)(6,11) + 西面 (0,4)(0,6) — 4x 软泥怪
                this.spawn("Slime", { x: 4, y: 11 });
                this.spawn("Slime", { x: 6, y: 11 });
                this.spawn("Slime", { x: 0, y: 4 });
                this.spawn("Slime", { x: 0, y: 6 });
                break;
            case 7: // Turn 7 [终末检验]: 北面 (5,11)(6,11) — 2x 攻城锤
                this.spawn("Siege", { x: 5, y: 11 });
                this.spawn("Siege", { x: 6, y: 11 });
                break;
            case 8:
            default:
                // 停止刷怪 — Level Clear 判定
                break;
        }
    }

    // Execute offset if grid is blocked (Spawn Displacement from GDD 2)
    private spawn(type: "Slime" | "Siege" | "Assassin", pos: GridPoint) {
        let targetPos = pos;
        const occupant = this.game.grid.getOccupant(pos);
        if (occupant) {
            const offsetPos = this.findNearestValidSpawn(pos);
            if (!offsetPos) return; // Map completely full (edge case)
            targetPos = offsetPos;
        }

        this.idCounter++;
        const id = `mob_${this.idCounter}`;
        let mob;
        if (type === "Slime") mob = new Slime(id);
        else if (type === "Siege") mob = new Siege(id);
        else mob = new Assassin(id);

        mob.position = targetPos;
        mob.state = "IDLE";

        this.game.entities.set(mob.id, mob);
        this.game.grid.setOccupant(targetPos, mob.id);
    }

    private findNearestValidSpawn(start: GridPoint): GridPoint | null {
        // Expand outwards to find unblocked grid node on outer loop if possible
        const queue: GridPoint[] = [start];
        const visited: Set<string> = new Set([`${start.x},${start.y}`]);
        const directions = [{ dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (!this.game.grid.getOccupant(current)) {
                return current;
            }

            for (const dir of directions) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                if (this.game.grid.isValid(nx, ny) && !visited.has(`${nx},${ny}`)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        return null;
    }

}

