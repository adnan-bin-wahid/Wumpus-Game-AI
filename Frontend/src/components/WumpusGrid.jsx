import React from 'react';
import './WumpusGrid.css';

const WumpusGrid = ({ grid, playerPosition }) => {
  const size = 10; // 10x10 grid

  const getCellContent = (x, y) => {
    const content = [];
    
    // Add player emoji if this is the player's position
    if (x === playerPosition.x && y === playerPosition.y) {
      content.push('🤠');
    }

    // Add cell-specific content (will be expanded later)
    const cell = grid[y]?.[x];
    if (cell) {
      if (cell.wumpus) content.push('👾');
      if (cell.pit) content.push('🕳️');
      if (cell.gold) content.push('💰');
      if (cell.breeze) content.push('💨');
      if (cell.stench) content.push('🦨');
    }

    return content.join(' ');
  };

  const getCellClass = (x, y) => {
    let classes = ['cell'];
    
    if (x === playerPosition.x && y === playerPosition.y) {
      classes.push('player');
    }
    
    if (grid[y]?.[x]?.visited) {
      classes.push('visited');
    }
    
    // Add cell-specific classes (will be expanded later)
    const cell = grid[y]?.[x];
    if (cell) {
      if (cell.wumpus) classes.push('wumpus');
      if (cell.pit) classes.push('pit');
      if (cell.gold) classes.push('gold');
    }
    
    return classes.join(' ');
  };

  return (
    <div className="wumpus-grid">
      {Array.from({ length: size }, (_, y) => (
        <div key={y} className="grid-row">
          {Array.from({ length: size }, (_, x) => (
            <div
              key={`${x}-${y}`}
              className={getCellClass(x, y)}
              data-x={x}
              data-y={y}
            >
              <div className="cell-content">
                {getCellContent(x, y)}
              </div>
              <div className="cell-coords">
                ({x}, {y})
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default WumpusGrid;
