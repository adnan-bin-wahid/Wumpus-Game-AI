import { GameState } from './types';

const API_BASE_URL = 'http://localhost:8000';

export const fetchGameState = async (): Promise<GameState> => {
  const response = await fetch(`${API_BASE_URL}/state`);
  if (!response.ok) {
    throw new Error('Failed to fetch game state');
  }
  return response.json();
};

export const initGame = async (size: number = 10): Promise<GameState> => {
  const response = await fetch(`${API_BASE_URL}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ size }),
  });
  if (!response.ok) {
    throw new Error('Failed to initialize game');
  }
  return response.json();
};

export const moveAgent = async (direction: string): Promise<GameState> => {
  const response = await fetch(`${API_BASE_URL}/move/${direction}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to move agent');
  }
  return response.json();
};

export const resetGame = async (): Promise<GameState> => {
  return initGame();
};

export const loadCustomMap = async (file: File): Promise<GameState> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/load-map`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Failed to load custom map');
  }
  return response.json();
};
