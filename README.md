# Wumpus Game AI

A modern implementation of the classic Wumpus World game with both manual and AI-powered gameplay modes.

## Prerequisites

Make sure you have Docker and Docker Compose installed on your machine:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Running the Application

1. Clone the repository:
```bash
git clone https://github.com/adnan-bin-wahid/Wumpus-Game-AI.git
cd Wumpus-Game-AI
```

2. Start the application using Docker Compose:
```bash
docker-compose up --build
```

3. Open your browser and navigate to:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

The application consists of two services:
- Frontend: React application running on port 3000
- Backend: Python Flask API running on port 5000

## Development

To stop the application:
```bash
docker-compose down
```

To rebuild the containers after making changes:
```bash
docker-compose up --build
```

## Game Controls

- Use arrow keys (↑, ↓, ←, →) or WASD keys for movement
- Click buttons or use keyboard controls to:
  - Move the player
  - Shoot arrows
  - Grab gold
  - Navigate the game world

## Features

- Manual and AI gameplay modes
- Intuitive keyboard controls
- Modern UI with animations
- Real-time game state updates
- Sound effects and visual feedback