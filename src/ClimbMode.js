import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World } = Matter;

export class ClimbMode {
    constructor(game) {
        this.game = game;
        this.name = 'climb';
    }

    getLavaStartHeight() {
        return CONFIG.canvasHeight + 3000;
    }

    update(game) {
        if (game.isGameOver) return;
        
        // 1. Move Lava
        this.updateLava(1.0);
        
        // 2. Update Height Score
        const currentY = game.player.position.y;
        const floorY = this.getFloorY() - 100; // Top of fixed starting ground
        const heightReached = Math.max(0, Math.floor((floorY - currentY) / 10));
        
        if (heightReached > game.score) {
            game.score = heightReached;
        }
    }

    getPlayerStartY() {
        return CONFIG.canvasHeight + 150;
    }

    getFloorY() {
        return CONFIG.canvasHeight + 400;
    }

    getInitialPlatformY(index, settings) {
        return CONFIG.canvasHeight - 60 - (index * settings.gapHeight);
    }

    getPlatformParams(index, settings) {
        const width = (settings.platformWidth * 0.7) + (Math.random() * settings.platformWidth * 1.0);
        const x = (Math.random() * (CONFIG.canvasWidth - width - 60)) + width / 2 + 30;
        return { width, x };
    }

    updateLava(mult) {
        this.game.lavaHeight -= this.game.lavaSpeed * mult;
        if (this.game.player.position.y > this.game.lavaHeight) {
            this.game.triggerDeath("CONSUMED BY LAVA");
        }
    }

    getTiltSettings() {
        return { maxMult: 1.2, sens: 20 };
    }

    getAbyssCondition() {
        return this.game.player.position.y > this.game.lavaHeight + 800;
    }

    getAbyssDeathMessage() {
        return "FELL INTO THE ABYSS";
    }

    getAbyssReviveVelocity() {
        return -20;
    }

    shouldCullPlatform(platformY, lavaY, playerY) {
        return platformY > Math.min(lavaY, playerY + 1500);
    }

    getNextPlatformY(platforms, playerY, settings) {
        if (!platforms.length) return playerY;
        
        const highestY = platforms.reduce((m, p) => Math.min(m, p.position.y), Infinity);
        const lowestY = platforms.reduce((m, p) => Math.max(m, p.position.y), -Infinity);
        
        // 1. Standard: Generate upwards
        if (playerY < highestY + 2000) {
            return highestY - (settings.gapHeight * (0.8 + Math.random() * 0.9));
        }
        
        // 2. Recovery: If player fell far down, generate near player again
        if (playerY > lowestY + 1000) {
            return playerY - 300;
        }

        return null;
    }

    getEnemySpawnOffset() {
        return -400;
    }

    getReviveY() {
        return this.game.player.position.y - 600;
    }

    getLavaOffset(baseLava) {
        return baseLava + 500;
    }

    getReviveLavaHeight(playerY) {
        return playerY + 1200;
    }

    handleJump(game, onGround, jumpForce, jumpVx = 0) {
        if (!onGround) return;
        if (!game.jumpDebounce) {
            Body.setVelocity(game.player, { x: jumpVx, y: jumpForce });
            game.createExplosion({ x: game.player.position.x, y: game.player.position.y + 16 }, '#ffffff', 10);
            if (game.audioManager) game.audioManager.playJump();
            game.jumpDebounce = true;
            setTimeout(() => game.jumpDebounce = false, 200);
        }
    }

    handleDash(game, targetVx) {
        if (!game.player || game.isGameOver || game.dashCooldown > 0) return;
        Body.setVelocity(game.player, { x: targetVx, y: -40 });
        game.isDashingFrames = 25; // Invincible Dash time
        game.dashCooldown = 250;
        game.maxDashCooldown = 250;
        game.shake = 15;
        game.createExplosion(game.player.position, '#00ff88', 25);
        game.playJump();

        // Erase visible red hazards & enemies instantly
        const scale = game.canvas.width / CONFIG.canvasWidth;
        const viewTop = -game.cameraY - (game.canvas.height / scale) * 0.2;
        const viewBottom = -game.cameraY + (game.canvas.height / scale) * 1.5;

        for (let i = game.enemies.length - 1; i >= 0; i--) {
            const e = game.enemies[i];
            if (e.position.y > viewTop && e.position.y < viewBottom) {
                World.remove(game.world, e);
                game.pool.enemy.push(e);
                game.createExplosion(e.position, '#ff2200', 30);
                game.addXP(30);
                game.enemies.splice(i, 1);
            }
        }
        for (let i = game.platforms.length - 1; i >= 0; i--) {
            const p = game.platforms[i];
            // Fix: Strict exclusion for pillars - they should NOT be removed by dash
            if ((p.label === 'hazard' || p.isHazard) && p.label !== 'pillar' && p.position.y > viewTop && p.position.y < viewBottom) {
                World.remove(game.world, p);
                game.pool.platform.push(p);
                game.createExplosion(p.position, '#ff2200', 30);
                game.addXP(30);
                game.platforms.splice(i, 1);
                game.shake = 8;
                if (game.hud) game.hud.showFloatingText(p.position.x, p.position.y, "CRASH!", "#ff0055");
            }
        }
    }
}
