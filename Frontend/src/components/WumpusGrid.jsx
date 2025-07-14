import React, { useEffect } from 'react';
import './WumpusGrid.css';

const WumpusGrid = ({ grid, playerPosition, hasArrow = true, onShoot, onMove, isAIMode = false }) => {
  const size = 10; // 10x10 grid

  // Add keyboard event listeners
  useEffect(() => {
    const handleKeyPress = (event) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          onMove('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          onMove('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          onMove('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          onMove('right');
          break;
        default:
          break;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [onMove]);

  const getCellContent = (x, y) => {
    const content = [];
    const cell = grid[y]?.[x];
    
    // Always show the player, even on unvisited cells
    if (x === playerPosition.x && y === playerPosition.y) {
      return content; // Return empty array to allow player image to be rendered separately
    }
    
    // In AI mode, show all elements regardless of visited status
    // In manual mode, only show contents for visited cells
    const shouldShowContent = isAIMode || cell?.visited;
    
    if (!shouldShowContent) {
      return ''; // Return empty string for covered cells in manual mode
    }

    // Show contents based on mode
    if (shouldShowContent) {
      if (cell.wumpus) content.push('👾');
      if (cell.pit) content.push('🕳️');
      if (cell.gold) content.push('💰');
      if (cell.breeze) content.push('💨');
      if (cell.stench) content.push('🦨');
    }

    return content.join(' ') || ' ';
  };

  const getCellClass = (x, y) => {
    let classes = ['cell'];
    const cell = grid[y]?.[x];
    
    // In AI mode, don't show covered state
    // In manual mode, show covered state for unvisited cells
    if (!isAIMode && !cell?.visited) {
      classes.push('covered');
    }
    
    if (x === playerPosition.x && y === playerPosition.y) {
      classes.push('player');
    }
    
    // In AI mode, always add element classes
    // In manual mode, only add classes for visited cells
    const shouldAddElementClasses = isAIMode || cell?.visited;
    
    if (shouldAddElementClasses) {
      classes.push('visited');
      
      if (cell.wumpus) classes.push('wumpus');
      if (cell.pit) classes.push('pit');
      if (cell.gold) classes.push('gold');
      if (cell.breeze) classes.push('breeze');
      if (cell.stench) classes.push('stench');
    }
    
    return classes.join(' ');
  };

  const renderCell = (x, y) => {
    const content = getCellContent(x, y);
    const isPlayer = x === playerPosition.x && y === playerPosition.y;
    const cell = grid[y]?.[x];
    
    return (
      <div
        key={`${x}-${y}`}
        className={getCellClass(x, y)}
        data-x={x}
        data-y={y}
      >
        <div className="cell-content">
          {content}
          {isPlayer && (
            <div className="player-container">
              <img 
                src="/player2.jpeg" 
                alt="player"
                className="player-img"
                style={{ 
                  transform: `rotate(${playerPosition.facing === 'right' ? 0 : 
                                     playerPosition.facing === 'down' ? 90 : 
                                     playerPosition.facing === 'left' ? 180 : 
                                     270}deg)`,
                }}
              />
            </div>
          )}
        </div>
        {(isAIMode || cell?.visited) && (
          <div className="cell-coords">
            {/* ({x}, {y}) */}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wumpus-grid">
      {Array.from({ length: size }, (_, y) => (
        <div key={y} className="grid-row">
          {Array.from({ length: size }, (_, x) => renderCell(x, y))}
        </div>
      ))}
    </div>
  );
};

export default WumpusGrid;