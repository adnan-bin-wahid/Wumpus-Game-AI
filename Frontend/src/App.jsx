import { useState } from 'react'
import './App.css'
import KnowledgeBase from './components/KnowledgeBase'
import WumpusGrid from './components/WumpusGrid'

function App() {
  const [gameMode, setGameMode] = useState(null); // null, 'ai', or 'manual'
  const [simulationState, setSimulationState] = useState('stopped'); // stopped, running, paused
  const [percepts, setPercepts] = useState({
    breeze: false,
    stench: false,
    glitter: false
  })

  const [gameState, setGameState] = useState({
    playerPosition: { x: 0, y: 9 }, // Start at bottom-left corner (0,9)
    facing: 'right', // direction the player is facing: 'up', 'right', 'down', 'left'
    hasGold: false,
    hasArrow: true,
    isAlive: true,
    grid: Array(10).fill().map(() => Array(10).fill({ 
      visited: false,
      wumpus: false,
      pit: false,
      gold: false,
      breeze: false,
      stench: false
    }))
  })

  const handleMove = (direction) => {
    if (!gameState.isAlive) return;
    
    const newPosition = { ...gameState.playerPosition };
    
    // Update facing direction
    setGameState(prev => ({
      ...prev,
      facing: direction
    }));
    
    switch (direction) {
      case 'up':
        if (newPosition.y > 0) newPosition.y--;
        break;
      case 'down':
        if (newPosition.y < 9) newPosition.y++;
        break;
      case 'left':
        if (newPosition.x > 0) newPosition.x--;
        break;
      case 'right':
        if (newPosition.x < 9) newPosition.x++;
        break;
    }

    // Update grid with visited cells
    const newGrid = gameState.grid.map((row, y) =>
      row.map((cell, x) => ({
        ...cell,
        visited: cell.visited || (x === newPosition.x && y === newPosition.y)
      }))
    );

    // Check for victory condition
    if (gameState.hasGold && newPosition.x === 0 && newPosition.y === 9) {
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
        message: "Congratulations! You won! You got the gold and made it back safely!"
      }));
      return;
    }

    // Check for death conditions
    const newCell = newGrid[newPosition.y][newPosition.x];
    if (newCell.wumpus) {
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
        isAlive: false,
        message: "Game Over! The Wumpus got you!"
      }));
      return;
    }
    
    if (newCell.pit) {
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
        isAlive: false,
        message: "Game Over! You fell into a pit!"
      }));
      return;
    }

    setGameState(prev => ({
      ...prev,
      playerPosition: newPosition,
      grid: newGrid
    }));

    // TODO: Call backend API to get new percepts
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
      playerPosition: { x: 0, y: 9 },
      hasGold: false,
      isAlive: true,
      grid: Array(10).fill().map(() => Array(10).fill({ visited: false }))
    });
  };

  const handleShoot = () => {
    if (!gameState.hasArrow) {
      return;
    }

    const { x, y } = gameState.playerPosition;
    const { facing } = gameState;
    
    // Look in the direction the player is facing
    let checkX = x;
    let checkY = y;
    
    while (checkX >= 0 && checkX < 10 && checkY >= 0 && checkY < 10) {
      // Check if we hit the wumpus
      if (gameState.grid[checkY][checkX].wumpus) {
        const newGrid = [...gameState.grid];
        newGrid[checkY][checkX].wumpus = false; // Kill the wumpus
        setGameState(prev => ({
          ...prev,
          hasArrow: false,
          grid: newGrid,
          message: "You killed the Wumpus!"
        }));
        return;
      }
      
      // Move in the facing direction
      if (facing === 'right') checkX++;
      else if (facing === 'left') checkX--;
      else if (facing === 'up') checkY--;
      else if (facing === 'down') checkY++;
    }
    
    // If we get here, we missed
    setGameState(prev => ({
      ...prev,
      hasArrow: false,
      message: "You missed! No more arrows left."
    }));
  };

  const handleGrab = () => {
    const { x, y } = gameState.playerPosition;
    const cell = gameState.grid[y][x];
    
    if (cell.gold) {
      const newGrid = [...gameState.grid];
      newGrid[y][x].gold = false;
      setGameState(prev => ({
        ...prev,
        hasGold: true,
        grid: newGrid,
        message: "You found the gold! Now try to get back to the start!"
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

          <div className="game-status">
            <p>Mode: {gameMode === 'ai' ? '🤖 AI' : '👤 Manual'}</p>
            <p>Position: ({gameState.playerPosition.x}, {gameState.playerPosition.y})</p>
            <p>Gold: {gameState.hasGold ? 'Collected' : 'Not Found'}</p>
            <p>Status: {gameState.isAlive ? 'Alive' : 'Dead'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
