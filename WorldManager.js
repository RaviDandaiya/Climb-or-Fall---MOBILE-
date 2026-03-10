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
            label: 'floor'
        });
        game.leftWall = Bodies.rectangle(10, CONFIG.canvasHeight / 2, 20, CONFIG.canvasHeight * 2, {
            isStatic: true, label: 'wall', friction: 0.1
        });
        game.rightWall = Bodies.rectangle(CONFIG.canvasWidth - 10, CONFIG.canvasHeight / 2, 20, CONFIG.canvasHeight * 2, {
            isStatic: true, label: 'wall', friction: 0.1
        });
        World.add(game.world, [floor, game.leftWall, game.rightWall]);
    }

    generateInitialPlatforms(settings) {
        for (let i = 0; i < 5; i++) {
            const y = this.game.modeStrategy.getInitialPlatformY(i, settings);
            this.addPlatform(y, i);
        }
    }

    addPlatform(y, index) {
        const game = this.game;
        if (game.isGameOver) return;
        const settings = DIFFICULTY_SETTINGS[game.difficulty];

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

    _addPillar(y, settings) {
        const game = this.game;
        const height = 100 + Math.random() * 150;
        const x = Math.random() * (CONFIG.canvasWidth - 80) + 40;
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

        if (game.maxHeight > 500 && Math.random() < 0.6) {
            pillar.isMoving = true;
            pillar.moveSpeed = (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
            pillar.minX = 40;
            pillar.maxX = CONFIG.canvasWidth - 40;
        }
        game.platforms.push(pillar);
    }

    _addRegularPlatform(y, index, settings) {
        const game = this.game;
        const pParams = game.modeStrategy.getPlatformParams(index, settings);
        const width = pParams.width;
        const x = pParams.x;

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
            if (rng < 0.1) this.addCoin(x, y - 35);
            else if (rng < 0.15) this.addPowerup(x, y - 40);
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
        let e = game.pool.enemy.pop();
        if (e) {
            Body.setPosition(e, { x, y });
            World.add(game.world, e);
        } else {
            e = Bodies.rectangle(x, y, 40, 30, { isStatic: true, isSensor: true, label: 'enemy' });
            World.add(game.world, e);
        }
        e.moveSpeed = (Math.random() < 0.5 ? 2 : -2);
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

        // Generate new
        const settings = DIFFICULTY_SETTINGS[game.difficulty];
        let nextY = game.modeStrategy.getNextPlatformY(game.platforms, py, settings);
        while (nextY !== null && !game.isGameOver && game.platforms.length < 40) {
            this.addPlatform(nextY, game.platforms.length);
            if (game.stage >= 1 && Math.random() < 0.1) {
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
        game.enemies.forEach(e => {
            if (e.position.x < 40 || e.position.x > CONFIG.canvasWidth - 40) e.moveSpeed *= -1;
            Body.translate(e, { x: e.moveSpeed, y: 0 });
        });
    }
}
