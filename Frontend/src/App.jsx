import { useState } from 'react'
import './App.css'
import KnowledgeBase from './components/KnowledgeBase'
import WumpusGrid from './components/WumpusGrid'

function App() {
  const [percepts, setPercepts] = useState({
    breeze: false,
    stench: false,
    glitter: false
  })

  const [gameState, setGameState] = useState({
    playerPosition: { x: 0, y: 9 }, // Start at bottom-left corner (0,9)
    hasGold: false,
    isAlive: true,
    grid: Array(10).fill().map(() => Array(10).fill({ visited: false }))
  })

  const handleMove = (direction) => {
    const newPosition = { ...gameState.playerPosition };
    
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

    setGameState(prev => ({
      ...prev,
      playerPosition: newPosition,
      grid: newGrid
    }));

    // TODO: Call backend API to get new percepts
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
          <div className="controls">
            <button className="control-btn up" onClick={() => handleMove('up')}>Up</button>
            <div className="horizontal-controls">
              <button className="control-btn left" onClick={() => handleMove('left')}>Left</button>
              <button className="control-btn right" onClick={() => handleMove('right')}>Right</button>
            </div>
            <button className="control-btn down" onClick={() => handleMove('down')}>Down</button>
          </div>
          <div className="game-status">
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
