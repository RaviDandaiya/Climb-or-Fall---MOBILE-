import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World, Composite } = Matter;

export class FallMode {
    constructor(game) {
        this.game = game;
        this.name = 'fall';
        
        // State for Continuous Free Fall
        this.lastUpdateTime = 0;
        this.vStart = 4;
        this.baseAcceleration = 0.002;
        this.maxVelocity = 14;
        this.currentWorldVel = this.vStart;
        
        this.isFastFalling = false;
        this.isBraking = false;
        this.brakeTimer = 0;
        this.brakeCooldown = 0;
        
        this.obstaclePatterns = ['walls', 'crushers', 'blades', 'lasers'];
        this.lastPattern = null;
    }

    getLavaStartHeight() {
        return -800;
    }

    getPlayerStartY() {
        return 150;
    }

    getFloorY() {
        return -200; // Irrelevant in continuous fall
    }

    getInitialPlatformY(index, settings) {
        // Reduced gap for more intense start
        return 400 + (index * 600);
    }

    getPlatformParams(index, settings) {
        return { width: 0, x: 0 }; // Overridden by custom logic
    }

    /**
     * REDESIGNED: Create obstacles instead of platforms
     */
    createCustomPlatform(y, index, settings, game) {
        if (game.isGameOver) return false;

        // Choose a pattern that isn't the same as the last one
        let pattern;
        do {
            pattern = this.obstaclePatterns[Math.floor(Math.random() * this.obstaclePatterns.length)];
        } while (pattern === this.lastPattern);
        this.lastPattern = pattern;

        const gapSize = Math.max(CONFIG.playerRadius * 5.5, 180 - (game.currentHeight * 0.05));
        const gapX = 100 + Math.random() * (CONFIG.canvasWidth - 200);

        if (pattern === 'walls') {
            this.createWallSegment(y, gapX, gapSize, game);
        } else if (pattern === 'crushers') {
            this.createMovingCrusher(y, game);
        } else if (pattern === 'blades') {
            this.createRotatingBlades(y, game);
        } else if (pattern === 'lasers') {
            this.createLaserGate(y, game);
        }

        // Spawn some coins in the gap area
        if (Math.random() < 0.6) {
            game.addCoin(gapX + (Math.random() - 0.5) * 40, y - 100);
        }
        
        return true; 
    }

    createWallSegment(y, gapX, gapSize, game) {
        const leftWidth = gapX - gapSize / 2;
        const rightWidth = CONFIG.canvasWidth - (gapX + gapSize / 2);
        
        const leftWall = Bodies.rectangle(leftWidth / 2, y, leftWidth, 60, { isStatic: true, label: 'hazard' });
        const rightWall = Bodies.rectangle(CONFIG.canvasWidth - rightWidth / 2, y, rightWidth, 60, { isStatic: true, label: 'hazard' });
        
        World.add(game.world, [leftWall, rightWall]);
        game.platforms.push(leftWall, rightWall);
    }

    createMovingCrusher(y, game) {
        const depth = game.currentHeight || 0;
        const speed = 2 + (depth * 0.005);
        const gap = 180 - Math.min(60, depth * 0.02);
        const cWidth = (CONFIG.canvasWidth - gap) / 2;
        
        // Spawn them spread out
        const leftX = -100;
        const rightX = CONFIG.canvasWidth + 100;
        
        let lBlock = Bodies.rectangle(leftX, y, cWidth, 80, { isStatic: true, label: 'crusher' });
        lBlock.isCrusher = true; 
        lBlock.crusherDir = 1; 
        lBlock.crusherSpeed = speed; 
        lBlock.targetMaxX = cWidth / 2 + 20;
        
        let rBlock = Bodies.rectangle(rightX, y, cWidth, 80, { isStatic: true, label: 'crusher' });
        rBlock.isCrusher = true; 
        rBlock.crusherDir = -1; 
        rBlock.crusherSpeed = speed; 
        rBlock.targetMinX = CONFIG.canvasWidth - (cWidth / 2) - 20;
        
        World.add(game.world, [lBlock, rBlock]);
        game.platforms.push(lBlock, rBlock);
    }

    createRotatingBlades(y, game) {
        const count = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const bx = 100 + (i * (CONFIG.canvasWidth - 200) / (count - 1));
            const by = y + (Math.random() - 0.5) * 100;
            
            // Re-use Enemy logic for rotating blades
            game.addEnemy(bx, by);
            // Enemies in FallMode should have some movement
            const lastEnemy = game.enemies[game.enemies.length - 1];
            if (lastEnemy) {
                lastEnemy.moveSpeed = (Math.random() - 0.5) * 4;
            }
        }
    }

    createLaserGate(y, game) {
        // Laser gates are very thin hazards that "activate"
        const gate = Bodies.rectangle(CONFIG.canvasWidth / 2, y, CONFIG.canvasWidth, 10, { 
            isStatic: true, 
            label: 'hazard',
            isSensor: true // Starts inactive
        });
        
        gate.isLaser = true;
        gate.laserTimer = 0;
        gate.laserState = 'off';
        
        World.add(game.world, gate);
        game.platforms.push(gate);
    }

    updateLava(mult) {
        // Redesigned: Spikes follow at the world velocity + a bit more if behind
        const targetSpeed = this.currentWorldVel * 0.95;
        this.game.lavaHeight += targetSpeed;

        // Catch up mechanic: If spikes are too far, they speed up
        const distToPlayer = this.game.player.position.y - this.game.lavaHeight;
        if (distToPlayer > 1200) {
            this.game.lavaHeight += 2;
        }

        if (this.game.player.position.y < this.game.lavaHeight) {
            this.game.triggerDeath("IMPALED BY SPIKES");
        }
    }

    getTiltSettings() {
        return { maxMult: 2.2, sens: 10 }; // High sensitivity for steering
    }

    getAbyssCondition() {
        // In freefall, abyss is falling too far AHEAD of the generated world
        // But main.js generates platforms ahead, so we just check spikes proximity
        return false; 
    }

    getAbyssDeathMessage() {
        return "LOST IN THE STATIC";
    }

    getAbyssReviveVelocity() {
        return this.currentWorldVel + 5;
    }

    shouldCullPlatform(platformY, lavaY, playerY) {
        return platformY < lavaY - 200;
    }

    getNextPlatformY(platforms, playerY, settings) {
        let lastY = platforms.length ? platforms.reduce((m, p) => Math.max(m, p.position.y), 0) : playerY;
        if (playerY > lastY - 2000) {
            return lastY + 700; // Regular interval
        }
        return null;
    }

    getEnemySpawnOffset() {
        return 800;
    }

    getReviveY() {
        return this.game.lavaHeight + 400;
    }

    getLavaOffset(baseLava) {
        return baseLava - 300;
    }

    getReviveLavaHeight(playerY) {
        return playerY - 600;
    }

    getPowerupType() {
        return Math.random() < 0.7 ? 'shield' : 'magnet';
    }
    
    updateFallMechanics(game) {
        // 1. Difficulty Scaling: Increase world velocity over time
        if (game.isGameOver) return;
        
        this.currentWorldVel = Math.min(
            this.maxVelocity, 
            this.vStart + (this.baseAcceleration * (performance.now() / 1000))
        );

        // 2. Physics: Constant Downward Force (Acceleration)
        // Matter.js gravity handles this, but we clamp the speed
        if (game.player.velocity.y > this.maxVelocity) {
            Body.setVelocity(game.player, { 
                x: game.player.velocity.x, 
                y: this.maxVelocity 
            });
        }
        // Ensure player doesn't stall completely
        if (game.player.velocity.y < this.currentWorldVel * 0.5) {
             Body.setVelocity(game.player, { 
                x: game.player.velocity.x, 
                y: this.currentWorldVel * 0.5 
            });
        }

        // 3. Handle Laser Gate Flickering
        game.platforms.forEach(p => {
             if (p.isLaser) {
                 p.laserTimer++;
                 // 2 second cycle: 1s off, 0.5s warning (flicker), 0.5s on
                 const cycle = p.laserTimer % 120;
                 if (cycle < 60) {
                     p.laserState = 'off';
                     p.isSensor = true;
                     p.render.visible = false;
                 } else if (cycle < 90) {
                     p.laserState = 'warning';
                     p.isSensor = true;
                     p.render.visible = (cycle % 10 < 5); // flicker
                 } else {
                     p.laserState = 'on';
                     p.isSensor = false;
                     p.render.visible = true;
                 }
             }

             // Standard Crusher movement logic
             if (p.isCrusher) {
                 if (p.crusherDir > 0) {
                     if (p.position.x < p.targetMaxX) {
                         Body.setPosition(p, { x: p.position.x + p.crusherSpeed, y: p.position.y });
                     } else {
                         // Stay at target briefly then reset? No, use previous logic
                     }
                 } else {
                     if (p.position.x > p.targetMinX) {
                         Body.setPosition(p, { x: p.position.x - p.crusherSpeed, y: p.position.y });
                     }
                 }
             }

             // Near-Miss Bonus
             if (!p.hasTriggeredNearMiss && !game.isGameOver && !p.isSensor) {
                 const pWidth = (p.bounds.max.x - p.bounds.min.x);
                 const dx = Math.abs(game.player.position.x - p.position.x) - (pWidth / 2);
                 const dy = Math.abs(game.player.position.y - p.position.y);
                 
                 if (dx < 40 && dx > 0 && dy < 50) {
                     p.hasTriggeredNearMiss = true;
                     game.combo++;
                     game.addXP(30);
                     game.addScoreBonus(50 * game.combo);
                     game.createExplosion(game.player.position, '#ffff00', 8);
                     game.shake = 5;
                 }
             }
        });

        // 4. Update Cooldowns / Brake
        if (this.brakeCooldown > 0) this.brakeCooldown--;
        if (this.brakeTimer > 0) {
            this.brakeTimer--;
            Body.setVelocity(game.player, { 
                x: game.player.velocity.x * 0.9, 
                y: game.player.velocity.y * 0.4 
            });
            if (this.brakeTimer % 4 === 0) game.createParticles(game.player.position, '#00d1ff', 2);
        }
    }

    handleJump(game) {
        // AIR BRAKE - Vital for timing lasers and crushers
        if (!game.player || game.isGameOver || this.brakeCooldown > 0) return;
        
        this.isBraking = true;
        this.brakeTimer = 35;
        this.brakeCooldown = 100; // 1.6s
        
        Body.setVelocity(game.player, { x: game.player.velocity.x, y: game.player.velocity.y * 0.1 });
        game.createExplosion(game.player.position, '#00d1ff', 12);
        game.shake = 5;
        game._playTone(400, 'sine', 0, 0.1);
    }

    handleDash(game, targetVx) {
        // SIDE DASH - Essential for dodging moving blades
        if (!game.player || game.isGameOver || game.dashCooldown > 0) return;
        
        const dashDir = targetVx > 0 ? 1 : (targetVx < 0 ? -1 : (game.player.velocity.x > 0 ? 1 : -1));
        const dashPower = 20;
        
        Body.setVelocity(game.player, { 
            x: dashDir * dashPower, 
            y: game.player.velocity.y * 0.3 
        });
        
        game.isDashingFrames = 15; 
        game.dashCooldown = 120; // 2s
        game.shake = 15;
        
        game.createExplosion(game.player.position, '#8800ff', 18);
        game._playTone(600, 'triangle', 0, 0.15);
    }
}
