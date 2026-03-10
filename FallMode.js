import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World, Composite } = Matter;

export class FallMode {
    constructor(game) {
        this.game = game;
        this.name = 'fall';
        
        // State for Continuous Free Fall
        this.vStart = 3;
        this.baseAcceleration = 0.03;
        this.maxVelocity = 12;
        this.currentWorldVel = this.vStart;
        
        this.isFastFalling = false;
        this.isBraking = false;
        this.brakeTimer = 0;
        this.brakeCooldown = 0;
        
        this.lastPattern = null;
        this.timeSurvived = 0;
        this.startTime = null;
    }

    getLavaStartHeight() {
        return -800; // Start spikes far behind
    }

    getPlayerStartY() {
        return 150;
    }

    getFloorY() {
        return -200; // Irrelevant in continuous fall
    }

    getInitialPlatformY(index, settings) {
        // Space out the beginning to give the player time to adjust
        return 600 + (index * 800);
    }

    getPlatformParams(index, settings) {
        return { width: 0, x: 0 }; // Overridden by custom logic
    }

    getDifficultyStage() {
        if (!this.timeSurvived) return 0;
        if (this.timeSurvived < 15) return 0; // Stage 1 - Beginner
        if (this.timeSurvived < 40) return 1; // Stage 2 - Early Challenge
        if (this.timeSurvived < 80) return 2; // Stage 3 - Intermediate
        return 3;                             // Stage 4 - Advanced
    }

    createCustomPlatform(y, index, settings, game) {
        if (game.isGameOver) return false;

        const stage = this.getDifficultyStage();

        // 1. Difficulty-based Spawn Table
        let possiblePatterns = [];
        if (stage === 0)      possiblePatterns = ['small_rock', 'small_monster'];
        else if (stage === 1) possiblePatterns = ['small_rock', 'medium_rock', 'monster_cluster'];
        else if (stage === 2) possiblePatterns = ['medium_rock', 'blades', 'small_crusher', 'walls'];
        else                  possiblePatterns = ['large_platform', 'crushers', 'blades', 'walls', 'lasers', 'complex_walls'];

        let pattern;
        do {
            pattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
        } while (pattern === this.lastPattern && possiblePatterns.length > 1);
        this.lastPattern = pattern;

        // 2. Obstacle Size & Gap Scaling
        const sizeIncrease = 0.2;
        const obstacleScale = 1 + (stage * sizeIncrease); 

        const minGap = CONFIG.playerRadius * 4.5; // Always larger than player width * 2
        const gapSize = Math.max(minGap, 280 - (stage * 50)); 
        const gapX = 100 + Math.random() * (CONFIG.canvasWidth - 200);

        // 3. Spawn Obstacle
        if (pattern === 'small_rock')           this.createRock(y, gapX, 1, game);
        else if (pattern === 'medium_rock')     this.createRock(y, gapX, 2, game);
        else if (pattern === 'large_platform')  this.createRock(y, gapX, 3.5, game);
        else if (pattern === 'small_monster')   this.createMonster(y, 1, game);
        else if (pattern === 'monster_cluster') this.createMonster(y, 3, game);
        else if (pattern === 'blades')          this.createRotatingBlades(y, game, obstacleScale);
        else if (pattern === 'small_crusher')   this.createMovingCrusher(y, game, 0.4, gapSize); 
        else if (pattern === 'crushers')        this.createMovingCrusher(y, game, 1.0, gapSize);
        else if (pattern === 'walls')           this.createWallSegment(y, gapX, gapSize, game, false);
        else if (pattern === 'complex_walls')   this.createWallSegment(y, gapX, gapSize * 0.8, game, true);
        else if (pattern === 'lasers')          this.createLaserGate(y, game);

        // 4. Coin Spawning in Safe Gaps
        if (Math.random() < 0.7) {
            game.addCoin(gapX + (Math.random() - 0.5) * gapSize * 0.5, y - 80);
            if (stage > 1 && Math.random() < 0.3) game.addCoin(gapX, y - 120);
        }
        
        return true; 
    }

    createRock(y, gapX, sizeLevel, game) {
        // Size 1: 60px, Size 2: 120px, Size 3.5: 210px
        const w = sizeLevel * 60; 
        const h = sizeLevel * 40;
        
        // Spawn rock away from the safe gap
        const rockX = gapX > CONFIG.canvasWidth / 2 ? gapX - (100 + w/2) : gapX + (100 + w/2); 
        const clampedX = Math.max(w/2 + 10, Math.min(CONFIG.canvasWidth - w/2 - 10, rockX));

        let rock = game.pool.platform.pop();
        if (rock) {
            const oldWidth = rock.bounds.max.x - rock.bounds.min.x;
            Body.scale(rock, w / oldWidth, 1);
            Body.setPosition(rock, {x: clampedX, y});
            World.add(game.world, rock);
        } else {
            rock = Bodies.rectangle(clampedX, y, w, h, { isStatic: true });
            World.add(game.world, rock);
        }
        rock.label = 'hazard';
        game.platforms.push(rock);
    }

    createMonster(y, count, game) {
        for (let i = 0; i < count; i++) {
            const x = 50 + Math.random() * (CONFIG.canvasWidth - 100);
            const my = y + (Math.random() - 0.5) * 100;
            
            let enemy = game.pool.enemy.pop();
            if (enemy) {
                Body.setPosition(enemy, {x, y: my});
                World.add(game.world, enemy);
            } else {
                enemy = Bodies.polygon(x, my, 8, 16, { isStatic: true, label: 'enemy', isSensor: true }); 
                World.add(game.world, enemy);
            }
            enemy.moveSpeed = (Math.random() - 0.5) * 4;
            game.enemies.push(enemy);
        }
    }

    createWallSegment(y, gapX, gapSize, game, isComplex = false) {
        const leftWidth = Math.max(10, gapX - gapSize / 2);
        const rightWidth = Math.max(10, CONFIG.canvasWidth - (gapX + gapSize / 2));
        const h = isComplex ? 120 : 60;

        let leftWall = game.pool.platform.pop() || Bodies.rectangle(leftWidth / 2, y, leftWidth, h, { isStatic: true });
        Body.setPosition(leftWall, {x: leftWidth/2, y});
        const lwScale = leftWidth / (leftWall.bounds.max.x - leftWall.bounds.min.x);
        Body.scale(leftWall, lwScale, 1);
        leftWall.label = 'hazard';

        let rightWall = game.pool.platform.pop() || Bodies.rectangle(CONFIG.canvasWidth - rightWidth / 2, y, rightWidth, h, { isStatic: true });
        Body.setPosition(rightWall, {x: CONFIG.canvasWidth - rightWidth/2, y});
        const rwScale = rightWidth / (rightWall.bounds.max.x - rightWall.bounds.min.x);
        Body.scale(rightWall, rwScale, 1);
        rightWall.label = 'hazard';

        World.add(game.world, [leftWall, rightWall]);
        game.platforms.push(leftWall, rightWall);

        if (isComplex && Math.random() < 0.5 && gapSize > 150) {
            let island = game.pool.platform.pop() || Bodies.rectangle(gapX, y, 40, h / 2, { isStatic: true });
            Body.setPosition(island, {x: gapX, y});
            const iScale = 40 / (island.bounds.max.x - island.bounds.min.x);
            Body.scale(island, iScale, 1);
            island.label = 'hazard';
            World.add(game.world, island);
            game.platforms.push(island);
        }
    }

    createMovingCrusher(y, game, speedMult, gapSize) {
        const speed = (2 + this.timeSurvived * 0.05) * speedMult;
        const cWidth = (CONFIG.canvasWidth - gapSize) / 2;
        const leftX = -50;
        const rightX = CONFIG.canvasWidth + 50;
        
        let lBlock = game.pool.platform.pop() || Bodies.rectangle(leftX, y, cWidth, 80, { isStatic: true });
        Body.setPosition(lBlock, {x: leftX, y});
        const lScale = cWidth / (lBlock.bounds.max.x - lBlock.bounds.min.x);
        Body.scale(lBlock, lScale, 1);
        lBlock.label = 'crusher';
        lBlock.isCrusher = true; lBlock.crusherDir = 1; lBlock.crusherSpeed = speed; lBlock.targetMaxX = cWidth / 2 + 10;
        
        let rBlock = game.pool.platform.pop() || Bodies.rectangle(rightX, y, cWidth, 80, { isStatic: true });
        Body.setPosition(rBlock, {x: rightX, y});
        const rScale = cWidth / (rBlock.bounds.max.x - rBlock.bounds.min.x);
        Body.scale(rBlock, rScale, 1);
        rBlock.label = 'crusher';
        rBlock.isCrusher = true; rBlock.crusherDir = -1; rBlock.crusherSpeed = speed; rBlock.targetMinX = CONFIG.canvasWidth - (cWidth / 2) - 10;
        
        World.add(game.world, [lBlock, rBlock]);
        game.platforms.push(lBlock, rBlock);
    }

    createRotatingBlades(y, game, scale = 1) {
        const count = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < count; i++) {
            const bx = (CONFIG.canvasWidth / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 50;
            
            let enemy = game.pool.enemy.pop();
            if (enemy) {
                Body.setPosition(enemy, {x: bx, y});
                World.add(game.world, enemy);
            } else {
                enemy = Bodies.polygon(bx, y, 8, 20 * scale, { isStatic: true, label: 'enemy', isSensor: true });
                World.add(game.world, enemy);
            }
            enemy.moveSpeed = (Math.random() - 0.5) * 6;
            game.enemies.push(enemy);
        }
    }

    createLaserGate(y, game) {
        let gate = game.pool.platform.pop() || Bodies.rectangle(CONFIG.canvasWidth / 2, y, CONFIG.canvasWidth, 15, { isStatic: true });
        Body.setPosition(gate, {x: CONFIG.canvasWidth / 2, y});
        const gScale = CONFIG.canvasWidth / (gate.bounds.max.x - gate.bounds.min.x);
        Body.scale(gate, gScale, 1);
        
        gate.label = 'hazard';
        gate.isSensor = true;
        gate.isLaser = true;
        gate.laserTimer = 0;
        gate.laserState = 'off';
        
        World.add(game.world, gate);
        game.platforms.push(gate);
    }

    updateLava(mult) {
        const targetSpeed = this.currentWorldVel * 0.95;
        this.game.lavaHeight += targetSpeed;

        const distToPlayer = this.game.player.position.y - this.game.lavaHeight;
        if (distToPlayer > 1200) {
            this.game.lavaHeight += 4;
        }

        if (this.game.player.position.y < this.game.lavaHeight) {
            this.game.triggerDeath("IMPALED BY SPIKES");
        }
    }

    getTiltSettings() {
        return { maxMult: 2.2, sens: 10 };
    }

    getAbyssCondition() {
        return false; 
    }

    getAbyssDeathMessage() {
        return "LOST IN THE STATIC";
    }

    getAbyssReviveVelocity() {
        return this.currentWorldVel + 5;
    }

    shouldCullPlatform(platformY, lavaY, playerY) {
        return platformY < Math.min(lavaY, playerY) - 500;
    }

    getNextPlatformY(platforms, playerY, settings) {
        const stage = this.getDifficultyStage();
        let lastY = platforms.length ? platforms.reduce((m, p) => Math.max(m, p.position.y), 0) : playerY;
        
        // Spawn rate: Reduction based on difficulty level
        const baseSpawnInterval = 1000;
        const reductionRate = 200;
        const minSpawnInterval = 350;
        
        const currentInterval = Math.max(minSpawnInterval, baseSpawnInterval - stage * reductionRate);

        if (playerY > lastY - 2000) {
            return lastY + currentInterval + (Math.random() * 200);
        }
        return null;
    }

    getEnemySpawnOffset() {
        return 800; // Not mainly used due to custom create mechanism
    }

    getReviveY() {
        return this.game.lavaHeight + 500;
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
        if (game.isGameOver) {
            this.startTime = null;
            return;
        }
        
        // 1. Calculate time survived for difficulty scaling
        if (!this.startTime) this.startTime = performance.now();
        this.timeSurvived = (performance.now() - this.startTime) / 1000;
        
        const stage = this.getDifficultyStage();
        
        // 2. World velocity scaling
        this.currentWorldVel = Math.min(
            this.maxVelocity, 
            this.vStart + (this.baseAcceleration * this.timeSurvived)
        );

        // Clamp maximum falling speed
        if (game.player.velocity.y > this.maxVelocity) {
            Body.setVelocity(game.player, { x: game.player.velocity.x, y: this.maxVelocity });
        }
        
        // Ensure the player is always falling at least as fast as the world 
        // to prevent them getting stuck above the screen viewport
        if (game.player.velocity.y < this.currentWorldVel * 0.4) {
             Body.setVelocity(game.player, { x: game.player.velocity.x, y: this.currentWorldVel * 0.4 });
        }

        // 3. Update active obstacles
        game.platforms.forEach(p => {
             if (p.isLaser) {
                 p.laserTimer++;
                 const maxCycle = Math.max(60, 150 - stage * 25);
                 const cycle = p.laserTimer % maxCycle;
                 const offTime = maxCycle * 0.5;
                 
                 if (cycle < offTime) {
                     p.laserState = 'off';
                     p.isSensor = true;
                     p.render.visible = false;
                 } else if (cycle < offTime + 30) {
                     p.laserState = 'warning';
                     p.isSensor = true;
                     p.render.visible = (cycle % 10 < 5); // Flicker effect
                 } else {
                     p.laserState = 'on';
                     p.isSensor = false;
                     p.render.visible = true;
                 }
             }

             if (p.isCrusher) {
                 if (p.crusherDir > 0) {
                     if (p.position.x < p.targetMaxX) {
                         Body.setPosition(p, { x: p.position.x + p.crusherSpeed, y: p.position.y });
                     }
                 } else {
                     if (p.position.x > p.targetMinX) {
                         Body.setPosition(p, { x: p.position.x - p.crusherSpeed, y: p.position.y });
                     }
                 }
             }

             // Near-Miss Bonus computation for precision steering
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

        // 4. Update player powers (Air Brake)
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
        if (!game.player || game.isGameOver || this.brakeCooldown > 0) return;
        
        this.isBraking = true;
        this.brakeTimer = 35;
        this.brakeCooldown = 100;
        
        Body.setVelocity(game.player, { x: game.player.velocity.x, y: game.player.velocity.y * 0.1 });
        game.createExplosion(game.player.position, '#00d1ff', 12);
        game.shake = 5;
        game._playTone(400, 'sine', 0, 0.1);
    }

    handleDash(game, targetVx) {
        if (!game.player || game.isGameOver || game.dashCooldown > 0) return;
        
        const dashDir = targetVx > 0 ? 1 : (targetVx < 0 ? -1 : (game.player.velocity.x > 0 ? 1 : -1));
        const dashPower = 20;
        
        Body.setVelocity(game.player, { 
            x: dashDir * dashPower, 
            y: game.player.velocity.y * 0.3 
        });
        
        game.isDashingFrames = 15; 
        game.dashCooldown = 120;
        game.shake = 15;
        
        game.createExplosion(game.player.position, '#8800ff', 18);
        game._playTone(600, 'triangle', 0, 0.15);
    }
}
