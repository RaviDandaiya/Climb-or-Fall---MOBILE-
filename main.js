import Matter from 'matter-js';
const { Engine, Render, Runner, World, Bodies, Body, Events, Vector, Composite, Sleeping } = Matter;

const CONFIG = {
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    playerRadius: 18,
    jumpForce: -34,
    moveSpeed: 24,
    maxHorizontalVelocity: 32,
    platformWidth: 140,
    platformHeight: 25,
};

const DIFFICULTY_SETTINGS = {
    easy: { lavaSpeed: 0.25, platformWidth: 200, gapHeight: 110, hazardChance: 0.0, movingChance: 0.1 },
    medium: { lavaSpeed: 0.35, platformWidth: 170, gapHeight: 120, hazardChance: 0.04, movingChance: 0.25 },
    hard: { lavaSpeed: 0.55, platformWidth: 140, gapHeight: 135, hazardChance: 0.1, movingChance: 0.5 }
};

const SKINS = [
    { id: 'default', name: 'Shadow', color: '#9d00ff', price: 0 },
    { id: 'crimson', name: 'Crimson', color: '#ff0044', price: 50 },
    { id: 'toxic', name: 'Toxic', color: '#00ff44', price: 100 },
    { id: 'frost', name: 'Frost', color: '#00ccff', price: 200 },
    { id: 'gold', name: 'Gilded', color: '#ffcc00', price: 500 },
    { id: 'xmas', name: 'Xmas', color: '#ff0000', price: 9999 }
];

const THEMES = {
    cave: { platform: '#2d3436', stroke: '#636e72', lava: '#ff4d00', glow: '#ff6600', bg: 'radial-gradient(circle at 50% 120%, rgba(255, 77, 0, 0.15), transparent 70%)', hazard: '#444' },
    lava: { platform: '#2d1a1a', stroke: '#ff3e3e', lava: '#ff3300', glow: '#ff0000', bg: 'radial-gradient(circle at 50% 120%, rgba(255, 30, 0, 0.3), transparent 70%)', hazard: '#ff0000' },
    frost: { platform: '#1a2a2e', stroke: '#00d1ff', lava: '#00a3ff', glow: '#00ccff', bg: 'radial-gradient(circle at 50% 120%, rgba(0, 209, 255, 0.15), transparent 70%)', hazard: '#ff0000' },
    void: { platform: '#0a0a0f', stroke: '#9d00ff', lava: '#4d00ff', glow: '#9d00ff', bg: 'radial-gradient(circle at 50% 120%, rgba(157, 0, 255, 0.15), transparent 70%)', hazard: '#ff0000' },
    gold: { platform: '#26241e', stroke: '#ffcc00', lava: '#ffaa00', glow: '#ffcc00', bg: 'radial-gradient(circle at 50% 120%, rgba(255, 204, 0, 0.15), transparent 70%)', hazard: '#ff0000' }
};

// MANUAL HEARTBEAT FLAG
let LOOP_ACTIVE = false;

import { auth, googleProvider, db } from './firebase-config.js';
import { signInWithPopup, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playJump() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playCoin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playDeath() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playLevelUp() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.1 + 0.4);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.1);
            osc.stop(this.ctx.currentTime + i * 0.1 + 0.4);
        });
    }
}

class Game {
    constructor() {
        this.audio = new AudioManager();
        this.engine = Engine.create();
        this.world = this.engine.world;
        this.canvas = document.getElementById('game-canvas');
        this.canvas.width = CONFIG.canvasWidth;
        this.canvas.height = CONFIG.canvasHeight;

        this.render = Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: CONFIG.canvasWidth,
                height: CONFIG.canvasHeight,
                wireframes: false,
                background: 'transparent',
                pixelRatio: 1,
            }
        });

        this.runner = Runner.create();
        this.player = null;
        this.platforms = [];
        this.keys = {}; // Track logical symbols (e.g., 'LEFT')
        this.rawKeys = new Set(); // Track physical codes (e.g., 'ArrowLeft')
        this.inputStack = []; // Track order of logical symbols
        this.currentVx = 0; // For smooth acceleration
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.bestHeight = parseInt(localStorage.getItem('bestHeight')) || 0;

        // Progression
        this.coins = parseInt(localStorage.getItem('coins')) || 0;
        this.ownedSkins = JSON.parse(localStorage.getItem('ownedSkins')) || ['default'];
        this.activeSkinId = localStorage.getItem('activeSkin') || 'default';
        this.passLevel = parseInt(localStorage.getItem('passLevel')) || 1;
        this.passXP = parseInt(localStorage.getItem('passXP')) || 0;

        this.claimedRewards = JSON.parse(localStorage.getItem('claimedRewards')) || [];
        this.revivesLeft = Infinity; // UNLIMITED REVIVES
        this.adInterval = null; // Track timer interval
        this.isGameOver = true;
        this.particles = [];
        this.shake = 0;
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;
        this.user = null; // Firebase User

        this.init();
    }

    init() {
        this.updateHUD();
        this.setupEventListeners();
        this.renderSkins();
        this.renderPass();

        this.world.gravity.y = 1.35;

        // Start Rendering
        Render.run(this.render);

        // Start MANUAL loop
        if (!LOOP_ACTIVE) {
            LOOP_ACTIVE = true;
            this.loop();
        }

        // Initial Sync
        this.handleResize();

        Events.on(this.render, 'afterRender', () => this.postProcess());

        // DIRECT PLAY BYPASS: If no user, treat as local guest automatically
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = user;
                console.log("User Authenticated:", user.uid);
                this.showMenu();
            } else {
                // Auto-fallback to local guest for instant play
                console.log("No User Found: Auto-entering Guest Mode");
                this.isLocalGuest = true;
                this.user = { uid: 'guest-' + Date.now() };
                this.showMenu();
            }
        });
    }

    loop(timestamp) {
        try {
            if (!this.lastTime) this.lastTime = timestamp;
            const delta = timestamp - this.lastTime;
            this.lastTime = timestamp;

            if (!this.isGameOver && this.player) {
                // Cap delta to prevent huge jumps
                const physicsDelta = Math.min(delta, 32);
                Engine.update(this.engine, physicsDelta);
                this.update();
            }
            requestAnimationFrame((t) => this.loop(t));
        } catch (err) {
            console.error(err);
        }
    }

    update() {
        const theme = this.getCurrentTheme();
        const container = document.getElementById('game-container');
        if (container && container.style.background !== theme.bg) {
            container.style.background = theme.bg;
        }

        this.handleInput();
        this.updateWorld();
        this.updateStats();
        this.cullAndGeneratePlatforms();
    }

    setupEventListeners() {
        document.getElementById('retry-button').onclick = () => location.reload();

        // Difficulty
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.onclick = () => this.startGame(btn.dataset.difficulty);
        });

        // Navigation
        document.getElementById('btn-shop').onclick = () => document.getElementById('shop-screen').classList.remove('hidden');
        document.getElementById('btn-pass').onclick = () => document.getElementById('pass-screen').classList.remove('hidden');
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.onclick = () => btn.parentElement.classList.add('hidden');
        });

        // Ad Revive
        document.getElementById('ad-revive-btn').onclick = () => this.startAdRevive();

        // DOCUMENT SCALE INPUTS (Robust Symbol Mapping)
        const getSymbol = (code) => {
            if (code === 'ArrowLeft' || code === 'KeyA') return 'LEFT';
            if (code === 'ArrowRight' || code === 'KeyD') return 'RIGHT';
            if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') return 'JUMP';
            return null;
        };

        const isLogicalDown = (symbol) => {
            if (symbol === 'LEFT') return this.rawKeys.has('ArrowLeft') || this.rawKeys.has('KeyA') || this.rawKeys.has('TOUCH_LEFT');
            if (symbol === 'RIGHT') return this.rawKeys.has('ArrowRight') || this.rawKeys.has('KeyD') || this.rawKeys.has('TOUCH_RIGHT');
            if (symbol === 'JUMP') return this.rawKeys.has('ArrowUp') || this.rawKeys.has('KeyW') || this.rawKeys.has('Space') || this.rawKeys.has('TOUCH_JUMP');
            return false;
        };

        document.addEventListener('keydown', (e) => {
            const symbol = getSymbol(e.code);
            this.rawKeys.add(e.code);

            if (symbol) {
                if (symbol !== 'JUMP') {
                    // Update stack: remove if exists, then push to top
                    this.inputStack = this.inputStack.filter(k => k !== symbol);
                    this.inputStack.push(symbol);
                }
                this.keys[symbol] = true;

                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
                    e.preventDefault();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const symbol = getSymbol(e.code);
            this.rawKeys.delete(e.code);

            if (symbol) {
                // Only deactivate logical symbol if NO raw keys mapping to it are down
                if (!isLogicalDown(symbol)) {
                    this.keys[symbol] = false;
                    this.inputStack = this.inputStack.filter(k => k !== symbol);
                }
            }
        });

        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('blur', () => {
            this.keys = {};
            this.rawKeys.clear();
            this.inputStack = [];
        });

        // --- Mobile Touch Controls ---
        const addTouch = (id, symbol) => {
            const btn = document.getElementById(id);
            const activate = (e) => {
                if (e.cancelable) e.preventDefault();
                const touchSymbol = `TOUCH_${symbol}`;
                this.rawKeys.add(touchSymbol);

                if (symbol !== 'JUMP') {
                    // Update stack: remove if exists, then push to top
                    this.inputStack = this.inputStack.filter(k => k !== symbol);
                    this.inputStack.push(symbol);
                }
                this.keys[symbol] = true;
                btn.classList.add('active');
            };
            const deactivate = (e) => {
                if (e.cancelable) e.preventDefault();
                const touchSymbol = `TOUCH_${symbol}`;
                this.rawKeys.delete(touchSymbol);

                if (!isLogicalDown(symbol)) {
                    this.keys[symbol] = false;
                    this.inputStack = this.inputStack.filter(k => k !== symbol);
                }
                btn.classList.remove('active');
            };

            btn.addEventListener('touchstart', activate, { passive: false });
            btn.addEventListener('touchend', deactivate);
            btn.addEventListener('mousedown', activate);
            btn.addEventListener('mouseup', deactivate);
            btn.addEventListener('mouseleave', deactivate);
        };

        addTouch('btn-left', 'LEFT');
        addTouch('btn-right', 'RIGHT');
        addTouch('btn-jump', 'JUMP');

        // --- Auth Listeners ---
        document.getElementById('btn-google-login').onclick = () => this.handleGoogleLogin();
        document.getElementById('btn-guest-login').onclick = () => this.handleGuestLogin();
    }

    handleGoogleLogin() {
        // Rebranded as Play Games for Web
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                console.log("Logged in with Google Play:", result.user.displayName);
                this.showMenu();
            }).catch((error) => {
                console.error("Login Failed:", error);
                alert("Google Play Login Failed: " + error.message);
            });
    }

    handleGuestLogin() {
        signInAnonymously(auth)
            .then(() => {
                console.log("Logged in as Firebase Guest");
                this.isLocalGuest = false;
                this.showMenu();
            }).catch((error) => {
                console.warn("Firebase Guest Access Failed, falling back to Local Guest:", error.message);
                this.isLocalGuest = true;
                this.user = { uid: 'local-guest-' + Date.now() }; // Temporary ID for session
                this.showMenu();
            });
    }

    showMenu() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('difficulty-screen').classList.remove('hidden');
    }

    updateHUD(forced = false) {
        const theme = this.getCurrentTheme();
        const root = document.documentElement;

        // Dynamic HUD Accents
        root.style.setProperty('--theme-accent-color', theme.stroke);
        root.style.setProperty('--theme-accent-glow', theme.lava + '77'); // Add transparency
        root.style.setProperty('--theme-accent-glow-shadow', theme.lava + '44');

        const coinText = document.getElementById('coin-count');
        const heightText = document.getElementById('height-value');

        // Coin Update + Pulse
        if (coinText.innerText !== String(this.coins) || forced) {
            coinText.innerText = this.coins;
            this.pulseElement(coinText.parentElement);
        }

        // Height Update + Pulse
        const h = Math.floor(Math.max(0, this.currentHeight / 10));
        if (heightText.innerText !== String(h) || forced) {
            heightText.innerText = h;
            this.pulseElement(heightText.parentElement);
        }

        document.getElementById('best-value').innerText = Math.floor(this.bestHeight / 10);
        document.getElementById('pass-level').innerText = this.passLevel;
        document.getElementById('pass-fill').style.width = `${(this.passXP / 1000) * 100}%`;
    }

    pulseElement(el) {
        if (!el) return;
        el.classList.remove('pulse-animation');
        void el.offsetWidth; // Force reflow
        el.classList.add('pulse-animation');
    }

    startGame(diff) {
        if (!this.user && !this.isLocalGuest) {
            alert("Please login or use Guest Mode to play!");
            location.reload();
            return;
        }
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = CONFIG.canvasHeight + 400;
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;
        this.revivesLeft = 1;

        // Force Game State Active
        this.isGameOver = false;

        document.getElementById('difficulty-screen').classList.add('hidden');
        document.getElementById('ui-overlay').classList.remove('hidden');
        document.getElementById('side-nav').classList.remove('hidden');

        // Ensure Window has focus for controls
        window.focus();
        if (document.activeElement) document.activeElement.blur();

        // Clear existing world
        World.clear(this.world);
        // Do NOT use Engine.clear() as it might detach the runner
        this.platforms = [];
        this.particles = [];

        this.createPlayer();
        this.createStartPlatform();
        this.createBoundaries();
        this.generateInitialPlatforms(settings);

        // Force Body Active
        Body.setStatic(this.player, false);
        Sleeping.set(this.player, false);

        // Reset Gravity
        this.world.gravity.y = 1.35;

        // Safety: ensure runner is enabled
        this.runner.enabled = true;
    }

    createPlayer() {
        this.player = Bodies.circle(CONFIG.canvasWidth / 2, CONFIG.canvasHeight - 150, CONFIG.playerRadius, {
            friction: 0.01,
            frictionAir: 0.01,
            restitution: 0,
            inertia: Infinity, // Prevent character from rolling
            label: 'player',
            render: { visible: false }
        });
        World.add(this.world, this.player);
    }

    createBoundaries() {
        const wallThickness = 100;
        const h = 50000; // Very tall walls

        this.leftWall = Bodies.rectangle(-wallThickness / 2, 0, wallThickness, h, {
            isStatic: true,
            friction: 0,
            label: 'wall',
            render: { fillStyle: '#1a1a1a', strokeStyle: '#333', lineWidth: 1, visible: true }
        });

        this.rightWall = Bodies.rectangle(CONFIG.canvasWidth + wallThickness / 2, 0, wallThickness, h, {
            isStatic: true,
            friction: 0,
            label: 'wall',
            render: { fillStyle: '#1a1a1a', strokeStyle: '#333', lineWidth: 1, visible: true }
        });

        World.add(this.world, [this.leftWall, this.rightWall]);
    }

    createStartPlatform() {
        const floor = Bodies.rectangle(CONFIG.canvasWidth / 2, CONFIG.canvasHeight + 100, CONFIG.canvasWidth * 10, 200, {
            isStatic: true,
            label: 'floor',
            render: { fillStyle: '#1a1a2e' }
        });
        World.add(this.world, floor);
    }

    generateInitialPlatforms(settings) {
        for (let i = 0; i < 80; i++) {
            // FIX: Start platforms virtually on the ground and pack them tighter
            this.addPlatform(CONFIG.canvasHeight - 60 - (i * (settings.gapHeight / 1.8)), i);
        }
    }

    addPlatform(y, index) {
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        const isPillar = Math.random() < 0.25;

        // Prevent infinite spawning
        if (this.isGameOver) return;
        const highestSoFar = this.platforms.reduce((min, p) => Math.min(min, p.position.y), Infinity);
        if (y > highestSoFar - 40) return;

        if (isPillar) {
            const height = 180 + Math.random() * 120;
            const x = Math.random() * (CONFIG.canvasWidth - 100) + 50;
            const pillar = Bodies.rectangle(x, y - height / 2, 40, height, {
                isStatic: true,
                label: 'platform',
                render: { fillStyle: '#2d3436', strokeStyle: '#9d00ff', lineWidth: 3 }
            });
            this.platforms.push(pillar);
            World.add(this.world, pillar);
        } else {
            const width = settings.platformWidth * (0.8 + Math.random() * 0.4);
            const x = Math.random() * (CONFIG.canvasWidth - width) + width / 2;
            const isHazard = index > 15 && Math.random() < settings.hazardChance;
            const theme = this.getCurrentTheme();
            const platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, {
                isStatic: true,
                label: isHazard ? 'hazard' : 'platform',
                render: {
                    fillStyle: isHazard ? theme.hazard : theme.platform,
                    strokeStyle: isHazard ? '#fff' : theme.stroke,
                    lineWidth: 2
                }
            });
            this.platforms.push(platform);
            World.add(this.world, platform);

            if (!isHazard && Math.random() < 0.15) {
                this.addCoin(x, y - 40);
            }
        }
    }

    addCoin(x, y) {
        const coin = Bodies.circle(x, y, 8, {
            isStatic: true,
            isSensor: true,
            label: 'coin',
            render: { fillStyle: '#ffcc00' }
        });
        World.add(this.world, coin);
    }

    update() {
        if (this.isGameOver) return;

        this.handleInput();
        this.updateStats();
        this.updateWorld();
        this.checkCollisions();
        this.cullAndGeneratePlatforms();

        if (this.shake > 0) this.shake *= 0.9;

        // Simple fall check
        if (this.player && this.player.position.y > this.lavaHeight + 600) {
            this.triggerDeath("FELL INTO THE ABYSS");
        }
    }

    checkCollisions() {
        if (!this.player) return;

        // Check for collisions safely
        let collisions = [];
        try {
            collisions = Matter.Query.collides(this.player, Composite.allBodies(this.world));
        } catch (e) {
            // Fallback or ignore if API mismatch persists
            console.warn("Collision check failed:", e);
            return;
        }

        collisions.forEach(collision => {
            // collides returns objects with { bodyA, bodyB }
            if (collision.bodyA.label === 'coin' || collision.bodyB.label === 'coin') {
                const coin = collision.bodyA.label === 'coin' ? collision.bodyA : collision.bodyB;
                this.collectCoin(coin);
            }
        });
    }

    collectCoin(coin) {
        this.audio.playCoin();
        this.coins += 5;
        this.addXP(20);
        this.updateHUD();
        this.createParticles(coin.position, '#ffcc00', 10);
        World.remove(this.world, coin);
        localStorage.setItem('coins', this.coins);
    }

    addXP(amt) {
        this.passXP += amt;
        if (this.passXP >= 1000) {
            this.passXP = 0;
            this.passLevel++;
            this.showLevelUp();
        }
        localStorage.setItem('passXP', this.passXP);
        localStorage.setItem('passLevel', this.passLevel);
        this.updateHUD();
        this.renderPass();
    }

    updateWorld() {
        this.lavaHeight -= this.lavaSpeed * (1 + this.currentHeight / 2000);
        if (this.player.position.y > this.lavaHeight) {
            this.triggerDeath("CONSUMED BY LAVA");
        }
    }

    handleInput() {
        if (this.isGameOver || !this.player) return;

        // Valid Physics Check (prevent NaN)
        if (!this.player.velocity || isNaN(this.player.velocity.x)) {
            Body.setVelocity(this.player, { x: 0, y: 0 });
        }

        const velocity = this.player.velocity;
        const baseSpeed = CONFIG.moveSpeed || 18; // Use CONFIG values or reasonable defaults
        const jumpForce = CONFIG.jumpForce || -29;

        // Dash Logic - Fixed detection
        const isDashing = this.rawKeys.has('ShiftLeft') || this.rawKeys.has('ShiftRight');
        const maxSpeed = isDashing ? baseSpeed * 1.5 : baseSpeed;

        // Ground Check
        const onGround = this.checkGrounded();

        // Horizontal Movement (Snappy Acceleration + Friction)
        const accel = onGround ? 1.2 : 0.8;
        const friction = onGround ? 0.82 : 0.92;

        let targetVx = 0;
        const lastSymbol = this.inputStack[this.inputStack.length - 1];

        // Determine Target Direction from Stack
        if (lastSymbol === 'LEFT') targetVx = -maxSpeed;
        else if (lastSymbol === 'RIGHT') targetVx = maxSpeed;

        // Apply Snappy Smoothness
        if (targetVx !== 0) {
            // Accelerate towards target
            this.currentVx += (targetVx - this.currentVx) * accel;
        } else {
            // Apply friction to stop
            this.currentVx *= friction;
            if (Math.abs(this.currentVx) < 0.5) this.currentVx = 0;
        }

        // Limit horizontal velocity
        const maxFinalVel = CONFIG.maxHorizontalVelocity || 26;
        this.currentVx = Math.max(-maxFinalVel, Math.min(maxFinalVel, this.currentVx));

        // Apply Velocity to Body
        Body.setVelocity(this.player, { x: this.currentVx, y: velocity.y });

        // JUMP: Unified Trigger + VISUALS
        if (this.keys['JUMP'] && onGround && !this.jumpDebounce) {
            this.audio.playJump();
            Body.setVelocity(this.player, { x: this.player.velocity.x, y: jumpForce });

            // MASSIVE EXPLOSION EFFECT
            this.createExplosion(
                { x: this.player.position.x, y: this.player.position.y + 20 },
                '#ffffff',
                30 // Double particles
            );
            this.createExplosion(
                { x: this.player.position.x, y: this.player.position.y + 20 },
                this.activeSkinId ? SKINS.find(s => s.id === this.activeSkinId).color : '#9d00ff',
                20 // Double particles
            );

            this.jumpDebounce = true;
            setTimeout(() => this.jumpDebounce = false, 100);
        }

        // Wall Climb Logic
        if (this.checkWallContact()) {
            if (this.keys['JUMP']) {
                this.isClimbing = true;
                // Upward climb force
                Body.setVelocity(this.player, { x: velocity.x, y: -5 });
            } else {
                this.isClimbing = false;
            }
        } else {
            this.isClimbing = false;
        }
    }

    checkWallContact() {
        if (!this.player) return false;
        const bodies = Composite.allBodies(this.world).filter(b => b.label === 'platform');
        const sideOffsets = [-CONFIG.playerRadius - 10, CONFIG.playerRadius + 10]; // Increased range
        return sideOffsets.some(offset => Matter.Query.ray(bodies, this.player.position, { x: this.player.position.x + offset, y: this.player.position.y }).length > 0);
    }

    checkGrounded() {
        const bodies = Composite.allBodies(this.world).filter(b => b.label === 'platform' || b.label === 'floor');
        return [-15, 0, 15].some(offset => Matter.Query.ray(bodies, { x: this.player.position.x + offset, y: this.player.position.y }, { x: this.player.position.x + offset, y: this.player.position.y + CONFIG.playerRadius + 15 }).length > 0);
    }

    updateStats() {
        const height = Math.floor((CONFIG.canvasHeight - 150 - this.player.position.y) / 10);
        this.currentHeight = Math.max(0, height);
        if (this.currentHeight > this.maxHeight) {
            this.maxHeight = this.currentHeight;
            this.addXP(1);
        }
        this.updateHUD();
    }

    triggerDeath(reason) {
        if (this.isGameOver) return;
        this.audio.playDeath();
        this.isGameOver = true;
        this.shake = 35;
        document.getElementById('fall-distance').innerText = this.maxHeight;
        document.getElementById('death-screen').classList.remove('hidden');
        // Unlimited revives, so always enabled
        document.getElementById('ad-revive-btn').disabled = false;
        document.getElementById('ad-revive-btn').disabled = false;
        document.getElementById('ad-revive-btn').innerText = `REVIVE`;

        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight;
            localStorage.setItem('bestHeight', this.bestHeight);
            this.updateHUD();
        }

        // Save Score to Firebase
        if (this.user) {
            this.saveScore(this.maxHeight);
        }
    }

    startAdRevive() {
        console.log("Attempting Instant Revive...");
        try {
            // Instant Revive - No Ad, No Timer
            document.getElementById('death-screen').classList.add('hidden');
            document.getElementById('ad-prompt').classList.add('hidden');
            this.revive();
            console.log("Revive successful");
        } catch (e) {
            console.error("Revive Error:", e);
            alert("Revive Failed: " + e.message);
        }
    }

    revive() {
        this.isGameOver = false;

        // Ensure Physics State is Active
        Body.setStatic(this.player, false);
        Sleeping.set(this.player, false);

        // Resume closer to where fell
        // Ensure X is within safe bounds (padding)
        const safeX = Math.max(100, Math.min(CONFIG.canvasWidth - 100, this.player.position.x));
        const reviveY = this.player.position.y - 600;

        Body.setPosition(this.player, { x: safeX, y: reviveY });
        Body.setVelocity(this.player, { x: 0, y: 0 });

        // SAFETY PLATFORM: Catch the player so they don't fall immediately
        const safetyPlat = Bodies.rectangle(safeX, reviveY + 60, 250, 20, {
            isStatic: true,
            label: 'platform',
            render: { fillStyle: '#00ff88', strokeStyle: '#fff', lineWidth: 2 }
        });
        World.add(this.world, safetyPlat);
        this.platforms.push(safetyPlat); // Track it

        // Huge lava buffer
        this.lavaHeight += 1500;
        this.shake = 10;

        // Force Camera Sync immediately to prevent visual glitch
        // TargetY calculation from postProcess: -this.player.position.y + CONFIG.canvasHeight / 2 + 100
        this.cameraY = -reviveY + CONFIG.canvasHeight / 2 + 100;

        this.createParticles(this.player.position, '#00ff88', 50);
    }

    renderSkins() {
        const container = document.getElementById('skin-container');
        container.innerHTML = '';
        SKINS.forEach(skin => {
            const isOwned = this.ownedSkins.includes(skin.id);
            const isActive = this.activeSkinId === skin.id;
            const card = document.createElement('div');
            card.className = `skin-card ${isActive ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="skin-preview" style="background: ${skin.color}"></div>
                <h3>${skin.name}</h3>
                <p>${isOwned ? (isActive ? 'EQUIPPED' : 'OWNED') : `🪙 ${skin.price}`}</p>
            `;
            card.onclick = () => this.handleSkinClick(skin);
            container.appendChild(card);
        });
    }

    handleSkinClick(skin) {
        if (this.ownedSkins.includes(skin.id)) {
            this.activeSkinId = skin.id;
            localStorage.setItem('activeSkin', skin.id);
        } else if (this.coins >= skin.price) {
            this.coins -= skin.price;
            this.ownedSkins.push(skin.id);
            this.activeSkinId = skin.id;
            localStorage.setItem('coins', this.coins);
            localStorage.setItem('ownedSkins', JSON.stringify(this.ownedSkins));
            localStorage.setItem('activeSkin', skin.id);
        }
        this.updateHUD();
        this.renderSkins();
    }

    renderPass() {
        const container = document.getElementById('pass-rewards-container');
        container.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const isUnlocked = this.passLevel >= i;
            const isClaimed = this.claimedRewards.includes(i);
            const reward = document.createElement('div');

            // Add clickable class if unlocked and not claimed
            const clickableClass = (isUnlocked && !isClaimed) ? 'clickable-reward' : '';

            reward.className = `reward-card ${isUnlocked ? 'unlocked' : ''} ${clickableClass}`;

            // Status Text Logic
            let statusText = "LOCKED";
            if (isClaimed) statusText = "✅ CLAIMED";
            else if (isUnlocked) statusText = "👋 CLAIM";

            reward.innerHTML = `
                <div class="stat-label">LVL ${i}</div>
                <div style="font-size: 2rem">${i % 2 === 0 ? '👕' : '🪙'}</div>
                <div class="stat-unit">${i % 2 === 0 ? 'Xmas Skin' : '+100 Coins'}</div>
                <div style="font-size: 0.7rem; margin-top:5px; font-weight:bold; color:${isUnlocked && !isClaimed ? '#00ffa3' : '#666'}">${statusText}</div>
            `;

            if (isUnlocked && !isClaimed) {
                reward.style.cursor = 'pointer';
                reward.onclick = () => this.claimReward(i);
            }

            container.appendChild(reward);
        }
    }

    claimReward(level) {
        if (this.claimedRewards.includes(level)) return;

        // Reward Logic
        if (level % 2 === 0) {
            // Even levels = Skin
            if (!this.ownedSkins.includes('xmas')) {
                this.ownedSkins.push('xmas');
                localStorage.setItem('ownedSkins', JSON.stringify(this.ownedSkins));
                alert("UNLOCKED: XMAS SKIN!");
            }
        } else {
            // Odd levels = Coins
            this.coins += 100;
            localStorage.setItem('coins', this.coins);
        }

        this.claimedRewards.push(level);
        localStorage.setItem('claimedRewards', JSON.stringify(this.claimedRewards));

        this.updateHUD();
        this.renderPass();
        this.renderSkins(); // Update skins if a skin was unlocked
    }

    getCurrentTheme() {
        const level = this.passLevel || 1;
        if (level >= 10) return THEMES.gold;
        if (level >= 7) return THEMES.void;
        if (level >= 4) return THEMES.frost;
        if (level >= 2) return THEMES.lava;
        return THEMES.cave;
    }

    drawWorldExt(ctx) {
        const theme = this.getCurrentTheme();
        const lavaY = this.lavaHeight + this.cameraY;
        const time = this.engine.timing.timestamp * 0.002;

        // Lava
        ctx.save();
        ctx.fillStyle = theme.lava;
        ctx.globalAlpha = 0.5 + Math.sin(time) * 0.15;

        if (CONFIG.canvasWidth > 768) {
            ctx.shadowBlur = 40;
            ctx.shadowColor = theme.glow;
        }

        ctx.fillRect(0, lavaY, CONFIG.canvasWidth, 3000);

        // Lava Edge
        ctx.beginPath();
        ctx.strokeStyle = theme.lava;
        ctx.lineWidth = 6;
        for (let i = 0; i <= CONFIG.canvasWidth; i += 40) {
            ctx.lineTo(i, lavaY + Math.sin(time + i * 0.015) * 12);
        }
        ctx.stroke();
        ctx.restore();

        // Player with skin
        const skin = SKINS.find(s => s.id === this.activeSkinId);
        if (!this.player) return; // Guard
        const p = this.player.position;
        const sy = p.y + this.cameraY;

        ctx.save();
        ctx.translate(p.x, sy);

        // Draw Hands (attached to body)
        ctx.strokeStyle = skin.color;
        ctx.lineWidth = 4;
        const armWave = Math.sin(time * 5) * 8;
        const armY = this.isClimbing ? -10 : 5;

        ctx.beginPath();
        ctx.moveTo(-12, armY);
        ctx.lineTo(-22, armY + armWave + (this.isClimbing ? -10 : 8));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(12, armY);
        ctx.lineTo(22, armY - armWave + (this.isClimbing ? -10 : 8));
        ctx.stroke();

        if (this.player) ctx.rotate(this.player.angle);

        // SUPER EXAGGERATED SQUASH
        const velocity = this.player.velocity.y;
        let scaleX = 1, scaleY = 1;
        // Simple, linear stretch based on speed
        if (Math.abs(velocity) > 0.5) {
            const stretch = Math.min(Math.abs(velocity) * 0.05, 0.4);
            scaleX = 1 - stretch;
            scaleY = 1 + stretch;
        }
        ctx.scale(scaleX, scaleY);

        ctx.fillStyle = '#050508';
        ctx.beginPath(); ctx.arc(0, 0, CONFIG.playerRadius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = skin.color;
        ctx.lineWidth = 4; ctx.stroke();

        // Eyes
        const blink = Math.sin(time * 2.5) > 0.97 ? 0.1 : 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-8, -5, 5, 7 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(8, -5, 5, 7 * blink, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Particles (Optimized Loop)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vy += 0.12;
            pt.life -= 0.025;

            if (pt.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y + this.cameraY, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    createExplosion(pos, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: pos.x,
                y: pos.y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: color,
                size: Math.random() * 6 + 2
            });
        }
    }

    createParticles(pos, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 1) * 12, life: 1, color });
        }
    }

    postProcess() {
        const ctx = this.render.context;
        if (!this.player) return; // Guard

        const width = window.innerWidth;
        const height = window.innerHeight;

        const targetY = -this.player.position.y + height / 2 + 100;
        this.cameraY += (targetY - this.cameraY) * 0.15;
        const bx = (Math.random() - 0.5) * this.shake;

        Render.lookAt(this.render, {
            min: { x: bx, y: -this.cameraY },
            max: { x: width + bx, y: height - this.cameraY }
        });
        this.drawWorldExt(ctx);
    }

    cullAndGeneratePlatforms() {
        if (!this.player) return;
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        const highest = this.platforms.reduce((min, p) => Math.min(min, p.position.y), Infinity);

        // Only spawn if we are getting close to the top edge and NOT infinitely loop
        if (this.player.position.y < highest + 600) {
            this.addPlatform(highest - (settings.gapHeight), this.platforms.length);
        }
    }

    saveScore(score) {
        if (!this.user || this.isLocalGuest) return;
        const userRef = doc(db, "scores", this.user.uid);

        // Check if current score is better than stored
        getDoc(userRef).then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (score > data.score) {
                    setDoc(userRef, {
                        uid: this.user.uid,
                        displayName: this.user.displayName || "Guest",
                        score: score,
                        timestamp: new Date()
                    }, { merge: true });
                }
            } else {
                setDoc(userRef, {
                    uid: this.user.uid,
                    displayName: this.user.displayName || "Guest",
                    score: score,
                    timestamp: new Date()
                });
            }
        }).catch((error) => console.error("Error saving score:", error));
    }

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        CONFIG.canvasWidth = width;
        CONFIG.canvasHeight = height;

        this.canvas.width = width;
        this.canvas.height = height;

        if (this.render) {
            this.render.options.width = width;
            this.render.options.height = height;
            this.render.canvas.width = width;
            this.render.canvas.height = height;

            // Adjust bounds immediately to prevent jitter
            this.render.bounds.max.x = width;
            this.render.bounds.max.y = height;
        }

        if (this.leftWall && this.rightWall) {
            const wallThickness = 100;
            Body.setPosition(this.leftWall, { x: -wallThickness / 2, y: this.player ? this.player.position.y : 0 });
            Body.setPosition(this.rightWall, { x: width + wallThickness / 2, y: this.player ? this.player.position.y : 0 });
        }
    }

    showLevelUp() {
        this.audio.playLevelUp();
        const toast = document.getElementById('level-up-toast');
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

const game = new Game();
const resumeAudio = () => {
    game.audio.init();
    if (game.audio.ctx && game.audio.ctx.state === 'suspended') {
        game.audio.ctx.resume();
    }
};

window.addEventListener('mousedown', resumeAudio, { once: true });
window.addEventListener('touchstart', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });
