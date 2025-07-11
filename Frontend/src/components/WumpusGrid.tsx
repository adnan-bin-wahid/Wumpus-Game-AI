import React from 'react';
import { Cell } from '../types';
import './WumpusGrid.css';

interface WumpusGridProps {
  gridSize: number;
  visibleCells: Cell[];
  agentPos: [number, number];
}

const WumpusGrid: React.FC<WumpusGridProps> = ({ gridSize, visibleCells, agentPos }) => {
  const renderCell = (row: number, col: number) => {
    const isAgent = row === agentPos[1] && col === agentPos[0];
    const cellClasses = ['cell'];
    
    const cell = visibleCells.find(c => c.x === col && c.y === row) || {
      visited: false,
      safe: false,
      wumpus: false,
      pit: false,
      gold: false,
      breeze: false,
      stench: false,
      glitter: false
    };

    if (cell.visited) cellClasses.push('visited');
    if (cell.safe) cellClasses.push('safe');
    if (isAgent) cellClasses.push('agent');

    return (
      <div key={`${row}-${col}`} className={cellClasses.join(' ')}>
        {isAgent && '👨'}
        {cell.wumpus && cell.visited && '👹'}
        {cell.pit && cell.visited && '⚫'}
        {cell.gold && cell.visited && '💰'}
        {!isAgent && cell.breeze && cell.visited && '💨'}
        {!isAgent && cell.stench && cell.visited && '💀'}
        {cell.gold && cell.visited && '✨'}
      </div>
    );
  };

  // Create a grid structure for rendering
  const rows = Array.from({ length: gridSize }, (_, i) => i);
  const cols = Array.from({ length: gridSize }, (_, i) => i);

  return (
    <div className="wumpus-grid">
      {rows.map((row) => (
        <div key={row} className="grid-row">
          {cols.map((col) => renderCell(row, col))}
        </div>
      ))}
    </div>
  );
};

export default WumpusGrid;
