from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import random
from typing import List, Optional, Tuple

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

class Cell:
    def __init__(self):
        self.wumpus = False
        self.pit = False
        self.gold = False
        self.breeze = False
        self.stench = False
        self.visited = False
        self.safe = False

class GameState(BaseModel):
    grid_size: int = 10
    agent_pos: Tuple[int, int]
    has_gold: bool = False
    game_over: bool = False
    score: int = 0
    message: str = ""

class WumpusWorld:
    def __init__(self, size: int = 10):
        self.size = size
        self.grid = [[Cell() for _ in range(size)] for _ in range(size)]
        self.agent_pos = (0, 0)
        self.has_gold = False
        self.game_over = False
        self.score = 0
        self.initialize_world()

    def initialize_world(self):
        # Place Wumpus (1)
        self.place_element('wumpus', 1)
        
        # Place Pits (3)
        self.place_element('pit', 3)
        
        # Place Gold (1)
        self.place_element('gold', 1)
        
        # Set breezes and stenches
        self.set_indicators()
        
        # Mark starting position as safe and visited
        self.grid[0][0].safe = True
        self.grid[0][0].visited = True

    def place_element(self, element_type: str, count: int):
        placed = 0
        while placed < count:
            x = random.randint(0, self.size - 1)
            y = random.randint(0, self.size - 1)
            
            # Don't place anything at starting position (0,0)
            if (x, y) == (0, 0):
                continue
                
            cell = self.grid[y][x]
            if not (cell.wumpus or cell.pit or cell.gold):
                if element_type == 'wumpus':
                    cell.wumpus = True
                elif element_type == 'pit':
                    cell.pit = True
                elif element_type == 'gold':
                    cell.gold = True
                placed += 1

    def set_indicators(self):
        for y in range(self.size):
            for x in range(self.size):
                if self.grid[y][x].wumpus:
                    self.set_stench(x, y)
                if self.grid[y][x].pit:
                    self.set_breeze(x, y)

    def set_stench(self, x: int, y: int):
        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            new_x, new_y = x + dx, y + dy
            if 0 <= new_x < self.size and 0 <= new_y < self.size:
                self.grid[new_y][new_x].stench = True

    def set_breeze(self, x: int, y: int):
        for dx, dy in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            new_x, new_y = x + dx, y + dy
            if 0 <= new_x < self.size and 0 <= new_y < self.size:
                self.grid[new_y][new_x].breeze = True

    def move(self, direction: str) -> dict:
        dx, dy = {
            'up': (0, -1),
            'right': (1, 0),
            'down': (0, 1),
            'left': (-1, 0)
        }.get(direction, (0, 0))

        new_x = self.agent_pos[0] + dx
        new_y = self.agent_pos[1] + dy

        # Check if move is valid
        if not (0 <= new_x < self.size and 0 <= new_y < self.size):
            return self.get_game_state("Invalid move: Out of bounds")

        # Update agent position
        self.agent_pos = (new_x, new_y)
        self.grid[new_y][new_x].visited = True
        self.score -= 1  # Cost for each move

        # Check for game over conditions
        cell = self.grid[new_y][new_x]
        if cell.wumpus:
            self.game_over = True
            return self.get_game_state("Game Over: You were killed by the Wumpus!")
        elif cell.pit:
            self.game_over = True
            return self.get_game_state("Game Over: You fell into a pit!")
        elif cell.gold and not self.has_gold:
            self.has_gold = True
            self.score += 1000  # Reward for finding gold
            return self.get_game_state("You found the gold!")

        return self.get_game_state("Moved successfully")

    def get_game_state(self, message: str = "") -> dict:
        return {
            "grid_size": self.size,
            "agent_pos": self.agent_pos,
            "has_gold": self.has_gold,
            "game_over": self.game_over,
            "score": self.score,
            "message": message,
            "percepts": self.get_percepts(),
            "visible_cells": self.get_visible_cells()
        }

    def get_percepts(self) -> dict:
        x, y = self.agent_pos
        cell = self.grid[y][x]
        return {
            "breeze": cell.breeze,
            "stench": cell.stench,
            "glitter": cell.gold,
        }

    def get_visible_cells(self) -> List[dict]:
        visible = []
        for y in range(self.size):
            for x in range(self.size):
                cell = self.grid[y][x]
                if cell.visited:
                    visible.append({
                        "x": x,
                        "y": y,
                        "wumpus": cell.wumpus,
                        "pit": cell.pit,
                        "gold": cell.gold,
                        "breeze": cell.breeze,
                        "stench": cell.stench,
                        "visited": cell.visited,
                        "safe": cell.safe
                    })
        return visible

# Global game instance
game: Optional[WumpusWorld] = None

@app.post("/start")
async def start_game(size: int = 10):
    global game
    game = WumpusWorld(size)
    return game.get_game_state("Game started")

@app.post("/move/{direction}")
async def move(direction: str):
    if game is None:
        raise HTTPException(status_code=400, detail="Game not started")
    return game.move(direction.lower())

@app.get("/state")
async def get_state():
    if game is None:
        raise HTTPException(status_code=400, detail="Game not started")
    return game.get_game_state()
