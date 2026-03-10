import Matter from 'matter-js';
import { Capacitor } from '@capacitor/core';
import { UnityAds } from 'capacitor-unity-ads';
import { CONFIG, THEMES, DIFFICULTY_SETTINGS, SKINS } from './constants.js';
import { AudioManager } from './Audio.js';
import { ParticleSystem } from './Particles.js';
import { HUDManager } from './HUD.js';
import { Renderer } from './Renderer.js';
import { ClimbMode } from './ClimbMode.js';
import { FallMode } from './FallMode.js';

const { Engine, Render, Runner, Bodies, Composite, World, Events, Body, Sleeping } = Matter;

let LOOP_ACTIVE = false;

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

        this.runner = Runner.create();
        this.player = null;
        this.platforms = [];
        this.keys = {};
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.scoreBonus = 0;
        this.score = 0;
        this.bestHeight = parseInt(localStorage.getItem('bestHeight')) || 0;
        this.combo = 1;
        this.stage = 0;
        this.currentTheme = THEMES[0];

        // Progression
        this.coins = parseInt(localStorage.getItem('coins')) || 0;
        this.ownedSkins = JSON.parse(localStorage.getItem('ownedSkins')) || ['default'];
        this.activeSkinId = localStorage.getItem('activeSkin') || 'default';
        this.passLevel = parseInt(localStorage.getItem('passLevel')) || 1;
        this.passXP = parseInt(localStorage.getItem('passXP')) || 0;

        this.claimedRewards = JSON.parse(localStorage.getItem('claimedRewards')) || [];
        this.revivesLeft = Infinity;
        this.playerName = localStorage.getItem('playerName') || 'Survivor';
        this.isGameOver = true;
        this.particleSystem = new ParticleSystem();
        this.shake = 0;
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;
        this.controlMode = localStorage.getItem('controlMode') || 'touch';
        this.gameMode = 'climb';
        this.modeStrategy = new ClimbMode(this);
        
        this.hasShield = false;
        this.magnetTimer = 0;
        this.powerups = [];

        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * CONFIG.canvasWidth,
            y: Math.random() * CONFIG.canvasHeight,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.7 + 0.3
        }));
        this.activeCoins = [];
        this.pool = { platform: [], pillar: [], coin: [], powerup: [], enemy: [] };

        this.hud = new HUDManager(this);
        this.enemies = [];

        this.init();
    }

    init() {
        try {
            // Robust check for sizing
            if (window.innerWidth === 0) {
                setTimeout(() => this.init(), 100);
                return;
            }

            this.updateHUD();
            this.setupEventListeners();
            this.renderSkins();
            this.renderPass();

            this.world.gravity.y = 1.35;

            // PHYSICS SETUP
            // We do NOT call Runner.run or Render.run automatically
            this.ctx = this.canvas.getContext('2d', { alpha: false });
            this.handleResize();

            // SINGLE HEARTBEAT LOOP
            this.lastTime = performance.now();
            const tick = (time) => {
                if (!time) time = performance.now();
                const delta = Math.min(time - this.lastTime, 50);
                this.lastTime = time;

                if (this.freezeEnd && time < this.freezeEnd) {
                    if (this.shake > 0) this.shake *= 0.9;
                    this.renderWorldManual();
                    requestAnimationFrame(tick);
                    return;
                }

                if (this.gameState === 'PLAYING' && this.player) {
                    // Update Physics at a fixed timestep for consistency across devices
                    Engine.update(this.engine, 16.666);
                    this.update();
                    this.createCuteTrail();
                } else if (this.gameState === 'DEATH_ANIMATION' && this.player) {
                    Engine.update(this.engine, 16.666);
                    Body.setAngle(this.player, this.player.angle + 0.35); // 20 deg spin
                    Body.setVelocity(this.player, { x: this.player.velocity.x, y: this.player.velocity.y + this.world.gravity.y * 0.1 }); // extra gravity
                    if (this.shake > 0) this.shake *= 0.9;

                    if (time - this.deathTimerAnim > 1800) {
                        this.showGameOverUI();
                    }
                } else if (!this.isGameOver && this.player && !this.gameState) {
                    Engine.update(this.engine, 16.666);
                    this.update();
                }

                this.renderWorldManual();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);

            this.renderer = new Renderer(this);
            
            try {
                this.audioManager = new AudioManager();
            } catch (err) { console.warn('audio init fail', err); }

            this.showMenu();
        } catch (e) {
            console.error("Initialization Error:", e);
            document.getElementById('difficulty-screen').classList.remove('hidden');
        }
    }

    setupEventListeners() {
        document.getElementById('retry-button').onclick = () => {
            document.getElementById('death-screen').classList.add('hidden');
            document.getElementById('retry-button').style.transform = '';
            document.getElementById('death-screen').style.opacity = '1';
            this.startGame(this.difficulty);
        };

        const homeBtn = document.getElementById('home-button');
        if (homeBtn) {
            homeBtn.onclick = () => this.showMainMenu();
        }

        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.onclick = () => this.startGame(btn.dataset.difficulty);
        });

        document.getElementById('btn-shop').onclick = () => document.getElementById('shop-screen').classList.remove('hidden');
        document.getElementById('btn-pass').onclick = () => document.getElementById('pass-screen').classList.remove('hidden');
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = () => btn.parentElement.classList.add('hidden');
        });

        document.getElementById('ad-revive-btn').onclick = () => this.startAdRevive();

        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
            nameInput.oninput = (e) => {
                this.playerName = e.target.value || 'Survivor';
                localStorage.setItem('playerName', this.playerName);
                this.updateHUD();
            };
        }

        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.keys[e.key] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keys[e.key] = false;
        });

        window.addEventListener('resize', () => this.handleResize());

        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnJump = document.getElementById('btn-jump');
        const btnPower = document.getElementById('btn-power');

        const bindButton = (btn, key) => {
            if (!btn) return;
            const down = (e) => {
                e.preventDefault();
                this.keys[key] = true;
                if (btn.classList) btn.classList.add('active');
                try {
                    if (this.audio && this.audio.state === 'suspended') this.audio.resume();
                } catch (err) { }
            };
            const up = (e) => {
                e.preventDefault();
                this.keys[key] = false;
                if (btn.classList) btn.classList.remove('active');
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            btn.addEventListener('pointerleave', up);
        };

        bindButton(btnLeft, 'ArrowLeft');
        bindButton(btnRight, 'ArrowRight');
        bindButton(btnJump, 'TouchJump');
        bindButton(btnPower, 'PowerDash');

        this.gyroGamma = 0;
        window.addEventListener('deviceorientation', (e) => {
            if (this.controlMode === 'tilt' && e.gamma !== null) {
                this.gyroGamma = e.gamma;
            }
        });

        const btnTouch = document.getElementById('btn-touch-mode');
        const btnTilt = document.getElementById('btn-tilt-mode');
        const leftGroup = document.querySelector('.control-group.left');
        const rightGroup = document.querySelector('.control-group.right');

        if (btnTouch && btnTilt) {
            if (this.controlMode === 'tilt') {
                btnTouch.classList.remove('active');
                btnTilt.classList.add('active');
                if (leftGroup) leftGroup.style.display = 'none';
                if (rightGroup) rightGroup.style.display = 'none';
            }
            btnTouch.onclick = () => {
                this.controlMode = 'touch';
                localStorage.setItem('controlMode', 'touch');
                btnTouch.classList.add('active');
                btnTilt.classList.remove('active');
                if (leftGroup) leftGroup.style.display = 'flex';
                if (rightGroup) rightGroup.style.display = 'flex';
            };
            btnTilt.onclick = async () => {
                if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                    try { await DeviceOrientationEvent.requestPermission(); } catch (err) { }
                }
                this.controlMode = 'tilt';
                localStorage.setItem('controlMode', 'tilt');
                btnTilt.classList.add('active');
                btnTouch.classList.remove('active');
                if (leftGroup) leftGroup.style.display = 'none';
                if (rightGroup) rightGroup.style.display = 'none';
            };
        }

        const btnClimb = document.getElementById('mode-climb');
        const btnFall = document.getElementById('mode-fall');
        if (btnClimb && btnFall) {
            btnClimb.onclick = () => {
                this.gameMode = 'climb';
                this.modeStrategy = new ClimbMode(this);
                btnClimb.classList.add('active');
                btnFall.classList.remove('active');
            };
            btnFall.onclick = () => {
                this.gameMode = 'fall';
                this.modeStrategy = new FallMode(this);
                btnFall.classList.add('active');
                btnClimb.classList.remove('active');
            };
        }

        const handleTapJumpStart = (e) => {
            // Always allow canvas tap to act as jump (perfect for hyper-casual)
            if (e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                this.keys['TouchJump'] = true;
                if (this.audio && this.audio.state === 'suspended') this.audio.resume();
            }
        };
        const handleTapJumpEnd = (e) => {
            this.keys['TouchJump'] = false;
        };
        this.canvas.addEventListener('pointerdown', handleTapJumpStart);
        this.canvas.addEventListener('pointerup', handleTapJumpEnd);
        this.canvas.addEventListener('pointercancel', handleTapJumpEnd);
        this.canvas.addEventListener('pointerleave', handleTapJumpEnd);
    }

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

    startGame(diff) {
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = this.modeStrategy.getLavaStartHeight();
        this.isGameOver = false;
        this.gameState = 'PLAYING';
        this.revivesLeft = 2; // Limit to 2 revives per game
        document.getElementById('difficulty-screen').classList.add('hidden');
        window.focus();

        Composite.clear(this.world);
        this.engine.world.gravity.y = 1.35;
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.scoreBonus = 0;
        this.score = 0;
        this.combo = 1;
        this.updateHUD();

        this.platforms = [];
        this.enemies = [];
        this.particleSystem.particles = [];
        this.dashCooldown = 0;
        this.isDashingFrames = 0;
        this.createPlayer();
        this.createStartPlatform();
        this.generateInitialPlatforms(settings);
        Body.setStatic(this.player, false);
        try { Sleeping.set(this.player, false); } catch (e) { }
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

    createStartPlatform() {
        const floorY = this.modeStrategy.getFloorY();
        const floor = Bodies.rectangle(CONFIG.canvasWidth / 2, floorY, CONFIG.canvasWidth * 10, 200, {
            isStatic: true,
            label: 'floor'
        });
        this.leftWall = Bodies.rectangle(10, CONFIG.canvasHeight / 2, 20, CONFIG.canvasHeight * 2, {
            isStatic: true,
            label: 'wall',
            friction: 0.1
        });
        this.rightWall = Bodies.rectangle(CONFIG.canvasWidth - 10, CONFIG.canvasHeight / 2, 20, CONFIG.canvasHeight * 2, {
            isStatic: true,
            label: 'wall',
            friction: 0.1
        });
        World.add(this.world, [floor, this.leftWall, this.rightWall]);
    }

    generateInitialPlatforms(settings) {
        for (let i = 0; i < 5; i++) {
            const y = this.modeStrategy.getInitialPlatformY(i, settings);
            this.addPlatform(y, i);
        }
    }

    addPlatform(y, index) {
        if (this.isGameOver) return;
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        
        if (this.modeStrategy.createCustomPlatform && this.modeStrategy.createCustomPlatform(y, index, settings, this)) {
            return;
        }

        const isPillar = Math.random() < settings.pillarChance;

        if (isPillar) {
            const height = 100 + Math.random() * 150; // Taller green pillars
            const x = Math.random() * (CONFIG.canvasWidth - 80) + 40;
            let pillar = this.pool.pillar.pop();
            if (pillar) {
                const oldHeight = pillar.bounds.max.y - pillar.bounds.min.y;
                Body.scale(pillar, 1, height / oldHeight);
                Body.setPosition(pillar, {x, y});
                Body.setVelocity(pillar, {x:0, y:0});
                World.add(this.world, pillar);
            } else {
                pillar = Bodies.rectangle(x, y, 40, height, { isStatic: true, label: 'pillar', render: { visible: false } });
                World.add(this.world, pillar);
            }
            pillar.isMoving = false;

            if (this.maxHeight > 500 && Math.random() < 0.6) {
                pillar.isMoving = true;
                pillar.moveSpeed = (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
                pillar.minX = 40; pillar.maxX = CONFIG.canvasWidth - 40;
            }
            this.platforms.push(pillar);
        } else {
            const pParams = this.modeStrategy.getPlatformParams(index, settings);
            const width = pParams.width;
            const x = pParams.x;

            const isHazard = index > 15 && Math.random() < settings.hazardChance;
            const isCrumbling = !isHazard && index > 10 && Math.random() < 0.15;
            const label = isHazard ? 'hazard' : 'platform';
            
            let platform = this.pool.platform.pop();
            if (platform) {
                const oldWidth = platform.bounds.max.x - platform.bounds.min.x;
                Body.scale(platform, width / oldWidth, 1);
                Body.setPosition(platform, {x, y});
                Body.setVelocity(platform, {x:0, y:0});
                platform.label = label;
                World.add(this.world, platform);
            } else {
                platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, { isStatic: true, render: { visible: false } });
                platform.label = label;
                World.add(this.world, platform);
            }
            platform.isCrumbling = isCrumbling;
            platform.crumbleTimer = 0;
            platform.isMoving = false;
            this.platforms.push(platform);

            if (!isHazard && !isCrumbling) {
                const rng = Math.random();
                if (rng < 0.1) this.addCoin(x, y - 35);
                else if (rng < 0.15) this.addPowerup(x, y - 40); 
            }
        }
    }

    addPowerup(x, y) {
        let type;
        if (this.modeStrategy.getPowerupType) {
            type = this.modeStrategy.getPowerupType();
        } else {
            type = Math.random() < 0.5 ? 'shield' : 'magnet';
        }
        let p = this.pool.powerup.pop();
        if (p) {
            Body.setPosition(p, {x, y});
            World.add(this.world, p);
        } else {
            p = Bodies.circle(x, y, 16, { isStatic: true, isSensor: true, label: 'powerup' });
            World.add(this.world, p);
        }
        p.powerupType = type;
        this.powerups.push(p);
    }

    collectPowerup(p) {
        if (p.powerupType === 'shield') {
            this.hasShield = true;
            this.createExplosion(p.position, '#00d1ff', 20);
        } else if (p.powerupType === 'magnet') {
            this.magnetTimer = 600; // ~10 seconds
            this.createExplosion(p.position, '#ff3e3e', 20);
        } else if (p.powerupType === 'anchor') {
            this.anchorTimer = 300; // 5 seconds
            this.createExplosion(p.position, '#444444', 30);
        }
        World.remove(this.world, p);
        this.powerups = this.powerups.filter(item => item !== p);
        this.pool.powerup.push(p);
        this._playTone(880, 'sine', 0, 0.15);
    }

    consumeShield() {
        this.hasShield = false;
        this.createExplosion(this.player.position, '#00d1ff', 30);
        this._playTone(220, 'sawtooth', 0, 0.3);
    }

    addCoin(x, y) {
        let coin = this.pool.coin.pop();
        if (coin) {
            Body.setPosition(coin, {x, y});
            World.add(this.world, coin);
        } else {
            coin = Bodies.circle(x, y, 8, { isStatic: true, isSensor: true, label: 'coin' });
            World.add(this.world, coin);
        }
        this.activeCoins.push(coin);
    }

    update() {
        if (this.isGameOver) return;
        this.handleInput();
        this.updateStats();
        this.updateWorld();
        this.updatePlatforms();
        this.updateEnemies();
        this.checkCollisions();
        this.cullAndGeneratePlatforms();
        
        if (this.modeStrategy.updateFallMechanics) {
            this.modeStrategy.updateFallMechanics(this);
        }

        // --- UI Cooldown Animations ---
        const btnPower = document.getElementById('btn-power');
        if (btnPower) {
            const maxDash = this.maxDashCooldown || 120;
            const dashVal = this.dashCooldown > 0 ? this.dashCooldown : 0;
            const dashPct = 100 - ((dashVal / maxDash) * 100);
            btnPower.style.setProperty('--cd-pct', `${dashPct}%`);
        }

        const btnJump = document.getElementById('btn-jump');
        if (btnJump) {
            if (this.modeStrategy.name === 'fall') {
                const maxBrake = this.modeStrategy.maxBrakeCooldown || 100;
                const brakeVal = this.modeStrategy.brakeCooldown > 0 ? this.modeStrategy.brakeCooldown : 0;
                const brakePct = 100 - ((brakeVal / maxBrake) * 100);
                btnJump.style.setProperty('--cd-pct', `${brakePct}%`);
            } else {
                btnJump.style.setProperty('--cd-pct', `100%`);
            }
        }

        if (this.magnetTimer > 0) {
            this.magnetTimer--;
            Composite.allBodies(this.world).forEach(b => {
                if (b.label === 'coin') {
                    const dx = this.player.position.x - b.position.x;
                    const dy = this.player.position.y - b.position.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < 250) {
                        const force = (250 - dist) / 2500;
                        Body.translate(b, { x: dx * force * 2, y: dy * force * 2 });
                    }
                }
            });
        }

        if (this.player && this.leftWall && this.rightWall) {
            Body.setPosition(this.leftWall, { x: 10, y: this.player.position.y });
            Body.setPosition(this.rightWall, { x: CONFIG.canvasWidth - 10, y: this.player.position.y });
        }

        if (this.shake > 0) this.shake *= 0.9;
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

    updatePlatforms() {
        const now = performance.now();
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.isMoving) {
                if (p.position.x < p.minX || p.position.x > p.maxX) p.moveSpeed *= -1;
                Body.translate(p, { x: p.moveSpeed, y: 0 });
            }
            if (p.isCrumbling && p.crumbleTimer > 0) {
                if (now - p.crumbleTimer > 1500) {
                    this.createExplosion(p.position, '#ccaa88', 15);
                    World.remove(this.world, p);
                    this.pool.platform.push(p);
                    this.platforms.splice(i, 1);
                }
            }
        }
    }

    updateEnemies() {
        this.enemies.forEach(e => {
            if (e.position.x < 40 || e.position.x > CONFIG.canvasWidth - 40) e.moveSpeed *= -1;
            Body.translate(e, { x: e.moveSpeed, y: 0 });
        });
    }

    checkCollisions() {
        if (!this.player) return;
        const collisions = Matter.Query.collides(this.player, Composite.allBodies(this.world));
        collisions.forEach(collision => {
            const other = collision.bodyA === this.player ? collision.bodyB : collision.bodyA;
            if (other.label === 'coin') this.collectCoin(other);
            else if (other.label === 'powerup') this.collectPowerup(other);
            else if (this.isDashingFrames > 0 && (other.label === 'enemy' || other.label === 'hazard' || other.label === 'pillar')) {
                // Invincible
            }
            else if (other.label === 'enemy' || (other.label === 'hazard' && this.player.velocity.y > 0)) {
                if (this.hasShield) {
                    this.consumeShield();
                    if (other.label === 'enemy') {
                        World.remove(this.world, other);
                        let idx = this.enemies.indexOf(other);
                        if (idx > -1) this.enemies.splice(idx, 1);
                        this.pool.enemy.push(other);
                    }
                } else {
                    this.triggerDeath(other.label === 'enemy' ? "SLAIN BY A FOE" : "CATASTROPHE");
                }
            }
            else if (other.label === 'crusher') {
                if (this.hasShield) {
                    this.consumeShield();
                    // Knockback to avoid immediate death loop
                    Body.setVelocity(this.player, { x: 0, y: -20 });
                } else {
                    this.triggerDeath("CRUSHED TO DUST");
                }
            }
            else if (other.label === 'platform' || other.label === 'pillar') {
                // Landing on regular platform resets combo
                this.combo = 1;
                this.updateHUD();
            }
            else if (other.label === 'enemy' || other.label === 'hazard') {
                 // Hit hazard/enemy (if shielded) resets combo
                 this.combo = 1;
                 this.updateHUD();
            }
            else if (other.label === 'glass' && this.player.velocity.y > 0) {
                // Shatter instantly
                this.createExplosion(other.position, '#aaddff', 40);
                this.shake = 25;
                Body.setVelocity(this.player, { x: this.player.velocity.x, y: 35 });
                World.remove(this.world, other);
                const idx = this.platforms.indexOf(other);
                if (idx > -1) this.platforms.splice(idx, 1);
                this.pool.platform.push(other);
                this._playTone(1200, 'square', 0, 0.1);
            }
            else if (other.label === 'platform' && other.isCrumbling && this.player.velocity.y > 0) {
                if (other.crumbleTimer === 0) other.crumbleTimer = performance.now();
            }
        });
    }

    collectCoin(coin) {
        this.coins += 5;
        this.addXP(20);
        this.updateHUD();
        this.createParticles(coin.position, '#ffcc00', 8);
        World.remove(this.world, coin);
        let idx = this.activeCoins.indexOf(coin);
        if (idx > -1) this.activeCoins.splice(idx, 1);
        this.pool.coin.push(coin);
        localStorage.setItem('coins', this.coins);
        this.playCoin();
    }

    addXP(amt) {
        this.passXP += amt;
        if (this.passXP >= 1000) {
            this.passXP = 0; this.passLevel++;
            this.showLevelUpToast(this.passLevel);
            this.playLevelUp();
        }
        localStorage.setItem('passXP', this.passXP);
        localStorage.setItem('passLevel', this.passLevel);
        this.updateHUD();
        this.renderPass();
    }

    updateWorld() {
        const maxMult = 3.5;
        const currentMult = 1 + this.maxHeight / 2000;
        const mult = Math.min(currentMult, maxMult);
        this.modeStrategy.updateLava(mult);
    }

    handleInput() {
        if (this.isGameOver || !this.player) return;
        const vel = this.player.velocity;
        const baseSpeed = CONFIG.moveSpeed;
        const jumpForce = CONFIG.jumpForce * (this.isClimbing ? 0.7 : 1);
        const onGround = [-15, 0, 15].some(off => Matter.Query.ray(Composite.allBodies(this.world).filter(b => b.label === 'platform' || b.label === 'floor'), { x: this.player.position.x + off, y: this.player.position.y }, { x: this.player.position.x + off, y: this.player.position.y + CONFIG.playerRadius + 5 }).length > 0);

        let targetVx = 0;
        if (this.controlMode === 'tilt' && this.gyroGamma !== 0) {
            if (this.smoothedGamma === undefined) this.smoothedGamma = this.gyroGamma;
            this.smoothedGamma += (this.gyroGamma - this.smoothedGamma) * 0.2; // faster smoothing
            let tilt = this.smoothedGamma;
            
            const tiltSettings = this.modeStrategy.getTiltSettings();
            if (Math.abs(tilt) > 3) targetVx = baseSpeed * Math.sign(tilt) * Math.min(tiltSettings.maxMult, Math.abs(tilt) / tiltSettings.sens);
        }
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) targetVx = -baseSpeed;
        else if (this.keys['ArrowRight'] || this.keys['KeyD']) targetVx = baseSpeed;

        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.isDashingFrames > 0) {
            this.isDashingFrames--;
            this.createCuteTrail(); // Intense trail
        }

        if ((this.keys['PowerDash'] || this.keys['KeyE'] || this.keys['ShiftLeft']) && this.dashCooldown <= 0) {
            this.modeStrategy.handleDash(this, targetVx);
            this.keys['PowerDash'] = false; this.keys['KeyE'] = false; this.keys['ShiftLeft'] = false;
        }

        if (targetVx !== 0) Body.setVelocity(this.player, { x: targetVx, y: vel.y });
        else Body.setVelocity(this.player, { x: vel.x * 0.8, y: vel.y });

        // Landing Juice
        if (onGround && this.wasFallingLastFrame) {
            this.shake = Math.min(this.shake + 3, 10);
            this.createExplosion({ x: this.player.position.x, y: this.player.position.y + 16 }, '#ffffff', 8);
        }
        this.wasFallingLastFrame = !onGround && vel.y > 0;

        if ((this.keys['TouchJump'] || this.keys['Space'] || this.keys['ArrowUp'])) {
            this.modeStrategy.handleJump(this, onGround, jumpForce);
            this.keys['TouchJump'] = false; this.keys['Space'] = false; this.keys['ArrowUp'] = false;
        }
    }

    updateStats() {
        const startY = this.modeStrategy.getPlayerStartY();
        const h = Math.floor(Math.abs(startY - this.player.position.y) / 10);
        this.currentHeight = Math.max(0, h);
        
        this.score = this.currentHeight + this.scoreBonus;

        if (this.score > this.maxHeight) {
            this.maxHeight = this.score; 
            if (this.maxHeight % 10 === 0) this.addXP(1);

            const newStage = Math.floor(this.maxHeight / 150);
            if (newStage > this.stage) { this.stage = newStage; this.levelUpTwist(this.stage); }
        }
        document.getElementById('height-value').innerText = this.score;
    }

    addScoreBonus(amt) {
        this.scoreBonus += amt;
    }

    levelUpTwist(stage) {
        this.currentTheme = THEMES[stage % THEMES.length];
        this.lavaSpeed += 0.05;
        this.playLevelUp();
    }

    triggerDeath(reason) {
        if (this.gameState === 'DEATH_ANIMATION' || this.gameState === 'GAME_OVER') return;
        this.gameState = 'DEATH_ANIMATION';
        this.isGameOver = true;
        this.shake = 25;
        
        this.deathReasonString = reason || "Skill issue? Try again.";
        this.deathTimerAnim = performance.now();
        this.freezeEnd = performance.now() + 150;
        
        if (this.player) {
            this.player.collisionFilter = { group: -1, category: 0, mask: 0 };
            Body.setVelocity(this.player, { x: (Math.random() - 0.5) * 10, y: -15 });
            this.createExplosion(this.player.position, '#ffffff', 20); // Bright flash
            this.createExplosion(this.player.position, '#ff2200', 30); // Fire / Debris
        }
    }

    showGameOverUI() {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';

        document.getElementById('fall-distance').innerText = this.maxHeight;
        const reasonEl = document.getElementById('death-reason');
        if (reasonEl) reasonEl.innerText = this.deathReasonString;

        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight; localStorage.setItem('bestHeight', this.bestHeight);
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

        this.playGameOver(); this.playFall();
    }

    async initAds() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await UnityAds.initialize({ gameId: '6051910', testMode: true });
            this.loadAds();
        } catch (e) { }
    }

    async loadAds() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await UnityAds.loadInterstitial({ placementId: 'Interstitial_Android' });
            await UnityAds.loadRewardedVideo({ placementId: 'Rewarded_Android' });
        } catch (e) { }
    }

    async showGameOverAd() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                await UnityAds.showRewardedVideo();
                this.loadAds();
            } else if ((await UnityAds.isInterstitialLoaded()).loaded) {
                await UnityAds.showInterstitial();
                this.loadAds();
            }
        } catch (e) { }
    }

    async startAdRevive() {
        if (!Capacitor.isNativePlatform()) {
            this.handleAdReward();
            return;
        }

        const btn = document.getElementById('ad-revive-btn');
        btn.innerText = "LOADING..."; btn.disabled = true;
        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                if ((await UnityAds.showRewardedVideo()).success) this.handleAdReward();
                else alert("Ad not finished!");
            } else {
                alert("Ad still loading... try in 3s");
                this.loadAds();
            }
        } catch (e) {
            this.handleAdReward(); // fallback
        } finally { btn.innerText = "REVIVE"; btn.disabled = false; }
    }

    handleAdReward() {
        this.revivesLeft--;
        document.getElementById('death-screen').classList.add('hidden');
        this.revive();
    }

    revive() {
        this.isGameOver = false;
        const rx = Math.max(100, Math.min(CONFIG.canvasWidth - 100, this.player.position.x));
        const oldY = this.player.position.y;
        const ry = this.modeStrategy.getReviveY();
        
        // Calculate the height jump to keep score consistent
        const startY = this.modeStrategy.getPlayerStartY();
        const oldH = Math.floor(Math.abs(startY - oldY) / 10);
        const newH = Math.floor(Math.abs(startY - ry) / 10);
        this.scoreBonus += (oldH - newH);

        Body.setPosition(this.player, { x: rx, y: ry });
        Body.setVelocity(this.player, { x: 0, y: 0 });
        
        // Mode-specific lava reset
        this.lavaHeight = this.modeStrategy.getReviveLavaHeight(ry);

        // Spawn a temporary safety platform
        const s = Bodies.rectangle(rx, ry + 30, 250, 20, { isStatic: true, label: 'platform' });
        World.add(this.world, s); 
        this.platforms.push(s);
        
        this.updateStats(); // Force UI update
        this.createParticles(this.player.position, '#00ff88', 30);
        this.shake = 10;
        
        // Brief invincibility frames
        this.isDashingFrames = 60; 
    }



    drawCachedPlatform() {
        const pctx = this.platformCanvas.getContext('2d');
        const w = 200, h = CONFIG.platformHeight;
        pctx.clearRect(0, 0, 300, 30);
        pctx.fillStyle = '#00af50'; pctx.strokeStyle = '#000'; pctx.lineWidth = 3;
        this.roundRect(pctx, 5, 5, w - 10, h, 8);
        pctx.fill(); pctx.stroke();
        pctx.fillStyle = '#00ff88';
        this.roundRect(pctx, 5, 5, w - 10, h * 0.4, 6);
        pctx.fill();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    renderWorldManual() {
        this.renderer.render();
    }

    createExplosion(pos, color, count) { this.particleSystem.createExplosion(pos, color, count); }
    createParticles(pos, color, count) { this.particleSystem.createParticles(pos, color, count); }
    createCuteTrail() { this.particleSystem.createCuteTrail(this.player, SKINS.find(s => s.id === this.activeSkinId), this.isGameOver); }

    _playTone(freq, type = 'sine', when = 0, duration = 0.08) { this.audioManager._playTone(freq, type, when, duration); }
    playJump() { this.audioManager.playJump(); }
    playCoin() { this.audioManager.playCoin(); }
    playLevelUp() { this.audioManager.playLevelUp(); }
    playGameOver() { this.audioManager.playGameOver(); }
    playFall() { this.audioManager.playFall(); }

    showLevelUpToast(level) {
        const el = document.createElement('div'); el.id = 'level-up-toast';
        el.innerHTML = `<div class="toast-title">LEVEL UP</div><div>Tier ${level} reached!</div>`;
        document.getElementById('game-container').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    cullAndGeneratePlatforms() {
        if (!this.player || this.isGameOver) return;
        const ly = this.modeStrategy.getLavaOffset(this.lavaHeight);
        const py = this.player.position.y;
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            if (this.modeStrategy.shouldCullPlatform(this.platforms[i].position.y, ly, py)) {
                const p = this.platforms[i];
                World.remove(this.world, p);
                this.platforms.splice(i, 1);
                if (p.label === 'pillar') this.pool.pillar.push(p);
                else this.pool.platform.push(p);
            }
        }
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            if (this.modeStrategy.shouldCullPlatform(this.powerups[i].position.y, ly, py)) {
                this.pool.powerup.push(this.powerups[i]);
                World.remove(this.world, this.powerups[i]); 
                this.powerups.splice(i, 1);
            }
        }
        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            if (this.modeStrategy.shouldCullPlatform(this.activeCoins[i].position.y, ly, py)) {
                this.pool.coin.push(this.activeCoins[i]);
                World.remove(this.world, this.activeCoins[i]); 
                this.activeCoins.splice(i, 1);
            }
        }
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        let nextY = this.modeStrategy.getNextPlatformY(this.platforms, py, settings);

        while (nextY !== null && !this.isGameOver && this.platforms.length < 40) {
            this.addPlatform(nextY, this.platforms.length);
            if (this.stage >= 1 && Math.random() < 0.1) {
                this.addEnemy(nextY + this.modeStrategy.getEnemySpawnOffset());
            }
            nextY = this.modeStrategy.getNextPlatformY(this.platforms, py, settings);
        }
    }

    addEnemy(y) {
        const x = Math.random() * (CONFIG.canvasWidth - 100) + 50;
        let e = this.pool.enemy.pop();
        if (e) {
            Body.setPosition(e, {x, y});
            World.add(this.world, e);
        } else {
            e = Bodies.rectangle(x, y, 40, 30, { isStatic: true, isSensor: true, label: 'enemy' });
            World.add(this.world, e);
        }
        e.moveSpeed = (Math.random() < 0.5 ? 2 : -2);
        this.enemies.push(e); 
    }

    handleResize() {
        if (window.innerWidth === 0) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Disable Matter.js render options updates as we render manually
    }



    claimReward(level) {
        if (this.claimedRewards.includes(level)) return;
        if (level % 2 === 0) {
            if (!this.ownedSkins.includes('xmas')) {
                this.ownedSkins.push('xmas');
                localStorage.setItem('ownedSkins', JSON.stringify(this.ownedSkins));
            }
        } else {
            this.coins += 100;
            localStorage.setItem('coins', this.coins);
        }
        this.claimedRewards.push(level);
        localStorage.setItem('claimedRewards', JSON.stringify(this.claimedRewards));
        this.updateHUD();
        this.renderPass();
        this.renderSkins();
    }

    saveScore(score) {
        console.log("Score saved locally:", score);
    }
}

window.onload = () => new Game();
