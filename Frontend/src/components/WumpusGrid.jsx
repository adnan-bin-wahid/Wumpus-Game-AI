import React from 'react';
import './WumpusGrid.css';

const WumpusGrid = ({ grid, playerPosition, hasArrow = true, onShoot }) => {
  const size = 10; // 10x10 grid

  const getCellContent = (x, y) => {
    const content = [];
    const cell = grid[y]?.[x];
    
    if (!cell?.visited) {
      return '❓';
    }

    // Add player emoji if this is the player's position
    if (x === playerPosition.x && y === playerPosition.y) {
      content.push('🤠');
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
