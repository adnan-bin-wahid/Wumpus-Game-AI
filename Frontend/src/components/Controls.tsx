import React from 'react';
import './Controls.css';

interface ControlsProps {
  onMove: (direction: string) => void;
  onReset: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoMode: () => void;
  onPause: () => void;
  autoMode: boolean;
  gameOver: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  onMove,
  onReset,
  onFileUpload,
  onAutoMode,
  onPause,
  autoMode,
  gameOver
}) => {
  return (
    <div className="controls">
      <div className="movement-controls">
        <button onClick={() => onMove('up')} disabled={gameOver || autoMode}>↑</button>
        <div className="horizontal-controls">
          <button onClick={() => onMove('left')} disabled={gameOver || autoMode}>←</button>
          <button onClick={() => onMove('right')} disabled={gameOver || autoMode}>→</button>
        </div>
        <button onClick={() => onMove('down')} disabled={gameOver || autoMode}>↓</button>
      </div>
      <div className="game-controls">
        <button onClick={onReset} className="reset-btn">
          🔄 Reset
        </button>
        <button onClick={onAutoMode} disabled={gameOver} className="auto-btn">
          ▶️ {autoMode ? 'Running...' : 'Start Auto'}
        </button>
        {autoMode && (
          <button onClick={onPause} className="pause-btn">
            ⏹ Pause
          </button>
        )}
        <div className="file-input">
          <label htmlFor="map-upload" className="file-label">
            📂 Load Map
          </label>
          <input
            type="file"
            id="map-upload"
            accept=".txt"
            onChange={onFileUpload}
            disabled={gameOver || autoMode}
          />
        </div>
      </div>
    </div>
  );
};

export default Controls;
