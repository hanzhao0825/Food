import { useState, useRef, useEffect } from 'react';
import './App.css';
import { GameEngine } from './core/GameEngine';
import { PathFinder } from './core/PathFinder';
import { RecipeManager } from './systems/RecipeManager';
import { Potato, PorkScrap, ChiliPepper, Tomato } from './entities/Heroes';
import type { GridPoint } from './core/types';
import type { Actor } from './entities/Actor';
import { type RecipeConfig, RecipeList } from './data/Recipes';

function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const pathFinderRef = useRef<PathFinder | null>(null);
  const recipeMgrRef = useRef<RecipeManager | null>(null);

  const [, setTick] = useState(0);
  const forceRender = () => setTick(t => t + 1);

  // UI State
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<GridPoint[]>([]);
  const [validAttacks, setValidAttacks] = useState<Actor[]>([]);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);

  // Action Menu State
  const [pendingActionActor, setPendingActionActor] = useState<{ id: string, originalPos: GridPoint } | null>(null);
  const [isAttackMode, setIsAttackMode] = useState(false);

  // Recipe UI State
  const [availableRecipes, setAvailableRecipes] = useState<{ recipe: RecipeConfig, participants: Actor[], isAvailable: boolean, missing: string[] }[]>([]);
  const [showRecipeModal, setShowRecipeModal] = useState(false);


  // Compliance (GDD) States
  const [summoningActorId, setSummoningActorId] = useState<string | null>(null);
  const [validSummonSpots, setValidSummonSpots] = useState<GridPoint[]>([]);

  const [isRecipeTargetMode, setIsRecipeTargetMode] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<{ recipe: RecipeConfig, participants: Actor[] } | null>(null);
  const [recipeTargetSpots, setRecipeTargetSpots] = useState<GridPoint[]>([]);
  const [recipeAoeSpots, setRecipeAoeSpots] = useState<GridPoint[]>([]);

  useEffect(() => {
    const engine = new GameEngine();
    // All 8 heroes start on bench
    const allHeroes = [
      new Potato("h1"), new PorkScrap("h2"), new ChiliPepper("h3"), new Tomato("h4"),
      new Potato("b1"), new PorkScrap("b2"), new ChiliPepper("b3"), new Tomato("b4")
    ];
    allHeroes.forEach(hero => {
      hero.state = "BENCHED";
      hero.cooldownTimer = 0;
      engine.entities.set(hero.id, hero);
    });

    engineRef.current = engine;
    engine.onStateChange = forceRender;
    pathFinderRef.current = new PathFinder(engine.grid, (id) => engine.entities.get(id));
    recipeMgrRef.current = new RecipeManager(engine);

    // GDD Refinement: Spawn initial wave BEFORE deployment so player can see enemies
    engine.spawner.spawnWaveForTurn(0);

    forceRender();
  }, []);

  if (!engineRef.current || !pathFinderRef.current || !recipeMgrRef.current) return <div>Loading...</div>;
  const engine = engineRef.current;
  const pathFinder = pathFinderRef.current;
  const recipeMgr = recipeMgrRef.current;

  // Derived State
  const currentUnitsOnField = Array.from(engine.entities.values()).filter(a => a.faction === "PLAYER" && a.position && a.name !== "Base");
  const unitCount = currentUnitsOnField.length;

  // Helpers
  const isMoveHighlighed = (x: number, y: number) => validMoves.some(p => p.x === x && p.y === y);
  const isAttackHighlighted = (id: string) => validAttacks.some(a => a.id === id);

  const isSummonSpot = (x: number, y: number) => validSummonSpots.some(p => p.x === x && p.y === y);
  const isDeploymentSpot = (x: number, y: number) => {
    if (x >= 4 && x <= 7 && y >= 4 && y <= 7) {
      return !((x === 5 || x === 6) && (y === 5 || y === 6));
    }
    return false;
  };

  const getEntityIcon = (name: string) => {
    const icons: Record<string, string> = { "Potato": "🥔", "Pork Scrap": "🥩", "Chili Pepper": "🌶️", "Tomato": "🍅", "Slime": "🟢", "Siege": "🛡️", "Assassin": "🗡️", "Base": "🏠" };
    return icons[name] || "❓";
  };

  const UnitInfo = ({ actor }: { actor: Actor }) => (
    <div style={{ padding: '8px', backgroundColor: '#181825', borderRadius: '6px', minWidth: '140px', textAlign: 'left' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: actor.faction === "PLAYER" ? "#f5c2e7" : "#f38ba8", borderBottom: '1px solid #313244', marginBottom: '4px' }}>
        {actor.name} {actor.faction === "PLAYER" ? "" : `(${(actor as any).aiTrait})`}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#a6e3a1', marginBottom: '4px' }}>
        HP: {Math.floor(actor.stats.hp)} / {actor.stats.maxHp}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', fontSize: '10px' }}>
        <span>⚔️P:{actor.effectiveStats.pAtk}</span>
        <span>🔮M:{actor.effectiveStats.mAtk}</span>
        <span>🛡️A:{actor.effectiveStats.armor}</span>
        <span>✨R:{actor.effectiveStats.resist}</span>
        <span>👟M:{actor.effectiveStats.moveRange}</span>
        <span>🎯R:{actor.effectiveStats.attackRange}</span>
      </div>
      {actor.passive && (
        <div style={{ marginTop: '5px', borderTop: '1px dashed #45475a', paddingTop: '4px' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#fab387' }}>{actor.passive.name}</div>
          <div style={{ fontSize: '9px', color: '#a6adc8', fontStyle: 'italic' }}>{actor.passive.description}</div>
        </div>
      )}
    </div>
  );

  const clearSelection = () => {
    setSelectedActorId(null);
    setPendingActionActor(null);
    setIsAttackMode(false);
    setIsRecipeTargetMode(false);
    setPendingRecipe(null);
    setRecipeTargetSpots([]);
    setRecipeAoeSpots([]);
    setValidMoves([]);
    setValidAttacks([]);
    forceRender();
  };

  // Only cancel recipe targeting — keep pendingActionActor intact so the action menu re-appears
  const cancelRecipeTargeting = () => {
    setIsRecipeTargetMode(false);
    setPendingRecipe(null);
    setRecipeTargetSpots([]);
    setRecipeAoeSpots([]);
    setShowRecipeModal(true); // re-open the recipe modal so user can pick another action
    forceRender();
  };

  const finishActorAction = (actor: Actor) => {
    actor.state = "ACTIONED";
    clearSelection();
  };

  const handleCellMouseEnter = (x: number, y: number) => {
    if (isRecipeTargetMode && pendingRecipe) {
      const spots: GridPoint[] = [];
      const radius = pendingRecipe.recipe.aoeRadius || 0;
      const shape = pendingRecipe.recipe.aoeShape || "DIAMOND";
      const targetPoint = { x, y };

      // Only show AOE if the cell is a valid target
      const isValid = recipeTargetSpots.some(p => p.x === x && p.y === y);
      if (isValid) {
        for (let iy = 0; iy < 12; iy++) {
          for (let ix = 0; ix < 12; ix++) {
            const p = { x: ix, y: iy };
            const dx = Math.abs(targetPoint.x - ix);
            const dy = Math.abs(targetPoint.y - iy);
            // SQUARE = 3x3 block (Chebyshev: max(dx,dy) <= radius)
            // DIAMOND = rhombus (Manhattan: dx+dy <= radius)
            const inAoe = shape === "SQUARE"
              ? Math.max(dx, dy) <= radius
              : (dx + dy) <= radius;
            if (inAoe) spots.push(p);
          }
        }
      }
      setRecipeAoeSpots(spots);
      forceRender();
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (engine.currentPhase === "ENEMY_RESOLVE" || engine.currentPhase === "ENVIRONMENT") return;
    const occupantId = engine.grid.getOccupant({ x, y });

    // 1. Logic for Deployment (Handled via startManualSummon trigger usually, but cell clicks on empty board)
    if (engine.currentPhase === "DEPLOYMENT" && !summoningActorId) {
      // Users should pick from bench first.
      return;
    }

    // 2. Recipe Targeting
    if (isRecipeTargetMode && pendingRecipe) {
      const isValid = recipeTargetSpots.some(p => p.x === x && p.y === y);
      if (isValid) {
        recipeMgr.executeRecipe(pendingRecipe.recipe, pendingRecipe.participants, { x, y });
        clearSelection();
      }
      return;
    }

    // 3. Manual Summon
    if (summoningActorId) {
      if (isSummonSpot(x, y) && !occupantId) {
        const actor = engine.entities.get(summoningActorId)!;
        actor.position = { x, y };

        // Residual Heat Bonus: If placed on heat, can move immediately (IDLE)
        const node = engine.grid.getNode(x, y);
        const hasHeat = node && node.residualHeatTurns > 0;

        if (hasHeat) {
          node!.residualHeatTurns = 0; // GDD 3.3: One-time use
        }

        actor.state = (engine.currentPhase === "DEPLOYMENT" || hasHeat) ? "IDLE" : "ACTIONED";
        engine.grid.setOccupant({ x, y }, actor.id);

        if (engine.currentPhase === "DEPLOYMENT") {
          let count = 0;
          engine.entities.forEach(a => { if (a.faction === "PLAYER" && a.position && a.name !== "Base") count++; });
          if (count >= 4) {
            engine.turnCounter = 1;
            engine.changePhase("PLAYER_MAIN");
            // Wave 0 was already spawned at init
          }
        }
      }
      setSummoningActorId(null);
      setValidSummonSpots([]);
      forceRender();
      return;
    }

    // 4. Swap Lockdown - REMOVED per GDD V2
    /*
    if (engine.currentPhase === "UI_LOCKDOWN" && swapQueue.length > 0) {
      ...
    }
    */

    // 5. Normal Play
    if (isAttackMode && pendingActionActor) {
      if (isAttackHighlighted(occupantId || "")) {
        engine.logicEngine.processAttackResolution(engine.entities.get(pendingActionActor.id)!, engine.entities.get(occupantId!)!);
        finishActorAction(engine.entities.get(pendingActionActor.id)!);
      } else {
        setIsAttackMode(false);
        setValidAttacks([]);
      }
      return;
    }

    if (selectedActorId && !pendingActionActor) {
      const actor = engine.entities.get(selectedActorId)!;
      if (occupantId === selectedActorId) {
        actor.state = "MOVED";
        setPendingActionActor({ id: actor.id, originalPos: { ...actor.position! } });
        setValidMoves([]);
        forceRender();
        return;
      }
      if (isMoveHighlighed(x, y)) {
        const originalPos = { ...actor.position! };
        engine.grid.setOccupant(actor.position!, null);
        actor.position = { x, y };
        engine.grid.setOccupant({ x, y }, actor.id);
        actor.state = "MOVED";
        setPendingActionActor({ id: actor.id, originalPos });
        setValidMoves([]);
        forceRender();
        return;
      }
      clearSelection();
    } else if (occupantId && !pendingActionActor) {
      const actor = engine.entities.get(occupantId);
      if (actor && actor.faction === "PLAYER" && actor.name !== "Base" && actor.state === "IDLE") {
        setSelectedActorId(actor.id);
        setValidMoves(pathFinder.getValidMoveNodes(actor.position!, actor.stats.moveRange, "PLAYER"));
        forceRender();
      }
    }
  };

  const handleRecipeTrigger = (r: { recipe: RecipeConfig, participants: Actor[], isAvailable: boolean, missing: string[] }) => {
    if (!r.isAvailable) return; // Should not happen if button is disabled, but for safety
    setShowRecipeModal(false);
    if (r.recipe.targetMode === "GLOBAL_AOE") {
      recipeMgr.executeRecipe(r.recipe, r.participants);
      clearSelection();
    } else {
      setIsRecipeTargetMode(true);
      setPendingRecipe({ recipe: r.recipe, participants: r.participants });

      // Calculate valid target spots based on castRange from any participant
      const spots: GridPoint[] = [];
      const range = r.recipe.castRange;
      for (let y = 0; y < 12; y++) {
        for (let x = 0; x < 12; x++) {
          const point = { x, y };
          const inRange = r.participants.some(p =>
            p.position && engine.grid.getManhattanDistance(p.position, point) <= range
          );
          if (inRange) {
            spots.push(point);
          }
        }
      }
      setRecipeTargetSpots(spots);
      setAvailableRecipes([]);
      forceRender();
    }
  };

  const startManualSummon = (actor: Actor) => {
    if (engine.currentPhase !== "DEPLOYMENT" && engine.isFieldPopulationFull()) {
      alert("Maximum 5 units on field!");
      return;
    }
    setSummoningActorId(actor.id);
    const spots: GridPoint[] = [];

    if (engine.currentPhase === "DEPLOYMENT") {
      for (let iy = 0; iy < 12; iy++) {
        for (let ix = 0; ix < 12; ix++) {
          if (isDeploymentSpot(ix, iy) && !engine.grid.getOccupant({ x: ix, y: iy })) {
            spots.push({ x: ix, y: iy });
          }
        }
      }
    } else {
      // Normal proximity-based summon (GDD 3.3)
      for (let iy = 0; iy < 12; iy++) {
        for (let ix = 0; ix < 12; ix++) {
          if (engine.grid.getOccupant({ x: ix, y: iy })) continue;
          const node = engine.grid.getNode(ix, iy);
          if (!node || node.isBase) continue;

          let allowed = false;
          // Rule 1: Near allies
          engine.entities.forEach(f => {
            if (f.faction === "PLAYER" && f.position && f.name !== "Base") {
              if (Math.abs(f.position.x - ix) + Math.abs(f.position.y - iy) === 1) allowed = true;
            }
          });
          // Rule 2: Near base
          if (!allowed && ix >= 4 && ix <= 7 && iy >= 4 && iy <= 7) allowed = true;
          // Rule 3: Residual Heat (Kitchen Heat GDD 3.2)
          if (!allowed && node.residualHeatTurns > 0) allowed = true;

          if (allowed) spots.push({ x: ix, y: iy });
        }
      }
    }
    setValidSummonSpots(spots);
    forceRender();
  };

  const renderGrid = () => {
    const cells = [];
    for (let y = 11; y >= 0; y--) {
      for (let x = 0; x < 12; x++) {
        const node = engine.grid.getNode(x, y);
        if (!node) continue;
        let classes = "grid-cell ";
        if (node.isBase) classes += "entity-base ";
        const actor = node.occupantId ? engine.entities.get(node.occupantId) : null;
        if (isMoveHighlighed(x, y)) classes += "highlight-move ";

        if (isSummonSpot(x, y)) classes += "highlight-summon ";
        if (isRecipeTargetMode && recipeTargetSpots.some(p => p.x === x && p.y === y)) classes += "highlight-recipe-target ";
        if (isRecipeTargetMode && recipeAoeSpots.some(p => p.x === x && p.y === y)) classes += "highlight-recipe-aoe ";

        if (engine.currentPhase === "DEPLOYMENT" && isDeploymentSpot(x, y)) classes += "highlight-deploy ";
        if (node.residualHeatTurns > 0) classes += "highlight-heat ";
        if (actor && isAttackHighlighted(actor.id)) classes += "highlight-attack ";

        let content = actor ? <div className={`${actor.faction === "PLAYER" ? "entity-player" : "entity-enemy"} ${actor.state === "ACTIONED" ? "actioned" : ""}`}>{getEntityIcon(actor.name)}</div> : (node.isBase ? <div className="entity-base">{getEntityIcon("Base")}</div> : null);
        let hp = actor ? <div className="hp-bar" style={{ width: `${(actor.stats.hp / actor.stats.maxHp) * 100}%` }}></div> : null;
        let heatIcon = node.residualHeatTurns > 0 ? <div style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '12px', zIndex: 5 }}>🔥</div> : null;

        // Status effect badges - show on the actor
        const STATUS_ICONS: Record<string, string> = { IGNITE: '🔥', CORRODE: '🧪', SLOW: '❄️', STUN: '💫' };
        let statusBadges = actor && actor.statusEffects.length > 0 ? (
          <div style={{ position: 'absolute', bottom: '4px', left: '2px', display: 'flex', gap: '1px', zIndex: 6 }}>
            {actor.statusEffects.map((ef, i) => (
              <div key={i} title={`${ef.type} (${ef.duration}t)`} style={{ fontSize: '9px', lineHeight: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '3px', padding: '0 1px' }}>
                {STATUS_ICONS[ef.type] || '?'}{ef.duration}
              </div>
            ))}
          </div>
        ) : null;

        cells.push(
          <div
            key={`${x}-${y}`}
            className={classes}
            onClick={() => handleCellClick(x, y)}
            onMouseEnter={() => {
              setHoveredActorId(node.occupantId || (node.isBase ? engine.base.id : null));
              handleCellMouseEnter(x, y);
            }}
            onMouseLeave={() => {
              setHoveredActorId(null);
              if (isRecipeTargetMode) setRecipeAoeSpots([]);
            }}
          >
            {content}{hp}{heatIcon}{statusBadges}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="App">
      <div className="ui-panel">
        <div>
          <h2>Turn: {engine.turnCounter} | Phase: {engine.currentPhase} {engine.turnCounter === 0 && "(Initial Deployment)"}</h2>
          {engine.isGameOver && <h1 style={{ color: 'red' }}>GAME OVER</h1>}
          {engine.hasWon && <h1 style={{ color: 'green' }}>VICTORY!</h1>}
        </div>
        <div>
          <div style={{ fontWeight: 'bold' }}>HEAT ({engine.heat}/{engine.maxHeat})</div>
          <div className="heat-bar-container"><div className="heat-bar-fill" style={{ width: `${(engine.heat / engine.maxHeat) * 100}%` }}></div></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', color: unitCount >= 5 ? '#f38ba8' : '#a6e3a1' }}>Field Units: {unitCount} / 5</div>
          <button className="btn" onClick={() => { engine.endPlayerTurn(); clearSelection(); }} disabled={engine.currentPhase !== "PLAYER_MAIN"}>End Turn</button>
        </div>
      </div>

      <div className="grid-container">{renderGrid()}</div>

      {hoveredActorId && engine.entities.get(hoveredActorId) && (
        <div className="tooltip-panel" style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1000 }}>
          <UnitInfo actor={engine.entities.get(hoveredActorId)!} />
        </div>
      )}

      {/* Deployment UI */}
      {engine.currentPhase === "DEPLOYMENT" && (
        <div style={{ position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(24, 24, 37, 0.9)', padding: '15px 30px', borderRadius: '20px', border: '2px solid #fab387', zIndex: 1000, pointerEvents: 'none', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
          <h3 style={{ margin: '0 0 5px 0', color: '#fab387' }}>Initial Deployment Phase</h3>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#cdd6f4' }}>Deploying: {unitCount} / 4</div>
          <div style={{ fontSize: '12px', color: '#a6adc8', marginTop: '5px' }}>Pick from Bench and place in orange cells.</div>
        </div>
      )}

      {/* Recipe Target Mode UI */}
      {isRecipeTargetMode && (
        <div style={{ position: 'fixed', bottom: '80px', left: '20px', backgroundColor: 'rgba(24, 24, 37, 0.95)', padding: '10px 18px', borderRadius: '12px', border: '2px solid #cba6f7', zIndex: 1000, textAlign: 'left', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', maxWidth: '280px' }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#cba6f7', marginBottom: '4px' }}>🎯 {pendingRecipe?.recipe.aliasName}</div>
          <div style={{ fontSize: '11px', color: '#a6adc8', marginBottom: '8px' }}>点击高亮区域释放技能</div>
          <button className="btn" style={{ padding: '4px 12px', fontSize: '11px' }} onClick={cancelRecipeTargeting}>取消</button>
        </div>
      )}

      {/* Bench UI for Manual Summon */}
      <div className="bench-panel" style={{ position: 'fixed', bottom: '80px', right: '20px', backgroundColor: '#181825', padding: '15px', borderRadius: '10px', border: '1px solid #45475a', width: '300px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>🪑 Bench (Manual Summon)</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Array.from(engine.entities.values())
            .filter(e => e.faction === "PLAYER" && (e.state === "BENCHED" || e.state === "DEAD"))
            .map(e => (
              <div key={e.id} className="bench-item"
                style={{
                  padding: '8px',
                  backgroundColor: '#1e1e2e',
                  borderRadius: '8px',
                  border: summoningActorId === e.id ? '2px solid #fab387' : '1px solid #45475a',
                  opacity: (e.cooldownTimer === 0 && e.state === "BENCHED") ? 1 : 0.5,
                  cursor: (e.cooldownTimer === 0 && e.state === "BENCHED") ? 'pointer' : 'not-allowed',
                  width: '100px',
                  position: 'relative'
                }}
                onMouseEnter={() => setHoveredActorId(e.id)}
                onMouseLeave={() => setHoveredActorId(null)}
                onClick={() => (e.cooldownTimer === 0 && e.state === "BENCHED") && startManualSummon(e)}
              >
                <div style={{ fontSize: '24px' }}>{getEntityIcon(e.name)}</div>

                {/* HP Bar on bench */}
                <div style={{ width: '100%', height: '4px', backgroundColor: '#313244', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(e.stats.hp / e.stats.maxHp) * 100}%`,
                    backgroundColor: e.stats.hp / e.stats.maxHp > 0.5 ? '#a6e3a1' : e.stats.hp / e.stats.maxHp > 0.25 ? '#f9e2af' : '#f38ba8',
                    transition: 'width 0.3s ease',
                    borderRadius: '2px'
                  }} />
                </div>
                <div style={{ fontSize: '8px', color: '#6c7086', marginTop: '1px' }}>
                  {Math.floor(e.stats.hp)}/{e.stats.maxHp}
                </div>

                {/* Unified Info in Bench - Show only on hover */}
                {hoveredActorId === e.id && (
                  <div style={{ position: 'absolute', bottom: '110%', left: '0', zIndex: 1001 }}>
                    <UnitInfo actor={e} />
                  </div>
                )}

                <div style={{ fontSize: '9px', fontWeight: 'bold', color: e.cooldownTimer > 0 ? '#f38ba8' : '#89b4fa', marginTop: '2px' }}>
                  {e.cooldownTimer > 0 ? `CD:${e.cooldownTimer}` : (e.state === "DEAD" ? "RIP" : "READY")}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="compendium-panel" style={{ position: 'fixed', top: '20px', left: '20px', backgroundColor: '#181825', padding: '15px', borderRadius: '10px', border: '1px dashed #cba6f7', width: '280px', maxHeight: '50vh', overflowY: 'auto' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#cba6f7' }}>📜 Recipe Compendium</h4>
        {RecipeList.map(r => (
          <div key={r.id} style={{ fontSize: '12px', marginBottom: '12px', borderBottom: '1px solid #313244', paddingBottom: '8px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <div style={{ fontWeight: 'bold', color: '#f5c2e7' }}>{r.aliasName}</div>
              <div style={{ fontSize: '10px', color: '#fab387', fontWeight: 'bold' }}>🔥 {r.heatCost}</div>
            </div>
            <div style={{ fontSize: '10px', color: '#a6adc8', fontStyle: 'italic', marginBottom: '5px' }}>{r.description}</div>
            <div style={{ fontSize: '10px', color: '#cba6f7' }}>🥗 {r.ingredients.join(' + ')}</div>
          </div>
        ))}
      </div>

      {pendingActionActor && !isAttackMode && !isRecipeTargetMode && (
        <div className="overlay" style={{ backgroundColor: 'transparent' }}>
          <div className="modal" style={{ pointerEvents: 'auto' }}>
            <h3>Action Menu</h3>
            <button className="btn" onClick={() => { const actor = engine.entities.get(pendingActionActor.id)!; const targets = pathFinder.getValidAttackTargets(actor); if (targets.length) { setIsAttackMode(true); setValidAttacks(targets); } else alert("No targets!"); }}>🗡️ Attack</button>
            <button className="btn" style={{ backgroundColor: '#cba6f7' }} onClick={() => { const actor = engine.entities.get(pendingActionActor.id)!; const recipes = recipeMgr.getAvailableRecipesForInitiator(actor); if (recipes.length) { setAvailableRecipes(recipes); setShowRecipeModal(true); } else alert("No recipes!"); }}>🍲 Cooking</button>
            <button className="btn" style={{ backgroundColor: '#f38ba8' }} onClick={() => finishActorAction(engine.entities.get(pendingActionActor.id)!)}>🛡️ Standby</button>
            <button className="btn" style={{ fontSize: '11px', marginTop: '10px' }} onClick={() => { const actor = engine.entities.get(pendingActionActor.id)!; engine.grid.setOccupant(actor.position!, null); actor.position = pendingActionActor.originalPos; engine.grid.setOccupant(actor.position, actor.id); actor.state = "IDLE"; clearSelection(); }}>Cancel Move</button>
          </div>
        </div>
      )}

      {showRecipeModal && (
        <div className="overlay">
          <div className="modal" style={{ width: '450px' }}>
            <h2 style={{ color: '#cba6f7' }}>🍲 Choose Recipe</h2>
            {availableRecipes.map(r => (
              <div key={r.recipe.id}
                style={{
                  padding: '12px',
                  border: r.isAvailable ? '2px solid #cba6f7' : '1px solid #45475a',
                  marginBottom: '10px',
                  cursor: r.isAvailable ? 'pointer' : 'not-allowed',
                  backgroundColor: r.isAvailable ? '#313244' : '#181825',
                  borderRadius: '10px',
                  textAlign: 'left'
                }}
                onClick={() => handleRecipeTrigger(r)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <b style={{ color: r.isAvailable ? '#f5c2e7' : '#585b70' }}>{r.recipe.aliasName}</b>
                  <span style={{ fontSize: '12px', color: r.isAvailable ? '#fab387' : '#585b70' }}>🔥 {r.recipe.heatCost} Heat</span>
                </div>
                <div style={{ fontSize: '11px', color: '#cdd6f4', marginBottom: '5px' }}>{r.recipe.description}</div>
                {!r.isAvailable && <div style={{ fontSize: '10px', color: '#f38ba8' }}>⚠️ {r.missing.join(', ')}</div>}
              </div>
            ))}
            <button className="btn" onClick={() => setShowRecipeModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Swap Detected Modal - REMOVED per GDD V2 */}
      {/* 
      {swapQueue.length > 0 && (
        ...
      )}
      */}
      {/* Debug Cheat Button */}
      <button
        style={{ position: 'fixed', top: '10px', right: '10px', opacity: 0.3, fontSize: '10px', backgroundColor: '#313244', color: '#cdd6f4', border: 'none', borderRadius: '4px', cursor: 'pointer', zIndex: 9999 }}
        onClick={() => { engine.addHeat(100); forceRender(); }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
      >
        🛠️ Debug: Set Heat 100
      </button>
    </div>
  );
}

export default App;
