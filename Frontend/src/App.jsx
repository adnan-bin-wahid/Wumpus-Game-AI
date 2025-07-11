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
    transitionSound.volume = 0.3; // Lower volume for transition sound
    
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
      // Initialize percepts for starting position
      updatePercepts({x: 0, y: 9});
    } else {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  }, [gameMode, backgroundMusic]);

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
  })

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
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // TODO: Implement environment file loading
      console.log('Loading environment file:', file.name);
    }
  };

  const handleStartSimulation = () => {
    setSimulationState('running');
    // TODO: Start AI simulation
  };

  const handleNextStep = () => {
    // TODO: Execute one AI step
  };

  const handlePause = () => {
    setSimulationState('paused');
  };

  const handleRestart = () => {
    setSimulationState('stopped');
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
  };

  const handleShoot = () => {
    if (!gameState.hasArrow || !gameState.isAlive) return;

    const { x, y, facing } = gameState.playerPosition;
    let hitWumpus = false;
    let checkX = x;
    let checkY = y;

    // Check cells in the direction player is facing
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
