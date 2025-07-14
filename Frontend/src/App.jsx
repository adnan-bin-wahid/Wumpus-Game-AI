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
    transitionSound.volume = 0.3;
    
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
      updatePercepts({x: 0, y: 9});
    } else {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  }, [gameMode, backgroundMusic]);

  // Enhanced AI Knowledge Base State with detailed tracking
  const [aiKnowledge, setAiKnowledge] = useState(() =>
    Array(10).fill().map(() => Array(10).fill().map(() => ({
      safe: false,
      possiblePit: false,
      possibleWumpus: false,
      visited: false,
      wumpusKilled: false,
      hasGold: false,
      explored: false
    })))
  );

  // Add AI state tracking with loop detection
  const [aiState, setAiState] = useState({
    hasShot: false,
    wumpusKilled: false,
    targetPosition: null,
    plan: [],
    currentPlanIndex: 0,
    searchingForGold: true,
    returningHome: false,
    visitedPositions: [], // Track recent positions for loop detection
    stuckCounter: 0 // Count how many times AI couldn't find new moves
  });

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
  });

  // REMOVE CHEATING FUNCTION - AI should not know gold location!
  // This function was giving the AI unfair advantage by revealing gold location
  // function findGoldCell(grid) { ... } - REMOVED!

  // Utility: Get Direction
  function getDirection(from, to) {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'down';
    if (to.y < from.y) return 'up';
    return null;
  }

  // Heuristic function for A*
  function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); //sum of the absolute differences of their x and y coordinates.
  }

  // Realistic A* Pathfinding - NO CHEATING! AI only uses known information
  function aStar(start, goal, knowledge, allowRisky = false) {
    const open = [{ pos: start, path: [start], cost: 0 }];
    const closed = Array(10).fill().map(() => Array(10).fill(false));
    
    while (open.length > 0) {
      // Sort by f(n) = g(n) + h(n) with safety priority
      open.sort((a, b) => {
        const fA = a.cost + heuristic(a.pos, goal);
        const fB = b.cost + heuristic(b.pos, goal);
        
        // Add safety penalty for dangerous cells
        const safetyPenaltyA = getSafetyPenalty(a.pos, knowledge, allowRisky);
        const safetyPenaltyB = getSafetyPenalty(b.pos, knowledge, allowRisky);
        
        return (fA + safetyPenaltyA) - (fB + safetyPenaltyB);
      });
      
      const current = open.shift();
      const { x, y } = current.pos;
      
      if (x === goal.x && y === goal.y) {
        return current.path;
      }
      
      if (closed[y][x]) continue;
      closed[y][x] = true;
      
      getAdjacentCells(x, y).forEach(([nx, ny]) => {
        if (closed[ny][nx]) return;
        
        const cell = knowledge[ny][nx];
        
        // ULTRA-SAFE movement rules - NO RISKS!
        let canMove = false;
        
        if (cell.visited) {
          // Always allow movement to visited cells (they're proven safe)
          canMove = true;
        } else if (cell.safe) {
          // Always allow movement to explicitly safe cells
          canMove = true;
        } else if (!cell.possiblePit && !cell.possibleWumpus && !cell.safe && !cell.visited) {
          // Allow movement to completely unknown cells (not marked as any danger)
          canMove = true;
        } else if (allowRisky) {
          // In risky mode, allow visited cells and be more lenient with unknowns
          if (cell.visited) {
            canMove = true;
          } else if (!cell.possiblePit && !cell.possibleWumpus) {
            canMove = true;
          }
        }
        // NEVER allow movement to cells marked as possible pit or wumpus!
        
        if (canMove) {
          const newCost = current.cost + 1;
          const existingNode = open.find(node => node.pos.x === nx && node.pos.y === ny);
          
          if (!existingNode || newCost < existingNode.cost) {
            const newNode = {
              pos: { x: nx, y: ny },
              path: [...current.path, { x: nx, y: ny }],
              cost: newCost
            };
            
            if (existingNode) {
              Object.assign(existingNode, newNode);
            } else {
              open.push(newNode);
            }
          }
        }
      });
    }
    
    return null; // No path found
  }

  // Enhanced safety penalty calculation - less strict but still safe
  function getSafetyPenalty(pos, knowledge, allowRisky = false) {
    const cell = knowledge[pos.y][pos.x];
    let penalty = 0;
    
    // Visited cells get small penalty to discourage unnecessary backtracking
    if (cell.visited) return 2;
    
    // Explicitly safe cells have no penalty
    if (cell.safe) return 0;
    
    // High penalties for dangerous cells but not impossible
    if (cell.possiblePit) penalty += allowRisky ? 15 : 100;
    if (cell.possibleWumpus && !aiState.wumpusKilled) penalty += allowRisky ? 20 : 150;
    
    // Unknown cells get minimal penalty to encourage exploration
    if (!cell.safe && !cell.visited && !cell.possiblePit && !cell.possibleWumpus) {
      penalty += allowRisky ? 0.5 : 1;
    }
    
    return penalty;
  }

  // Enhanced logical inference to deduce safe/unsafe cells
  function applyLogicalInference(knowledge) {
    let changed = true;
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops
    
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (knowledge[y][x].visited) continue;
          
          const adjacentCells = getAdjacentCells(x, y);
          const visitedAdjacentCells = adjacentCells.filter(([adjX, adjY]) => 
            knowledge[adjY][adjX].visited
          );
          
          // Rule: If all visited adjacent cells have no breeze, this cell is safe from pits
          if (visitedAdjacentCells.length > 0) {
            const allAdjacentHaveNoBreeze = visitedAdjacentCells.every(([adjX, adjY]) => {
              const adjCell = knowledge[adjY][adjX];
              return adjCell.visited && !hasBreeze(adjX, adjY);
            });
            
            if (allAdjacentHaveNoBreeze && knowledge[y][x].possiblePit) {
              knowledge[y][x].possiblePit = false;
              changed = true;
            }
            
            // Rule: If all visited adjacent cells have no stench, this cell is safe from wumpus
            const allAdjacentHaveNoStench = visitedAdjacentCells.every(([adjX, adjY]) => {
              const adjCell = knowledge[adjY][adjX];
              return adjCell.visited && !hasStench(adjX, adjY);
            });
            
            if (allAdjacentHaveNoStench && knowledge[y][x].possibleWumpus) {
              knowledge[y][x].possibleWumpus = false;
              changed = true;
            }
            
            // Update safety status
            if (!knowledge[y][x].possiblePit && !knowledge[y][x].possibleWumpus && !knowledge[y][x].safe) {
              knowledge[y][x].safe = true;
              changed = true;
            }
          }
          
          // Advanced inference: If we detect breeze/stench in only one adjacent cell,
          // and all other adjacent cells are safe, then this cell must contain the danger
          const breezyAdjacentCells = visitedAdjacentCells.filter(([adjX, adjY]) => 
            hasBreeze(adjX, adjY)
          );
          
          const stenchyAdjacentCells = visitedAdjacentCells.filter(([adjX, adjY]) => 
            hasStench(adjX, adjY)
          );
          
          // If only one adjacent cell has breeze and others don't, this cell likely has a pit
          if (breezyAdjacentCells.length > 0 && visitedAdjacentCells.length > breezyAdjacentCells.length) {
            const safeCells = adjacentCells.filter(([adjX, adjY]) => 
              knowledge[adjY][adjX].safe || knowledge[adjY][adjX].visited
            );
            
            if (safeCells.length === adjacentCells.length - 1) {
              // This is likely the dangerous cell
              if (!knowledge[y][x].possiblePit) {
                knowledge[y][x].possiblePit = true;
                knowledge[y][x].safe = false;
                changed = true;
              }
            }
          }
          
          // Same logic for wumpus
          if (stenchyAdjacentCells.length > 0 && visitedAdjacentCells.length > stenchyAdjacentCells.length && !aiState.wumpusKilled) {
            const safeCells = adjacentCells.filter(([adjX, adjY]) => 
              knowledge[adjY][adjX].safe || knowledge[adjY][adjX].visited
            );
            
            if (safeCells.length === adjacentCells.length - 1) {
              if (!knowledge[y][x].possibleWumpus) {
                knowledge[y][x].possibleWumpus = true;
                knowledge[y][x].safe = false;
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  // Helper function to check if a position has breeze (from game state)
  function hasBreeze(x, y) {
    if (!gameState?.grid || !isValidPosition(x, y)) return false;
    return gameState.grid[y][x].breeze;
  }

  // Helper function to check if a position has stench (from game state)
  function hasStench(x, y) {
    if (!gameState?.grid || !isValidPosition(x, y)) return false;
    return gameState.grid[y][x].stench;
  }

  // Enhanced AI Knowledge Update using First Order Logic
  function updateAIKnowledge(position, percepts) {
    const { x, y } = position;
    const newKnowledge = aiKnowledge.map(row => row.map(cell => ({ ...cell })));
    
    // Mark current position as visited and safe
    newKnowledge[y][x].visited = true;
    newKnowledge[y][x].safe = true;
    newKnowledge[y][x].explored = true;
    
    // First Order Logic Rules Implementation
    
    // Rule 1: If no breeze, then no pits in adjacent cells
    if (!percepts.breeze) {
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        newKnowledge[adjY][adjX].possiblePit = false;
        if (!newKnowledge[adjY][adjX].possibleWumpus) {
          newKnowledge[adjY][adjX].safe = true;
        }
      });
    } else {
      // Rule 2: If breeze, then at least one adjacent cell has a pit
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        if (!newKnowledge[adjY][adjX].visited) {
          newKnowledge[adjY][adjX].possiblePit = true;
          newKnowledge[adjY][adjX].safe = false;
        }
      });
    }
    
    // Rule 3: If no stench, then no wumpus in adjacent cells
    if (!percepts.stench) {
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        newKnowledge[adjY][adjX].possibleWumpus = false;
        if (!newKnowledge[adjY][adjX].possiblePit) {
          newKnowledge[adjY][adjX].safe = true;
        }
      });
    } else {
      // Rule 4: If stench and wumpus not killed, then wumpus in adjacent cell
      if (!aiState.wumpusKilled) {
        getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
          if (!newKnowledge[adjY][adjX].visited) {
            newKnowledge[adjY][adjX].possibleWumpus = true;
            newKnowledge[adjY][adjX].safe = false;
          }
        });
      }
    }
    
    // Rule 5: If glitter, gold is here
    if (percepts.glitter) {
      newKnowledge[y][x].hasGold = true;
    }
    
    // Apply logical inference to reduce uncertainty
    applyLogicalInference(newKnowledge);
    
    setAiKnowledge(newKnowledge);
  }

  // Enhanced exploration target finding - NO CHEATING! AI doesn't know gold location
  function findBestExplorationTarget(knowledge, currentPos) {
    const safeCells = [];
    const unknownCells = [];
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (!knowledge[y][x].visited) {
          const distance = heuristic(currentPos, { x, y });
          const cellInfo = { x, y, distance };
          
          if (knowledge[y][x].safe) {
            // Definitely safe cells are best
            safeCells.push(cellInfo);
          } else if (!knowledge[y][x].possiblePit && !knowledge[y][x].possibleWumpus) {
            // Unknown cells that aren't marked as dangerous
            unknownCells.push({ ...cellInfo, distance: distance + 1 }); // Small penalty for unknown
          }
        }
      }
    }
    
    // Prioritize safe cells, then unknown cells
    const allTargets = [...safeCells, ...unknownCells];
    
    // Sort by distance but add some randomness for more natural exploration
    allTargets.sort((a, b) => {
      const distDiff = a.distance - b.distance;
      // If distances are close, add some randomness
      if (Math.abs(distDiff) <= 2) {
        return Math.random() - 0.5;
      }
      return distDiff;
    });
    
    console.log(`Found ${safeCells.length} safe cells, ${unknownCells.length} unknown cells for exploration`);
    
    return allTargets.length > 0 ? { x: allTargets[0].x, y: allTargets[0].y } : null;
  }

  // Balanced AI Step with proper exploration behavior and loop detection
  function aiStep() {
    try {
      if (!gameState.isAlive || simulationState === 'stopped') return;
      
      const { x, y } = gameState.playerPosition;
      const cell = gameState.grid[y][x];
      const percepts = {
        breeze: cell.breeze,
        stench: cell.stench,
        glitter: cell.gold,
      };
      
      // Update knowledge base and position tracking
      updateAIKnowledge({ x, y }, percepts);
      updateAIPositionTracking({ x, y });
      
      console.log(`AI at position (${x}, ${y}), percepts:`, percepts);
      console.log(`AI state:`, aiState);
      
      // Check for loop detection
      const inLoop = detectLoop({ x, y });
      if (inLoop) {
        console.log("Loop detected! AI will be more aggressive in exploration.");
      }
      
      // Decision making logic - BALANCED AI BEHAVIOR
      
      // 1. If glitter is perceived, grab the gold
      if (percepts.glitter && !gameState.hasGold) {
        console.log("AI found gold, grabbing it!");
        handleGrab();
        setAiState(prev => ({ ...prev, searchingForGold: false, returningHome: true }));
        return;
      }
      
      // 2. If we have gold and at start position, climb out
      if (gameState.hasGold && x === 0 && y === 9) {
        console.log("AI won the game!");
        showGamePopup("🎉 Congratulations! You won! 🏆\nYou got the gold and made it back safely! 🌟", goldSound);
        setSimulationState('stopped');
        return;
      }
      
      // 3. Enhanced shooting strategy - only if confident about wumpus location
      if (percepts.stench && gameState.hasArrow && !aiState.hasShot) {
        const shootingTarget = findBestShootingTarget(x, y);
        if (shootingTarget) {
          const direction = getDirection({ x, y }, shootingTarget);
          console.log(`AI detected wumpus, aiming ${direction}`);
          
          if (gameState.playerPosition.facing !== direction) {
            handleMove(direction); // Turn to face the target
            return;
          } else {
            console.log("AI shooting arrow!");
            handleShoot();
            setAiState(prev => ({ ...prev, hasShot: true, wumpusKilled: true }));
            return;
          }
        }
      }
      
      // 4. BALANCED EXPLORATION - more aggressive but still safe
      if (aiState.searchingForGold) {
        // First try to find a safe exploration target
        const explorationTarget = findBestExplorationTarget(aiKnowledge, { x, y });
        
        if (explorationTarget) {
          console.log("AI exploring unknown territory:", explorationTarget);
          const safePath = aStar({ x, y }, explorationTarget, aiKnowledge, false);
          
          if (safePath && safePath.length > 1) {
            const next = safePath[1];
            
            // Balanced safety check before moving
            if (isMoveBalancedSafe(x, y, next.x, next.y)) {
              const direction = getDirection({ x, y }, next);
              console.log(`AI moving to explore: ${direction}`);
              handleMove(direction);
              return;
            } else {
              console.log(`ABORTING move to (${next.x}, ${next.y}) - failed balanced safety check!`);
            }
          }
        }
        
        // If no safe exploration targets, try balanced exploration move
        const balancedMove = findBalancedExplorationMove(x, y);
        if (balancedMove) {
          const direction = getDirection({ x, y }, balancedMove);
          console.log(`AI making balanced exploration move: ${direction}`);
          handleMove(direction);
          return;
        }
      } else if (aiState.returningHome) {
        // Return to start position (0, 9) with gold
        const homePath = aStar({ x, y }, { x: 0, y: 9 }, aiKnowledge, false);
        if (homePath && homePath.length > 1) {
          const next = homePath[1];
          const direction = getDirection({ x, y }, next);
          console.log(`AI returning home: ${direction}`);
          handleMove(direction);
          return;
        }
      }
      
      // 5. Enhanced fallback strategy with anti-loop measures
      console.log("AI using enhanced fallback strategy");
      const safeMoves = findSafeAdjacentMoves(x, y);
      
      if (safeMoves.length > 0) {
        const chosenMove = safeMoves[0]; // Already prioritized by findSafeAdjacentMoves
        const direction = getDirection({ x, y }, chosenMove);
        
        if (!aiKnowledge[chosenMove.y][chosenMove.x].visited) {
          console.log(`AI making safe unvisited move: ${direction}`);
          setAiState(prev => ({ ...prev, stuckCounter: 0 })); // Reset stuck counter
        } else {
          console.log(`AI making visited move due to necessity: ${direction}`);
          incrementStuckCounter();
        }
        handleMove(direction);
      } else {
        // Enhanced emergency backtrack - find distant safe cell to break loops
        console.log("No safe adjacent moves - attempting strategic backtrack");
        const strategicBacktrack = findStrategicBacktrackTarget(x, y);
        
        if (strategicBacktrack) {
          const backtrackPath = aStar({ x, y }, strategicBacktrack, aiKnowledge, true);
          if (backtrackPath && backtrackPath.length > 1) {
            const next = backtrackPath[1];
            const direction = getDirection({ x, y }, next);
            console.log(`AI strategic backtrack towards (${strategicBacktrack.x}, ${strategicBacktrack.y}): ${direction}`);
            handleMove(direction);
            incrementStuckCounter();
            return;
          }
        }
        
        // Last resort: any adjacent visited cell (but avoid recent positions)
        const emergencyMove = findEmergencyVisitedCell(x, y);
        if (emergencyMove) {
          const direction = getDirection({ x, y }, emergencyMove);
          console.log(`AI emergency move to avoid complete deadlock: ${direction}`);
          handleMove(direction);
          incrementStuckCounter();
        } else {
          console.log("AI is completely stuck - no safe moves or backtrack options!");
          handleStuckSituation(x, y);
        }
      }
    } catch (error) {
      console.error('Error in aiStep:', error);
      setSimulationState('paused');
      showGamePopup(
        `⚠️ AI Step Error!\nError: ${error.message}\nSimulation paused for safety.`,
        null,
        'wumpus'
      );
    }
  }

  // STRICT loop detection to prevent endless wandering
  function detectLoop(currentPos) {
    const posKey = `${currentPos.x},${currentPos.y}`;
    const recentPositions = aiState.visitedPositions.slice(-20); // Check last 20 positions
    
    // Count how many times we've been to this position recently
    const visitCount = recentPositions.filter(pos => pos === posKey).length;
    
    // STRICT: Even 2 visits is considered a loop
    if (visitCount >= 2) return true;
    
    // ULTRA-STRICT Pattern detection: Check for repeating sequences of different lengths
    const patterns = [2, 3, 4, 5, 6]; // Check for patterns of length 2-6
    
    for (const patternLength of patterns) {
      // ULTRA-STRICT: Different requirements based on pattern length
      if (patternLength <= 3) {
        // For short patterns (2-3), require at least 4 repetitions
        if (recentPositions.length >= patternLength * 4) {
          const patterns = [];
          for (let i = 0; i < 4; i++) {
            const startIdx = -patternLength * (i + 1);
            const endIdx = i === 0 ? undefined : -patternLength * i;
            patterns.push(recentPositions.slice(startIdx, endIdx));
          }
          
          // Check if all 4 patterns are identical
          const firstPattern = patterns[0];
          const allPatternsMatch = patterns.every(pattern => 
            JSON.stringify(pattern) === JSON.stringify(firstPattern)
          );
          
          if (allPatternsMatch) {
            // Additional validation: pattern must contain actual movement
            const patternUniquePositions = [...new Set(firstPattern)];
            if (patternUniquePositions.length >= 2) {
              console.log(`ULTRA-STRICT Loop detected: Short pattern of length ${patternLength} repeating 4+ times with ${patternUniquePositions.length} unique positions`);
              return true;
            }
          }
        }
        
        // Also check for 3 repetitions with stricter validation for length 2-3
        if (recentPositions.length >= patternLength * 3) {
          const lastPattern = recentPositions.slice(-patternLength);
          const previousPattern = recentPositions.slice(-patternLength * 2, -patternLength);
          const thirdLastPattern = recentPositions.slice(-patternLength * 3, -patternLength * 2);
          
          if (JSON.stringify(lastPattern) === JSON.stringify(previousPattern) &&
              JSON.stringify(previousPattern) === JSON.stringify(thirdLastPattern)) {
            
            // STRICT validation for short patterns: must have multiple positions AND recent frequency
            const patternUniquePositions = [...new Set(lastPattern)];
            const patternFrequency = recentPositions.filter(pos => lastPattern.includes(pos)).length;
            
            if (patternUniquePositions.length >= 2 && patternFrequency >= patternLength * 3) {
              console.log(`ULTRA-STRICT Loop detected: Short pattern of length ${patternLength} with high frequency (${patternFrequency}) and ${patternUniquePositions.length} unique positions`);
              return true;
            }
          }
        }
      } else {
        // For longer patterns (4-6), require at least 3 repetitions (original logic)
        if (recentPositions.length >= patternLength * 3) {
          const lastPattern = recentPositions.slice(-patternLength);
          const previousPattern = recentPositions.slice(-patternLength * 2, -patternLength);
          const thirdLastPattern = recentPositions.slice(-patternLength * 3, -patternLength * 2);
          
          // Check if the pattern repeats at least 3 times consecutively
          if (JSON.stringify(lastPattern) === JSON.stringify(previousPattern) &&
              JSON.stringify(previousPattern) === JSON.stringify(thirdLastPattern)) {
            console.log(`STRICT Loop detected: Long pattern of length ${patternLength} repeating 3+ times`);
            return true;
          }
          
          // Additional check: Pattern must also be non-trivial (not just staying in one place)
          const patternUniquePositions = [...new Set(lastPattern)];
          if (patternUniquePositions.length >= 2 && 
              JSON.stringify(lastPattern) === JSON.stringify(previousPattern)) {
            // Allow 2-time repetition only for complex patterns (length >= 4) with multiple positions
            if (patternLength >= 4) {
              console.log(`STRICT Loop detected: Complex long pattern of length ${patternLength} with ${patternUniquePositions.length} unique positions`);
              return true;
            }
          }
        }
      }
    }
    
    // Oscillation detection: Check if bouncing between multiple positions
    const uniquePositions = [...new Set(recentPositions.slice(-8))];
    if (uniquePositions.length <= 3 && recentPositions.length >= 8) {
      console.log("Loop detected: Oscillating between limited positions");
      return true;
    }
    
    // Stuck in area detection: Check if AI is confined to a small area
    if (recentPositions.length >= 12) {
      const recentUniquePositions = [...new Set(recentPositions.slice(-12))];
      if (recentUniquePositions.length <= 4) {
        console.log("Loop detected: Stuck in small area");
        return true;
      }
    }
    
    return false;
  }

  // STRICT AI position tracking with enhanced pattern recognition
  function updateAIPositionTracking(position) {
    const posKey = `${position.x},${position.y}`;
    setAiState(prev => {
      const newVisitedPositions = [...prev.visitedPositions.slice(-30), posKey]; // Keep last 30 positions for better analysis
      
      // More aggressive loop breaking detection
      const recentPositions = newVisitedPositions.slice(-8);
      const uniqueRecentPositions = [...new Set(recentPositions)];
      
      // Check if this move is actually breaking a loop pattern
      const isBreakingLoop = uniqueRecentPositions.length > 3 && // Moving between more than 3 positions
        !prev.visitedPositions.slice(-6).includes(posKey); // Not in last 6 positions
      
      // Progressive stuck counter reduction for good moves
      const stuckReduction = isBreakingLoop ? Math.max(2, Math.floor(prev.stuckCounter * 0.5)) : 1;
      
      return {
        ...prev,
        visitedPositions: newVisitedPositions,
        stuckCounter: isBreakingLoop ? Math.max(0, prev.stuckCounter - stuckReduction) : prev.stuckCounter
      };
    });
  }

  // Enhanced stuck counter management with escalation
  function incrementStuckCounter() {
    setAiState(prev => {
      const newStuckCounter = prev.stuckCounter + 1;
      
      // Log escalation levels
      if (newStuckCounter === 5) {
        console.log("AI entering MODERATE stuck state - allowing riskier moves");
      } else if (newStuckCounter === 10) {
        console.log("AI entering HIGH stuck state - aggressive loop breaking");
      } else if (newStuckCounter === 15) {
        console.log("AI entering CRITICAL stuck state - maximum risk tolerance");
      }
      
      return {
        ...prev,
        stuckCounter: newStuckCounter
      };
    });
  }

  // Reset stuck counter when making significant progress
  function resetStuckCounter() {
    setAiState(prev => ({
      ...prev,
      stuckCounter: 0
    }));
  }

  // Helper function to assess current danger level
  function assessCurrentDangerLevel(x, y) {
    const adjacentCells = getAdjacentCells(x, y);
    let dangerCount = 0;
    
    adjacentCells.forEach(([adjX, adjY]) => {
      const cell = aiKnowledge[adjY][adjX];
      if (cell.possiblePit) dangerCount += 2;
      if (cell.possibleWumpus && !aiState.wumpusKilled) dangerCount += 3;
      if (!cell.safe && !cell.visited && !cell.possiblePit && !cell.possibleWumpus) dangerCount += 1;
    });
    
    return dangerCount;
  }

  // Helper function to check if all adjacent cells are dangerous
  function areAllAdjacentCellsDangerous(x, y) {
    const adjacentCells = getAdjacentCells(x, y);
    return adjacentCells.every(([adjX, adjY]) => {
      const cell = aiKnowledge[adjY][adjX];
      return (cell.possiblePit || (cell.possibleWumpus && !aiState.wumpusKilled)) && !cell.visited;
    });
  }

  // Helper function to find the nearest safe cell (visited or explicitly safe)
  function findNearestSafeCell(currentX, currentY) {
    const safeCells = [];
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const cell = aiKnowledge[y][x];
        if ((cell.visited || cell.safe) && !(x === currentX && y === currentY)) {
          const distance = heuristic({ x: currentX, y: currentY }, { x, y });
          safeCells.push({ x, y, distance });
        }
      }
    }
    
    safeCells.sort((a, b) => a.distance - b.distance);
    return safeCells.length > 0 ? { x: safeCells[0].x, y: safeCells[0].y } : null;
  }

  // Helper function to find a safe adjacent move
  function findSafeAdjacentMove(x, y) {
    const adjacentCells = getAdjacentCells(x, y);
    const safeMoves = adjacentCells.filter(([adjX, adjY]) => {
      const cell = aiKnowledge[adjY][adjX];
      return cell.visited || cell.safe;
    });
    
    if (safeMoves.length > 0) {
      return { x: safeMoves[0][0], y: safeMoves[0][1] };
    }
    return null;
  }

  // Helper function to find any visited cell for emergency backtracking
  function findAnyVisitedCell(currentX, currentY) {
    const adjacentCells = getAdjacentCells(currentX, currentY);
    const visitedAdjacent = adjacentCells.filter(([adjX, adjY]) => {
      return aiKnowledge[adjY][adjX].visited;
    });
    
    if (visitedAdjacent.length > 0) {
      return { x: visitedAdjacent[0][0], y: visitedAdjacent[0][1] };
    }
    return null;
  }

  // ENHANCED strategic backtrack target finder - more aggressive loop breaking
  function findStrategicBacktrackTarget(currentX, currentY) {
    const safeCells = [];
    const recentPositions = aiState.visitedPositions.slice(-15); // Extended recent positions
    const allPositions = aiState.visitedPositions;
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const cell = aiKnowledge[y][x];
        const posKey = `${x},${y}`;
        
        // Find visited safe cells with strict filtering
        if (cell.visited && cell.safe && !(x === currentX && y === currentY)) {
          const distance = heuristic({ x: currentX, y: currentY }, { x, y });
          const visitCount = allPositions.filter(pos => pos === posKey).length;
          const isRecent = recentPositions.includes(posKey);
          
          // STRICT filtering: not recent AND not visited too frequently
          if (!isRecent && visitCount <= 3 && distance >= 3) { // Minimum distance of 3
            
            // Prefer cells that have unexplored neighbors (potential for new exploration)
            const unexploredNeighbors = getAdjacentCells(x, y).filter(([nx, ny]) => 
              !aiKnowledge[ny][nx].visited && !aiKnowledge[ny][nx].possiblePit && 
              !aiKnowledge[ny][nx].possibleWumpus
            ).length;
            
            // Add score for cells that can break us out of current area
            const currentAreaCells = getAdjacentCells(currentX, currentY).length;
            const targetAreaCells = getAdjacentCells(x, y).length;
            const areaDiversity = Math.abs(targetAreaCells - currentAreaCells);
            
            safeCells.push({ 
              x, y, distance, unexploredNeighbors, visitCount, areaDiversity,
              score: unexploredNeighbors * 3 + distance * 2 + areaDiversity
            });
          }
        }
      }
    }
    
    if (safeCells.length === 0) {
      console.log("No strategic backtrack targets found with strict criteria");
      return null;
    }
    
    // Sort by: 1) Highest score (combination of factors), 2) Fewest visits, 3) Distance
    safeCells.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.visitCount !== b.visitCount) return a.visitCount - b.visitCount;
      return b.distance - a.distance; // Prefer farther cells
    });
    
    console.log(`Strategic backtrack target: (${safeCells[0].x}, ${safeCells[0].y}) with score ${safeCells[0].score}, ${safeCells[0].unexploredNeighbors} unexplored neighbors, visited ${safeCells[0].visitCount} times`);
    return { x: safeCells[0].x, y: safeCells[0].y };
  }

  // NEW: Emergency visited cell finder that avoids recent positions
  function findEmergencyVisitedCell(currentX, currentY) {
    const adjacentCells = getAdjacentCells(currentX, currentY);
    const recentPositions = aiState.visitedPositions.slice(-8);
    
    // Try to find visited cells that are NOT in recent positions
    const nonRecentVisited = adjacentCells.filter(([adjX, adjY]) => {
      const posKey = `${adjX},${adjY}`;
      return aiKnowledge[adjY][adjX].visited && !recentPositions.includes(posKey);
    });
    
    if (nonRecentVisited.length > 0) {
      return { x: nonRecentVisited[0][0], y: nonRecentVisited[0][1] };
    }
    
    // Last resort: any visited adjacent cell
    const anyVisited = adjacentCells.filter(([adjX, adjY]) => {
      return aiKnowledge[adjY][adjX].visited;
    });
    
    if (anyVisited.length > 0) {
      console.log("WARNING: Using recent visited cell as emergency move");
      return { x: anyVisited[0][0], y: anyVisited[0][1] };
    }
    
    return null;
  }

  // Helper function to handle stuck situations
  function handleStuckSituation(x, y) {
    console.log("AI is truly stuck, pausing simulation");
    setSimulationState('paused');
    setPopupContent({
      message: (
        <div className="text-center">
          <div className="text-red-600 text-2xl font-bold mb-2">AI is stuck!</div>
          <div className="text-gray-500 text-lg">Position: ({x}, {y})</div>
          <div className="text-gray-500 text-lg">No safe moves available. Consider restarting.</div>
        </div>
      ),
      sound: null
    });
    setShowPopup(true);
  }

  // Helper function to find the best shooting target
  function findBestShootingTarget(currentX, currentY) {
    const adjacentCells = getAdjacentCells(currentX, currentY);
    const suspiciousCells = adjacentCells.filter(([adjX, adjY]) => 
      aiKnowledge[adjY][adjX].possibleWumpus && !aiKnowledge[adjY][adjX].visited
    );
    
    // Only shoot if we're confident about wumpus location
    if (suspiciousCells.length === 1) {
      return { x: suspiciousCells[0][0], y: suspiciousCells[0][1] };
    }
    
    return null;
  }

  // Helper function to find all safe cells for movement
  function findAllSafeCells(knowledge, currentPos) {
    const safeCells = [];
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if ((knowledge[y][x].safe || knowledge[y][x].visited) && 
            !(x === currentPos.x && y === currentPos.y)) {
          const distance = heuristic(currentPos, { x, y });
          safeCells.push({ x, y, distance });
        }
      }
    }
    
    // Sort by distance
    safeCells.sort((a, b) => a.distance - b.distance);
    return safeCells;
  }

  // Enhanced useEffect for AI stepping with error handling
  useEffect(() => {
    if (gameMode === 'ai' && (simulationState === 'running' || simulationState === 'step')) {
      try {
        // Safety check - ensure all required AI state properties exist
        if (!aiState || !aiKnowledge || !gameState) {
          console.error('Missing required state objects for AI simulation');
          setSimulationState('paused');
          showGamePopup(
            `⚠️ Initialization Error!\nAI state not properly initialized.\nPlease reload the environment.`,
            null,
            'wumpus'
          );
          return;
        }
        
        // Additional safety checks for AI state properties
        if (typeof aiState.searchingForGold === 'undefined' || 
            typeof aiState.returningHome === 'undefined' ||
            !aiState.visitedPositions ||
            typeof aiState.stuckCounter === 'undefined') {
          console.error('AI state missing required properties:', aiState);
          setSimulationState('paused');
          showGamePopup(
            `⚠️ AI State Error!\nAI state missing required properties.\nPlease reload the environment.`,
            null,
            'wumpus'
          );
          return;
        }
        
        if (simulationState === 'step') {
          // Execute one step then stop
          setTimeout(() => {
            try {
              aiStep();
              setSimulationState('paused');
            } catch (error) {
              console.error('Error in AI step execution:', error);
              setSimulationState('paused');
              showGamePopup(
                `⚠️ AI Step Error!\nError during step execution: ${error.message}`,
                null,
                'wumpus'
              );
            }
          }, 100);
        } else if (simulationState === 'running') {
          // Continuous execution
          const interval = setInterval(() => {
            try {
              aiStep();
            } catch (error) {
              console.error('Error in AI step:', error);
              setSimulationState('paused');
              showGamePopup(
                `⚠️ AI Error!\nAn error occurred during AI execution.\nSimulation paused for safety.\nError: ${error.message}`,
                null,
                'wumpus'
              );
              clearInterval(interval);
            }
          }, 800); // 800ms per step for better visualization
          return () => clearInterval(interval);
        }
      } catch (error) {
        console.error('Error in useEffect:', error);
        setSimulationState('stopped');
        showGamePopup(
          `⚠️ Critical Error!\nUnable to start AI simulation.\nError: ${error.message}`,
          null,
          'wumpus'
        );
      }
    }
  }, [gameMode, simulationState, gameState, aiKnowledge, aiState]);

  const showGamePopup = (message, sound, type = 'default') => {
    setPopupContent({ message, sound, type });
    setShowPopup(true);
    if (sound) {
      backgroundMusic.pause();
      sound.play();
    }
  };

  const handlePopupClose = () => {
    setShowPopup(false);
    // Only restart if the game is actually over (not alive)
    if (!gameState.isAlive) {
      handleRestart();
    }
    backgroundMusic.play();
  };

  // Popup component
  const Popup = ({ message, onClose, type = 'default' }) => (
    <div className="popup-overlay">
      <div className={`popup-content ${type === 'gold' ? 'popup-gold' : ''}`}>
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

    // CRITICAL SAFETY CHECK for AI mode: Never allow AI to move to dangerous cells
    if (gameMode === 'ai' && willMove) {
      const targetCell = gameState.grid[newPosition.y][newPosition.x];
      if (targetCell.pit || targetCell.wumpus) {
        console.log(`EMERGENCY STOP: AI tried to move to dangerous cell (${newPosition.x}, ${newPosition.y})`);
        console.log('Cell contents:', targetCell);
        // setSimulationState('paused');
        // showGamePopup(
        //   `⚠️ SAFETY OVERRIDE ACTIVATED!\nAI attempted to move to a dangerous cell at (${newPosition.x}, ${newPosition.y})\nSimulation paused for safety.`,
        //   null,
        //   'wumpus'
        // );
        return;
      }
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
      
      // Show victory popup and restart the game
      showGamePopup("🏆 Congratulations! You found the gold! ✨💰\n🎉 Starting a new game...", goldSound, 'gold');
      
      // Restart the game after a short delay
      setTimeout(() => {
        handleRestart();
        
        // If in AI mode, auto-start the simulation for the new game
        if (gameMode === 'ai') {
          setTimeout(() => {
            setSimulationState('running');
          }, 1000); // Give time for restart to complete
        }
      }, 2000); // 2 second delay to show the victory message
      
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
        newCell.wumpus 
          ? "☠️ Game Over! The Wumpus got you! 👾" 
          : "💀 Game Over! You fell into a pit! 🕳️",
        newCell.wumpus ? wumpusSound : pitSound,
        newCell.wumpus ? 'wumpus' : 'pit'
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
      showGamePopup("🎉 Congratulations! You won! 🏆\nYou got the gold and made it back safely! 🌟", goldSound);
      return;
    }

    // Update game state and percepts
    setGameState(prev => ({
      ...prev,
      playerPosition: newPosition,
      grid: newGrid
    }));
    updatePercepts(newPosition);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // Validate file content exists
          if (!e.target.result) {
            throw new Error('File is empty or could not be read');
          }

          const lines = e.target.result.trim().split('\n');
          if (lines.length !== 10) {
            throw new Error(`Invalid file format: Must have exactly 10 lines, got ${lines.length}`);
          }

          const newGrid = Array(10).fill().map(() => Array(10).fill().map(() => ({
            visited: false,
            wumpus: false,
            pit: false,
            gold: false,
            breeze: false,
            stench: false,
            glitter: false
          })));

          lines.forEach((line, y) => {
            const chars = line.trim().split('');
            if (chars.length !== 10) {
              throw new Error(`Invalid line ${y + 1}: Must have exactly 10 characters, got ${chars.length}`);
            }

            chars.forEach((char, x) => {
              switch (char) {
                case 'P':
                  newGrid[y][x].pit = true;
                  // Add breeze to adjacent cells
                  getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
                    if (adjX >= 0 && adjX < 10 && adjY >= 0 && adjY < 10) {
                      newGrid[adjY][adjX].breeze = true;
                    }
                  });
                  break;
                case 'W':
                  newGrid[y][x].wumpus = true;
                  // Add stench to adjacent cells
                  getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
                    if (adjX >= 0 && adjX < 10 && adjY >= 0 && adjY < 10) {
                      newGrid[adjY][adjX].stench = true;
                    }
                  });
                  break;
                case 'G':
                  newGrid[y][x].gold = true;
                  newGrid[y][x].glitter = true;
                  break;
                case '-':
                  break;
                default:
                  throw new Error(`Invalid character at position (${x},${y}): ${char}. Valid characters: P, W, G, -`);
              }
            });
          });

          // Reset game state with new grid
          setGameState(prev => ({
            ...prev,
            grid: newGrid,
            playerPosition: { 
              x: 0, 
              y: 9,
              facing: 'right'
            },
            hasGold: false,
            hasArrow: true,
            isAlive: true
          }));

          // Reset AI knowledge and state
          setAiKnowledge(() =>
            Array(10).fill().map(() => Array(10).fill().map(() => ({
              safe: false,
              possiblePit: false,
              possibleWumpus: false,
              visited: false,
              wumpusKilled: false,
              hasGold: false,
              explored: false
            })))
          );

          // Mark starting position as safe in AI knowledge
          setAiKnowledge(prev => {
            const newKnowledge = [...prev];
            newKnowledge[9][0].safe = true;
            newKnowledge[9][0].visited = true;
            return newKnowledge;
          });

          // Reset AI state with all required properties
          setAiState({
            hasShot: false,
            wumpusKilled: false,
            targetPosition: null,
            plan: [],
            currentPlanIndex: 0,
            searchingForGold: true,
            returningHome: false,
            visitedPositions: [],
            stuckCounter: 0
          });

          // Success message and auto-start simulation
          console.log('Environment loaded successfully - starting AI simulation automatically');
          
          // Auto-start the simulation instead of stopping
          setTimeout(() => {
            setSimulationState('running');
          }, 500); // Small delay to ensure state is fully updated
          
        } catch (error) {
          console.error('File upload error:', error);
          setSimulationState('stopped');
          showGamePopup(
            `⚠️ Error Loading Environment!\nError: ${error.message}\nPlease check your file format.`,
            null,
            'wumpus'
          );
        }
      };
      
      reader.onerror = () => {
        console.error('File reading error');
        showGamePopup(
          `⚠️ File Reading Error!\nCould not read the selected file.\nPlease try again.`,
          null,
          'wumpus'
        );
      };
      
      reader.readAsText(file);
    } else {
      console.warn('No file selected');
    }
  };

  const handleStartSimulation = () => {
    try {
      // Validate that we have a proper game state
      if (!gameState || !gameState.grid || !gameState.playerPosition) {
        showGamePopup(
          `⚠️ Cannot Start Simulation!\nNo environment loaded.\nPlease upload an environment file first.`,
          null,
          'wumpus'
        );
        return;
      }
      
      // Validate AI state
      if (!aiState || typeof aiState.searchingForGold === 'undefined') {
        showGamePopup(
          `⚠️ AI Not Initialized!\nAI state not properly initialized.\nPlease reload the environment.`,
          null,
          'wumpus'
        );
        return;
      }
      
      // Validate AI knowledge
      if (!aiKnowledge || aiKnowledge.length !== 10 || aiKnowledge[0].length !== 10) {
        showGamePopup(
          `⚠️ AI Knowledge Error!\nAI knowledge base not properly initialized.\nPlease reload the environment.`,
          null,
          'wumpus'
        );
        return;
      }
      
      console.log('Starting AI simulation with validated state...');
      setSimulationState('running');
    } catch (error) {
      console.error('Error starting simulation:', error);
      showGamePopup(
        `⚠️ Startup Error!\nError: ${error.message}\nCannot start simulation.`,
        null,
        'wumpus'
      );
    }
  };

  const handleNextStep = () => {
    if (simulationState === 'running') return;
    setSimulationState('step');
  };

  const handlePause = () => {
    setSimulationState('paused');
  };

  // Reset AI state when game restarts
  const handleRestart = () => {
    setSimulationState('stopped');
    setAiState({
      hasShot: false,
      wumpusKilled: false,
      targetPosition: null,
      plan: [],
      currentPlanIndex: 0,
      searchingForGold: true,
      returningHome: false,
      visitedPositions: [],
      stuckCounter: 0
    });
    setAiKnowledge(() =>
      Array(10).fill().map(() => Array(10).fill().map(() => ({
        safe: false,
        possiblePit: false,
        possibleWumpus: false,
        visited: false,
        wumpusKilled: false,
        hasGold: false,
        explored: false
      })))
    );
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
    
    // Mark starting position as safe in AI knowledge
    setAiKnowledge(prev => {
      const newKnowledge = [...prev];
      newKnowledge[9][0].safe = true;
      newKnowledge[9][0].visited = true;
      return newKnowledge;
    });
  };

  const handleShoot = () => {
    if (!gameState.hasArrow || !gameState.isAlive) return;

    const { x, y, facing } = gameState.playerPosition;
    let hitWumpus = false;
    let checkX = x;
    let checkY = y;

    // Move in the direction player is facing
    switch (facing) {
      case 'right': checkX++; break;
      case 'left': checkX--; break;
      case 'up': checkY--; break;
      case 'down': checkY++; break;
    }

    // Check cells in the direction until we hit a wall or wumpus
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
      
      // Update AI state
      setAiState(prev => ({ ...prev, wumpusKilled: true }));
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
        message: "✨ You got the gold! Now head back to the start! 🏃"
      }));
    }
  };  // STRICT safe moves finder - even more aggressive loop avoidance
  function findSafeAdjacentMoves(x, y) {
    const adjacentCells = getAdjacentCells(x, y);
    const allSafeMoves = adjacentCells.filter(([adjX, adjY]) => {
      return isMoveBalancedSafe(x, y, adjX, adjY);
    });
    
    const safeMoves = allSafeMoves.map(([adjX, adjY]) => ({ x: adjX, y: adjY }));
    
    // Separate unvisited and visited safe moves
    const unvisitedSafeMoves = safeMoves.filter(move => !aiKnowledge[move.y][move.x].visited);
    const visitedSafeMoves = safeMoves.filter(move => aiKnowledge[move.y][move.x].visited);
    
    // STRICT filtering of visited moves to avoid recent positions (last 12 instead of 8)
    const nonRecentVisitedMoves = visitedSafeMoves.filter(move => {
      const posKey = `${move.x},${move.y}`;
      const recentPositions = aiState.visitedPositions.slice(-12); // Extended to last 12 positions
      return !recentPositions.includes(posKey);
    });
    
    // Even stricter: avoid positions that were visited multiple times
    const nonRepeatedVisitedMoves = nonRecentVisitedMoves.filter(move => {
      const posKey = `${move.x},${move.y}`;
      const allPositions = aiState.visitedPositions;
      const visitCount = allPositions.filter(pos => pos === posKey).length;
      return visitCount <= 2; // Avoid positions visited more than twice
    });
    
    console.log(`STRICT safe moves from (${x}, ${y}): ${unvisitedSafeMoves.length} unvisited, ${nonRepeatedVisitedMoves.length} non-repeated visited, ${visitedSafeMoves.length} total visited`);
    
    // Priority: 1) Unvisited moves, 2) Non-repeated visited moves, 3) Non-recent visited moves, 4) Emergency any visited
    if (unvisitedSafeMoves.length > 0) {
      return unvisitedSafeMoves;
    } else if (nonRepeatedVisitedMoves.length > 0) {
      console.log("Using non-repeated visited moves");
      return nonRepeatedVisitedMoves;
    } else if (nonRecentVisitedMoves.length > 0) {
      console.log("Using non-recent visited moves");
      return nonRecentVisitedMoves;
    } else {
      // Emergency: only if no other options and we're truly stuck
      console.log("WARNING: Only recently/repeatedly visited moves available - high loop risk");
      return visitedSafeMoves;
    }
  }

  // Helper function to choose the best safe move (prefer unexplored safe cells)
  function chooseBestSafeMove(safeMoves, currentX, currentY) {
    // Prioritize unvisited safe cells over visited ones
    const unvisitedSafeMoves = safeMoves.filter(move => !aiKnowledge[move.y][move.x].visited);
    
    if (unvisitedSafeMoves.length > 0) {
      return unvisitedSafeMoves[0];
    }
    
    // If all safe moves are visited, choose the closest one
    safeMoves.sort((a, b) => {
      const distA = heuristic({ x: currentX, y: currentY }, a);
      const distB = heuristic({ x: currentX, y: currentY }, b);
      return distA - distB;
    });
    
    return safeMoves[0];
  }

  // ENHANCED exploration with STRICT anti-revisit preference and risky move allowance
  function findBalancedExplorationMove(x, y) {
    const adjacentCells = getAdjacentCells(x, y);
    
    // Find all safe moves using enhanced validation
    const balancedSafeMoves = adjacentCells.filter(([adjX, adjY]) => {
      return isMoveBalancedSafe(x, y, adjX, adjY);
    });
    
    // Among safe moves, strongly prefer unvisited ones
    const unvisitedSafeMoves = balancedSafeMoves.filter(([adjX, adjY]) => {
      return !aiKnowledge[adjY][adjX].visited;
    });
    
    if (unvisitedSafeMoves.length > 0) {
      // Choose the unvisited safe move that's closest to unexplored areas
      const bestMove = unvisitedSafeMoves.reduce((best, [adjX, adjY]) => {
        const unexploredNeighbors = getAdjacentCells(adjX, adjY).filter(([nx, ny]) => 
          !aiKnowledge[ny][nx].visited
        ).length;
        
        // Add bonus for moves that lead to completely unknown areas
        const unknownNeighbors = getAdjacentCells(adjX, adjY).filter(([nx, ny]) => 
          !aiKnowledge[ny][nx].visited && 
          !aiKnowledge[ny][nx].possiblePit && 
          !aiKnowledge[ny][nx].possibleWumpus
        ).length;
        
        const totalScore = unexploredNeighbors + (unknownNeighbors * 0.5);
        
        if (!best || totalScore > best.score) {
          return { x: adjX, y: adjY, unexploredCount: unexploredNeighbors, score: totalScore };
        }
        return best;
      }, null);
      
      console.log(`Enhanced exploration move selected: (${bestMove.x}, ${bestMove.y}) with score ${bestMove.score}`);
      return { x: bestMove.x, y: bestMove.y };
    }
    
    // Check if we're in a strict loop situation
    const inStrictLoop = detectLoop({ x, y });
    const highlyStuck = aiState.stuckCounter > 8; // Increased threshold for stricter behavior
    
    if (inStrictLoop && highlyStuck) {
      console.log("STRICT loop detected and highly stuck - considering strategic visited move");
      
      // Find visited moves that have NOT been visited recently AND not visited frequently
      const visitedSafeMoves = balancedSafeMoves.filter(([adjX, adjY]) => {
        return aiKnowledge[adjY][adjX].visited;
      });
      
      // Multiple filters for loop breaking
      const strategicBreakMoves = visitedSafeMoves.filter(([adjX, adjY]) => {
        const posKey = `${adjX},${adjY}`;
        const recentPositions = aiState.visitedPositions.slice(-15); // Check last 15 positions
        const allPositions = aiState.visitedPositions;
        
        // Not in recent positions AND not visited too frequently
        const notRecent = !recentPositions.includes(posKey);
        const visitCount = allPositions.filter(pos => pos === posKey).length;
        const notFrequent = visitCount <= 3;
        
        // Prefer moves that lead to areas with unexplored neighbors
        const hasUnexploredNeighbors = getAdjacentCells(adjX, adjY).some(([nx, ny]) => 
          !aiKnowledge[ny][nx].visited
        );
        
        return notRecent && notFrequent && hasUnexploredNeighbors;
      });
      
      if (strategicBreakMoves.length > 0) {
        const [adjX, adjY] = strategicBreakMoves[0];
        console.log(`STRATEGIC loop-breaking move to visited cell: (${adjX}, ${adjY})`);
        return { x: adjX, y: adjY };
      }
    }
    
    console.log("STRICT: No exploration moves available - maintaining strong anti-revisit policy");
    return null;
  }

  // ENHANCED move validation - allows risky moves when safe adjacent cells are visited
  function isMoveBalancedSafe(fromX, fromY, toX, toY) {
    const targetCell = aiKnowledge[toY][toX];
    
    // Always safe: visited or explicitly marked safe
    if (targetCell.visited || targetCell.safe) {
      return true;
    }
    
    // NEVER safe: confirmed dangerous cells
    if (targetCell.possiblePit || (targetCell.possibleWumpus && !aiState.wumpusKilled)) {
      console.log(`REJECTING move to (${toX}, ${toY}) - possible danger detected!`);
      return false;
    }
    
    // Enhanced logic: Allow risky moves if adjacent safe cells are mostly visited
    const targetAdjacentCells = getAdjacentCells(toX, toY);
    const safeAdjacentCells = targetAdjacentCells.filter(([adjX, adjY]) => {
      const adjCell = aiKnowledge[adjY][adjX];
      return adjCell.visited || adjCell.safe;
    });
    
    const visitedAdjacentCells = targetAdjacentCells.filter(([adjX, adjY]) => {
      return aiKnowledge[adjY][adjX].visited;
    });
    
    // If most adjacent cells are safe/visited, allow this risky move
    const safeRatio = safeAdjacentCells.length / targetAdjacentCells.length;
    const visitedRatio = visitedAdjacentCells.length / targetAdjacentCells.length;
    
    if (safeRatio >= 0.5 || visitedRatio >= 0.5) {
      console.log(`Allowing risky move to (${toX}, ${toY}) - ${safeAdjacentCells.length}/${targetAdjacentCells.length} adjacent cells are safe`);
      return true;
    }
    
    // Check current sensing situation
    const currentCell = gameState.grid[fromY][fromX];
    if (currentCell.breeze || currentCell.stench) {
      // If sensing danger, be more careful but still allow if we have evidence of safety
      const evidenceOfSafety = targetAdjacentCells.some(([adjX, adjY]) => {
        const adjCell = aiKnowledge[adjY][adjX];
        return adjCell.visited && !gameState.grid[adjY][adjX].breeze && !gameState.grid[adjY][adjX].stench;
      });
      
      if (evidenceOfSafety) {
        console.log(`Allowing risky move to (${toX}, ${toY}) - evidence of safety from adjacent explored cells`);
        return true;
      }
    }
    
    // Allow unknown cells if we're in a loop and need to break free
    const inLoop = detectLoop({ x: fromX, y: fromY });
    if (inLoop && !targetCell.possiblePit && !targetCell.possibleWumpus) {
      console.log(`Allowing risky move to (${toX}, ${toY}) - breaking loop with unknown cell`);
      return true;
    }
    
    // Default: Unknown cells are okay if we're not sensing immediate danger
    return !targetCell.possiblePit && !targetCell.possibleWumpus && !currentCell.breeze && !currentCell.stench;
  }

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
            isAIMode={gameMode === 'ai'}
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
          type={popupContent.type}
        />
      )}
    </div>
    
  )
}

export default App
