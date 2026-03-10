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
}
