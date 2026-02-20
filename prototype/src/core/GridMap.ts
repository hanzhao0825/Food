import type { GridNode, GridPoint } from './types';

export class GridMap {
    public readonly width: number;
    public readonly height: number;
    private nodes: GridNode[][];

    // Base coordinates according to Level_01_Prototype.md: (5,5), (5,6), (6,5), (6,6)
    public readonly basePoints: GridPoint[] = [
        { x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 6 }
    ];

    constructor(width: number = 12, height: number = 12) {
        this.width = width;
        this.height = height;
        this.nodes = [];
        this.initializeGrid();
    }

    private initializeGrid() {
        for (let y = 0; y < this.height; y++) {
            const row: GridNode[] = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    pos: { x, y },
                    occupantId: null,
                    isBase: this.basePoints.some(p => p.x === x && p.y === y),
                    residualHeatTurns: 0
                });
            }
            this.nodes.push(row);
        }
    }

    public getNode(x: number, y: number): GridNode | null {
        if (!this.isValid(x, y)) return null;
        return this.nodes[y][x];
    }

    public getNodeByPoint(p: GridPoint): GridNode | null {
        return this.getNode(p.x, p.y);
    }

    public isValid(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    // Manhattan distance (|X1-X2| + |Y1-Y2|)
    public getManhattanDistance(p1: GridPoint, p2: GridPoint): number {
        return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    }

    public setOccupant(p: GridPoint, id: string | null): void {
        const node = this.getNodeByPoint(p);
        if (node) {
            node.occupantId = id;
        }
    }

    public getOccupant(p: GridPoint): string | null {
        const node = this.getNodeByPoint(p);
        return node ? node.occupantId : null;
    }

    // A simple grid iteration helper
    public forEachNode(callback: (node: GridNode) => void) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                callback(this.nodes[y][x]);
            }
        }
    }
}
