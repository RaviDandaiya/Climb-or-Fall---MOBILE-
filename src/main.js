/**
 * main.js — Game entry point.
 * Orchestrates all managers; each system lives in its own module.
 */

import Matter from 'matter-js';
import { CONFIG, THEMES, DIFFICULTY_SETTINGS, SKINS, BATTLE_PASS } from './constants.js';
import { AudioManager } from './Audio.js';
import { ParticleSystem } from './Particles.js';
import { HUDManager } from './HUD.js';
import { Renderer } from './Renderer.js';
import { ClimbMode } from './ClimbMode.js';
import { FallMode } from './FallMode.js';
import { InputManager } from './InputManager.js';
import { WorldManager } from './WorldManager.js';
import { AdManager } from './AdManager.js';

const { Engine, Render, Runner, Bodies, Composite, World, Body, Sleeping } = Matter;

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.engine = Engine.create();
        this.world = this.engine.world;

        this.render = Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: window.innerWidth,
                height: window.innerHeight,
                wireframes: false,
                background: 'transparent',
                pixelRatio: window.devicePixelRatio || 1
            }
        });

        this.player = null;
        this.platforms = [];
        this.enemies = [];
        this.activeCoins = [];
        this.powerups = [];
        this.pool = { platform: [], pillar: [], coin: [], powerup: [], enemy: [] };
        // Initialize background particles (stars/rain/etc)
        this.stars = [];
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * CONFIG.canvasWidth, // Using logical world width
                y: Math.random() * 4000,
                size: Math.random() * 3 + 1,
                opacity: Math.random()
            });
        }

        
        this.cameraY = 0;
        this.score = 0;
        this.bestHeight = parseInt(localStorage.getItem('bestHeight') ?? localStorage.getItem('bestScore')) || 0;
        localStorage.setItem('bestHeight', this.bestHeight);
        localStorage.setItem('bestScore', this.bestHeight);
        this.combo = 1;
        this.currentTheme = THEMES[0];
        this.coins = parseInt(localStorage.getItem('coins')) || 0;
        this.totalCoinsAcc = parseInt(localStorage.getItem('totalCoinsAcc')) || 0;
        this.gamesPlayed = parseInt(localStorage.getItem('gamesPlayed')) || 0;
        this.magnetTimer = 0; // Fixed: initialize magnet timer
        this.dashCooldown = 0;
        this.maxDashCooldown = 0;
        this.isDashingFrames = 0;
        this.powerUsesSinceAd = 0;
        this.hasShield = false;
        this.shake = 0;
        this.ownedSkins = this._loadOwnedSkins();
        this.activeSkinId = localStorage.getItem('activeSkin') || 'default';
        if (!this.canUseSkin(this.activeSkinId)) {
            this.activeSkinId = 'default';
            localStorage.setItem('activeSkin', this.activeSkinId);
        }
        this.claimedRewards = JSON.parse(localStorage.getItem('claimedRewards') || '[]');
        this.playerName = localStorage.getItem('playerName') || 'Survivor';

        this.isGameOver = true;
        this.gameState = 'MENU';
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = 2000;
        this.sensitivity = parseFloat(localStorage.getItem('sensitivity') || '1');
        this.controlMode = localStorage.getItem('controlMode') || 'touch';
        this.stage = 0; // Initialize stage for difficulty progression

        this.particleSystem = new ParticleSystem();
        this.hud = new HUDManager(this);
        this._modeClasses = { ClimbMode, FallMode };
        this.inputManager = new InputManager(this);
        this.worldManager = new WorldManager(this);
        this.adManager = new AdManager(this);

        this.modeStrategy = new ClimbMode(this);

        this.init();
    }

    init() {
        try {
            console.log("Game Init Sequence Start");
            this.handleResize();
            this.setupUIListeners();
            this.inputManager.setup();
            this.adManager.init();
            this._bindAudioUnlock();
            
            // Initial high score display for home screen
            this.syncHomeScore();
            
            const tick = () => {
                try {
                    if (this.gameState === 'PLAYING' && !this.isGameOver && !this.isAdPlaying) {
                        // Sub-stepping for Continuous Collision Detection (CCD) feel and stability
                        const substeps = 6;
                        const stepSize = 16.666 / substeps;
                        for (let i = 0; i < substeps; i++) {
                            Engine.update(this.engine, stepSize);
                        }
                        this.update();
                    }
                    if (this.renderer) this.renderer.render();
                } catch (err) {
                    console.error("Tick error:", err);
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);

            this.renderer = new Renderer(this);
            try { this.audioManager = new AudioManager(); } catch (err) { console.warn('Audio Init Failed', err); }

            this.hud.updateHUD();
            this.hud.renderSkins();
            this.hud.renderPass();
            this.showMainMenu();
            console.log("Game Init Sequence Complete");
        } catch (e) {
            console.error('Fatal Init Error:', e);
            this.showMenuOverlay();
        }
    }

    setupUIListeners() {
        const uiClick = () => { if(this.audioManager) { this.audioManager.resume(); this.audioManager.playUI(); } };
        
        document.getElementById('retry-button').onclick = () => {
            uiClick();
            document.getElementById('death-screen').classList.add('hidden');
            this.startGame(this.difficulty);
        };

        const reviveBtn = document.getElementById('ad-revive-btn');
        if (reviveBtn) {
            reviveBtn.onclick = () => {
                uiClick();
                if (this.adManager) {
                    this.adManager.startRevive();
                }
            };
        }

        const homeBtn = document.getElementById('home-button');
        if (homeBtn) homeBtn.onclick = () => { uiClick(); this.showMainMenu(); };

        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.onclick = () => {
                uiClick();
                // Toggle active state
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.difficulty;
            };
        });

        const startRunBtn = document.getElementById('btn-start-run');
        if (startRunBtn) {
            startRunBtn.onclick = () => {
                uiClick();
                this.startGame(this.difficulty || 'medium');
            };
        }

        document.getElementById('btn-shop').onclick = () => { uiClick(); document.getElementById('shop-screen').classList.remove('hidden'); };
        document.getElementById('btn-pass').onclick = () => { uiClick(); document.getElementById('pass-screen').classList.remove('hidden'); };
        
        const exitBtn = document.getElementById('btn-exit-game');
        if (exitBtn) {
            exitBtn.onclick = (e) => {
                if(e) e.stopPropagation();
                uiClick();
                console.log("Exit button clicked");
                this.isGameOver = true;
                this.gameState = 'MENU';
                this.showMainMenu();
            };
        }

        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = () => { uiClick(); btn.parentElement.classList.add('hidden'); };
        });

        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
            nameInput.oninput = (e) => {
                this.playerName = e.target.value || 'Survivor';
                localStorage.setItem('playerName', this.playerName);
            };
        }

        const sensSlider = document.getElementById('sensitivity-slider');
        const sensValue = document.getElementById('sensitivity-value');
        if (sensSlider) {
            sensSlider.value = this.sensitivity;
            if(sensValue) sensValue.innerText = `${Math.round(this.sensitivity * 100)}%`;
            sensSlider.oninput = (e) => {
                this.sensitivity = parseFloat(e.target.value) || 1;
                localStorage.setItem('sensitivity', this.sensitivity);
                if(sensValue) sensValue.innerText = `${Math.round(this.sensitivity * 100)}%`;
            };
        }
    }

    handleResize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.renderer) this.renderer.handleResize();
    }

    showMenuOverlay() {
        const overlay = document.getElementById('difficulty-screen');
        if (overlay) overlay.classList.remove('hidden');
    }

    showMainMenu() {
        this.gameState = 'MENU';
        this.isGameOver = true;
        this.showMenuOverlay();
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('ui-overlay').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        document.getElementById('side-nav').classList.remove('hidden');
        document.body.classList.add('menu-open');
        
        this.syncHomeScore();
    }

    startGame(diff) {
        console.log("Starting run with difficulty:", diff);
        this.difficulty = diff || 'medium';
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        
        this.score = 0;
        this.combo = 1;
        this.isGameOver = false;
        this.gameState = 'PLAYING';
        this.powerUsesSinceAd = 0;
        this.dashCooldown = 0;
        this.isDashingFrames = 0;
        this.hasShield = false;
        this.magnetTimer = 0;
        this.isAdPlaying = false;
        this.jumpDebounce = false;
        this.shake = 0;
        
        document.getElementById('difficulty-screen').classList.add('hidden');
        document.getElementById('ui-overlay').classList.remove('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('side-nav').classList.add('hidden');
        document.body.classList.remove('menu-open');
        
        // Setup Physics World
        Composite.clear(this.world);
        this.world.gravity.y = 1.35;
        this.cameraY = 0;
        this._isResettingCamera = true;
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = this.modeStrategy.getLavaStartHeight();
        
        this.platforms = [];
        this.enemies = [];
        this.activeCoins = [];
        this.powerups = [];
        
        this.createPlayer();
        this.worldManager.createStartPlatform();
        this.worldManager.generateInitialPlatforms(settings);
        
        this.inputManager.reset();
        this.gamesPlayed++;
        localStorage.setItem('gamesPlayed', this.gamesPlayed);
        
        if (this.audioManager) this.audioManager.playStart();
        this.setupCollisionDetection();
        this.updatePowerButtonUI();
        this.hud.updateHUD();
    }

    setupCollisionDetection() {
        const { Events } = Matter;
        if (this._collisionHandler) {
            Events.off(this.engine, 'collisionStart', this._collisionHandler);
        }

        this._collisionHandler = (event) => {
            if (this.isGameOver) return;
            for (const pair of event.pairs) {
                const labels = [pair.bodyA.label, pair.bodyB.label];
                const bodies = [pair.bodyA, pair.bodyB];
                const playerIndex = labels.indexOf('player');
                
                if (playerIndex === -1) continue;

                const otherBody = bodies[1 - playerIndex];
                const otherLabel = labels[1 - playerIndex];
                const isEnemy = otherLabel === 'enemy' || otherLabel.startsWith('enemy');

                // 1. Hazard / Enemy Collision
                if (otherLabel === 'hazard' || isEnemy || (otherLabel === 'pillar' && otherBody.isHazard)) {
                    if (this.isDashingFrames > 0 || this.hasShield) {
                        if (isEnemy) {
                            this.worldManager.destroyEnemy && this.worldManager.destroyEnemy(otherBody);
                        }
                        this.hasShield = false; 
                    } else {
                        this.triggerDeath(isEnemy ? "HIT AN ENEMY" : "TOUCHED A HAZARD");
                    }
                }

                // 2. Coin Collection
                if (otherLabel === 'coin') {
                    if (this.worldManager.collectCoin) this.worldManager.collectCoin(otherBody);
                    else {
                        // Inline fallback if method missing
                        this.coins++;
                        this.totalCoinsAcc++;
                        localStorage.setItem('coins', this.coins);
                        localStorage.setItem('totalCoinsAcc', this.totalCoinsAcc);
                        Matter.World.remove(this.world, otherBody);
                        this.activeCoins = this.activeCoins.filter(c => c !== otherBody);
                        this.pool.coin.push(otherBody);
                        if (this.audioManager) this.audioManager.playCoin && this.audioManager.playCoin();
                    }
                }

                // 3. Powerup Collection
                if (otherLabel === 'powerup') {
                    if (this.worldManager.collectPowerup) this.worldManager.collectPowerup(otherBody);
                    else {
                        // Inline fallback
                        const type = otherBody.powerupType;
                        if (type === 'shield') this.hasShield = true;
                        if (type === 'magnet') this.magnetTimer = 600;
                        Matter.World.remove(this.world, otherBody);
                        this.powerups = this.powerups.filter(p => p !== otherBody);
                        this.pool.powerup.push(otherBody);
                        if (this.audioManager?.playPowerup) this.audioManager.playPowerup();
                    }
                }
            }
        };

        Events.on(this.engine, 'collisionStart', this._collisionHandler);
    }

    createPlayer() {
        const startY = this.modeStrategy.getPlayerStartY();
        // Rectangular collider with chamfer for better stability on platforms
        const pw = CONFIG.playerRadius * 1.8;
        const ph = CONFIG.playerRadius * 2.0;

        this.player = Bodies.rectangle(CONFIG.canvasWidth / 2, startY, pw, ph, {
            friction: 0.002,
            frictionAir: 0.01,
            restitution: 0.05,
            slop: 0.01,
            chamfer: { radius: 10 },
            label: 'player',
            render: { visible: false }
        });
        World.add(this.world, this.player);
    }

    update() {
        if (this.isGameOver) return;
        
        // --- MOVEMENT & INPUT ---
        this.inputManager.updateTilt();
        let impulseX = 0;
        const jumpForce = -23.0; // Standard jump
        
        // Adjusted horizontal force: 7.5 provides a tight, responsive platformer speed.
        const horizForce = 7.5 * this.sensitivity; 
        // Stricter onGround check to prevent "infinite jumping" or floaty peaks
        const onGround = Math.abs(this.player.velocity.y) < 1.5;

        // --- HORIZONTAL MOVEMENT ---
        if (this.controlMode === 'tilt') {
            const maxMult = this.modeStrategy.getTiltSettings ? this.modeStrategy.getTiltSettings().maxMult : 1.5;
            const tiltSens = this.modeStrategy.getTiltSettings ? this.modeStrategy.getTiltSettings().sens : 15;
            const normGamma = Math.max(-maxMult, Math.min(maxMult, this.inputManager.smoothedGamma / tiltSens));
            const targetVx = normGamma * 6.5 * this.sensitivity;
            this.inputManager.vx += (targetVx - this.inputManager.vx) * 0.2;
            Body.setVelocity(this.player, { x: this.inputManager.vx, y: this.player.velocity.y });
        } else {
            // Touch Mode & Keyboard Fallback shared logic
            const isLeft = this.inputManager.keys['ArrowLeft'] || this.inputManager.keys['KeyA'];
            const isRight = this.inputManager.keys['ArrowRight'] || this.inputManager.keys['KeyD'];
            
            if (isLeft) {
                Body.setVelocity(this.player, { x: -horizForce, y: this.player.velocity.y });
            } else if (isRight) {
                Body.setVelocity(this.player, { x: horizForce, y: this.player.velocity.y });
            } else {
                // Instantly damp horizontal friction so there's no icy slide!
                Body.setVelocity(this.player, { x: this.player.velocity.x * 0.6, y: this.player.velocity.y });
            }
        }

        // --- JUMP LOGIC (Unified for all inputs) ---
        const jumpPressed = this.inputManager.consume('TapJumpDirect') || 
                            this.inputManager.consume('Space') || 
                            this.inputManager.consume('ArrowUp') || 
                            this.inputManager.consume('KeyW') ||
                            this.inputManager.consume('TouchJump');

        if (jumpPressed) {
            if (this.modeStrategy.handleJump) {
                this.modeStrategy.handleJump(this, onGround, jumpForce, 0);
            }
        }

        // Screen wrap-around
        if (this.player.position.x < -CONFIG.playerRadius) {
            Body.setPosition(this.player, { x: CONFIG.canvasWidth + CONFIG.playerRadius, y: this.player.position.y });
        } else if (this.player.position.x > CONFIG.canvasWidth + CONFIG.playerRadius) {
            Body.setPosition(this.player, { x: -CONFIG.playerRadius, y: this.player.position.y });
        }

        // Cooldowns
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.isDashingFrames > 0) this.isDashingFrames--;
        if (this.magnetTimer > 0) this.magnetTimer--; // Fixed: decrement magnet duration

        this.updatePowerButtonUI();

        // Power Dash (⚡)
        const powerDashPressed = this.inputManager.consume('PowerDash');
        if (powerDashPressed && this.dashCooldown <= 0) {
            const dashVx = this.player.velocity.x > 0 ? horizForce * 2 : -horizForce * 2;
            if (this.powerUsesSinceAd < 3) {
                if (this.modeStrategy.handleDash) {
                    this.modeStrategy.handleDash(this, dashVx);
                    this.powerUsesSinceAd++;
                }
            } else {
                if (this.adManager) this.adManager.startPowerAd(dashVx);
            }
        }
        // --- END MOVEMENT & INPUT ---

        this.modeStrategy.update(this);
        this.worldManager.updatePlatforms();
        this.worldManager.updateEnemies();
        this.worldManager.updateMagnets();
        this.worldManager.cullAndGenerate();
        
        if (this.score > this.bestHeight) {
            this.bestHeight = this.score;
            localStorage.setItem('bestHeight', this.bestHeight);
            localStorage.setItem('bestScore', this.bestHeight);
            this.syncHomeScore();
        }

        // --- PROGRESSION ---
        // Increment stage every 100 points to scale difficulty and enemies
        this.stage = Math.floor(this.score / 100);
        
        this.hud.updateHUD();
    }

    triggerDeath(reason) {
        if (this.isGameOver) return;
        
        // Shield Protection for environmental deaths
        if (this.hasShield) {
            this.hasShield = false;
            this.shake = 20;
            this.createExplosion(this.player.position, '#00d1ff', 25);
            // Leap up slightly to escape the hazard
            Body.setVelocity(this.player, { x: 0, y: -20 });
            if (this.audioManager) this.audioManager.playPowerup && this.audioManager.playPowerup();
            return;
        }

        console.log(`DEATH TRIGGERED! Reason: ${reason} | PlayerY: ${Math.round(this.player.position.y)} | LavaY: ${Math.round(this.lavaHeight)}`);
        this.isGameOver = true;
        this.gameState = 'GAME_OVER';
        
        const rEl = document.getElementById('death-reason');
        if (rEl) rEl.innerText = reason;
        
        document.getElementById('death-screen').classList.remove('hidden');
        document.getElementById('ui-overlay').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        if (this.audioManager) {
            if (this.audioManager.playDeath) this.audioManager.playDeath();
            else if (this.audioManager.playGameOver) this.audioManager.playGameOver();
        }
    }

    handleAdReward() {
        this.isAdPlaying = false; // Unpause physics
        if (this.gameState === 'GAME_OVER') {
            this.isGameOver = false;
            this.gameState = 'PLAYING';
            // Pop the player up slightly to prevent instant death and zero momentum
            Body.setVelocity(this.player, { x: 0, y: 0 });
            Body.setPosition(this.player, { x: this.player.position.x, y: this.player.position.y - 300 });
            
            // Push lava down immediately gives them time to land
            this.lavaHeight = this.player.position.y + 600; 

            // Restore HUD
            document.getElementById('death-screen').classList.add('hidden');
            document.getElementById('ui-overlay').classList.remove('hidden');
            if (this.controlMode === 'touch') document.getElementById('mobile-controls').classList.remove('hidden');
        }
    }

    addXP(amt) { /* Placeholder for level up logic */ }
    addScoreBonus(amt) { this.score += amt; }
    createExplosion(pos, color, count) { this.particleSystem.createExplosion(pos, color, count); }
    createParticles(pos, color, count) { this.particleSystem.createExplosion(pos, color, count); }
    playJump() { if (this.audioManager?.playJump) this.audioManager.playJump(); }
    playPowerup() {
        if (this.audioManager?.playPowerup) this.audioManager.playPowerup();
        else if (this.audioManager?.playPowerPickup) this.audioManager.playPowerPickup();
    }
    _playTone(freq, type = 'sine', when = 0, duration = 0.08) {
        if (this.audioManager?._playTone) this.audioManager._playTone(freq, type, when, duration);
    }

    claimReward(id) {
        const reward = BATTLE_PASS.find((p) => p.id === id);
        if (!reward || this.claimedRewards.includes(id) || !reward.isUnlocked(this)) return;

        this.claimedRewards = [...this.claimedRewards, id];
        this.coins += reward.rewardAmount;
        this.totalCoinsAcc += reward.rewardAmount;

        localStorage.setItem('claimedRewards', JSON.stringify(this.claimedRewards));
        localStorage.setItem('coins', this.coins);
        localStorage.setItem('totalCoinsAcc', this.totalCoinsAcc);

        if (this.audioManager?.playLevelUp) this.audioManager.playLevelUp();
        this.hud.updateHUD();
        this.hud.renderPass();
    }

    syncHomeScore() {
        const el = document.getElementById('home-best-score');
        if (el) el.innerText = String(this.bestHeight);
    }

    updatePowerButtonUI() {
        const powerBtn = document.getElementById('btn-power');
        if (!powerBtn) return;

        const overlay = powerBtn.querySelector('.dash-cooldown-overlay');
        const isCoolingDown = this.dashCooldown > 0 && this.maxDashCooldown > 0;
        const needsAd = !isCoolingDown && this.powerUsesSinceAd >= 3;
        const rechargeProgress = isCoolingDown
            ? Math.max(0, Math.min(1, 1 - (this.dashCooldown / this.maxDashCooldown)))
            : 1;

        powerBtn.classList.toggle('recharging', isCoolingDown);
        powerBtn.classList.toggle('ad-required', needsAd);
        powerBtn.disabled = isCoolingDown;
        powerBtn.setAttribute('aria-disabled', String(isCoolingDown));

        if (overlay) {
            if (isCoolingDown) {
                const darkAngle = (1 - rechargeProgress) * 360;
                overlay.style.opacity = '1';
                overlay.style.background = `conic-gradient(from -90deg, rgba(0, 0, 0, 0.72) 0deg ${darkAngle}deg, rgba(0, 0, 0, 0.06) ${darkAngle}deg 360deg)`;
            } else {
                overlay.style.opacity = '0';
                overlay.style.background = '';
            }
        }
    }

    setActiveSkin(skinId) {
        const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
        if (!this.canUseSkin(skin.id)) return false;
        this.activeSkinId = skin.id;
        localStorage.setItem('activeSkin', skin.id);
        if (this.hud) this.hud.renderSkins();
        return true;
    }

    _loadOwnedSkins() {
        try {
            const parsed = JSON.parse(localStorage.getItem('ownedSkins') || '["default"]');
            const owned = Array.isArray(parsed) ? parsed.filter(Boolean) : ['default'];
            return Array.from(new Set(['default', ...owned]));
        } catch {
            return ['default'];
        }
    }

    isSkinOwned(skinId) {
        return Array.isArray(this.ownedSkins) && this.ownedSkins.includes(skinId);
    }

    canUseSkin(skinId) {
        const skin = SKINS.find((s) => s.id === skinId);
        if (!skin) return false;
        if (skin.unlockMode === 'coins') return this.isSkinOwned(skin.id);
        return skin.isUnlocked(this);
    }

    purchaseSkin(skinId) {
        const skin = SKINS.find((s) => s.id === skinId);
        if (!skin || skin.unlockMode !== 'coins' || this.isSkinOwned(skin.id)) return false;
        if (this.coins < skin.cost) return false;

        this.coins -= skin.cost;
        this.ownedSkins = Array.from(new Set([...this.ownedSkins, skin.id]));
        localStorage.setItem('coins', this.coins);
        localStorage.setItem('ownedSkins', JSON.stringify(this.ownedSkins));
        if (this.audioManager?.playLevelUp) this.audioManager.playLevelUp();
        this.setActiveSkin(skin.id);
        this.hud.updateHUD();
        return true;
    }

    _bindAudioUnlock() {
        const unlock = () => {
            if (this.audioManager) this.audioManager.resume();
            window.removeEventListener('pointerdown', unlock);
        };
        window.addEventListener('pointerdown', unlock);
    }
}

window.onload = () => {
    window.game = new Game();
};
