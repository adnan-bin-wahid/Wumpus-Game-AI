export interface Cell {
  x: number;
  y: number;
  wumpus: boolean;
  pit: boolean;
  gold: boolean;
  breeze: boolean;
  stench: boolean;
  visited: boolean;
  safe: boolean;
}

export interface Percepts {
  breeze: boolean;
  stench: boolean;
  glitter: boolean;
}

export interface GameState {
  grid_size: number;
  agent_pos: [number, number];
  has_gold: boolean;
  game_over: boolean;
  score: number;
  message: string;
  percepts: Percepts;
  visible_cells: Cell[];
}
