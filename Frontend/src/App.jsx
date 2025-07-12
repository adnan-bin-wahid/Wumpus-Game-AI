import { useState, useEffect } from 'react'
import './App.css'
import KnowledgeBase from './components/KnowledgeBase'
import WumpusGrid from './components/WumpusGrid'

// Game configuration
const gameConfig = {
  numGold: 1,
  numPits: 5,
  numWumpus: 2,
}

// Helper function to check if a position is valid
const isValidPosition = (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10;

// Helper function to get adjacent cells
const getAdjacentCells = (x, y) => {
  return [
    [x-1, y], [x+1, y],
    [x, y-1], [x, y+1]
  ].filter(([x, y]) => isValidPosition(x, y));
};

// Helper function to place elements randomly
const placeRandomElements = (grid, count, element, adjacentEffect) => {
  let placed = 0;
  while (placed < count) {
    const x = Math.floor(Math.random() * 10);
    const y = Math.floor(Math.random() * 10);
    
    // Don't place in starting position or its adjacent cells
    if ((x === 0 && y === 9) || 
        (x === 1 && y === 9) || 
        (x === 0 && y === 8)) {
      continue;
    }
    
    if (!grid[y][x][element]) {
      grid[y][x][element] = true;
      
      // Add adjacent effects
      if (adjacentEffect) {
        getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
          grid[adjY][adjX][adjacentEffect] = true;
        });
      }
      placed++;
    }
  }
  return grid;
};

function App() {
  const [gameMode, setGameMode] = useState(null);
  const [simulationState, setSimulationState] = useState('stopped');
  const [showPopup, setShowPopup] = useState(false);
  const [popupContent, setPopupContent] = useState({ message: '', sound: '' });
  const [backgroundMusic] = useState(new Audio('/background_sound.mp3'));
  const [goldSound] = useState(new Audio('/gold.mp3'));
  const [pitSound] = useState(new Audio('/pit.mp3'));
  const [wumpusSound] = useState(new Audio('/wumpus.mp3'));
  const [transitionSound] = useState(new Audio('/transition.mp3'));
  const [percepts, setPercepts] = useState({
    breeze: false,
    stench: false,
    glitter: false
  });

  // Configure sounds
  useEffect(() => {
    backgroundMusic.loop = true;
    transitionSound.volume = 0.3;
    
    return () => {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
      transitionSound.pause();
      transitionSound.currentTime = 0;
    };
  }, [backgroundMusic, transitionSound]);

  // Start background music when game mode is selected
  useEffect(() => {
    if (gameMode) {
      backgroundMusic.play();
      updatePercepts({x: 0, y: 9});
    } else {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  }, [gameMode, backgroundMusic]);

  // Enhanced AI Knowledge Base State with detailed tracking
  const [aiKnowledge, setAiKnowledge] = useState(() =>
    Array(10).fill().map(() => Array(10).fill().map(() => ({
      safe: false,
      possiblePit: false,
      possibleWumpus: false,
      visited: false,
      wumpusKilled: false,
      hasGold: false,
      explored: false
    })))
  );

  // Add AI state tracking
  const [aiState, setAiState] = useState({
    hasShot: false,
    wumpusKilled: false,
    targetPosition: null,
    plan: [],
    currentPlanIndex: 0,
    searchingForGold: true,
    returningHome: false
  });

  // Initialize grid with game elements
  const initializeGrid = () => {
    let grid = Array(10).fill().map(() => Array(10).fill().map(() => ({
      visited: false,
      wumpus: false,
      pit: false,
      gold: false,
      breeze: false,
      stench: false,
      glitter: false
    })));

    // Place elements in order: pits, wumpus, gold
    grid = placeRandomElements(grid, gameConfig.numPits, 'pit', 'breeze');
    grid = placeRandomElements(grid, gameConfig.numWumpus, 'wumpus', 'stench');
    grid = placeRandomElements(grid, gameConfig.numGold, 'gold', 'glitter');

    // Set starting position as visited
    grid[9][0].visited = true;
    
    return grid;
  };

  const [gameState, setGameState] = useState({
    playerPosition: { 
      x: 0, 
      y: 9,
      facing: 'right'
    },
    hasGold: false,
    hasArrow: true,
    isAlive: true,
    grid: initializeGrid()
  });

  // Utility: Find Gold Cell
  function findGoldCell(grid) {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (grid[y][x].gold) return { x, y };
      }
    }
    return null;
  }

  // Utility: Get Direction
  function getDirection(from, to) {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'down';
    if (to.y < from.y) return 'up';
    return null;
  }

  // Heuristic function for A*
  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // Enhanced A* Pathfinding
  function aStar(start, goal, knowledge, allowRisky = false) {
    const open = [{ pos: start, path: [start], cost: 0 }];
    const closed = Array(10).fill().map(() => Array(10).fill(false));
    
    while (open.length > 0) {
      // Sort by f(n) = g(n) + h(n)
      open.sort((a, b) => {
        const fA = a.cost + heuristic(a.pos, goal);
        const fB = b.cost + heuristic(b.pos, goal);
        return fA - fB;
      });
      
      const current = open.shift();
      const { x, y } = current.pos;
      
      if (x === goal.x && y === goal.y) {
        return current.path;
      }
      
      if (closed[y][x]) continue;
      closed[y][x] = true;
      
      getAdjacentCells(x, y).forEach(([nx, ny]) => {
        if (closed[ny][nx]) return;
        
        const cell = knowledge[ny][nx];
        const isSafe = cell.safe || cell.visited;
        const isPossibleDanger = cell.possiblePit || (cell.possibleWumpus && !aiState.wumpusKilled);
        
        // Allow movement if safe, or if we're allowing risky moves and it's not definitely dangerous
        if (isSafe || (allowRisky && !isPossibleDanger)) {
          const newCost = current.cost + 1;
          const existingNode = open.find(node => node.pos.x === nx && node.pos.y === ny);
          
          if (!existingNode || newCost < existingNode.cost) {
            const newNode = {
              pos: { x: nx, y: ny },
              path: [...current.path, { x: nx, y: ny }],
              cost: newCost
            };
            
            if (existingNode) {
              Object.assign(existingNode, newNode);
            } else {
              open.push(newNode);
            }
          }
        }
      });
    }
    
    return null; // No path found
  }

  // Apply logical inference to deduce safe/unsafe cells
  function applyLogicalInference(knowledge) {
    let changed = true;
    
    while (changed) {
      changed = false;
      
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (knowledge[y][x].visited) continue;
          
          const adjacentCells = getAdjacentCells(x, y);
          
          // Check if we can deduce this cell is safe through elimination
          if (knowledge[y][x].possiblePit || knowledge[y][x].possibleWumpus) {
            const riskyCells = adjacentCells.filter(([adjX, adjY]) => 
              knowledge[adjY][adjX].possiblePit || knowledge[adjY][adjX].possibleWumpus
            );
            
            if (riskyCells.length === 1) {
              // This cell might be safe if it's the only risky one
              // More complex logic would be needed for full inference
            }
          }
        }
      }
    }
  }

  // Enhanced AI Knowledge Update using First Order Logic
  function updateAIKnowledge(position, percepts) {
    const { x, y } = position;
    const newKnowledge = aiKnowledge.map(row => row.map(cell => ({ ...cell })));
    
    // Mark current position as visited and safe
    newKnowledge[y][x].visited = true;
    newKnowledge[y][x].safe = true;
    newKnowledge[y][x].explored = true;
    
    // First Order Logic Rules Implementation
    
    // Rule 1: If no breeze, then no pits in adjacent cells
    if (!percepts.breeze) {
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        newKnowledge[adjY][adjX].possiblePit = false;
        if (!newKnowledge[adjY][adjX].possibleWumpus) {
          newKnowledge[adjY][adjX].safe = true;
        }
      });
    } else {
      // Rule 2: If breeze, then at least one adjacent cell has a pit
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        if (!newKnowledge[adjY][adjX].visited) {
          newKnowledge[adjY][adjX].possiblePit = true;
          newKnowledge[adjY][adjX].safe = false;
        }
      });
    }
    
    // Rule 3: If no stench, then no wumpus in adjacent cells
    if (!percepts.stench) {
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        newKnowledge[adjY][adjX].possibleWumpus = false;
        if (!newKnowledge[adjY][adjX].possiblePit) {
          newKnowledge[adjY][adjX].safe = true;
        }
      });
    } else {
      // Rule 4: If stench and wumpus not killed, then wumpus in adjacent cell
      if (!aiState.wumpusKilled) {
        getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
          if (!newKnowledge[adjY][adjX].visited) {
            newKnowledge[adjY][adjX].possibleWumpus = true;
            newKnowledge[adjY][adjX].safe = false;
          }
        });
      }
    }
    
    // Rule 5: If glitter, gold is here
    if (percepts.glitter) {
      newKnowledge[y][x].hasGold = true;
    }
    
    // Apply logical inference to reduce uncertainty
    applyLogicalInference(newKnowledge);
    
    setAiKnowledge(newKnowledge);
  }

  // Find the best safe cell to explore
  function findBestExplorationTarget(knowledge, currentPos) {
    const safeCells = [];
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (!knowledge[y][x].visited && knowledge[y][x].safe) {
          const distance = heuristic(currentPos, { x, y });
          safeCells.push({ x, y, distance });
        }
      }
    }
    
    // Sort by distance and return the closest safe cell
    safeCells.sort((a, b) => a.distance - b.distance);
    return safeCells.length > 0 ? { x: safeCells[0].x, y: safeCells[0].y } : null;
  }

  // Enhanced AI Step with better decision making
  function aiStep() {
    if (!gameState.isAlive || simulationState === 'stopped') return;
    
    const { x, y } = gameState.playerPosition;
    const cell = gameState.grid[y][x];
    const percepts = {
      breeze: cell.breeze,
      stench: cell.stench,
      glitter: cell.gold,
    };
    
    // Update knowledge base
    updateAIKnowledge({ x, y }, percepts);
    
    // Decision making logic
    
    // 1. If glitter is perceived, grab the gold
    if (percepts.glitter && !gameState.hasGold) {
      handleGrab();
      setAiState(prev => ({ ...prev, searchingForGold: false, returningHome: true }));
      return;
    }
    
    // 2. If we have gold and at start position, climb out
    if (gameState.hasGold && x === 0 && y === 9) {
      showGamePopup("Congratulations! You won! You got the gold and made it back safely!", goldSound);
      setSimulationState('stopped');
      return;
    }
    
    // 3. If we smell stench and have arrow, consider shooting
    if (percepts.stench && gameState.hasArrow && !aiState.hasShot) {
      // Simple shooting strategy: shoot if we're confident about wumpus direction
      const adjacentCells = getAdjacentCells(x, y);
      const suspiciousCells = adjacentCells.filter(([adjX, adjY]) => 
        aiKnowledge[adjY][adjX].possibleWumpus && !aiKnowledge[adjY][adjX].visited
      );
      
      if (suspiciousCells.length === 1) {
        const [targetX, targetY] = suspiciousCells[0];
        const direction = getDirection({ x, y }, { x: targetX, y: targetY });
        
        if (gameState.playerPosition.facing !== direction) {
          handleMove(direction); // Turn to face the target
          return;
        } else {
          handleShoot();
          setAiState(prev => ({ ...prev, hasShot: true, wumpusKilled: true }));
          return;
        }
      }
    }
    
    // 4. Plan movement
    let target = null;
    
    if (aiState.searchingForGold) {
      // Look for gold or explore safely
      target = findGoldCell(gameState.grid);
      if (!target) {
        // Find safe unexplored cell
        target = findBestExplorationTarget(aiKnowledge, { x, y });
      }
    } else {
      // Return home
      target = { x: 0, y: 9 };
    }
    
    if (!target) {
      // No safe target found, try risky exploration as last resort
      target = findBestExplorationTarget(aiKnowledge, { x, y });
      if (!target) {
        setSimulationState('paused');
        console.log("AI stuck: No safe moves available");
        return;
      }
    }
    
    // Find path to target
    const path = aStar({ x, y }, target, aiKnowledge, false);
    
    if (path && path.length > 1) {
      const next = path[1];
      const direction = getDirection({ x, y }, next);
      handleMove(direction);
    } else {
      // Try risky path as last resort
      const riskyPath = aStar({ x, y }, target, aiKnowledge, true);
      if (riskyPath && riskyPath.length > 1) {
        const next = riskyPath[1];
        const direction = getDirection({ x, y }, next);
        handleMove(direction);
      } else {
        setSimulationState('paused');
        console.log("AI stuck: No path to target");
      }
    }
  }

  // Enhanced useEffect for AI stepping
  useEffect(() => {
    if (gameMode === 'ai' && (simulationState === 'running' || simulationState === 'step')) {
      if (simulationState === 'step') {
        // Execute one step then stop
        setTimeout(() => {
          aiStep();
          setSimulationState('paused');
        }, 100);
      } else if (simulationState === 'running') {
        // Continuous execution
        const interval = setInterval(aiStep, 800); // 800ms per step for better visualization
        return () => clearInterval(interval);
      }
    }
  }, [gameMode, simulationState, gameState, aiKnowledge, aiState]);

  const showGamePopup = (message, sound) => {
    setPopupContent({ message, sound });
    setShowPopup(true);
    if (sound) {
      backgroundMusic.pause();
      sound.play();
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    handleRestart();
    backgroundMusic.play();
  };

  // Popup component
  const Popup = ({ message, onClose }) => (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h2>{message}</h2>
        </div>
        <div className="popup-actions">
          <button className="control-btn restart popup-restart" onClick={onClose}>
            🔄 Restart Game
          </button>
        </div>
      </div>
    </div>
  );

  // Update percepts when player moves
  const updatePercepts = (position) => {
    if (!position || !gameState?.grid) return;
    
    const { x, y } = position;
    const cell = gameState.grid[y][x];
    
    if (cell) {
      setPercepts({
        breeze: cell.breeze,
        stench: cell.stench,
        glitter: cell.gold // Glitter if gold is in the same square
      });
    }
  };

  const handleMove = (direction) => {
    if (!gameState.isAlive) return;
    
    // First, check if we need to change direction
    if (gameState.playerPosition.facing !== direction) {
      // Just change direction
      setGameState(prev => ({
        ...prev,
        playerPosition: {
          ...prev.playerPosition,
          facing: direction
        }
      }));
      // Play transition sound for rotation
      transitionSound.currentTime = 0;
      transitionSound.play();
      return;
    }
    
    // If we're already facing the right direction, move
    const newPosition = {
      ...gameState.playerPosition
    };
    
    let willMove = false;
    
    switch (direction) {
      case 'up':
        if (newPosition.y > 0) {
          newPosition.y--;
          willMove = true;
        }
        break;
      case 'down':
        if (newPosition.y < 9) {
          newPosition.y++;
          willMove = true;
        }
        break;
      case 'left':
        if (newPosition.x > 0) {
          newPosition.x--;
          willMove = true;
        }
        break;
      case 'right':
        if (newPosition.x < 9) {
          newPosition.x++;
          willMove = true;
        }
        break;
    }

    // Play transition sound if the player will actually move
    if (willMove) {
      transitionSound.currentTime = 0;
      transitionSound.play();
    }

    // Update grid with visited cells
    const newGrid = gameState.grid.map((row, y) =>
      row.map((cell, x) => ({
        ...cell,
        visited: cell.visited || (x === newPosition.x && y === newPosition.y)
      }))
    );

    // Check for gold collection
    if (newGrid[newPosition.y][newPosition.x].gold) {
      newGrid[newPosition.y][newPosition.x].gold = false;
      setGameState(prev => ({
        ...prev,
        hasGold: true,
        playerPosition: newPosition,
        grid: newGrid,
      }));
      showGamePopup("You found the gold! Now head back to the start!", goldSound);
      updatePercepts(newPosition);
      return;
    }

    // Check for death conditions
    const newCell = newGrid[newPosition.y][newPosition.x];
    if (newCell.wumpus || newCell.pit) {
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
        isAlive: false,
      }));
      showGamePopup(
        newCell.wumpus ? "Game Over! The Wumpus got you!" : "Game Over! You fell into a pit!",
        newCell.wumpus ? wumpusSound : pitSound
      );
      return;
    }

    // Check for victory condition
    if (gameState.hasGold && newPosition.x === 0 && newPosition.y === 9) {
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
      }));
      showGamePopup("Congratulations! You won! You got the gold and made it back safely!", goldSound);
      return;
    }

    // Update game state and percepts
    setGameState(prev => ({
      ...prev,
      playerPosition: newPosition,
      grid: newGrid
    }));
    updatePercepts(newPosition);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // TODO: Implement environment file loading
      console.log('Loading environment file:', file.name);
    }
  };

  const handleStartSimulation = () => {
    setSimulationState('running');
  };

  const handleNextStep = () => {
    if (simulationState === 'running') return;
    setSimulationState('step');
  };

  const handlePause = () => {
    setSimulationState('paused');
  };

  // Reset AI state when game restarts
  const handleRestart = () => {
    setSimulationState('stopped');
    setAiState({
      hasShot: false,
      wumpusKilled: false,
      targetPosition: null,
      plan: [],
      currentPlanIndex: 0,
      searchingForGold: true,
      returningHome: false
    });
    setAiKnowledge(() =>
      Array(10).fill().map(() => Array(10).fill().map(() => ({
        safe: false,
        possiblePit: false,
        possibleWumpus: false,
        visited: false,
        wumpusKilled: false,
        hasGold: false,
        explored: false
      })))
    );
    setGameState({
      playerPosition: { 
        x: 0, 
        y: 9,
        facing: 'right'
      },
      hasGold: false,
      hasArrow: true,
      isAlive: true,
      grid: initializeGrid()
    });
    
    // Mark starting position as safe in AI knowledge
    setAiKnowledge(prev => {
      const newKnowledge = [...prev];
      newKnowledge[9][0].safe = true;
      newKnowledge[9][0].visited = true;
      return newKnowledge;
    });
  };

  const handleShoot = () => {
    if (!gameState.hasArrow || !gameState.isAlive) return;

    const { x, y, facing } = gameState.playerPosition;
    let hitWumpus = false;
    let checkX = x;
    let checkY = y;

    // Move in the direction player is facing
    switch (facing) {
      case 'right': checkX++; break;
      case 'left': checkX--; break;
      case 'up': checkY--; break;
      case 'down': checkY++; break;
    }

    // Check cells in the direction until we hit a wall or wumpus
    while (isValidPosition(checkX, checkY)) {
      if (gameState.grid[checkY][checkX].wumpus) {
        hitWumpus = true;
        break;
      }

      switch (facing) {
        case 'right': checkX++; break;
        case 'left': checkX--; break;
        case 'up': checkY--; break;
        case 'down': checkY++; break;
      }
    }

    const newGrid = [...gameState.grid];
    if (hitWumpus) {
      // Remove wumpus and its stench from adjacent cells
      newGrid[checkY][checkX].wumpus = false;
      getAdjacentCells(checkX, checkY).forEach(([adjX, adjY]) => {
        // Only remove stench if no other wumpus is adjacent
        const hasAdjacentWumpus = getAdjacentCells(adjX, adjY).some(
          ([wx, wy]) => newGrid[wy][wx].wumpus
        );
        if (!hasAdjacentWumpus) {
          newGrid[adjY][adjX].stench = false;
        }
      });
      
      // Update AI state
      setAiState(prev => ({ ...prev, wumpusKilled: true }));
    }

    setGameState(prev => ({
      ...prev,
      hasArrow: false,
      grid: newGrid,
      message: hitWumpus ? "You killed a Wumpus!" : "Your arrow missed!"
    }));
  };

  const handleGrab = () => {
    if (!gameState.isAlive) return;
    
    const { x, y } = gameState.playerPosition;
    const cell = gameState.grid[y][x];
    
    if (cell.gold) {
      const newGrid = gameState.grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => ({
          ...cell,
          gold: rowIndex === y && colIndex === x ? false : cell.gold
        }))
      );

      setGameState(prev => ({
        ...prev,
        hasGold: true,
        grid: newGrid,
        message: "You got the gold! Now head back to the start!"
      }));
    }
  };



  if (!gameMode) {
    return (
      <div className="game-container">
        <h1>Wumpus World</h1>
        <div className="mode-selection">
          <button className="mode-btn ai" onClick={() => setGameMode('ai')}>
            <span className="icon">🤖</span>
            AI Mode
          </button>
          <button className="mode-btn manual" onClick={() => setGameMode('manual')}>
            <span className="icon">👤</span>
            Manual Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <h1>Wumpus World</h1>
      <div className="game-layout">
        <div className="game-board">
          <WumpusGrid
            grid={gameState.grid}
            playerPosition={gameState.playerPosition}
            hasArrow={gameState.hasArrow}
            onMove={handleMove}
          />
        </div>
        <div className="game-sidebar">
          <KnowledgeBase percepts={percepts} />
          
          {gameMode === 'manual' ? (
            <div className="manual-controls">
              <div className="controls">
                <button 
                  className="control-btn up" 
                  onClick={() => handleMove('up')}
                  disabled={!gameState.isAlive}
                >Up</button>
                <div className="horizontal-controls">
                  <button 
                    className="control-btn left" 
                    onClick={() => handleMove('left')}
                    disabled={!gameState.isAlive}
                  >Left</button>
                  <button 
                    className="control-btn right" 
                    onClick={() => handleMove('right')}
                    disabled={!gameState.isAlive}
                  >Right</button>
                </div>
                <button 
                  className="control-btn down" 
                  onClick={() => handleMove('down')}
                  disabled={!gameState.isAlive}
                >Down</button>
              </div>
              <div className="action-controls">
                <button 
                  className={`control-btn action ${gameState.hasArrow ? 'has-arrow' : ''}`}
                  onClick={handleShoot}
                  disabled={!gameState.hasArrow || !gameState.isAlive}
                >
                  🏹 Shoot Arrow
                </button>
                <button 
                  className="control-btn action"
                  onClick={handleGrab}
                  disabled={!gameState.isAlive}
                >
                  ✨ Grab Gold
                </button>
              </div>
            </div>
          ) : (
            <div className="ai-controls">
              <div className="control-group">
                <button 
                  className={`control-btn ${simulationState === 'running' ? 'active' : ''}`}
                  onClick={handleStartSimulation}
                  disabled={simulationState === 'running'}
                >
                  ▶️ Start Simulation
                </button>
                <button 
                  className="control-btn"
                  onClick={handleNextStep}
                  disabled={simulationState === 'running'}
                >
                  ⏭ Next Step
                </button>
                <button 
                  className="control-btn"
                  onClick={handlePause}
                  disabled={simulationState !== 'running'}
                >
                  ⏹ Pause
                </button>
              </div>
            </div>
          )}

          <div className="common-controls">
            <button className="control-btn restart" onClick={handleRestart}>
              🔄 Restart
            </button>
            <label className="control-btn file-upload">
              📂 Load Environment
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>

      {showPopup && (
        <Popup 
          message={popupContent.message} 
          onClose={handlePopupClose} 
        />
      )}
    </div>
    
  )
}

export default App
