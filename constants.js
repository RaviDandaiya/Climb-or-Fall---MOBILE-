export const CONFIG = {
    canvasWidth: 600,
    canvasHeight: 900,
    playerRadius: 18,
    moveSpeed: 7.5,
    jumpForce: -20.0,
    platformHeight: 12
};

export const THEMES = [
    { name: 'Void', bg: ['#0f0c29', '#302b63'], accent: '#9d00ff' },
    { name: 'Fire', bg: ['#1e130c', '#9a0606'], accent: '#ff4b2b' },
    { name: 'Neon', bg: ['#000000', '#434343'], accent: '#00ff88' },
    { name: 'Ocean', bg: ['#114357', '#f29492'], accent: '#2ebf91' }
];

export const DIFFICULTY_SETTINGS = {
    easy: { lavaSpeed: 0.4, gapHeight: 100, platformWidth: 160, hazardChance: 0.05, pillarChance: 0.02 },
    medium: { lavaSpeed: 0.65, gapHeight: 125, platformWidth: 130, hazardChance: 0.12, pillarChance: 0.05 },
    hard: { lavaSpeed: 0.9, gapHeight: 145, platformWidth: 100, hazardChance: 0.22, pillarChance: 0.1 }
};

export const SKINS = [
    { id: 'default', name: 'GLOW', color: '#9d00ff', price: 0 },
    { id: 'neon', name: 'CYBER', color: '#00ff88', price: 200 },
    { id: 'ninja', name: 'NIGHT', color: '#ffcc00', price: 500 },
    { id: 'alien', name: 'XENO', color: '#ff00ff', price: 1000 },
    { id: 'xmas', name: 'SANTA', color: '#ff0044', price: 1500 }
];
