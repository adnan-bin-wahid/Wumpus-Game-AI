import React, { useState, useEffect } from 'react';
import './App.css';
import WumpusGrid from './components/WumpusGrid';
import Controls from './components/Controls';
import KnowledgeBase from './components/KnowledgeBase';
import { GameState } from './types';
import { fetchGameState, initGame, moveAgent, loadCustomMap, resetGame } from './api';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [autoMode, setAutoMode] = useState<boolean>(false);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = async () => {
    const state = await initGame();
    setGameState(state);
  };

  const handleMove = async (direction: string) => {
    if (gameState && !gameState.game_over) {
      const newState = await moveAgent(direction);
      setGameState(newState);
    }
  };

  const handleReset = async () => {
    const state = await resetGame();
    setGameState(state);
    setAutoMode(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const state = await loadCustomMap(file);
      setGameState(state);
    }
  };

  const toggleAutoMode = () => {
    setAutoMode(!autoMode);
  };

  const handlePause = () => {
    setAutoMode(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Wumpus World</h1>
        {gameState && (
          <div className="game-info">
            <span>Score: {gameState.score}</span>
            <span>Status: {gameState.message}</span>
          </div>
        )}
      </header>
      <main>
        <div className="game-container">
          <div className="grid-container">
            {gameState && (
              <WumpusGrid
                gridSize={gameState.grid_size}
                visibleCells={gameState.visible_cells}
                agentPos={gameState.agent_pos}
              />
            )}
          </div>
          <div className="controls-container">
            <Controls
              onMove={handleMove}
              onReset={handleReset}
              onFileUpload={handleFileUpload}
              onAutoMode={toggleAutoMode}
              onPause={handlePause}
              autoMode={autoMode}
              gameOver={gameState?.game_over || false}
            />
          </div>
        </div>
        <div className="knowledge-base-container">
          {gameState && <KnowledgeBase percepts={gameState.percepts} />}
        </div>
      </main>
    </div>
  );
};

export default App;
