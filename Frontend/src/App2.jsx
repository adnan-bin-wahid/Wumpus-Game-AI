import { useState, useEffect } from 'react'
import './App.css'
import KnowledgeBase from './components/KnowledgeBase'
import WumpusGrid from './components/WumpusGrid'
import './components/ScoreDisplay.css'

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
  const [score, setScore] = useState(0); // Add score state for performance tracking
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
      explored: false,
      glitterProbability: 0 // Track probability of gold being near
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
    stuckCounter: 0, // Count how many times AI couldn't find new moves
    explorationMode: 'normal', // normal, aggressive, desperate
    lastGoldHint: null, // Store last position where we detected a gold hint
    globalExploredCount: 0, // Track total explored cells
    
    // ENHANCEMENT 1: Exponential revisit penalties - tracking
    visitCountMap: {}, // Map of positions to visit counts
    
    // ENHANCEMENT 2: Progress tracking
    lastNewCellDiscovery: Date.now(),
    newCellsDiscoveredCount: 0,
    
    // ENHANCEMENT 3: Exploration zones
    // Divide the 10x10 grid into 4 zones (top-left, top-right, bottom-left, bottom-right)
    explorationZones: [
      {id: 0, name: "top-left", explored: 0, total: 25, lastVisited: null},
      {id: 1, name: "top-right", explored: 0, total: 25, lastVisited: null},
      {id: 2, name: "bottom-left", explored: 0, total: 25, lastVisited: null},
      {id: 3, name: "bottom-right", explored: 0, total: 25, lastVisited: null}
    ],
    currentZone: 0,
    zoneChangeCount: 0,
    
    // ENHANCEMENT 5: Improved loop detection
    pathHistory: [], // Store recent paths for more advanced pattern detection
    loopDetectionLevel: 1, // Starts at basic and increases with stuck time
    
    // ENHANCEMENT 7: Stronger blocking
    blockedCells: {}, // Cells temporarily blocked from consideration with expiry time
    
    // ENHANCEMENT 8: Zone-based exploration
    zoneExplorationPriority: [0, 1, 2, 3], // Default priority order
    zoneBlockingTime: {0: 0, 1: 0, 2: 0, 3: 0} // Time until a zone is unblocked
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
    hasReachedHomeWithGold: false,
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
    const posKey = `${pos.x},${pos.y}`;
    
    // ENHANCEMENT 1: Exponential revisit penalties
    if (cell.visited) {
      // Get visit count from the map or default to count from visitedPositions
      const visitCount = aiState.visitCountMap[posKey] || 
                        aiState.visitedPositions.filter(p => p === posKey).length;
      
      // Apply exponentially increasing penalty based on visit count
      // Base penalty: 2, but grows exponentially with revisits
      const basePenalty = 2;
      penalty = basePenalty * Math.pow(2.5, Math.min(visitCount, 6)); 
      
      // Extra penalty for recently visited cells
      const recentVisits = aiState.visitedPositions.slice(-10).filter(p => p === posKey).length;
      if (recentVisits > 0) {
        penalty += recentVisits * 25; // Strongly discourage immediate revisits
      }
      
      // ENHANCEMENT 3: Exploration zones - add penalty for over-explored zones
      const zone = getZoneForPosition(pos.x, pos.y);
      if (zone !== null) {
        const zoneInfo = aiState.explorationZones[zone];
        if (zoneInfo && zoneInfo.explored > zoneInfo.total * 0.75) {
          // If we've explored most of this zone, encourage looking elsewhere
          penalty += 15;
        }
        
        // If this zone is blocked due to overexploration, add huge penalty
        if (aiState.zoneBlockingTime[zone] > Date.now()) {
          penalty += 200;
        }
      }
      
      // ENHANCEMENT 2: Progress tracking - adjust based on exploration progress
      if (aiState.lastNewCellDiscovery) {
        const timeSinceNewCell = Date.now() - aiState.lastNewCellDiscovery;
        const secondsSinceNewCell = timeSinceNewCell / 1000;
        
        // If we haven't found a new cell in a while, be more willing to take risks
        if (secondsSinceNewCell > 30) {
          // Reduce penalty for already visited cells to break out of loops
          penalty *= 0.7;
        }
      }
      
      return penalty;
    }
    
    // Explicitly safe cells have reduced penalty or bonus to encourage exploring new safe areas
    if (cell.safe && !cell.visited) {
      return -5; // Bonus for safe unvisited cells
    }
    
    // High penalties for dangerous cells but not impossible
    if (cell.possiblePit) penalty += allowRisky ? 15 : 100;
    if (cell.possibleWumpus && !aiState.wumpusKilled) penalty += allowRisky ? 20 : 150;
    
    // Unknown cells get minimal penalty to encourage exploration
    if (!cell.safe && !cell.visited && !cell.possiblePit && !cell.possibleWumpus) {
      // ENHANCEMENT 4: Enhanced frontier prioritization
      // Check if this cell is a frontier cell (adjacent to visited cells)
      const isFrontier = getAdjacentCells(pos.x, pos.y).some(([adjX, adjY]) => 
        knowledge[adjY][adjX].visited
      );
      
      if (isFrontier) {
        // Frontier cells are more valuable - give a bonus
        penalty -= 2;
        
        // ENHANCEMENT 8: Zone-based exploration - prioritize unexplored zones
        const zone = getZoneForPosition(pos.x, pos.y);
        if (zone !== null) {
          const zoneInfo = aiState.explorationZones[zone];
          if (zoneInfo && zoneInfo.explored < zoneInfo.total * 0.5) {
            // Bonus for less explored zones
            penalty -= 5;
          }
        }
      } else {
        penalty += allowRisky ? 0.5 : 1;
      }
    }
    
    // ENHANCEMENT 7: Stronger blocking - completely avoid blocked cells
    if (aiState.blockedCells[posKey] && aiState.blockedCells[posKey] > Date.now()) {
      penalty += 500; // Make it virtually impossible to select
    }
    
    return penalty;
  }
  
  // Helper function to determine which zone a position belongs to
  function getZoneForPosition(x, y) {
    // Zone 0: Top-left (0-4, 0-4)
    if (x < 5 && y < 5) return 0;
    // Zone 1: Top-right (5-9, 0-4)
    if (x >= 5 && y < 5) return 1;
    // Zone 2: Bottom-left (0-4, 5-9)
    if (x < 5 && y >= 5) return 2;
    // Zone 3: Bottom-right (5-9, 5-9)
    if (x >= 5 && y >= 5) return 3;
    
    return null; // Should never happen
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
    
    // Track global exploration progress
    setAiState(prev => ({
      ...prev,
      globalExploredCount: prev.globalExploredCount + 1
    }));
    
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
      // Store this position as a gold hint for future reference
      setAiState(prev => ({
        ...prev, 
        lastGoldHint: { x, y },
        explorationMode: 'normal' // Reset exploration mode on gold hint
      }));
    }
    
    // Optimize gold search by tracking glitter probabilities
    // If we find a glitter, increase probability in surrounding cells
    if (percepts.glitter) {
      getAdjacentCells(x, y).forEach(([adjX, adjY]) => {
        newKnowledge[adjY][adjX].glitterProbability = 1.0; // Maximum probability
      });
    } else {
      // Decrease probability slightly for this cell
      newKnowledge[y][x].glitterProbability = Math.max(0, (newKnowledge[y][x].glitterProbability || 0) - 0.1);
      
      // If cells have been explored but no gold, update exploration mode
      const visitedCellCount = newKnowledge.flat().filter(cell => cell.visited).length;
      if (visitedCellCount > 15 && !percepts.glitter) {
        setAiState(prev => ({
          ...prev,
          explorationMode: 'aggressive'
        }));
      }
      if (visitedCellCount > 30 && !percepts.glitter) {
        setAiState(prev => ({
          ...prev,
          explorationMode: 'desperate'
        }));
      }
    }
    
    // Apply logical inference to reduce uncertainty
    applyLogicalInference(newKnowledge);
    
    setAiKnowledge(newKnowledge);
  }

  // Optimized exploration target finding focused on gold discovery
  function findBestExplorationTarget(knowledge, currentPos) {
    const safeCells = [];
    const unknownCells = [];
    const visitedCells = []; // Track visited cells for fallback
    const explorationMode = aiState.explorationMode || 'normal';
    
    // ENHANCEMENT 1: Exponential revisit penalties
    // Get visit counts for more effective blocking
    const visitCountMap = aiState.visitCountMap || {};
    
    // ENHANCEMENT 2: Progress tracking
    const timeSinceNewCell = aiState.lastNewCellDiscovery ? 
                            (Date.now() - aiState.lastNewCellDiscovery) / 1000 : 0;
    
    // ENHANCEMENT 3 & 8: Zone-based exploration
    // Get current prioritized zones
    const zonePriorities = aiState.zoneExplorationPriority || [0, 1, 2, 3];
    const zoneBlockingTime = aiState.zoneBlockingTime || {};
    const currentTime = Date.now();
    
    // Get more recent positions to avoid revisiting them (increased from 15 to 20)
    const recentPositions = new Set(aiState.visitedPositions.slice(-20));
    const repetitionFactor = aiState.repetitionFactor || 0;
    
    // Track blocked cells
    const blockedCells = aiState.blockedCells || {};
    
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const posKey = `${x},${y}`;
        const cell = knowledge[y][x];
        const wasRecentlyVisited = recentPositions.has(posKey);
        const distance = heuristic(currentPos, { x, y });
        
        // Skip current position
        if (x === currentPos.x && y === currentPos.y) continue;
        
        // ENHANCEMENT 7: Stronger blocking - skip cells that are temporarily blocked
        if (blockedCells[posKey] && blockedCells[posKey] > currentTime) {
          continue;
        }
        
        // Calculate important values for this cell
        const glitterProb = knowledge[y][x].glitterProbability || 0;
        const frontierValue = getFrontierValue(x, y, knowledge);
        const isDeadEnd = frontierValue === 0 && knowledge[y][x].visited;
        
        // ENHANCEMENT 4: Enhanced frontier prioritization
        // Calculate frontier score - prioritize cells that open up more unexplored areas
        const frontierScore = calculateFrontierScore(x, y, knowledge);
        
        // Get visit count for exponential penalty
        const visitCount = visitCountMap[posKey] || 0;
        
        // ENHANCEMENT 1: Exponential revisit penalties
        // Calculate exponential penalty based on visit count
        const visitPenalty = visitCount > 0 ? Math.pow(2, Math.min(visitCount, 5)) : 0;
        
        // ENHANCEMENT 3: Exploration zones
        // Get zone bonus/penalty
        const zone = getZoneForPosition(x, y);
        let zoneBonus = 0;
        
        if (zone !== null) {
          // Check zone priority (lower index = higher priority)
          const zonePriorityIndex = zonePriorities.indexOf(zone);
          // Higher priority zones (lower index) get higher bonus
          zoneBonus = Math.max(0, 12 - (zonePriorityIndex * 3));
          
          // If zone is blocked, apply massive penalty
          if (zoneBlockingTime[zone] && zoneBlockingTime[zone] > currentTime) {
            zoneBonus = -100;
          }
          
          // If we're in desperate exploration mode and stuck for too long,
          // make previously low priority zones more attractive
          if (explorationMode === 'desperate' && timeSinceNewCell > 20) {
            // Invert zone priorities to break out of local loops
            zoneBonus = zonePriorityIndex * 2;
          }
        }
        
        // ENHANCEMENT 2: Progress tracking - adjust scoring based on time since new cell
        let progressFactor = 1.0;
        if (timeSinceNewCell > 15) { // If stuck for more than 15 seconds
          progressFactor = 1.5; // Increase willingness to explore new areas
        }
        
        // Penalty for recently visited positions to break loops - now exponential
        const recentVisitPenalty = wasRecentlyVisited ? 
          (explorationMode === 'desperate' ? 5 : Math.min(10 * visitCount, 50)) : 0;
        
        // Base exploration score calculation with enhanced metrics
        let explorationScore = 
          (10 * glitterProb) +        // Gold probability is highest priority
          (8 * frontierValue) +       // ENHANCEMENT 4: Increased frontier value weight
          (6 * frontierScore) +       // ENHANCEMENT 4: Bonus for cells opening more territory
          (zoneBonus) -               // ENHANCEMENT 3: Zone-based priority
          (distance * 0.4) -          // Closer cells are better but less important than other factors
          (visitPenalty * 2) -        // ENHANCEMENT 1: Exponential penalty for revisits
          recentVisitPenalty;         // Additional penalty for recently visited cells
          
        // Apply progress factor to the entire score
        explorationScore *= progressFactor;
          
        // Add novelty bonus based on repetition factor - favor new areas
        if (!knowledge[y][x].visited && repetitionFactor > 0.3) {
          explorationScore += 10; // ENHANCEMENT 1: Increased bonus to unexplored cells when in a loop
        }
        
        // Apply mode-specific modifiers
        if (explorationMode === 'aggressive') {
          // Aggressive mode: Prioritize unexplored territory even more
          if (!knowledge[y][x].visited) explorationScore += 2;
        } else if (explorationMode === 'desperate') {
          // Desperate mode: Take more risks, especially with distant cells
          if (!knowledge[y][x].visited) explorationScore += 4;
          if (distance > 3) explorationScore += 1; // Boost distant cells
        }
            
        const cellInfo = { 
          x, y, 
          distance,
          glitterProb,
          frontierValue,
          explorationScore,
          wasRecentlyVisited,
          isDeadEnd
        };
        
        if (knowledge[y][x].safe && !knowledge[y][x].visited) {
          // Unvisited safe cells are ideal
          safeCells.push(cellInfo);
        } else if (!knowledge[y][x].possiblePit && !knowledge[y][x].possibleWumpus && !knowledge[y][x].visited) {
          // Unvisited cells that aren't marked dangerous
          unknownCells.push(cellInfo);
        } else if (knowledge[y][x].safe && knowledge[y][x].visited && !isDeadEnd) {
          // Track visited safe cells as fallback
          visitedCells.push(cellInfo);
        }
      }
    }
    
    // Build target list based on exploration mode
    let allTargets = [];
    
    if (safeCells.length > 0) {
      // We have unvisited safe cells - prioritize these
      allTargets = [...safeCells];
    } else if (explorationMode === 'desperate') {
      // Desperate mode: Consider all options
      allTargets = [...unknownCells, ...visitedCells];
      // Only log desperate exploration mode once every 5 steps
      if (aiState.globalExploredCount % 5 === 0) {
        console.log("Desperate exploration: considering all cell types");
      }
    } else if (explorationMode === 'aggressive') {
      // Aggressive mode: Consider unknown cells and some visited
      allTargets = [...unknownCells];
      
      // Add visited cells but only if they're not recently visited
      const nonRecentVisited = visitedCells.filter(cell => !cell.wasRecentlyVisited);
      allTargets = [...allTargets, ...nonRecentVisited];
      
      // Only log aggressive exploration mode once every 5 steps
      if (aiState.globalExploredCount % 5 === 0) {
        console.log("Aggressive exploration: considering unknown cells and some visited");
      }
    } else {
      // Normal mode: Just safe unvisited cells, fall back to visited if needed
      allTargets = safeCells.length > 0 ? [...safeCells] : 
                   [...unknownCells, ...visitedCells.filter(c => !c.wasRecentlyVisited)];
    }
    
    if (allTargets.length === 0) {
      // Only log when truly out of options
      console.log("No suitable exploration targets - will need to backtrack");
      return null;
    }
    
    // Sort by exploration score (higher is better)
    allTargets.sort((a, b) => b.explorationScore - a.explorationScore);
    
    // Check if we have a gold hint and prioritize exploring near it
    if (aiState.lastGoldHint && explorationMode !== 'desperate') {
      const goldHintX = aiState.lastGoldHint.x;
      const goldHintY = aiState.lastGoldHint.y;
      
      // Find unexplored cells near the gold hint
      const nearGoldTargets = allTargets.filter(cell => {
        const goldDistance = Math.abs(cell.x - goldHintX) + Math.abs(cell.y - goldHintY);
        return goldDistance <= 3; // Within 3 cells of gold hint
      });
      
      if (nearGoldTargets.length > 0) {
        // Always log gold hint exploration - this is important
        console.log(`Prioritizing exploration near gold hint at (${goldHintX}, ${goldHintY})`);
        return nearGoldTargets[0];
      }
    }
    
    // Only log exploration status when it's critically low (every 10 steps)
    if ((safeCells.length === 0 || unknownCells.length < 5) && 
        aiState.globalExploredCount % 10 === 0) {
      console.log(`Exploration status: ${safeCells.length} safe unvisited, ${unknownCells.length} unknown cells`);
    }
    
    return { x: allTargets[0].x, y: allTargets[0].y };
  }
  
  // Helper function to calculate frontier value (unexplored neighbors)
  function getFrontierValue(x, y, knowledge) {
    const adjacentCells = getAdjacentCells(x, y);
    const unexploredCount = adjacentCells.filter(([adjX, adjY]) => {
      return !knowledge[adjY][adjX].visited;
    }).length;
    
    return unexploredCount / adjacentCells.length; // 0 to 1 value
  }
  
  // ENHANCEMENT 4: Enhanced frontier prioritization
  function calculateFrontierScore(x, y, knowledge) {
    // This function calculates a more sophisticated frontier score
    // that evaluates how valuable this cell is for opening new territory
    
    // If already visited, the frontier value is diminished
    if (knowledge[y][x].visited) {
      return 0.2 * getFrontierValue(x, y, knowledge);
    }
    
    // For unvisited cells, look at neighbors of neighbors to estimate exploration potential
    const adjacentCells = getAdjacentCells(x, y);
    
    // Count total unvisited cells in the extended neighborhood (2-step)
    let unexploredExtendedCount = 0;
    let totalExtendedCells = 0;
    
    adjacentCells.forEach(([adjX, adjY]) => {
      // If this adjacent cell is unexplored, it contributes to frontier value
      if (!knowledge[adjY][adjX].visited) {
        unexploredExtendedCount++;
      }
      
      // Now check this cell's neighbors (2-steps away from original)
      const extendedNeighbors = getAdjacentCells(adjX, adjY);
      extendedNeighbors.forEach(([extX, extY]) => {
        // Only count cells that are truly 2 steps away (not adjacent to original)
        if (Math.abs(extX - x) > 1 || Math.abs(extY - y) > 1) {
          totalExtendedCells++;
          if (!knowledge[extY][extX].visited) {
            unexploredExtendedCount++;
          }
        }
      });
    });
    
    // Combine immediate frontier value with extended frontier value
    const immediateFrontierValue = getFrontierValue(x, y, knowledge);
    const extendedFrontierValue = totalExtendedCells > 0 ? 
                                unexploredExtendedCount / totalExtendedCells : 0;
                                
    // Weight immediate frontier slightly more than extended
    return (0.7 * immediateFrontierValue) + (0.3 * extendedFrontierValue);
  }

  // Optimized AI Step for faster gold discovery
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
      
      // Only log important percepts (gold and stench) but not breeze as it's common
      if (percepts.glitter || percepts.stench) {
        console.log(`AI at position (${x}, ${y}), found: ${percepts.glitter ? 'gold ' : ''}${percepts.stench ? 'stench ' : ''}`);
      }
      
      // Simple loop detection
      const inLoop = detectLoop({ x, y });
      if (inLoop) {
        // This is an important event to always log
        console.log("Loop detected! Changing exploration strategy.");
        // Switch exploration mode on loops
        setAiState(prev => ({
          ...prev,
          explorationMode: prev.explorationMode === 'normal' ? 'aggressive' : 
                          prev.explorationMode === 'aggressive' ? 'desperate' : 'normal'
        }));
      }
      
      // Decision making logic - BALANCED AI BEHAVIOR
      
      // 1. If glitter is perceived, grab the gold
      if (percepts.glitter && !gameState.hasGold) {
        console.log("AI found gold, grabbing it!");
        
        // Update knowledge base to mark this cell as containing gold
        const newKnowledge = aiKnowledge.map(row => row.map(cell => ({ ...cell })));
        newKnowledge[y][x].hasGold = true;
        setAiKnowledge(newKnowledge);
        
        // Grab the gold
        handleGrab();
        
        // Explicitly set the AI to returning home mode with a clear plan
        setAiState(prev => ({
          ...prev,
          searchingForGold: false,
          returningHome: true,
          plan: [],  // Will be populated in the next AI step
          targetPosition: { x: 0, y: 9 }
        }));
        
        // When the popup is closed, the handlePopupClose function will restart 
        // the simulation automatically. No need to use setTimeout here.
        
        return;
      }
      
      // 2. If we have gold and at start position, climb out
      if (gameState.hasGold && x === 0 && y === 9) {
        console.log("AI won the game!");
        
        // Immediately stop the simulation to prevent multiple popups
        setSimulationState('stopped');
        
        // Calculate final score manually to ensure it's accurate
        // The score includes: -1 per move, -10 per arrow, +1000 for gold
        const calculatedScore = score + 1000;  // Add gold bonus if it wasn't added before
        
        // Show victory popup with longer delay before returning to home
        showGamePopup(`🎉 Congratulations! You won! 🏆\nYou got the gold and made it back safely! 🌟\nFinal Score: ${calculatedScore}`, goldSound);
        
        // Return to home page after a longer delay (5 seconds)
        setTimeout(() => {
          setGameMode(null); // Return to home page only after delay
        }, 5000);
        
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
          // Only log exploration targets every 5 steps to reduce noise
          if (aiState.globalExploredCount % 5 === 0) {
            console.log("AI exploring unknown territory:", explorationTarget);
          }
          const safePath = aStar({ x, y }, explorationTarget, aiKnowledge, false);
          
          if (safePath && safePath.length > 1) {
            const next = safePath[1];
            
            // Balanced safety check before moving
            if (isMoveBalancedSafe(x, y, next.x, next.y)) {
              const direction = getDirection({ x, y }, next);
              // Only log direction changes when debugging or infrequently
              if (aiState.globalExploredCount % 10 === 0) {
                console.log(`AI moving to explore: ${direction}`);
              }
              handleMove(direction);
              return;
            } else {
              // Always log safety check failures as they're important for debugging
              console.log(`ABORTING move to (${next.x}, ${next.y}) - failed balanced safety check!`);
            }
          }
        }
        
        // If no safe exploration targets, try balanced exploration move
        const balancedMove = findBalancedExplorationMove(x, y);
        if (balancedMove) {
          const direction = getDirection({ x, y }, balancedMove);
          // Log balanced exploration moves as they indicate a shift in strategy
          console.log(`AI making balanced exploration move: ${direction}`);
          handleMove(direction);
          return;
        }
      } else if (aiState.returningHome) {
        // Return to start position (0, 9) with gold using optimized A* pathfinding
        
        // If we're already at the starting position, climb out and win
        if (x === 0 && y === 9) {
          // Agent has reached starting cell, trigger victory
          console.log("AI successfully returned to starting position with gold!");
          
          // Update game state to indicate we've reached home with gold
          setGameState(prev => ({
            ...prev,
            hasReachedHomeWithGold: true
          }));
          
          // Immediately stop the simulation to prevent multiple popups
          setSimulationState('stopped');
          
          // Calculate final score including gold bonus
          const calculatedScore = score;  // Score already includes gold bonus
          
          // Show victory popup
          showGamePopup(`🎉 Congratulations! You won! 🏆\nYou got the gold and made it back safely! 🌟\nFinal Score: ${calculatedScore}`, goldSound, 'gold');
          
          return;
        }
        
        // Plan the path home if we don't have one already
        if (!aiState.plan || aiState.plan.length === 0) {
          console.log("Planning path back to starting position...");
          // Use A* to find the safest path home - we can be a bit more risky since we already have the gold
          const homePath = aStar({ x, y }, { x: 0, y: 9 }, aiKnowledge, true);
          
          if (homePath && homePath.length > 1) {
            console.log(`Found path home with ${homePath.length - 1} steps`);
            setAiState(prev => ({
              ...prev,
              plan: homePath,
              currentPlanIndex: 1  // Start with the first step (index 0 is current position)
            }));
          } else {
            console.log("Failed to find direct path home, switching to exploration mode");
            // If we can't find a path, look for safe cells to explore more
            const safeTarget = findStrategicBacktrackTarget(x, y);
            if (safeTarget) {
              const safePath = aStar({ x, y }, safeTarget, aiKnowledge, false);
              if (safePath && safePath.length > 1) {
                setAiState(prev => ({
                  ...prev,
                  plan: safePath,
                  currentPlanIndex: 1
                }));
              }
            }
          }
        }
        
        // Execute the next step in our plan
        if (aiState.plan && aiState.plan.length > aiState.currentPlanIndex) {
          const next = aiState.plan[aiState.currentPlanIndex];
          const direction = getDirection({ x, y }, next);
          console.log(`AI returning home: Moving ${direction} to (${next.x}, ${next.y})`);
          
          // Increment plan index for next time
          setAiState(prev => ({
            ...prev,
            currentPlanIndex: prev.currentPlanIndex + 1
          }));
          
          handleMove(direction);
          return;
        } else {
          // If we've exhausted our plan but haven't reached home, replan
          console.log("Replanning path home...");
          const newHomePath = aStar({ x, y }, { x: 0, y: 9 }, aiKnowledge, true);
          
          if (newHomePath && newHomePath.length > 1) {
            setAiState(prev => ({
              ...prev,
              plan: newHomePath,
              currentPlanIndex: 1
            }));
            
            // Execute first step right away
            const next = newHomePath[1];
            const direction = getDirection({ x, y }, next);
            console.log(`AI returning home (new plan): ${direction}`);
            handleMove(direction);
            return;
          }
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

  // Advanced loop detection with intelligent pattern recognition
  // ENHANCEMENT 5: Improved loop detection with intelligent pattern recognition
  function detectLoop(currentPos) {
    const posKey = `${currentPos.x},${currentPos.y}`;
    
    // Use more history for deeper pattern detection
    const recentPositions = aiState.visitedPositions.slice(-40);
    const pathHistory = aiState.pathHistory || [];
    
    // Get detection level based on how stuck the agent is
    const detectionLevel = aiState.loopDetectionLevel || 1;
    
    // ENHANCEMENT 6: Better debugging
    if (detectionLevel > 1) {
      console.log(`Running loop detection at level ${detectionLevel}`);
    }
    
    // Skip if we don't have enough history yet
    if (recentPositions.length < 6) return false;
    
    // Level 1: Exact position repeated multiple times (most obvious loop)
    const visitCount = recentPositions.filter(pos => pos === posKey).length;
    
    // Lower threshold for higher detection levels
    const visitThreshold = detectionLevel === 1 ? 2 : (detectionLevel >= 3 ? 1 : 2);
    
    if (visitCount >= visitThreshold) {
      // Calculate exponentially increasing severity based on visit count
      const severity = visitCount >= 4 ? "critical" : 
                      visitCount >= 3 ? "high" : "medium";
      
      // ENHANCEMENT 6: Better debugging              
      console.log(`Loop detected: Position ${posKey} visited ${visitCount} times recently (${severity})`);
      
      // ENHANCEMENT 1: Calculate visit interval to detect cyclical patterns
      const visitIndices = [];
      for (let i = 0; i < recentPositions.length; i++) {
        if (recentPositions[i] === posKey) {
          visitIndices.push(i);
        }
      }
      
      // Check for consistent intervals which indicates a cycle
      const intervals = [];
      for (let i = 1; i < visitIndices.length; i++) {
        intervals.push(visitIndices[i] - visitIndices[i-1]);
      }
      
      let isCyclical = false;
      let cycleLength = 0;
      
      if (intervals.length >= 2) {
        // Check if intervals are consistent (allowing small variations)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const consistent = intervals.every(interval => Math.abs(interval - avgInterval) <= 2);
        
        if (consistent) {
          isCyclical = true;
          cycleLength = Math.round(avgInterval);
          console.log(`Detected cyclical pattern with cycle length ${cycleLength}`);
        }
      }
      
      return {
        severity, 
        type: "position_repeat",
        count: visitCount,
        position: posKey,
        isCyclical,
        cycleLength
      };
    }
    
    // Level 2: Oscillation detection (going back and forth)
    if (recentPositions.length >= 8) {
      // Check oscillation patterns of different sizes
      for (let size = 2; size <= 4; size++) {
        const recentSet = new Set(recentPositions.slice(-size * 2));
        
        // If we're oscillating between a small number of positions
        if (recentSet.size <= size && recentPositions.length >= size * 2) {
          const severity = size === 2 ? "critical" : 
                          size === 3 ? "high" : "medium";
                          
          console.log(`Loop detected: ${size}-position oscillation (${severity})`);
          return {
            severity,
            type: "oscillation",
            cells: recentSet.size,
            positions: [...recentSet]
          };
        }
      }
    }
    
    // Level 3: Path repetition detection (extended pattern analysis)
    if (recentPositions.length >= 10) {
      // Check for repeating path sequences of various lengths
      for (let patternLength = 2; patternLength <= 6; patternLength++) {
        if (recentPositions.length >= patternLength * 2) {
          const lastPattern = recentPositions.slice(-patternLength);
          const prevPattern = recentPositions.slice(-patternLength*2, -patternLength);
          
          // Check if patterns match
          if (JSON.stringify(lastPattern) === JSON.stringify(prevPattern)) {
            const severity = patternLength <= 3 ? "high" : "medium";
            console.log(`Loop detected: Path pattern of length ${patternLength} is repeating (${severity})`);
            return {
              severity,
              type: "pattern_repeat",
              length: patternLength,
              pattern: lastPattern
            };
          }
        }
      }
      
      // Look for longer patterns with small variations
      if (recentPositions.length >= 15) {
        for (let patternLength = 3; patternLength <= 6; patternLength++) {
          // Allow for one position difference in the pattern (fuzzy matching)
          const lastPattern = recentPositions.slice(-patternLength);
          const prevPattern = recentPositions.slice(-patternLength*2, -patternLength);
          
          let differences = 0;
          for (let i = 0; i < patternLength; i++) {
            if (lastPattern[i] !== prevPattern[i]) differences++;
          }
          
          // If patterns match with at most one difference
          if (differences <= 1) {
            console.log(`Loop detected: Fuzzy path pattern of length ${patternLength} is repeating`);
            return {
              severity: "medium",
              type: "fuzzy_pattern_repeat",
              length: patternLength
            };
          }
        }
      }
    }
    
    // Level 4: Limited area detection with spatial analysis
    if (recentPositions.length >= 12) {
      const uniquePositions = [...new Set(recentPositions.slice(-12))];
      // If we've only visited a few unique positions in the last 12 moves
      const uniqueRatio = uniquePositions.length / 12;
      
      if (uniqueRatio <= 0.33) { // Only 33% or fewer unique cells
        const severity = uniqueRatio <= 0.25 ? "high" : "medium";
        console.log(`Loop detected: Stuck in small area with only ${uniquePositions.length} unique positions (${severity})`);
        return {
          severity,
          type: "confined_area",
          uniqueCells: uniquePositions.length,
          uniqueRatio
        };
      }
    }
    
    // Level 5: Progressive confinement detection
    // Check if we're exploring fewer and fewer unique cells over time
    if (recentPositions.length >= 20) {
      const firstHalfUnique = new Set(recentPositions.slice(-20, -10)).size;
      const secondHalfUnique = new Set(recentPositions.slice(-10)).size;
      
      // If we're exploring fewer unique cells in the second half
      if (secondHalfUnique < firstHalfUnique * 0.7) {
        console.log(`Loop detected: Decreasing exploration efficiency (${secondHalfUnique} vs ${firstHalfUnique} unique cells)`);
        return {
          severity: "medium",
          type: "decreasing_efficiency",
          firstHalfUnique,
          secondHalfUnique
        };
      }
    }
    
    // Level 6: Global efficiency analysis
    if (recentPositions.length >= 25) {
      const uniquePositions = [...new Set(recentPositions)];
      const globalEfficiency = uniquePositions.length / recentPositions.length;
      
      // If we've been moving a lot but not visiting many unique cells
      if (globalEfficiency <= 0.4) { // Less than 40% unique cells overall
        const severity = globalEfficiency <= 0.25 ? "high" : "medium";
        console.log(`Loop detected: Low exploration efficiency (${uniquePositions.length} unique out of ${recentPositions.length} moves, ${(globalEfficiency * 100).toFixed(1)}%)`);
        return {
          severity,
          type: "inefficient_exploration",
          efficiency: globalEfficiency,
          uniqueCount: uniquePositions.length,
          totalMoves: recentPositions.length
        };
      }
    }
    
    return false;
  }

  // Enhanced position tracking with anti-stuck measures and zone-based exploration
  function updateAIPositionTracking(position) {
    const posKey = `${position.x},${position.y}`;
    setAiState(prev => {
      // ENHANCEMENT 1: Exponential revisit penalties - tracking
      // Update visit count map
      const updatedVisitCountMap = { ...prev.visitCountMap };
      updatedVisitCountMap[posKey] = (updatedVisitCountMap[posKey] || 0) + 1;
      
      // Keep more history for better loop detection (40 positions for more pattern detection)
      const newVisitedPositions = [...prev.visitedPositions.slice(-39), posKey];
      
      // Track position frequency for more advanced loop breaking
      const posFrequency = {};
      newVisitedPositions.forEach(pos => {
        posFrequency[pos] = (posFrequency[pos] || 0) + 1;
      });
      
      // Calculate repetition factor - how much we're repeating positions
      const totalPositions = newVisitedPositions.length;
      const uniquePositions = Object.keys(posFrequency).length;
      const repetitionFactor = totalPositions > 0 ? 1 - (uniquePositions / totalPositions) : 0;
      
      // ENHANCEMENT 5: Improved loop detection - path history for pattern recognition
      let newPathHistory = [...(prev.pathHistory || [])];
      if (newPathHistory.length >= 10) {
        newPathHistory = newPathHistory.slice(-9);
      }
      newPathHistory.push(posKey);
      
      // Check if this is a brand new position
      const isNewPosition = !prev.visitedPositions.includes(posKey);
      
      // ENHANCEMENT 2: Progress tracking
      let lastNewCellDiscovery = prev.lastNewCellDiscovery;
      let newCellsDiscoveredCount = prev.newCellsDiscoveredCount || 0;
      
      if (isNewPosition) {
        lastNewCellDiscovery = Date.now();
        newCellsDiscoveredCount++;
        // Only log every 5th new cell to reduce noise
        if (newCellsDiscoveredCount % 5 === 0) {
          console.log(`New cell discovered at (${position.x}, ${position.y}) - total: ${newCellsDiscoveredCount}`);
        }
      }
      
      // ENHANCEMENT 3: Exploration zones
      const currentZone = getZoneForPosition(position.x, position.y);
      const updatedZones = [...prev.explorationZones];
      
      if (currentZone !== null) {
        // Update zone exploration stats
        updatedZones[currentZone] = {
          ...updatedZones[currentZone],
          lastVisited: Date.now()
        };
        
        // Update zone exploration count if this is a new position
        if (isNewPosition) {
          updatedZones[currentZone].explored++;
          
          // ENHANCEMENT 6: Better debugging - but only log every 5th cell per zone to reduce noise
          if (updatedZones[currentZone].explored % 5 === 0) {
            console.log(`Zone ${currentZone} exploration: ${updatedZones[currentZone].explored}/${updatedZones[currentZone].total} cells (${Math.round(updatedZones[currentZone].explored/updatedZones[currentZone].total*100)}%)`);
          }
        }
      }
      
      // ENHANCEMENT 7: Stronger blocking - block cells that have been visited too many times
      const updatedBlockedCells = { ...prev.blockedCells };
      const visitCount = updatedVisitCountMap[posKey] || 0;
      
      // Block cells that have been visited too many times
      if (visitCount >= 4) {
        // Exponentially increase blocking time based on visit count
        const blockingDuration = Math.min(5000 * Math.pow(2, visitCount - 4), 60000); // Cap at 1 minute
        updatedBlockedCells[posKey] = Date.now() + blockingDuration;
        // Only log cell blocking with long durations (important for debugging)
        if (blockingDuration > 10000) {
          console.log(`Blocking cell (${position.x}, ${position.y}) for ${blockingDuration/1000}s due to ${visitCount} visits`);
        }
      }
      
      // ENHANCEMENT 8: Zone-based exploration - prioritize or block zones
      let updatedZonePriority = [...prev.zoneExplorationPriority];
      const updatedZoneBlockingTime = { ...prev.zoneBlockingTime };
      
      // Check if current zone is over-explored
      if (currentZone !== null && 
          updatedZones[currentZone].explored > updatedZones[currentZone].total * 0.7) {
        // Block this zone temporarily to force exploration elsewhere
        updatedZoneBlockingTime[currentZone] = Date.now() + 30000; // 30 seconds
        
        // Move this zone to the end of priority list
        updatedZonePriority = updatedZonePriority.filter(z => z !== currentZone);
        updatedZonePriority.push(currentZone);
        
        // Always log zone reprioritization - this is an important strategy shift
        console.log(`Zone ${currentZone} is over-explored. Reprioritizing zones: ${updatedZonePriority.join(',')}`);
      }
      
      // Automatically escalate exploration mode based on repetition and progress
      let newExplorationMode = prev.explorationMode;
      const timeSinceNewCell = Date.now() - lastNewCellDiscovery;
      
      if (repetitionFactor > 0.6 || timeSinceNewCell > 30000) { // High repetition or no progress
        // Only log mode switch if it's actually changing
        if (newExplorationMode !== 'desperate') {
          newExplorationMode = 'desperate';
          console.log(`Switching to desperate mode - repetition: ${Math.round(repetitionFactor * 100)}%, time since new cell: ${Math.round(timeSinceNewCell/1000)}s`);
        } else {
          newExplorationMode = 'desperate';
        }
      } else if (repetitionFactor > 0.4 || timeSinceNewCell > 15000) { // Medium repetition
        // Only log mode switch if it's actually changing
        if (newExplorationMode !== 'aggressive') {
          newExplorationMode = 'aggressive';
          console.log(`Switching to aggressive mode - repetition: ${Math.round(repetitionFactor * 100)}%, time since new cell: ${Math.round(timeSinceNewCell/1000)}s`);
        } else {
          newExplorationMode = 'aggressive';
        }
      } else if (prev.globalExploredCount > 50 && newExplorationMode === 'normal') {
        // Also consider global exploration count
        newExplorationMode = 'aggressive';
      }
      
      // Reset stuck counter when we find a new cell, increment it otherwise
      const newStuckCounter = isNewPosition ? 0 : Math.min(prev.stuckCounter + 1, 20);
      
      // Only log detailed exploration stats if we're getting stuck or every 10 steps
      if ((newStuckCounter > 0 && newStuckCounter % 10 === 0) || 
          (prev.globalExploredCount % 10 === 0)) {
        const exploredPercentage = Math.round((prev.globalExploredCount + (isNewPosition ? 1 : 0)) / 100 * 100);
        console.log(`Exploration: ${exploredPercentage}%, Zone: ${currentZone}, Mode: ${newExplorationMode}${newStuckCounter > 0 ? ', Stuck: ' + newStuckCounter : ''}`);
      }
      
      return {
        ...prev,
        visitedPositions: newVisitedPositions,
        visitCountMap: updatedVisitCountMap,
        stuckCounter: newStuckCounter,
        explorationMode: newExplorationMode,
        repetitionFactor,
        lastNewCellDiscovery,
        newCellsDiscoveredCount,
        explorationZones: updatedZones,
        currentZone,
        pathHistory: newPathHistory,
        blockedCells: updatedBlockedCells,
        zoneExplorationPriority: updatedZonePriority,
        zoneBlockingTime: updatedZoneBlockingTime,
        loopDetectionLevel: newStuckCounter > 10 ? 2 : (newStuckCounter > 20 ? 3 : 1) // Increase detection level when stuck
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

  // Helper functions for stuck detection
  function countVisits(x, y) {
    const posKey = `${x},${y}`;
    return aiState.visitedPositions.filter(pos => pos === posKey).length;
  }
  
  function isRecentlyVisited(x, y) {
    const posKey = `${x},${y}`;
    const recentPositions = aiState.visitedPositions.slice(-10);
    return recentPositions.includes(posKey);
  }
  
  // Find a strategic backtracking target
  function findStrategicBacktrackTarget(x, y) {
    console.log("Finding strategic backtrack target");
    
    // Check if we have any known safe cells far from current position
    const distantSafeCells = [];
    
    for (let cy = 0; cy < 10; cy++) {
      for (let cx = 0; cx < 10; cx++) {
        const cell = aiKnowledge[cy][cx];
        if (cell.safe && !cell.definitelyDangerous) {
          const distance = heuristic({x, y}, {x: cx, y: cy});
          const visitCount = countVisits(cx, cy);
          const recentlyVisited = isRecentlyVisited(cx, cy);
          
          // Find cells that are distant but not very recently visited
          if (distance >= 3 && (!recentlyVisited || aiState.explorationMode === 'desperate')) {
            distantSafeCells.push({
              x: cx, y: cy, 
              distance,
              visitCount,
              // Score - prefer distant cells with fewer visits
              score: distance * 2 - visitCount * 3
            });
          }
        }
      }
    }
    
    // Sort by score (higher is better)
    distantSafeCells.sort((a, b) => b.score - a.score);
    
    if (distantSafeCells.length > 0) {
      console.log(`Found strategic backtrack target at (${distantSafeCells[0].x}, ${distantSafeCells[0].y}) with score ${distantSafeCells[0].score}`);
      return { x: distantSafeCells[0].x, y: distantSafeCells[0].y };
    }
    
    // Fallback - if no good target found
    return null;
  }
  
  // Find an emergency move to a visited cell (last resort)
  function findEmergencyVisitedCell(x, y) {
    console.log("Looking for emergency visited cell");
    
    const adjacentCells = getAdjacentCells(x, y);
    const visitableCells = adjacentCells
      .map(([adjX, adjY]) => {
        // Skip positions that definitely have dangers
        if (aiKnowledge[adjY][adjX].definitelyDangerous) return null;
        
        // Get visit data
        const posKey = `${adjX},${adjY}`;
        const recentPositions = aiState.visitedPositions.slice(-8);
        const visitCount = aiState.visitedPositions.filter(pos => pos === posKey).length;
        const recentlyVisited = recentPositions.includes(posKey);
        
        return {
          x: adjX,
          y: adjY,
          visitCount,
          recentlyVisited,
          // Score - lower is better
          score: visitCount * 2 + (recentlyVisited ? 5 : 0)
        };
      })
      .filter(cell => cell !== null)
      .sort((a, b) => a.score - b.score); // Sort by score (lower is better)
    
    if (visitableCells.length > 0) {
      console.log(`Found emergency visited cell at (${visitableCells[0].x}, ${visitableCells[0].y})`);
      return { x: visitableCells[0].x, y: visitableCells[0].y };
    }
    
    return null;
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

  // Enhanced function to handle stuck situations with recovery attempts
  function handleStuckSituation(x, y) {
    console.log("AI is potentially stuck at position:", x, y);
    
    // First try - attempt to make a risky move as a last resort
    if (aiState.stuckCounter < 15) {
      console.log("Attempting emergency recovery with risky move");
      
      // Force a change to desperate mode
      setAiState(prev => ({
        ...prev,
        explorationMode: 'desperate',
        stuckCounter: prev.stuckCounter + 1,
        emergencyModeActive: true
      }));
      
      // Try to find ANY adjacent cell - even slightly risky ones
      const adjacentCells = getAdjacentCells(x, y);
      let riskyMoves = [];
      
      adjacentCells.forEach(([adjX, adjY]) => {
        // Avoid cells with high danger probability
        const cell = aiKnowledge[adjY][adjX];
        const danger = (cell.pitProbability || 0) + (cell.wumpusProbability || 0);
        
        if (danger < 0.7 && !cell.definitelyDangerous) {  // Accept some risk but not certain death
          const visitCount = countVisits(adjX, adjY);
          const recentVisit = isRecentlyVisited(adjX, adjY);
          
          riskyMoves.push({
            x: adjX, 
            y: adjY, 
            danger,
            visitCount,
            recentVisit,
            score: danger * 10 + visitCount * 2 + (recentVisit ? 5 : 0)  // Lower score is better
          });
        }
      });
      
      // Sort by score (lower is better)
      riskyMoves.sort((a, b) => a.score - b.score);
      
      if (riskyMoves.length > 0) {
        const bestRiskyMove = riskyMoves[0];
        console.log(`Making EMERGENCY RISKY MOVE to (${bestRiskyMove.x}, ${bestRiskyMove.y}) with danger ${bestRiskyMove.danger.toFixed(2)}`);
        const direction = getDirection({ x, y }, bestRiskyMove);
        handleMove(direction);
        return;
      }
    }
    
    // If still stuck or too many risky attempts, pause simulation
    console.log("AI is truly stuck, pausing simulation");
    setSimulationState('paused');
    setPopupContent({
      message: (
        <div className="text-center">
          <div className="text-red-600 text-2xl font-bold mb-2">AI is stuck!</div>
          <div className="text-gray-500 text-lg">Position: ({x}, {y})</div>
          <div className="text-gray-500 text-lg">No safe moves available. Consider restarting.</div>
          <div className="text-gray-700 mt-2">
            Stuck counter: {aiState.stuckCounter}
            <br/>
            Exploration mode: {aiState.explorationMode}
            <br/>
            Repetition factor: {(aiState.repetitionFactor || 0).toFixed(2)}
          </div>
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

  // Enhanced useEffect for AI stepping with optimized performance
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
        
        // Minimal safety checks for critical properties
        if (!aiState.visitedPositions) {
          console.error('AI state missing visitedPositions property');
          setSimulationState('paused');
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
            }
          }, 10);
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
          }, 250); // 250ms per step for faster exploration
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
    
    // Check if this was a gold victory popup (continue gameplay) or a death popup (restart)
    const isGoldVictory = popupContent.type === 'gold';
    
    // If this was a gold victory popup and the agent should continue to return home
    if (isGoldVictory && gameMode === 'ai' && gameState.hasGold && 
        !gameState.hasReachedHomeWithGold) {
      // Restart the AI simulation to continue navigating back home
      console.log('Resuming AI simulation to return home with gold');
      setAiState(prev => ({
        ...prev,
        searchingForGold: false,
        returningHome: true
      }));
      setSimulationState('running');
    }
    // Only restart if the game is over due to death (not gold victory)
    else if (!gameState.isAlive && !isGoldVictory && gameMode !== null) {
      handleRestart();
    }
    
    backgroundMusic.play();
  };

  // Popup component
  const Popup = ({ message, onClose, type = 'default' }) => {
    // For gold victory messages, show a Continue button instead of Restart
    const isVictory = type === 'gold' && (message.includes("Congratulations") || message.includes("You won"));
    
    return (
      <div className="popup-overlay">
        <div className={`popup-content ${type === 'gold' ? 'popup-gold' : ''}`}>
          <div className="popup-header">
            <h2>{message}</h2>
          </div>
          <div className="popup-actions">
            <button className="control-btn restart popup-restart" onClick={onClose}>
              {isVictory ? '🎮 Continue' : '🔄 Restart Game'}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
      
      // Update game state with gold collected
      setGameState(prev => ({
        ...prev,
        hasGold: true,
        playerPosition: newPosition,
        grid: newGrid,
      }));
      
      // Show victory popup and pause the game with current score
      // Calculate the score directly to include the +1000 gold bonus
      const calculatedScore = score + 1000; // Include gold bonus
      showGamePopup(`🏆 Congratulations! You found the gold! ✨💰\n👉 Continue playing to return home!\nCurrent Score: ${calculatedScore}`, goldSound, 'gold');
      
      // Pause simulation until user clicks Continue
      setSimulationState('stopped');
      
      return;
    }

    // Check for death conditions
    const newCell = newGrid[newPosition.y][newPosition.x];
    if (newCell.wumpus || newCell.pit) {
      // Deduct 1000 points for death
      setScore(prevScore => prevScore - 1000);
      
      setGameState(prev => ({
        ...prev,
        playerPosition: newPosition,
        grid: newGrid,
        isAlive: false,
      }));
      showGamePopup(
        newCell.wumpus 
          ? `☠️ Game Over! The Wumpus got you! 👾\nFinal Score: ${score - 1000}` 
          : `💀 Game Over! You fell into a pit! 🕳️\nFinal Score: ${score - 1000}`,
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
        hasReachedHomeWithGold: true
      }));
      
      // Make sure we include the gold bonus in the final score
      // This ensures we show the correct score even if state updates haven't completed yet
      const calculatedScore = score + 1000; // Make sure gold bonus is included
      
      showGamePopup(`🎉 Congratulations! You won! 🏆\nYou got the gold and made it back safely! 🌟\nFinal Score: ${calculatedScore}`, goldSound, 'gold');
      
      return;
    }

    // Update game state and percepts
    setGameState(prev => ({
      ...prev,
      playerPosition: newPosition,
      grid: newGrid
    }));
    
    // Decrease score by 1 for each move
    setScore(prevScore => prevScore - 1);
    
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
    // Reset score to 0 when restarting
    setScore(0);
    setAiState({
      hasShot: false,
      wumpusKilled: false,
      targetPosition: null,
      plan: [],
      currentPlanIndex: 0,
      searchingForGold: true,
      returningHome: false,
      visitedPositions: [],
      stuckCounter: 0,
      explorationMode: 'normal',
      lastGoldHint: null,
      globalExploredCount: 0,
      // Reset all the enhancement tracking variables
      visitCountMap: {},
      lastNewCellDiscovery: Date.now(),
      newCellsDiscoveredCount: 0,
      explorationZones: [
        {id: 0, name: "top-left", explored: 0, total: 25, lastVisited: null},
        {id: 1, name: "top-right", explored: 0, total: 25, lastVisited: null},
        {id: 2, name: "bottom-left", explored: 0, total: 25, lastVisited: null},
        {id: 3, name: "bottom-right", explored: 0, total: 25, lastVisited: null}
      ],
      currentZone: 0,
      zoneChangeCount: 0,
      pathHistory: [],
      loopDetectionLevel: 1,
      blockedCells: {},
      zoneExplorationPriority: [0, 1, 2, 3],
      zoneBlockingTime: {0: 0, 1: 0, 2: 0, 3: 0},
      repetitionFactor: 0
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
      hasReachedHomeWithGold: false,
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

    // Decrease score by 10 for using arrow
    setScore(prevScore => prevScore - 10);

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
      // Add 1000 points for finding gold
      setScore(prevScore => prevScore + 1000);

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
        message: "✨ You got the gold!"
      }));

      // When gold is collected, set AI to return home using shortest and safest path
      setAiState(prev => ({
        ...prev,
        searchingForGold: false,
        returningHome: true,
        // Set agent to return to start position (0,9)
        plan: [],
        currentPlanIndex: 0,
        targetPosition: { x: 0, y: 9 }
      }));

      // Play gold sound
      goldSound.currentTime = 0;
      goldSound.play();

      if (gameMode !== 'ai') {
        // Manual mode - show victory popup with score and pause the game
        const calculatedScore = score + 1000;
        showGamePopup(`🏆 Congratulations! You found the gold! ✨💰\n Continue playing to return home!\nCurrent Score: ${calculatedScore}`, goldSound, 'gold');
      } else {
        // AI mode - show popup but resume automatically after a short delay
        console.log("AI found gold, planning shortest and safest return to home");
        const calculatedScore = score + 1000;
        showGamePopup(`🏆 AI found gold! ✨💰\nNow returning home...\nCurrent Score: ${calculatedScore}`, goldSound, 'gold');
        
        // Pause briefly, then continue simulation
        setSimulationState('paused');
        setTimeout(() => {
          if (simulationState === 'paused') {
            setSimulationState('running');
          }
        }, 2000);
      }
    }
  };
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
          <button 
            className="mode-btn ai" 
            onClick={() => {
              setGameMode('ai');
              setScore(0); // Reset score when starting a new game
            }}
          >
            <span className="icon">🤖</span>
            AI Mode
          </button>
          <button 
            className="mode-btn manual" 
            onClick={() => {
              setGameMode('manual');
              setScore(0); // Reset score when starting a new game
            }}
          >
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
          <div className="score-display">
            <h3>Score: {score}</h3>
            <p className="score-info">
              • Move: -1 point<br/>
              • Arrow: -10 points<br/>
              • Gold: +1000 points<br/>
              • Death: -1000 points
            </p>
          </div>
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
            <button className="control-btn home" onClick={() => setGameMode(null)}>
              🏠 Return to Home
            </button>
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
