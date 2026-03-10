import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World } = Matter;

export class FallMode {
    constructor(game) {
        this.game = game;
        this.name = 'fall';
    }

    getLavaStartHeight() {
        return -1200;
    }

    getPlayerStartY() {
        return 150;
    }

    getFloorY() {
        return -100;
    }

    getInitialPlatformY(index, settings) {
        return 60 + (index * settings.gapHeight);
    }

    getPlatformParams(index, settings) {
        const width = (settings.platformWidth * 0.7) + (Math.random() * settings.platformWidth * 0.6);
        const x = (Math.random() * (CONFIG.canvasWidth - width - 60)) + width / 2 + 30;
        return { width, x };
    }

    createCustomPlatform(y, index, settings, game) {
        if (game.isGameOver) return false;

        const depth = game.currentHeight || 0;
        const r = Math.random();
        
        // Even early game should have some variety
        let pType = 'unknown';
        if (index < 3) pType = 'slalom'; // Absolute start
        
        if (pType === 'unknown') {
            if (depth > 200) {
                if (r < 0.15) pType = 'glass';
                else if (r < 0.35) pType = 'crusher';
                else if (r < 0.45) pType = 'oscillator';
                else pType = 'slalom';
            } else if (depth > 50) {
                if (r < 0.1) pType = 'glass';
                else if (r < 0.25) pType = 'crusher';
                else if (r < 0.35) pType = 'oscillator';
                else pType = 'slalom';
            } else {
                // Low depth variety
                if (r < 0.2) pType = 'oscillator';
                else pType = 'slalom';
            }
        }
        
        if (pType !== 'slalom' && pType !== 'crusher' && pType !== 'glass') {
            if (Math.random() < settings.pillarChance) return false;
        }

        const isHazard = index > 15 && Math.random() < settings.hazardChance;
        const isCrumbling = !isHazard && index > 10 && Math.random() < 0.15;

        let width, x;
        if (pType === 'crusher') {
            const gap = Math.max(100, 160 - (depth * 0.1));
            const cWidth = (CONFIG.canvasWidth - gap) / 2;
            const leftX = cWidth / 2 - 200; 
            const rightX = CONFIG.canvasWidth - cWidth / 2 + 200;
            
            const speed = 1.5 + (depth * 0.005);
            
            let lBlock = Bodies.rectangle(leftX, y, cWidth, CONFIG.platformHeight, { isStatic: true, label: 'crusher' });
            lBlock.isCrusher = true; lBlock.crusherDir = 1; lBlock.crusherSpeed = speed; lBlock.targetMaxX = cWidth / 2;
            
            let rBlock = Bodies.rectangle(rightX, y, cWidth, CONFIG.platformHeight, { isStatic: true, label: 'crusher' });
            rBlock.isCrusher = true; rBlock.crusherDir = -1; rBlock.crusherSpeed = speed; rBlock.targetMinX = CONFIG.canvasWidth - (cWidth / 2);
            
            World.add(game.world, [lBlock, rBlock]);
            game.platforms.push(lBlock, rBlock);
            
            if (Math.random() < 0.3) game.addCoin(CONFIG.canvasWidth / 2, y - 40);
            return true;
        } else if (pType === 'slalom') {
            const baseGap = 160;
            const difficultyFactor = 0.15;
            let gapWidth = baseGap - (depth * difficultyFactor);
            gapWidth = Math.max(gapWidth, 50);

            width = CONFIG.canvasWidth - gapWidth;
            x = (index % 2 === 0) ? (width / 2 + 10) : (CONFIG.canvasWidth - width / 2 - 10);
            x += (Math.random() * 20 - 10);
        } else if (pType === 'glass') {
            width = 120 + Math.random() * 80;
            x = Math.random() * (CONFIG.canvasWidth - width - 60) + width / 2 + 30;
        } else if (pType === 'oscillator') {
            width = 160 + Math.random() * 100;
            x = CONFIG.canvasWidth / 2;
        }

        const label = pType === 'glass' ? 'glass' : (pType === 'oscillator' ? 'oscillator' : (isHazard ? 'hazard' : 'platform'));
        
        let platform = game.pool.platform.pop();
        if (platform) {
            const oldWidth = platform.bounds.max.x - platform.bounds.min.x;
            Body.scale(platform, width / oldWidth, 1);
            Body.setPosition(platform, {x, y});
            Body.setVelocity(platform, {x:0, y:0});
            platform.label = label;
            World.add(game.world, platform);
        } else {
            platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, { isStatic: true, render: { visible: false } });
            platform.label = label;
            World.add(game.world, platform);
        }
        
        platform.isCrumbling = isCrumbling;
        platform.crumbleTimer = 0;
        platform.isMoving = (pType === 'oscillator');
        if (platform.isMoving) {
            platform.moveSpeed = 2 + Math.random() * 2;
            platform.minX = width/2 + 20;
            platform.maxX = CONFIG.canvasWidth - width/2 - 20;
        }
        
        game.platforms.push(platform);

        if (!isHazard && !isCrumbling && pType !== 'glass' && pType !== 'oscillator') {
            const objR = Math.random();
            if (objR < 0.1) game.addCoin(x, y - 35);
            else if (objR < 0.20) game.addPowerup(x, y - 40);
        }
        
        return true; 
    }

    updateLava(mult) {
        // Reduced speed as requested
        this.game.lavaHeight += this.game.lavaSpeed * (mult * 0.7);
        if (this.game.player.position.y < this.game.lavaHeight) {
            this.game.triggerDeath("IMPALED BY SPIKES");
        }
    }

    getTiltSettings() {
        return { maxMult: 1.8, sens: 12 };
    }

    getAbyssCondition() {
        return this.game.player.position.y < this.game.lavaHeight - 800;
    }

    getAbyssDeathMessage() {
        return "SOARED TO OBLIVION";
    }

    getAbyssReviveVelocity() {
        return 20;
    }

    shouldCullPlatform(platformY, lavaY, playerY) {
        return platformY < Math.max(lavaY, playerY - 1500);
    }

    getNextPlatformY(platforms, playerY, settings) {
        let nextY = platforms.length ? platforms.reduce((m, p) => Math.max(m, p.position.y), -Infinity) : playerY;
        const checkDist = (playerY > nextY - 2500);
        if (!checkDist) return null;
        return nextY + (settings.gapHeight * (0.8 + Math.random() * 0.9));
    }

    getEnemySpawnOffset() {
        return 400;
    }

    getReviveY() {
        return this.game.player.position.y + 600;
    }

    getLavaOffset(baseLava) {
        return baseLava - 500;
    }

    getPowerupType() {
        const rand = Math.random();
        if (rand < 0.15) return 'anchor';
        else if (rand < 0.5) return 'shield';
        else return 'magnet';
    }
    
    updateFallMechanics(game) {
        // Handle Crushers
        game.platforms.forEach(p => {
             if (p.isCrusher) {
                 if (p.crusherDir > 0) {
                     if (p.position.x < p.targetMaxX) {
                         Body.setPosition(p, { x: p.position.x + p.crusherSpeed, y: p.position.y });
                     } else {
                         Body.setPosition(p, { x: p.startX || p.position.x - 200, y: p.position.y });
                     }
                 } else {
                     if (p.position.x > p.targetMinX) {
                         Body.setPosition(p, { x: p.position.x - p.crusherSpeed, y: p.position.y });
                     } else {
                         Body.setPosition(p, { x: p.startX || p.position.x + 200, y: p.position.y });
                     }
                 }
             }

             // Handle Oscillator logic (already pushed to game.platforms)
             // main.js handles p.isMoving generically, but we could customize here if needed

             // Near-Miss Bonus System
             if (!p.hasTriggeredNearMiss && !game.isGameOver) {
                 const pWidth = (p.bounds.max.x - p.bounds.min.x);
                 const dx = Math.abs(game.player.position.x - p.position.x) - (pWidth / 2);
                 const dy = Math.abs(game.player.position.y - p.position.y);
                 
                 // If extremely close (but not touching)
                 if (dx < 35 && dx > 0 && dy < 40) {
                     p.hasTriggeredNearMiss = true;
                     game.combo++;
                     game.addXP(25);
                     game.addScoreBonus(50 * game.combo);
                     game.createExplosion(game.player.position, '#ffff00', 8);
                     game.shake = 5;
                     // Optional: some audio feedback if needed
                 }
             }
        });

        // Fast Fall Phase Out
        if (this.isFastFalling && game.player.velocity.y < 10) {
            this.isFastFalling = false;
        }
        
        // Handle Anchor (smash standard platforms)
        if (game.anchorTimer > 0) {
            game.anchorTimer--;
            let glow = Math.sin(performance.now() * 0.01) * 20;
            // Force player downwards faster
            if (game.player.velocity.y < 30) {
                Body.setVelocity(game.player, { x: game.player.velocity.x, y: 30 });
            }
            
            for (let i = game.platforms.length - 1; i >= 0; i--) {
                const p = game.platforms[i];
                if (p.position.y > game.player.position.y && p.position.y - game.player.position.y < 50) {
                    if (Math.abs(p.position.x - game.player.position.x) < (p.bounds.max.x - p.bounds.min.x)/2 + 25) {
                        if (p.label !== 'crusher') { // don't smash crushers
                            game.createExplosion(p.position, '#aaaaaa', 25);
                            World.remove(game.world, p);
                            game.platforms.splice(i, 1);
                            game.pool.platform.push(p);
                            game.addXP(20);
                            game.coins += 2;
                        }
                    }
                }
            }
        }
    }

    handleJump(game) {
        // Fast Fall / Slam ability
        if (!game.player || game.isGameOver) return;
        this.isFastFalling = true;
        Body.setVelocity(game.player, { x: game.player.velocity.x, y: 30 });
        game.createExplosion(game.player.position, '#ffffff', 10);
        game._playTone(150, 'sine', 0, 0.2); // Low slam sound
    }

    handleDash(game) {
        // Phase / Blink ability
        if (!game.player || game.isGameOver || game.dashCooldown > 0) return;
        
        const dashDist = 200;
        const dir = game.keys['ArrowLeft'] || game.keys['KeyA'] ? -1 : (game.keys['ArrowRight'] || game.keys['KeyD'] ? 1 : 0);
        
        if (dir !== 0) {
            game.createExplosion(game.player.position, '#00ff88', 15);
            Body.translate(game.player, { x: dir * dashDist, y: 0 });
            game.createExplosion(game.player.position, '#00ff88', 15);
            game.dashCooldown = 60; // 1 second
            game._playTone(600, 'sine', 0, 0.1);
        }
    }
}
