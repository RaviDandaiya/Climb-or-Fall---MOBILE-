/**
 * main.js — Game entry point.
 * Orchestrates all managers; each system lives in its own module.
 *
 * Module Map:
 *   InputManager.js   — keyboard, touch, tilt, canvas-tap input
 *   WorldManager.js   — platform / coin / powerup / enemy creation & culling
 *   AdManager.js      — Unity Ads lifecycle
 *   Renderer.js       — canvas drawing
 *   Particles.js      — particle pool
 *   Audio.js          — Web Audio tones
 *   HUD.js            — DOM-based HUD, shop, pass
 *   ClimbMode.js      — climb mode strategy
 *   FallMode.js       — fall mode strategy
 *   constants.js      — shared config, themes, skins
 */

import Matter from 'matter-js';
import { CONFIG, THEMES, DIFFICULTY_SETTINGS, SKINS, BATTLE_PASS as imports_BATTLE_PASS } from './constants.js';
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

// ════════════════════════════════════════════════════════════════
//  GAME CLASS
// ════════════════════════════════════════════════════════════════

class Game {
    constructor() {
        // ── Canvas & Physics ────────────────────────────────────
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

        this.runner = Runner.create();

        // ── Player & World State ────────────────────────────────
        this.player = null;
        this.platforms = [];
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.scoreBonus = 0;
        this.score = 0;
        this.bestHeight = parseInt(localStorage.getItem('bestHeight')) || 0;
        this.combo = 1;
        this.stage = 0;
        this.currentTheme = THEMES[0];

        // ── Progression ─────────────────────────────────────────
        this.coins = parseInt(localStorage.getItem('coins')) || 0;
        this.totalCoinsAcc = parseInt(localStorage.getItem('totalCoinsAcc')) || 0;
        this.gamesPlayed = parseInt(localStorage.getItem('gamesPlayed')) || 0;
        this.activeSkinId = localStorage.getItem('activeSkin') || 'default';
        
        try {
            this.claimedRewards = JSON.parse(localStorage.getItem('claimedRewards')) || [];
        } catch (e) {
            this.claimedRewards = [];
        }
        
        this.revivesLeft = Infinity;
        this.playerName = localStorage.getItem('playerName') || 'Survivor';

        // ── Game State ──────────────────────────────────────────
        this.isGameOver = true;
        this.gameState = null;   // 'PLAYING' | 'DEATH_ANIMATION' | 'GAME_OVER' | 'MENU'
        this.timeScale = 1.0;
        this.shake = 0;
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;
        this.controlMode = localStorage.getItem('controlMode') || 'touch';
        this.gameMode = 'climb';

        // ── Powerups ────────────────────────────────────────────
        this.hasShield = false;
        this.magnetTimer = 0;
        this.powerups = [];
        this._lavaWarned = false;

        // ── Dash / Ability State ────────────────────────────────
        this.dashCooldown = 0;
        this.isDashingFrames = 0;

        // ── Visual ──────────────────────────────────────────────
        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * CONFIG.canvasWidth,
            y: Math.random() * CONFIG.canvasHeight,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.7 + 0.3
        }));
        this.activeCoins = [];
        this.pool = { platform: [], pillar: [], coin: [], powerup: [], enemy: [] };
        this.enemies = [];

        // ── Managers ────────────────────────────────────────────
        this.particleSystem = new ParticleSystem();
        this.hud = new HUDManager(this);
        this.inputManager = new InputManager(this);
        this.worldManager = new WorldManager(this);
        this.adManager = new AdManager(this);

        // Pass mode classes so InputManager can create them for mode toggles
        this._modeClasses = { ClimbMode, FallMode };
        this.modeStrategy = new ClimbMode(this);

        // ── Boot ────────────────────────────────────────────────
        this.init();
    }

    // ════════════════════════════════════════════════════════════
    //  INITIALIZATION
    // ════════════════════════════════════════════════════════════

    init() {
        try {
            if (window.innerWidth === 0) { setTimeout(() => this.init(), 100); return; }

            this.updateHUD();
            this.setupUIListeners();
            this.inputManager.setup();
            this.renderSkins();
            this.renderPass();

            this.world.gravity.y = 1.35;
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.handleResize();

            // Game loop
            this.lastTime = performance.now();
            const tick = (time) => {
                if (!time) time = performance.now();
                this.lastTime = time;

                // Time-scale (slow-mo on death)
                if (this.freezeEnd && time < this.freezeEnd) {
                    this.timeScale = 0.15;
                } else {
                    this.timeScale = 1.0;
                }

                if (this.gameState === 'PLAYING' && this.player && !this.isAdPlaying) {
                    Engine.update(this.engine, 16.666 * this.timeScale);
                    this.update();
                    this.createCuteTrail();
                } else if (this.gameState === 'DEATH_ANIMATION' && this.player) {
                    if (this.modeStrategy.name !== 'fall') {
                        Engine.update(this.engine, 16.666 * this.timeScale);
                        Body.setAngle(this.player, this.player.angle + 0.15 * this.timeScale);
                        Body.applyForce(this.player, this.player.position, { x: 0, y: 0.005 * this.timeScale });
                        if (time - this.deathTimerAnim > 1800) this.showGameOverUI();
                    } else {
                        // Immediately show Game Over in fall mode without delay
                        this.showGameOverUI();
                    }
                }

                this.renderWorldManual();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);

            this.renderer = new Renderer(this);
            try { this.audioManager = new AudioManager(); } catch (err) { console.warn('audio init fail', err); }

            this.showMenu();
        } catch (e) {
            console.error('Initialization Error:', e);
            document.getElementById('difficulty-screen').classList.remove('hidden');
        }
    }

    // ════════════════════════════════════════════════════════════
    //  UI LISTENERS (non-input: retry, shop, pass, name, etc.)
    // ════════════════════════════════════════════════════════════

    setupUIListeners() {
        // Retry
        document.getElementById('retry-button').onclick = () => {
            document.getElementById('death-screen').classList.add('hidden');
            document.getElementById('retry-button').style.transform = '';
            document.getElementById('death-screen').style.opacity = '1';
            this.startGame(this.difficulty);
        };

        // Home
        const homeBtn = document.getElementById('home-button');
        if (homeBtn) homeBtn.onclick = () => this.showMainMenu();

        // Difficulty
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.onclick = () => this.startGame(btn.dataset.difficulty);
        });

        // Shop / Pass / Close
        document.getElementById('btn-shop').onclick = () => document.getElementById('shop-screen').classList.remove('hidden');
        document.getElementById('btn-pass').onclick = () => document.getElementById('pass-screen').classList.remove('hidden');
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = () => btn.parentElement.classList.add('hidden');
        });

        // Ad revive
        document.getElementById('ad-revive-btn').onclick = () => this.adManager.startRevive();

        // Player name
        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
            nameInput.oninput = (e) => {
                this.playerName = e.target.value || 'Survivor';
                localStorage.setItem('playerName', this.playerName);
                this.updateHUD();
            };
        }


        // Resize
        window.addEventListener('resize', () => this.handleResize());
    }

    // ════════════════════════════════════════════════════════════
    //  HUD DELEGATES
    // ════════════════════════════════════════════════════════════

    showMenu() { this.hud.showMenu(); }
    showMainMenu() {
        this.gameState = 'MENU';
        this.isGameOver = true;
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('difficulty-screen').classList.remove('hidden');
        this.hud.updateHUD();
    }
    updateHUD() { this.hud.updateHUD(); }
    renderSkins() { this.hud.renderSkins(); }
    renderPass() { this.hud.renderPass(); }
    showLevelUpToast(level) { this.hud.showLevelUpToast(level); }

    // ════════════════════════════════════════════════════════════
    //  GAME LIFECYCLE
    // ════════════════════════════════════════════════════════════

    startGame(diff) {
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = this.modeStrategy.getLavaStartHeight();
        this.isGameOver = false;
        this.gameState = 'PLAYING';
        this.revivesLeft = 2;
        document.getElementById('difficulty-screen').classList.add('hidden');
        window.focus();

        Composite.clear(this.world);
        this.engine.world.gravity.y = 1.35;
        this.cameraY = 0;
        this._isResettingCamera = true;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.scoreBonus = 0;
        this.score = 0;
        this.combo = 1;
        this.powerUsesThisRun = 0;
        this.isAdPlaying = false;
        this.inputManager.reset();
        
        this.gamesPlayed++;
        localStorage.setItem('gamesPlayed', this.gamesPlayed);
        
        this.updateHUD();

        this.platforms = [];
        this.enemies = [];
        this.particleSystem.particles = [];
        this.dashCooldown = 0;
        this.isDashingFrames = 0;
        this.createPlayer();
        this.worldManager.createStartPlatform();
        this.worldManager.generateInitialPlatforms(settings);
        Body.setStatic(this.player, false);
        try { Sleeping.set(this.player, false); } catch (_) {}
    }

    createPlayer() {
        const startY = this.modeStrategy.getPlayerStartY();
        this.player = Bodies.circle(CONFIG.canvasWidth / 2, startY, CONFIG.playerRadius, {
            friction: 0.001,
            restitution: 0.1,
            label: 'player',
            render: { visible: false }
        });
        World.add(this.world, this.player);
    }

    // ════════════════════════════════════════════════════════════
    //  MAIN UPDATE LOOP (called each PLAYING frame)
    // ════════════════════════════════════════════════════════════

    update() {
        if (this.isGameOver) return;
        
        // Debug logging for developer (only once a second)
        if (Math.floor(performance.now() / 1000) > (this._lastLogTime || 0)) {
            console.log(`Game Loop: ${this.gameState}, Mode: ${this.modeStrategy.name}, PlayerY: ${this.player?.position?.y?.toFixed(1)}, Score: ${this.score}`);
            this._lastLogTime = Math.floor(performance.now() / 1000);
        }

        this.handleInput();
        this.updateStats();
        this.updateWorld();
        this.checkLavaProximity();
        this.worldManager.updatePlatforms();
        this.worldManager.updateEnemies();
        this.checkCollisions();
        this.worldManager.cullAndGenerate();

        if (this.modeStrategy.updateFallMechanics) {
            this.modeStrategy.updateFallMechanics(this);
        }

        this.updateCooldownUI();
        this.updateMagnet();
        this.updateWalls();

        if (this.shake > 0) this.shake *= 0.9;
        this.checkAbyss();
    }

    // ── Sub-updates ─────────────────────────────────────────────

    updateCooldownUI() {
        const btnPower = document.getElementById('btn-power');
        if (btnPower) {
            const maxDash = this.maxDashCooldown || 120;
            const dashVal = this.dashCooldown > 0 ? this.dashCooldown : 0;
            btnPower.style.setProperty('--cd-pct', `${100 - (dashVal / maxDash) * 100}%`);
            
            if (this.powerUsesThisRun > 0) {
                btnPower.innerHTML = '<span class="ads-neon">ADS</span><span style="font-size: 0.9em;">⚡</span>';
                btnPower.classList.add('needs-ad');
            } else {
                btnPower.innerHTML = '⚡';
                btnPower.classList.remove('needs-ad');
            }
        }
        const btnJump = document.getElementById('btn-jump');
        if (btnJump) {
            if (this.modeStrategy.name === 'fall') {
                const maxBrake = this.modeStrategy.maxBrakeCooldown || 100;
                const brakeVal = this.modeStrategy.brakeCooldown > 0 ? this.modeStrategy.brakeCooldown : 0;
                btnJump.style.setProperty('--cd-pct', `${100 - (brakeVal / maxBrake) * 100}%`);
            } else {
                btnJump.style.setProperty('--cd-pct', '100%');
            }
        }
    }

    updateMagnet() {
        if (this.magnetTimer <= 0) return;
        this.magnetTimer--;
        Composite.allBodies(this.world).forEach(b => {
            if (b.label === 'coin') {
                const dx = this.player.position.x - b.position.x;
                const dy = this.player.position.y - b.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 250) {
                    const force = (250 - dist) / 2500;
                    Body.translate(b, { x: dx * force * 2, y: dy * force * 2 });
                }
            }
        });
    }

    checkLavaProximity() {
        if (!this.player) return;
        const distance = this.lavaHeight - this.player.position.y;
        if (distance < 450 && !this._lavaWarned) {
            this._lavaWarned = true;
            this.playLavaWarning();
        } else if (distance > 650 && this._lavaWarned) {
            this._lavaWarned = false;
        }
    }

    updateWalls() {
        if (this.player && this.leftWall && this.rightWall) {
            Body.setPosition(this.leftWall, { x: 10, y: this.player.position.y });
            Body.setPosition(this.rightWall, { x: CONFIG.canvasWidth - 10, y: this.player.position.y });
        }
    }

    checkAbyss() {
        const abyssDead = this.modeStrategy.getAbyssCondition();
        if (this.player && abyssDead) {
            if (this.hasShield) {
                this.consumeShield();
                Body.setVelocity(this.player, { x: 0, y: this.modeStrategy.getAbyssReviveVelocity() });
            } else {
                this.triggerDeath(this.modeStrategy.getAbyssDeathMessage());
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    //  INPUT HANDLING
    // ════════════════════════════════════════════════════════════

    handleInput() {
        if (this.isGameOver || !this.player) return;
        const keys = this.inputManager.keys;
        const vel = this.player.velocity;
        const baseSpeed = CONFIG.moveSpeed;
        const jumpForce = CONFIG.jumpForce * (this.isClimbing ? 0.7 : 1);

        const onGround = [-15, 0, 15].some(off =>
            Matter.Query.ray(
                Composite.allBodies(this.world).filter(b => b.label === 'platform' || b.label === 'floor'),
                { x: this.player.position.x + off, y: this.player.position.y },
                { x: this.player.position.x + off, y: this.player.position.y + CONFIG.playerRadius + 5 }
            ).length > 0
        );

        // Smooth horizontal movement
        const im = this.inputManager;
        const accel = 0.8;
        const friction = 0.85;

        if (keys['ArrowLeft'] || keys['KeyA']) {
            im.vx -= accel;
        } else if (keys['ArrowRight'] || keys['KeyD']) {
            im.vx += accel;
        } else if (this.controlMode === 'tilt' && im.gyroGamma !== 0) {
            im.updateTilt();
            const tiltSettings = this.modeStrategy.getTiltSettings();
            const tiltVal = Math.sign(im.smoothedGamma) * Math.min(tiltSettings.maxMult, Math.abs(im.smoothedGamma) / tiltSettings.sens);
            im.vx += tiltVal * accel;
        } else {
            im.vx *= friction;
        }
        im.vx = Math.max(-baseSpeed, Math.min(baseSpeed, im.vx));

        // Dash
        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.isDashingFrames > 0) {
            this.isDashingFrames--;
            this.createCuteTrail();
        }
        if ((keys['PowerDash'] || keys['KeyE'] || keys['ShiftLeft']) && this.dashCooldown <= 0) {
            keys['PowerDash'] = false; keys['KeyE'] = false; keys['ShiftLeft'] = false;
            if (this.powerUsesThisRun === 0) {
                this.powerUsesThisRun++;
                this.modeStrategy.handleDash(this, im.vx);
            } else {
                this.adManager.startPowerAd();
            }
        }

        // Apply velocity
        if (Math.abs(im.vx) > 0.1) {
            Body.setVelocity(this.player, { x: im.vx, y: vel.y });
        } else {
            Body.setVelocity(this.player, { x: vel.x * 0.9, y: vel.y });
        }

        // Landing juice
        if (onGround && this.wasFallingLastFrame) {
            this.shake = Math.min(this.shake + 3, 10);
            this.createExplosion({ x: this.player.position.x, y: this.player.position.y + 16 }, '#ffffff', 8);
        }
        this.wasFallingLastFrame = !onGround && vel.y > 0;

        // Jump
        if (keys['TouchJump'] || keys['Space'] || keys['ArrowUp']) {
            this.modeStrategy.handleJump(this, onGround, jumpForce);
        }
    }

    // ════════════════════════════════════════════════════════════
    //  COLLISIONS
    // ════════════════════════════════════════════════════════════

    checkCollisions() {
        if (!this.player) return;
        const collisions = Matter.Query.collides(this.player, Composite.allBodies(this.world));
        collisions.forEach(collision => {
            const other = collision.bodyA === this.player ? collision.bodyB : collision.bodyA;

            if (other.label === 'coin') { this.collectCoin(other); return; }
            if (other.label === 'powerup') { this.collectPowerup(other); return; }

            // Invincible during dash
            if (this.isDashingFrames > 0 && (other.label === 'enemy' || other.label === 'hazard' || other.label === 'pillar')) return;

            if (other.label === 'enemy' || (other.label === 'hazard' && this.player.velocity.y > 0)) {
                if (this.hasShield) {
                    this.consumeShield();
                    if (other.label === 'enemy') {
                        World.remove(this.world, other);
                        const idx = this.enemies.indexOf(other);
                        if (idx > -1) this.enemies.splice(idx, 1);
                        this.pool.enemy.push(other);
                    }
                } else {
                    this.triggerDeath(other.label === 'enemy' ? 'SLAIN BY A FOE' : 'CATASTROPHE');
                }
            } else if (other.label === 'crusher') {
                if (this.hasShield) {
                    this.consumeShield();
                    Body.setVelocity(this.player, { x: 0, y: -20 });
                } else {
                    this.triggerDeath('CRUSHED TO DUST');
                }
            } else if (other.label === 'platform' || other.label === 'pillar') {
                this.combo = 1;
                this.updateHUD();
            } else if (other.label === 'glass' && this.player.velocity.y > 0) {
                this.createExplosion(other.position, '#aaddff', 40);
                this.shake = 25;
                Body.setVelocity(this.player, { x: this.player.velocity.x, y: 35 });
                World.remove(this.world, other);
                const idx = this.platforms.indexOf(other);
                if (idx > -1) this.platforms.splice(idx, 1);
                this.pool.platform.push(other);
                this._playTone(1200, 'square', 0, 0.1);
            } else if (other.label === 'platform' && other.isCrumbling && this.player.velocity.y > 0) {
                if (other.crumbleTimer === 0) other.crumbleTimer = performance.now();
            }
        });
    }

    // ════════════════════════════════════════════════════════════
    //  COLLECTIBLES & POWERUPS
    // ════════════════════════════════════════════════════════════

    collectCoin(coin) {
        this.coins += 5;
        this.totalCoinsAcc += 5;
        this.updateHUD();
        this.createParticles(coin.position, '#ffcc00', 8);
        World.remove(this.world, coin);
        const idx = this.activeCoins.indexOf(coin);
        if (idx > -1) this.activeCoins.splice(idx, 1);
        this.pool.coin.push(coin);
        localStorage.setItem('coins', this.coins);
        localStorage.setItem('totalCoinsAcc', this.totalCoinsAcc);
        this.playCoin();
    }

    collectPowerup(p) {
        if (p.powerupType === 'shield') {
            this.hasShield = true;
            this.createExplosion(p.position, '#00d1ff', 20);
            this.playShield();
        } else if (p.powerupType === 'magnet') {
            this.magnetTimer = 600;
            this.createExplosion(p.position, '#ff3e3e', 20);
            this.playMagnet();
        } else if (p.powerupType === 'anchor') {
            this.anchorTimer = 300;
            this.createExplosion(p.position, '#444444', 30);
            this.playPowerPickup();
        }
        World.remove(this.world, p);
        this.powerups = this.powerups.filter(item => item !== p);
        this.pool.powerup.push(p);
    }

    consumeShield() {
        this.hasShield = false;
        this.createExplosion(this.player.position, '#00d1ff', 30);
        this._playTone(220, 'sawtooth', 0, 0.3);
    }

    // ════════════════════════════════════════════════════════════
    //  SCORING & PROGRESSION
    // ════════════════════════════════════════════════════════════

    updateStats() {
        const startY = this.modeStrategy.getPlayerStartY();
        let rawH = 0;
        if (this.modeStrategy.name === 'fall') {
            rawH = (this.player.position.y - startY) / 10;
        } else {
            rawH = (startY - this.player.position.y) / 10;
        }
        const h = rawH < 2 ? 0 : Math.floor(rawH);
        this.currentHeight = h;
        this.score = this.currentHeight + this.scoreBonus;

        if (this.score > this.maxHeight) {
            this.maxHeight = this.score;
            const newStage = Math.floor(this.maxHeight / 150);
            if (newStage > this.stage) { this.stage = newStage; this.levelUpTwist(this.stage); }
        }
        document.getElementById('height-value').innerText = this.score;
    }

    addScoreBonus(amt) { this.scoreBonus += amt; }

    addXP(amt) {
        // Redundant with new task-based progression
    }

    updateWorld() {
        const maxMult = 3.5;
        const currentMult = 1 + this.maxHeight / 2000;
        this.modeStrategy.updateLava(Math.min(currentMult, maxMult));
    }

    levelUpTwist(stage) {
        const nextTheme = THEMES[stage % THEMES.length];
        this._animateThemeTransition(this.currentTheme, nextTheme);
        this.currentTheme = nextTheme;
        this.lavaSpeed += 0.05;
        this.playLevelUp();
    }

    _animateThemeTransition(fromTheme, toTheme) {
        try {
            const root = document.documentElement;
            root.style.setProperty('--theme-from-bg1', fromTheme?.bg?.[0] || '#0c0c12');
            root.style.setProperty('--theme-from-bg2', fromTheme?.bg?.[1] || '#0c0f18');
            root.style.setProperty('--theme-to-bg1', toTheme?.bg?.[0] || '#0c0c12');
            root.style.setProperty('--theme-to-bg2', toTheme?.bg?.[1] || '#0c0f18');
            root.classList.remove('theme-transition');
            void root.offsetWidth; // force reflow
            root.classList.add('theme-transition');
        } catch (_) {}
    }

    // ════════════════════════════════════════════════════════════
    //  DEATH & GAME OVER
    // ════════════════════════════════════════════════════════════

    triggerDeath(reason) {
        if (this.gameState === 'DEATH_ANIMATION' || this.gameState === 'GAME_OVER') return;
        this.gameState = 'DEATH_ANIMATION';
        this.isGameOver = true;
        this.shake = 25;

        this.deathReasonString = reason || 'Skill issue? Try again.';
        this.deathTimerAnim = performance.now();
        this.freezeEnd = performance.now() + 150;

        if (this.player) {
            this.player.collisionFilter = { group: -1, category: 0, mask: 0 };
            if (this.modeStrategy.name === 'fall') {
                Body.setVelocity(this.player, { x: (Math.random() - 0.5) * 5, y: -2 });
            } else {
                Body.setVelocity(this.player, { x: (Math.random() - 0.5) * 10, y: -15 });
            }
            this.createExplosion(this.player.position, '#ffffff', 20);
            this.createExplosion(this.player.position, '#ff2200', 30);
        }
    }

    showGameOverUI() {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';

        document.getElementById('fall-distance').innerText = this.maxHeight;
        const reasonEl = document.getElementById('death-reason');
        if (reasonEl) reasonEl.innerText = this.deathReasonString;

        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight;
            localStorage.setItem('bestHeight', this.bestHeight);
            this.updateHUD();
        }
        const bestDeathEl = document.getElementById('best-distance-death');
        if (bestDeathEl) bestDeathEl.innerText = this.bestHeight;

        const ds = document.getElementById('death-screen');
        ds.classList.remove('hidden');
        ds.style.opacity = '0';
        ds.style.transition = 'opacity 0.5s ease-in-out';
        setTimeout(() => ds.style.opacity = '1', 50);

        const rb = document.getElementById('retry-button');
        if (rb) {
            rb.style.transform = 'scale(0.8)';
            rb.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            setTimeout(() => rb.style.transform = 'scale(1)', 550);
        }

        const btn = document.getElementById('ad-revive-btn');
        if (this.revivesLeft > 0) {
            btn.style.display = 'flex';
            btn.innerHTML = `<span class="btn-icon">▶</span> <span class="btn-text">REVIVE (${this.revivesLeft})</span><div class="btn-glow"></div>`;
        } else {
            btn.style.display = 'none';
        }

        this.playGameOver();
        this.playFall();
    }

    // ════════════════════════════════════════════════════════════
    //  REVIVE
    // ════════════════════════════════════════════════════════════

    handleAdReward() {
        this.revivesLeft--;
        document.getElementById('death-screen').classList.add('hidden');
        this.revive();
    }

    revive() {
        this.isGameOver = false;
        this.gameState = 'PLAYING';
        const rx = Math.max(100, Math.min(CONFIG.canvasWidth - 100, this.player.position.x));
        const oldY = this.player.position.y;
        const ry = this.modeStrategy.getReviveY();

        const startY = this.modeStrategy.getPlayerStartY();
        const oldH = Math.floor(Math.abs(startY - oldY) / 10);
        const newH = Math.floor(Math.abs(startY - ry) / 10);
        this.scoreBonus += (oldH - newH);

        Body.setPosition(this.player, { x: rx, y: ry });
        Body.setVelocity(this.player, { x: 0, y: 0 });
        this.player.collisionFilter = { group: 0, category: 1, mask: 0xFFFFFFFF };
        this.lavaHeight = this.modeStrategy.getReviveLavaHeight(ry);

        // Clear all old entities so new ones can spawn ahead
        [this.platforms, this.enemies, this.activeCoins, this.powerups].forEach(arr => {
            arr.forEach(item => {
                if(item.label !== 'wall' && item.label !== 'floor') World.remove(this.world, item);
            });
            arr.length = 0;
        });

        const s = Bodies.rectangle(rx, ry + 30, 250, 20, { isStatic: true, label: 'platform' });
        World.add(this.world, s);
        this.platforms.push(s);

        this.updateStats();
        this.createParticles(this.player.position, '#00ff88', 30);
        this.shake = 10;
        this.isDashingFrames = 60; // Brief invincibility
    }

    // ════════════════════════════════════════════════════════════
    //  REWARDS
    // ════════════════════════════════════════════════════════════

    claimReward(level) {
        if (this.claimedRewards.includes(level)) return;
        
        // Find reward in BATTLE_PASS
        const passItem = imports_BATTLE_PASS.find(p => p.id === level);
        if(passItem && passItem.isUnlocked(this)) {
            this.coins += passItem.rewardAmount;
            localStorage.setItem('coins', this.coins);
            this.claimedRewards.push(level);
            localStorage.setItem('claimedRewards', JSON.stringify(this.claimedRewards));
            this.updateHUD();
            this.renderPass();
            this.renderSkins();
            this._playTone(880, 'square', 0, 0.2);
        }
    }

    // ════════════════════════════════════════════════════════════
    //  RENDERING & PARTICLES (thin delegates)
    // ════════════════════════════════════════════════════════════

    renderWorldManual() { this.renderer.render(); }
    handleResize() {
        if (window.innerWidth === 0) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createExplosion(pos, color, count) { this.particleSystem.createExplosion(pos, color, count); }
    createParticles(pos, color, count) { this.particleSystem.createParticles(pos, color, count); }
    createCuteTrail() { this.particleSystem.createCuteTrail(this.player, SKINS.find(s => s.id === this.activeSkinId), this.isGameOver); }

    // ════════════════════════════════════════════════════════════
    //  AUDIO (thin delegates)
    // ════════════════════════════════════════════════════════════

    _playTone(freq, type = 'sine', when = 0, duration = 0.08) { this.audioManager._playTone(freq, type, when, duration); }
    playJump() { this.audioManager.playJump(); }
    playCoin() { this.audioManager.playCoin(); }
    playLevelUp() { this.audioManager.playLevelUp(); }
    playGameOver() { this.audioManager.playGameOver(); }
    playFall() { this.audioManager.playFall(); }
    playShield() { this.audioManager.playShield(); }
    playMagnet() { this.audioManager.playMagnet(); }
    playPowerPickup() { this.audioManager.playPowerPickup(); }
    playLavaWarning() { this.audioManager.playLavaWarning(); }

    saveScore(score) { console.log('Score saved locally:', score); }
}

// ════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════
window.onload = () => new Game();
