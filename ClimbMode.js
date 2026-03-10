import Matter from 'matter-js';
import { CONFIG, DIFFICULTY_SETTINGS } from './constants.js';

const { Bodies, Body, World } = Matter;

export class ClimbMode {
    constructor(game) {
        this.game = game;
        this.name = 'climb';
    }

    getLavaStartHeight() {
        return CONFIG.canvasHeight + 1200;
    }

    getPlayerStartY() {
        return CONFIG.canvasHeight - 150;
    }

    getFloorY() {
        return CONFIG.canvasHeight + 100;
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
        let nextY = platforms.length ? platforms.reduce((m, p) => Math.min(m, p.position.y), Infinity) : playerY;
        const checkDist = (playerY < nextY + 2500);
        if (!checkDist) return null;
        return nextY - (settings.gapHeight * (0.8 + Math.random() * 0.9));
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

    handleJump(game, onGround, jumpForce) {
        if (onGround && !game.jumpDebounce) {
            Body.setVelocity(game.player, { x: game.player.velocity.x, y: jumpForce });
            game.createExplosion({ x: game.player.position.x, y: game.player.position.y + 16 }, '#ffffff', 10);
            game.playJump();
            game.jumpDebounce = true;
            setTimeout(() => game.jumpDebounce = false, 200);
        }
    }

    handleDash(game, targetVx) {
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
            if (p.label === 'hazard' && p.position.y > viewTop && p.position.y < viewBottom) {
                World.remove(game.world, p);
                if (p.label === 'pillar') game.pool.pillar.push(p);
                else game.pool.platform.push(p);
                game.createExplosion(p.position, '#ff2200', 30);
                game.addXP(30);
                game.platforms.splice(i, 1);
            }
        }
    }
}
