import { GridMap } from './GridMap';
import type { TurnPhase } from './types';
import { Actor, BaseEntity } from '../entities/Actor';
import { WaveSpawner } from '../systems/WaveSpawner';
import { EnemyAI } from '../systems/EnemyAI';
import { LogicEngine } from './LogicEngine';
import type { Enemy } from '../entities/Enemies';

export class GameEngine {
    public grid: GridMap;
    public entities: Map<string, Actor>;
    public base: BaseEntity;

    public turnCounter: number = 0; // Turn 0 is Deployment/Init
    public currentPhase: TurnPhase = "DEPLOYMENT";

    // Resource
    public heat: number = 30; // Starts at 30
    public maxHeat: number = 100;

    // Game Over condition
    public isGameOver: boolean = false;
    public hasWon: boolean = false;

    public logicEngine: LogicEngine;
    public spawner: WaveSpawner;
    public ai: EnemyAI;

    // React UI Hook
    public onStateChange?: () => void;

    constructor() {
        this.grid = new GridMap(12, 12);
        this.entities = new Map<string, Actor>();

        // Initialize Base
        this.base = new BaseEntity("base_01");
        this.entities.set(this.base.id, this.base);
        this.base.state = "IDLE";
        // Occupy the 2x2 grid for base
        this.grid.basePoints.forEach(p => {
            this.grid.setOccupant(p, this.base.id);
        });

        this.logicEngine = new LogicEngine(this);
        this.spawner = new WaveSpawner(this);
        this.ai = new EnemyAI(this, this.logicEngine);
    }

    public addHeat(amount: number) {
        this.heat = Math.min(this.maxHeat, this.heat + amount);
    }

    public consumeHeat(amount: number): boolean {
        if (this.heat >= amount) {
            this.heat -= amount;
            return true;
        }
        return false;
    }

    public isFieldPopulationFull(): boolean {
        let count = 0;
        this.entities.forEach(a => {
            if (a.faction === "PLAYER" && a.position && a.name !== "Base") count++;
        });
        return count >= 5;
    }

    /** Centralized death handler — clears grid, runs faction-specific logic. */
    public killActor(actor: Actor) {
        if (actor.position) {
            this.grid.setOccupant(actor.position, null);
            actor.position = null;
        }
        if (actor.faction === "ENEMY") {
            // Remove enemy from the entity map entirely
            this.entities.delete(actor.id);
            this.addHeat(15);
        } else if (actor.faction === "PLAYER" && actor.name !== "Base") {
            actor.state = "DEAD";
            actor.cooldownTimer = 2;
        }
    }

    public async endPlayerTurn() {
        if (this.currentPhase !== "PLAYER_MAIN") return;
        this.changePhase("ENEMY_RESOLVE");

        // Wait briefly before enemies start moving for better game feel
        if (this.onStateChange) this.onStateChange();
        await new Promise(r => setTimeout(r, 400));

        await this.resolveEnemyTurn();
    }

    public async resolveEnemyTurn() {
        // Run AI act() for each enemy alive sequentially
        const enemies: Enemy[] = [];
        this.entities.forEach(actor => {
            if (actor.faction === "ENEMY" && actor.stats.hp > 0 && actor.position) {
                enemies.push(actor as Enemy);
            }
        });

        // Await each enemy's action sequentially
        for (const e of enemies) {
            if (e.stats.hp > 0 && e.position) {
                await this.ai.act(e);
            }
        }

        // Once done, enter cleanup
        this.changePhase("ENVIRONMENT");
        this.resolveEnvironment();
    }

    private resolveEnvironment() {
        // 1. Process DoT effects (IGNITE) — check death after each tick
        this.entities.forEach(actor => {
            if (actor.stats.hp <= 0) return;

            const ignite = actor.statusEffects.find(e => e.type === "IGNITE");
            if (ignite) {
                actor.takeDamage(ignite.value || 15);
                if (actor.stats.hp <= 0) {
                    this.killActor(actor);
                    return; // skip effect cleanup for dead actor
                }
            }

            // Decrement & cleanup effects
            actor.statusEffects.forEach(e => e.duration--);
            actor.statusEffects = actor.statusEffects.filter(e => e.duration > 0);
        });

        // 2. Cleanup phase & State Resets
        this.entities.forEach(actor => {
            if (actor.faction === "PLAYER") {
                // Reset states
                if (actor.position && (actor.state === "ACTIONED" || actor.state === "MOVED")) {
                    actor.state = "IDLE";
                }

                // Process bench/dead actors
                if ((actor.state === "BENCHED" || actor.state === "DEAD")) {
                    // Decrease CD
                    if (actor.cooldownTimer > 0) {
                        actor.cooldownTimer--;
                    }
                    if (actor.cooldownTimer === 0 && actor.state === "DEAD") {
                        actor.state = "BENCHED"; // Dead becomes Benched after CD
                    }
                    // Heal 25% maxHP (GDD 3.3) — applies even when HP=0 (dead units)
                    if (actor.stats.hp < actor.stats.maxHp) {
                        actor.heal(Math.floor(actor.stats.maxHp * 0.25));
                    }
                }
            }
        });

        // 3. Grid Cleanup (Residual Heat)
        this.grid.forEachNode(node => {
            if (node.residualHeatTurns > 0) {
                node.residualHeatTurns--;
            }
        });

        // Increment turn
        this.turnCounter++;

        // Spawn waves according to turn
        this.spawner.spawnWaveForTurn(this.turnCounter);

        // Win condition check for wave 8
        if (this.turnCounter > 8) {
            let anyEnemyAlive = false;
            this.entities.forEach(actor => {
                if (actor.faction === "ENEMY" && actor.stats.hp > 0) anyEnemyAlive = true;
            });
            if (!anyEnemyAlive && this.base.stats.hp > 0) {
                this.hasWon = true;
                this.onStateChange?.();
                return;
            }
        }

        if (this.base.stats.hp <= 0) {
            this.isGameOver = true;
            this.onStateChange?.();
        } else {
            // Back to Player
            this.changePhase("PLAYER_MAIN");
            this.onStateChange?.();
        }
    }

    public changePhase(newPhase: TurnPhase) {
        this.currentPhase = newPhase;
    }
}
