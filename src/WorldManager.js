import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World, Composite } = Matter;

/**
 * WorldManager — handles platform/coin/powerup/enemy creation,
 * object pooling and culling.
 */
export class WorldManager {
    constructor(game) {
        this.game = game;
    }

    // ─── Platform Creation ──────────────────────────────────────

    createStartPlatform() {
        const game = this.game;
        const floorY = game.modeStrategy.getFloorY();
        const floor = Bodies.rectangle(CONFIG.canvasWidth / 2, floorY, CONFIG.canvasWidth * 10, 200, {
            isStatic: true,
            label: 'floor',
            friction: 0.2
        });
        
        // REMOVED side walls to allow smooth screen wrap-around
        World.add(game.world, [floor]);
    }

    generateInitialPlatforms(settings) {
        // More platforms at start for immediate engagement
        for (let i = 0; i < 10; i++) {
            const y = this.game.modeStrategy.getInitialPlatformY(i, settings);
            this.addPlatform(y, i);
            // Immediate interaction: add coins to the first few platforms
            if (i < 5) this.addCoin(Math.random() * CONFIG.canvasWidth, y - 50);
        }
    }

    addPlatform(y, index) {
        const game = this.game;
        if (game.isGameOver) return;
        const settings = DIFFICULTY_SETTINGS[game.difficulty];

        // Overlap safety: Don't spawn if too close to another platform vertically
        const tooClose = game.platforms.some(p => Math.abs(p.position.y - y) < CONFIG.platformHeight * 2);
        if (tooClose) return;

        if (game.modeStrategy.createCustomPlatform && game.modeStrategy.createCustomPlatform(y, index, settings, game)) {
            return;
        }

        const isPillar = Math.random() < settings.pillarChance;

        if (isPillar) {
            this._addPillar(y, settings);
        } else {
            this._addRegularPlatform(y, index, settings);
        }
    }

    _checkOverlap(x, y, width, height) {
        const padding = 20;
        const minX = x - width / 2 - padding;
        const maxX = x + width / 2 + padding;
        const minY = y - height / 2 - padding;
        const maxY = y + height / 2 + padding;

        return this.game.platforms.some(p => {
            return !(maxX < p.bounds.min.x || 
                     minX > p.bounds.max.x || 
                     maxY < p.bounds.min.y || 
                     minY > p.bounds.max.y);
        });
    }

    _addPillar(y, settings) {
        const game = this.game;
        let height = 100 + Math.random() * 150;
        // Keep pillars away from the exact screen edges to prevent wrap-around glitches
        let x = Math.random() * (CONFIG.canvasWidth - 120) + 60;

        let attempts = 0;
        let hasOverlap = false;

        do {
            hasOverlap = this._checkOverlap(x, y, 40, height);
            if (hasOverlap) {
                x = Math.random() * (CONFIG.canvasWidth - 80) + 40;
                attempts++;
            }
        } while (hasOverlap && attempts < 10);

        if (hasOverlap) return; // Give up trying to spawn to prevent overlap

        let pillar = game.pool.pillar.pop();
        if (pillar) {
            const oldHeight = pillar.bounds.max.y - pillar.bounds.min.y;
            Body.scale(pillar, 1, height / oldHeight);
            Body.setPosition(pillar, { x, y });
            Body.setVelocity(pillar, { x: 0, y: 0 });
            World.add(game.world, pillar);
        } else {
            pillar = Bodies.rectangle(x, y, 40, height, { isStatic: true, label: 'pillar', render: { visible: false } });
            World.add(game.world, pillar);
        }
        pillar.isMoving = false;

        if (game.score > 500 && Math.random() < 0.6) {
            pillar.isMoving = true;
            pillar.moveSpeed = (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
            pillar.minX = 40;
            pillar.maxX = CONFIG.canvasWidth - 40;
        }
        game.platforms.push(pillar);
    }

    _addRegularPlatform(y, index, settings) {
        const game = this.game;
        let pParams = game.modeStrategy.getPlatformParams(index, settings);
        let width = pParams.width;
        let x = pParams.x;

        let attempts = 0;
        let hasOverlap = false;

        do {
            hasOverlap = this._checkOverlap(x, y, width, CONFIG.platformHeight);
            if (hasOverlap) {
                pParams = game.modeStrategy.getPlatformParams(index, settings);
                width = pParams.width;
                x = pParams.x;
                attempts++;
            }
        } while (hasOverlap && attempts < 10);

        if (hasOverlap) return; // Give up trying to spawn to prevent overlap

        const isHazard = index > 15 && Math.random() < settings.hazardChance;
        const isCrumbling = !isHazard && index > 10 && Math.random() < 0.15;
        const label = isHazard ? 'hazard' : 'platform';

        let platform = game.pool.platform.pop();
        if (platform) {
            const oldWidth = platform.bounds.max.x - platform.bounds.min.x;
            Body.scale(platform, width / oldWidth, 1);
            Body.setPosition(platform, { x, y });
            Body.setVelocity(platform, { x: 0, y: 0 });
            platform.label = label;
            World.add(game.world, platform);
        } else {
            platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, { isStatic: true, render: { visible: false } });
            platform.label = label;
            World.add(game.world, platform);
        }
        platform.isCrumbling = isCrumbling;
        platform.crumbleTimer = 0;
        platform.isMoving = false;
        game.platforms.push(platform);

        if (!isHazard && !isCrumbling) {
            const rng = Math.random();
            if (rng < 0.15) {
                // Spawn a cluster of coins (1-4)
                const count = Math.floor(Math.random() * 3) + 1;
                const spacing = 25;
                const startX = x - ((count - 1) * spacing) / 2;
                for (let i = 0; i < count; i++) {
                    this.addCoin(startX + i * spacing, y - 35);
                }
            } else if (rng < 0.20) {
                this.addPowerup(x, y - 40);
            }
        }
    }

    // ─── Coins ──────────────────────────────────────────────────

    addCoin(x, y) {
        const game = this.game;
        let coin = game.pool.coin.pop();
        if (coin) {
            Body.setPosition(coin, { x, y });
            World.add(game.world, coin);
        } else {
            coin = Bodies.circle(x, y, 8, { isStatic: true, isSensor: true, label: 'coin' });
            World.add(game.world, coin);
        }
        // 10% chance to be a BIG COIN worth 5
        coin.value = Math.random() < 0.1 ? 5 : 1;
        game.activeCoins.push(coin);
    }

    // ─── Powerups ───────────────────────────────────────────────

    addPowerup(x, y) {
        const game = this.game;
        let type;
        if (game.modeStrategy.getPowerupType) {
            type = game.modeStrategy.getPowerupType();
        } else {
            type = Math.random() < 0.5 ? 'shield' : 'magnet';
        }
        let p = game.pool.powerup.pop();
        if (p) {
            Body.setPosition(p, { x, y });
            World.add(game.world, p);
        } else {
            p = Bodies.circle(x, y, 16, { isStatic: true, isSensor: true, label: 'powerup' });
            World.add(game.world, p);
        }
        p.powerupType = type;
        game.powerups.push(p);
    }

    // ─── Enemies ────────────────────────────────────────────────

    addEnemy(y) {
        const game = this.game;
        const x = Math.random() * (CONFIG.canvasWidth - 100) + 50;
        
        // Decide enemy type: higher chance for Stalkers in later stages
        const isStalker = game.stage >= 2 && Math.random() < 0.3;
        const label = isStalker ? 'enemy_stalker' : 'enemy';

        let e = game.pool.enemy.pop();
        if (e) {
            Body.setPosition(e, { x, y });
            e.label = label;
            World.add(game.world, e);
        } else {
            e = Bodies.rectangle(x, y, 40, 30, { isStatic: true, isSensor: true, label: label });
            World.add(game.world, e);
        }
        e.isStalker = isStalker;
        e.moveSpeed = (Math.random() < 0.5 ? 2 : -2) * (1 + (game.stage * 0.2));
        game.enemies.push(e);
    }

    // ─── Culling ────────────────────────────────────────────────

    cullAndGenerate() {
        const game = this.game;
        if (!game.player || game.isGameOver) return;

        const ly = game.modeStrategy.getLavaOffset(game.lavaHeight);
        const py = game.player.position.y;

        // Cull platforms
        for (let i = game.platforms.length - 1; i >= 0; i--) {
            if (game.modeStrategy.shouldCullPlatform(game.platforms[i].position.y, ly, py)) {
                const p = game.platforms[i];
                World.remove(game.world, p);
                game.platforms.splice(i, 1);
                if (p.label === 'pillar') game.pool.pillar.push(p);
                else game.pool.platform.push(p);
            }
        }
        // Cull powerups
        for (let i = game.powerups.length - 1; i >= 0; i--) {
            if (game.modeStrategy.shouldCullPlatform(game.powerups[i].position.y, ly, py)) {
                game.pool.powerup.push(game.powerups[i]);
                World.remove(game.world, game.powerups[i]);
                game.powerups.splice(i, 1);
            }
        }
        // Cull coins
        for (let i = game.activeCoins.length - 1; i >= 0; i--) {
            if (game.modeStrategy.shouldCullPlatform(game.activeCoins[i].position.y, ly, py)) {
                game.pool.coin.push(game.activeCoins[i]);
                World.remove(game.world, game.activeCoins[i]);
                game.activeCoins.splice(i, 1);
            }
        }

        // Cull enemies
        for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            if (game.modeStrategy.shouldCullPlatform(e.position.y, ly, py)) {
                World.remove(game.world, e);
                game.enemies.splice(i, 1);
                game.pool.enemy.push(e);
            }
        }

        // Generate new
        const settings = DIFFICULTY_SETTINGS[game.difficulty];
        let nextY = game.modeStrategy.getNextPlatformY(game.platforms, py, settings);
        while (nextY !== null && !game.isGameOver && game.platforms.length < 40) {
            this.addPlatform(nextY, game.platforms.length);
            // Spawn enemies based on stage progression (e.g. stage 2+ starts regular spawns)
            const enemySpawnChance = 0.05 + (game.stage * 0.05); // Increases with stage
            if (game.stage >= 1 && Math.random() < Math.min(0.4, enemySpawnChance)) {
                this.addEnemy(nextY + game.modeStrategy.getEnemySpawnOffset());
            }
            nextY = game.modeStrategy.getNextPlatformY(game.platforms, py, settings);
        }
    }

    // ─── Per-frame Updates ──────────────────────────────────────

    updatePlatforms() {
        const game = this.game;
        const now = performance.now();
        for (let i = game.platforms.length - 1; i >= 0; i--) {
            const p = game.platforms[i];
            if (p.isMoving) {
                if (p.position.x < p.minX || p.position.x > p.maxX) p.moveSpeed *= -1;
                Body.translate(p, { x: p.moveSpeed, y: 0 });
            }
            if (p.isCrumbling && p.crumbleTimer > 0) {
                if (now - p.crumbleTimer > 1500) {
                    game.createExplosion(p.position, '#ccaa88', 15);
                    World.remove(game.world, p);
                    game.pool.platform.push(p);
                    game.platforms.splice(i, 1);
                }
            }
        }
    }

    updateEnemies() {
        const game = this.game;
        const player = game.player;
        if (!player) return;

        game.enemies.forEach(e => {
            const distY = Math.abs(e.position.y - player.position.y);
            
            // Only update enemies that are somewhat near the player vertically to save CPU
            // and prevent far-away enemies from doing weird things
            if (distY > 1200) return;

            if (e.isStalker) {
                // Stalker AI: move towards player if vertically close
                const distX = player.position.x - e.position.x;
                
                // Only charge if within a reasonable vertical range
                if (distY < 450 && distY > 30) {
                    // Charge! 
                    const dir = distX > 0 ? 1 : -1;
                    
                    // Added a horizontal deadzone (20px) to prevent the "tethered" jitter effect
                    if (Math.abs(distX) > 20) {
                        // Use a speed that is slightly randomized and NOT exactly 7.5 (player speed)
                        // to avoid the visual illusion of being tethered.
                        const baseSpeed = 3 + (game.stage * 0.4);
                        const randomVariation = (Math.sin(game.frameCount * 0.05) * 1); // Subtle wave
                        e.moveSpeed = dir * (baseSpeed + randomVariation);
                    } else {
                        // Slow down when very close horizontally
                        e.moveSpeed *= 0.9;
                    }
                } else {
                    // Patrol if player is too far or vertically offset
                    if (e.position.x < 40 || e.position.x > CONFIG.canvasWidth - 40) e.moveSpeed *= -1;
                }
            } else {
                // Regular Patrol AI: keep it independent
                if (e.position.x < 40 || e.position.x > CONFIG.canvasWidth - 40) e.moveSpeed *= -1;
            }
            
            // Apply horizontal movement
            Body.translate(e, { x: e.moveSpeed, y: 0 });

            // Enemy Screen wrap-around (matches player behavior)
            // Using wider boundaries to prevent "death by teleport"
            if (e.position.x < -80) {
                Body.setPosition(e, { x: CONFIG.canvasWidth + 70, y: e.position.y });
            } else if (e.position.x > CONFIG.canvasWidth + 80) {
                Body.setPosition(e, { x: -70, y: e.position.y });
            }
        });
    }

    updateMagnets() {
        const game = this.game;
        if (game.magnetTimer <= 0 || !game.player || game.isGameOver) return;

        game.activeCoins.forEach(coin => {
            const dx = game.player.position.x - coin.position.x;
            const dy = game.player.position.y - coin.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 350) {
                // Determine attraction speed: stronger when closer
                const attractSpeed = Math.max(2, (350 - dist) / 12);
                const dirX = dx / dist;
                const dirY = dy / dist;
                
                // Move coin towards player
                Body.translate(coin, { x: dirX * attractSpeed, y: dirY * attractSpeed });
            }
        });
    }

    // ─── Interaction Helpers ────────────────────────────────────

    collectCoin(body) {
        const game = this.game;
        const val = body.value || 1;
        game.coins += val;
        game.totalCoinsAcc += val;
        localStorage.setItem('coins', game.coins);
        localStorage.setItem('totalCoinsAcc', game.totalCoinsAcc);
        
        World.remove(game.world, body);
        game.activeCoins = game.activeCoins.filter(c => c !== body);
        game.pool.coin.push(body);
        
        game.particleSystem.createExplosion(body.position, '#ffcc00', 8);
        if (game.audioManager && game.audioManager.playCoin) game.audioManager.playCoin();
        game.hud.updateHUD();
    }

    collectPowerup(body) {
        const game = this.game;
        const type = body.powerupType;
        
        if (type === 'shield') game.hasShield = true;
        if (type === 'magnet') game.magnetTimer = 600; // ~10 seconds at 60fps
        
        World.remove(game.world, body);
        game.powerups = game.powerups.filter(p => p !== body);
        game.pool.powerup.push(body);
        
        const color = type === 'shield' ? '#00d1ff' : '#ff3e3e';
        game.particleSystem.createExplosion(body.position, color, 15);
        if (game.audioManager && game.audioManager.playPowerup) game.audioManager.playPowerup();
        game.hud.updateHUD();
    }

    destroyEnemy(body) {
        const game = this.game;
        World.remove(game.world, body);
        game.enemies = game.enemies.filter(e => e !== body);
        game.pool.enemy.push(body);
        
        game.particleSystem.createExplosion(body.position, '#ff0044', 20);
        game.addXP && game.addXP(50);
        game.shake = 10;
    }
}
