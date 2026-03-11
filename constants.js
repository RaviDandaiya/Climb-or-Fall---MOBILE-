export const CONFIG = {
    canvasWidth: 600,
    canvasHeight: 900,
    playerRadius: 18,
    moveSpeed: 7.5,
    jumpForce: -20.0,
    platformHeight: 12
};

export const THEMES = [
    { name: 'Forest', bg: ['#0f3408', '#2b4f17'], accent: '#4ade80' },
    { name: 'Water', bg: ['#041c40', '#0eaaf0'], accent: '#22d3ee' },
    { name: 'Earth', bg: ['#2e1503', '#523412'], accent: '#d97706' },
    { name: 'Rain', bg: ['#1c202a', '#39465c'], accent: '#94a3b8' },
    { name: 'Space', bg: ['#050112', '#1a043c'], accent: '#c084fc' }
];

export const DIFFICULTY_SETTINGS = {
    easy: { lavaSpeed: 0.4, gapHeight: 100, platformWidth: 160, hazardChance: 0.05, pillarChance: 0.02 },
    medium: { lavaSpeed: 0.65, gapHeight: 125, platformWidth: 130, hazardChance: 0.12, pillarChance: 0.05 },
    hard: { lavaSpeed: 0.9, gapHeight: 145, platformWidth: 100, hazardChance: 0.22, pillarChance: 0.1 }
};

export const SKINS = [
    { id: 'default', name: 'GLOW', color: '#9d00ff', reqType: 'default', reqValue: 0, desc: 'Unlocked by default', isUnlocked: (game) => true },
    { id: 'neon', name: 'CYBER', color: '#00ff88', reqType: 'gamesPlayed', reqValue: 3, desc: 'Play 3 Games', isUnlocked: (game) => game.gamesPlayed >= 3 },
    { id: 'ninja', name: 'NIGHT', color: '#ffcc00', reqType: 'bestHeight', reqValue: 300, desc: 'Reach 300 Height', isUnlocked: (game) => game.bestHeight >= 300 },
    { id: 'alien', name: 'XENO', color: '#ff00ff', reqType: 'totalCoinsAcc', reqValue: 100, desc: 'Collect 100 Total Coins', isUnlocked: (game) => game.totalCoinsAcc >= 100 },
    { id: 'xmas', name: 'SANTA', color: '#ff0044', reqType: 'gamesPlayed', reqValue: 10, desc: 'Play 10 Games', isUnlocked: (game) => game.gamesPlayed >= 10 },
    { id: 'ghost', name: 'PHANTOM', color: '#ffffff', reqType: 'bestHeight', reqValue: 1000, desc: 'Reach 1000 Height', isUnlocked: (game) => game.bestHeight >= 1000 },
    { id: 'blood', name: 'VAMPIRE', color: '#880000', reqType: 'totalCoinsAcc', reqValue: 500, desc: 'Collect 500 Total Coins', isUnlocked: (game) => game.totalCoinsAcc >= 500 },
    { id: 'ocean', name: 'ABYSS', color: '#0055ff', reqType: 'bestHeight', reqValue: 2000, desc: 'Reach 2000 Height', isUnlocked: (game) => game.bestHeight >= 2000 }
];

export const BATTLE_PASS = [
    { id: 1, desc: 'Play 1 Game', reqType: 'gamesPlayed', reqValue: 1, rewardText: '+50 Coins', rewardAmount: 50, isUnlocked: (game) => game.gamesPlayed >= 1 },
    { id: 2, desc: 'Reach 200 Height', reqType: 'bestHeight', reqValue: 200, rewardText: '+100 Coins', rewardAmount: 100, isUnlocked: (game) => game.bestHeight >= 200 },
    { id: 3, desc: 'Collect 50 Coins', reqType: 'totalCoinsAcc', reqValue: 50, rewardText: '+150 Coins', rewardAmount: 150, isUnlocked: (game) => game.totalCoinsAcc >= 50 },
    { id: 4, desc: 'Play 5 Games', reqType: 'gamesPlayed', reqValue: 5, rewardText: '+200 Coins', rewardAmount: 200, isUnlocked: (game) => game.gamesPlayed >= 5 },
    { id: 5, desc: 'Reach 500 Height', reqType: 'bestHeight', reqValue: 500, rewardText: '+300 Coins', rewardAmount: 300, isUnlocked: (game) => game.bestHeight >= 500 },
    { id: 6, desc: 'Collect 200 Coins', reqType: 'totalCoinsAcc', reqValue: 200, rewardText: '+400 Coins', rewardAmount: 400, isUnlocked: (game) => game.totalCoinsAcc >= 200 },
    { id: 7, desc: 'Play 15 Games', reqType: 'gamesPlayed', reqValue: 15, rewardText: '+500 Coins', rewardAmount: 500, isUnlocked: (game) => game.gamesPlayed >= 15 },
    { id: 8, desc: 'Reach 1000 Height', reqType: 'bestHeight', reqValue: 1000, rewardText: '+1000 Coins', rewardAmount: 1000, isUnlocked: (game) => game.bestHeight >= 1000 },
    { id: 9, desc: 'Collect 500 Coins', reqType: 'totalCoinsAcc', reqValue: 500, rewardText: '+1500 Coins', rewardAmount: 1500, isUnlocked: (game) => game.totalCoinsAcc >= 500 },
    { id: 10, desc: 'Reach 2000 Height', reqType: 'bestHeight', reqValue: 2000, rewardText: '+2000 Coins', rewardAmount: 2000, isUnlocked: (game) => game.bestHeight >= 2000 }
];
