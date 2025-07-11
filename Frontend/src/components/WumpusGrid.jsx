import React from 'react';
import './WumpusGrid.css';

const WumpusGrid = ({ grid, playerPosition, hasArrow = true, onShoot }) => {
  const size = 10; // 10x10 grid

  const getCellContent = (x, y) => {
    const content = [];
    const cell = grid[y]?.[x];
    
    // Always show the player, even on unvisited cells
    if (x === playerPosition.x && y === playerPosition.y) {
      return content; // Return empty array to allow player image to be rendered separately
    }
    
    if (!cell?.visited) {
      return ''; // Return empty string for covered cells
    }

    // Only show contents for visited cells
    if (cell?.visited) {
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
    
    if (!cell?.visited) {
      classes.push('covered');
    }
    
    if (x === playerPosition.x && y === playerPosition.y) {
      classes.push('player');
    }
    
    if (cell?.visited) {
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
        {cell?.visited && (
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
