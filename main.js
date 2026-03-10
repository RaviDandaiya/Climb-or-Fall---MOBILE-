import Matter from 'matter-js';
import { Capacitor } from '@capacitor/core';
import { UnityAds } from 'capacitor-unity-ads';

const { Engine, Render, Runner, Bodies, Composite, World, Events, Body, Sleeping } = Matter;

const CONFIG = {
    canvasWidth: 600,
    canvasHeight: 900,
    playerRadius: 18,
    moveSpeed: 7.5,
    jumpForce: -20.0,
    platformHeight: 12
};

const THEMES = [
    { name: 'Void', bg: ['#0f0c29', '#302b63'], accent: '#9d00ff' },
    { name: 'Fire', bg: ['#1e130c', '#9a0606'], accent: '#ff4b2b' },
    { name: 'Neon', bg: ['#000000', '#434343'], accent: '#00ff88' },
    { name: 'Ocean', bg: ['#114357', '#f29492'], accent: '#2ebf91' }
];

const DIFFICULTY_SETTINGS = {
    easy: { lavaSpeed: 0.4, gapHeight: 100, platformWidth: 160, hazardChance: 0.05, pillarChance: 0.02 },
    medium: { lavaSpeed: 0.65, gapHeight: 125, platformWidth: 130, hazardChance: 0.12, pillarChance: 0.05 },
    hard: { lavaSpeed: 0.9, gapHeight: 145, platformWidth: 100, hazardChance: 0.22, pillarChance: 0.1 }
};

const SKINS = [
    { id: 'default', name: 'GLOW', color: '#9d00ff', price: 0 },
    { id: 'neon', name: 'CYBER', color: '#00ff88', price: 200 },
    { id: 'ninja', name: 'NIGHT', color: '#ffcc00', price: 500 },
    { id: 'alien', name: 'XENO', color: '#ff00ff', price: 1000 },
    { id: 'xmas', name: 'SANTA', color: '#ff0044', price: 1500 }
];

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
        this.particles = [];
        this.particlePool = [];
        this.shake = 0;
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;
        this.controlMode = localStorage.getItem('controlMode') || 'touch';
        this.gameMode = 'climb';
        
        this.hasShield = false;
        this.magnetTimer = 0;
        this.powerups = [];

        this.stars = Array.from({ length: 80 }, () => ({
            x: Math.random() * CONFIG.canvasWidth,
            y: Math.random() * CONFIG.canvasHeight,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.7 + 0.3
        }));

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

                if (!this.isGameOver && this.player) {
                    // Update Physics at a fixed timestep for consistency across devices
                    Engine.update(this.engine, 16.666);
                    this.update();
                    this.createCuteTrail();
                }

                this.renderWorldManual();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);

            this.enemies = [];
            this.initAds();

            this.platformCanvas = document.createElement('canvas');
            this.platformCanvas.width = 300;
            this.platformCanvas.height = 30;
            this.drawCachedPlatform();

            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    this.audio = new AudioContext();
                    this.masterGain = this.audio.createGain();
                    this.masterGain.gain.value = 0.12;
                    this.masterGain.connect(this.audio.destination);
                }
            } catch (err) { console.warn('audio init fail', err); }

            this.showMenu();
        } catch (e) {
            console.error("Initialization Error:", e);
            document.getElementById('difficulty-screen').classList.remove('hidden');
        }
    }

    setupEventListeners() {
        document.getElementById('retry-button').onclick = () => location.reload();

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
                btnClimb.classList.add('active');
                btnFall.classList.remove('active');
            };
            btnFall.onclick = () => {
                this.gameMode = 'fall';
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

    showMenu() {
        document.getElementById('difficulty-screen').classList.remove('hidden');
    }

    updateHUD() {
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.coins;
        if (document.getElementById('best-value')) document.getElementById('best-value').innerText = this.bestHeight;
        if (document.getElementById('height-value')) document.getElementById('height-value').innerText = this.currentHeight;
        if (document.getElementById('pass-level')) document.getElementById('pass-level').innerText = this.passLevel;
    }

    startGame(diff) {
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = this.gameMode === 'climb' ? CONFIG.canvasHeight + 1200 : -1200;
        this.isGameOver = false;
        this.revivesLeft = 2; // Limit to 2 revives per game
        document.getElementById('difficulty-screen').classList.add('hidden');
        window.focus();

        Composite.clear(this.world);
        this.engine.world.gravity.y = 1.35;
        this.cameraY = 0;
        this.maxHeight = 0;
        this.currentHeight = 0;

        this.platforms = [];
        this.enemies = [];
        this.particles = [];
        this.dashCooldown = 0;
        this.isDashingFrames = 0;
        this.createPlayer();
        this.createStartPlatform();
        this.generateInitialPlatforms(settings);
        Body.setStatic(this.player, false);
        try { Sleeping.set(this.player, false); } catch (e) { }
    }

    createPlayer() {
        const startY = this.gameMode === 'climb' ? CONFIG.canvasHeight - 150 : 150;
        this.player = Bodies.circle(CONFIG.canvasWidth / 2, startY, CONFIG.playerRadius, {
            friction: 0.001,
            restitution: 0.1,
            label: 'player',
            render: { visible: false }
        });
        World.add(this.world, this.player);
    }

    createStartPlatform() {
        const floorY = this.gameMode === 'climb' ? CONFIG.canvasHeight + 100 : -100;
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
            const y = this.gameMode === 'climb' 
                ? (CONFIG.canvasHeight - 60 - (i * settings.gapHeight))
                : (60 + (i * settings.gapHeight));
            this.addPlatform(y, i);
        }
    }

    addPlatform(y, index) {
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        const isPillar = Math.random() < settings.pillarChance;
        if (this.isGameOver) return;

        if (isPillar) {
            const height = 100 + Math.random() * 150; // Taller green pillars
            const x = Math.random() * (CONFIG.canvasWidth - 80) + 40;
            const pillar = Bodies.rectangle(x, y, 40, height, { isStatic: true, label: 'pillar', render: { visible: false } });
            if (this.maxHeight > 500 && Math.random() < 0.6) {
                pillar.isMoving = true;
                pillar.moveSpeed = (Math.random() < 0.5 ? 1 : -1) * (1.5 + Math.random() * 2);
                pillar.minX = 40; pillar.maxX = CONFIG.canvasWidth - 40;
            }
            this.platforms.push(pillar);
            World.add(this.world, pillar);
        } else {
            const width = (settings.platformWidth * 0.7) + (Math.random() * settings.platformWidth * 1.0);
            const x = (Math.random() * (CONFIG.canvasWidth - width - 60)) + width / 2 + 30;
            const isHazard = index > 15 && Math.random() < settings.hazardChance;
            const isCrumbling = !isHazard && index > 10 && Math.random() < 0.15;
            const platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, { isStatic: true, label: isHazard ? 'hazard' : 'platform', render: { visible: false } });
            if (isCrumbling) {
                platform.isCrumbling = true;
                platform.crumbleTimer = 0; // Not yet touched
            }
            this.platforms.push(platform);
            World.add(this.world, platform);
            if (!isHazard && !isCrumbling) {
                const rng = Math.random();
                if (rng < 0.1) this.addCoin(x, y - 35);
                else if (rng < 0.15) this.addPowerup(x, y - 40); 
            }
        }
    }

    addPowerup(x, y) {
        const type = Math.random() < 0.5 ? 'shield' : 'magnet';
        const p = Bodies.circle(x, y, 16, { isStatic: true, isSensor: true, label: 'powerup' });
        p.powerupType = type;
        this.powerups.push(p);
        World.add(this.world, p);
    }

    collectPowerup(p) {
        if (p.powerupType === 'shield') {
            this.hasShield = true;
            this.createExplosion(p.position, '#00d1ff', 20);
        } else if (p.powerupType === 'magnet') {
            this.magnetTimer = 600; // ~10 seconds
            this.createExplosion(p.position, '#ff3e3e', 20);
        }
        World.remove(this.world, p);
        this.powerups = this.powerups.filter(item => item !== p);
        this._playTone(880, 'sine', 0, 0.15);
    }

    consumeShield() {
        this.hasShield = false;
        this.createExplosion(this.player.position, '#00d1ff', 30);
        this._playTone(220, 'sawtooth', 0, 0.3);
    }

    addCoin(x, y) {
        const coin = Bodies.circle(x, y, 8, { isStatic: true, isSensor: true, label: 'coin' });
        World.add(this.world, coin);
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
        const abyssDead = this.gameMode === 'climb' 
            ? (this.player.position.y > this.lavaHeight + 800)
            : (this.player.position.y < this.lavaHeight - 800);
        if (this.player && abyssDead) {
            if (this.hasShield) {
                this.consumeShield();
                Body.setVelocity(this.player, { x: 0, y: this.gameMode === 'climb' ? -20 : 20 });
            } else {
                this.triggerDeath(this.gameMode === 'climb' ? "FELL INTO THE ABYSS" : "SOARED TO OBLIVION");
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
                } else {
                    this.triggerDeath(other.label === 'enemy' ? "SLAIN BY A FOE" : "CATASTROPHE");
                }
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
        
        if (this.gameMode === 'climb') {
            this.lavaHeight -= this.lavaSpeed * mult;
            if (this.player.position.y > this.lavaHeight) this.triggerDeath("CONSUMED BY LAVA");
        } else {
            this.lavaHeight += this.lavaSpeed * mult;
            if (this.player.position.y < this.lavaHeight) this.triggerDeath("IMPALED BY SPIKES");
        }
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
            this.smoothedGamma += (this.gyroGamma - this.smoothedGamma) * 0.15;
            let tilt = this.smoothedGamma;
            if (Math.abs(tilt) > 4) targetVx = baseSpeed * Math.sign(tilt) * Math.min(1.2, Math.abs(tilt) / 20);
        }
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) targetVx = -baseSpeed;
        else if (this.keys['ArrowRight'] || this.keys['KeyD']) targetVx = baseSpeed;

        if (this.dashCooldown > 0) this.dashCooldown--;
        if (this.isDashingFrames > 0) {
            this.isDashingFrames--;
            this.createCuteTrail(); // Intense trail
        }

        if ((this.keys['PowerDash'] || this.keys['KeyE'] || this.keys['ShiftLeft']) && this.dashCooldown <= 0) {
            Body.setVelocity(this.player, { x: targetVx, y: -40 });
            this.keys['PowerDash'] = false; this.keys['KeyE'] = false; this.keys['ShiftLeft'] = false;
            this.isDashingFrames = 25; // Invincible Dash time
            this.dashCooldown = 250;
            this.createExplosion(this.player.position, '#00ff88', 25);
            this.playJump();

            // Erase visible red hazards & enemies instantly
            const scale = this.canvas.width / CONFIG.canvasWidth;
            const viewTop = -this.cameraY - (this.canvas.height / scale) * 0.2;
            const viewBottom = -this.cameraY + (this.canvas.height / scale) * 1.5;

            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (e.position.y > viewTop && e.position.y < viewBottom) {
                    World.remove(this.world, e);
                    this.createExplosion(e.position, '#ff2200', 30);
                    this.addXP(30);
                    this.enemies.splice(i, 1);
                }
            }
            for (let i = this.platforms.length - 1; i >= 0; i--) {
                const p = this.platforms[i];
                if (p.label === 'hazard' && p.position.y > viewTop && p.position.y < viewBottom) {
                    World.remove(this.world, p);
                    this.createExplosion(p.position, '#ff2200', 30);
                    this.addXP(30);
                    this.platforms.splice(i, 1);
                }
            }
        }

        if (targetVx !== 0) Body.setVelocity(this.player, { x: targetVx, y: vel.y });
        else Body.setVelocity(this.player, { x: vel.x * 0.8, y: vel.y });

        if ((this.keys['TouchJump'] || this.keys['Space'] || this.keys['ArrowUp']) && onGround && !this.jumpDebounce) {
            Body.setVelocity(this.player, { x: this.player.velocity.x, y: jumpForce });
            this.keys['TouchJump'] = false; this.keys['Space'] = false;
            this.createExplosion({ x: this.player.position.x, y: this.player.position.y + 16 }, '#ffffff', 10);
            this.playJump();
            this.jumpDebounce = true;
            setTimeout(() => this.jumpDebounce = false, 200);
        }
    }

    updateStats() {
        const startY = this.gameMode === 'climb' ? CONFIG.canvasHeight - 150 : 150;
        const h = Math.floor(Math.abs(startY - this.player.position.y) / 10);
        this.currentHeight = Math.max(0, h);
        if (this.currentHeight > this.maxHeight) {
            this.maxHeight = this.currentHeight; this.addXP(1);
            const newStage = Math.floor(this.maxHeight / 150);
            if (newStage > this.stage) { this.stage = newStage; this.levelUpTwist(this.stage); }
        }
        document.getElementById('height-value').innerText = this.currentHeight;
    }

    levelUpTwist(stage) {
        this.currentTheme = THEMES[stage % THEMES.length];
        this.lavaSpeed += 0.05;
        this.playLevelUp();
    }

    triggerDeath(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true; this.shake = 30;
        document.getElementById('fall-distance').innerText = this.maxHeight;
        document.getElementById('death-screen').classList.remove('hidden');
        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight; localStorage.setItem('bestHeight', this.bestHeight);
            this.updateHUD();
        }

        const btn = document.getElementById('ad-revive-btn');
        if (this.revivesLeft > 0) {
            btn.style.display = 'block';
            btn.innerText = `WATCH AD TO REVIVE (${this.revivesLeft} LEFT)`;
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
        const ry = this.player.position.y - 600;
        Body.setPosition(this.player, { x: rx, y: ry });
        Body.setVelocity(this.player, { x: 0, y: 0 });
        const s = Bodies.rectangle(rx, ry + 60, 200, 20, { isStatic: true, label: 'platform' });
        World.add(this.world, s); this.platforms.push(s);
        this.lavaHeight += 1200;
        this.createParticles(this.player.position, '#00ff88', 30);
    }

    renderSkins() {
        const container = document.getElementById('skin-container');
        if (!container) return;
        container.innerHTML = '';
        SKINS.forEach(skin => {
            const card = document.createElement('div');
            card.className = `skin-card ${this.activeSkinId === skin.id ? 'selected' : ''}`;
            card.innerHTML = `<div class="skin-preview" style="background: ${skin.color}"></div><h3>${skin.name}</h3>`;
            card.onclick = () => {
                this.activeSkinId = skin.id; localStorage.setItem('activeSkin', skin.id);
                this.renderSkins();
            };
            container.appendChild(card);
        });
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
        const ctx = this.ctx;
        if (!ctx) return;

        // 1. Clear with animated gradient background
        const bgTime = performance.now() / 2000;
        const bgOffset1 = Math.sin(bgTime) * 300;
        const bgOffset2 = Math.cos(bgTime) * 300;
        const grad = ctx.createLinearGradient(0, bgOffset1, 0, Math.max(window.innerHeight, this.canvas.height) + bgOffset2);
        grad.addColorStop(0, this.currentTheme.bg[0]);
        grad.addColorStop(1, this.currentTheme.bg[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width + 1000, this.canvas.height + 1000);

        // 2. Camera & Global Transform
        ctx.save();

        // Centering & Scaling logic
        // We want our 600px wide game logic to fit horizontally
        const scale = this.canvas.width / CONFIG.canvasWidth;
        ctx.scale(scale, scale);

        // Vertical Camera sync
        if (this.player) {
            const targetY = -this.player.position.y + (this.canvas.height / scale) / 2 + 100;
            this.cameraY += (targetY - this.cameraY) * 0.1;
        }
        ctx.translate(0, this.cameraY);

        // Draw physical side walls (Animated Glowing Laser Barriers)
        const viewTop = -this.cameraY - 1000;
        const viewHeight = (this.canvas.height / scale) + 2000;

        ctx.fillStyle = '#111116';
        ctx.fillRect(0, viewTop, 20, viewHeight); // left wall
        ctx.fillRect(CONFIG.canvasWidth - 20, viewTop, 20, viewHeight); // right wall

        // Laser barrier inner edge animation
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
        ctx.fillStyle = `rgba(0, 255, 136, ${0.4 * pulse})`;
        ctx.fillRect(18, viewTop, 2, viewHeight);
        ctx.fillRect(CONFIG.canvasWidth - 20, viewTop, 2, viewHeight);

        // Draw Earth surface for the start!
        ctx.fillStyle = '#3a2318'; // Dark earth dirt
        const surfaceY = this.gameMode === 'climb' ? CONFIG.canvasHeight : 0;
        const surfaceH = this.gameMode === 'climb' ? 10000 : -10000;
        ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, surfaceH);
        ctx.fillStyle = '#00af50'; // Grass top
        ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, this.gameMode === 'climb' ? 20 : -20);

        // 3. Draw Stars
        const time = performance.now() / 1000;
        this.stars.forEach(s => {
            s.y = (s.y + 0.2) % (this.canvas.height / scale + 1000);
            ctx.fillStyle = `rgba(255,255,255,${s.opacity * (0.6 + 0.4 * Math.sin(time + s.x))})`;
            ctx.fillRect(s.x, s.y - 500, s.size, s.size);
        });

        // 4. Draw Platforms
        this.platforms.forEach(p => {
            if (p.label === 'platform') {
                const w = p.bounds.max.x - p.bounds.min.x;
                ctx.save();
                if (p.isCrumbling && p.crumbleTimer > 0) {
                    const shake = Math.sin(performance.now() * 0.1) * 3;
                    ctx.translate(shake, 0);
                    ctx.filter = 'contrast(1.5) brightness(1.2)';
                }
                
                if (p.isCrumbling) {
                    // Draw a unique aesthetic for crumbling platforms
                    ctx.fillStyle = p.crumbleTimer > 0 ? '#ffae00' : '#d2b48c'; // Tan to Orange
                    ctx.strokeStyle = '#8b4513';
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, p.position.x - w / 2, p.position.y - 6, w, 15, 4);
                    ctx.fill();
                    ctx.stroke();
                    // Cracked lines
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.moveTo(p.position.x - w/4, p.position.y - 6);
                    ctx.lineTo(p.position.x - w/5, p.position.y + 9);
                    ctx.stroke();
                } else {
                    ctx.drawImage(this.platformCanvas, 5, 5, 190, 15, p.position.x - w / 2, p.position.y - 6, w, 15);
                }
                ctx.restore();
            } else if (p.label === 'pillar') {
                const w = p.bounds.max.x - p.bounds.min.x;
                const h = p.bounds.max.y - p.bounds.min.y;
                ctx.fillStyle = '#00af50';
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3;
                this.roundRect(ctx, p.bounds.min.x, p.bounds.min.y, w, h, 8);
                ctx.fill();
                ctx.stroke();
            } else if (p.label === 'hazard') {
                ctx.fillStyle = '#ff2200';
                ctx.fillRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
            }
        });

        // 4.5 Draw Powerups
        this.powerups.forEach(p => {
            ctx.save();
            ctx.translate(p.position.x, p.position.y);
            // Floating animation
            ctx.translate(0, Math.sin(performance.now() / 200) * 10);
            
            // Draw glowing background
            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
            glow.addColorStop(0, p.powerupType === 'shield' ? 'rgba(0, 209, 255, 0.4)' : 'rgba(255, 62, 62, 0.4)');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.fill();

            // Icon circle
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.strokeStyle = p.powerupType === 'shield' ? '#00d1ff' : '#ff3e3e';
            ctx.lineWidth = 3;
            ctx.fill();
            ctx.stroke();

            // Symbol
            ctx.fillStyle = '#fff';
            ctx.font = '800 14px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.powerupType === 'shield' ? '🛡️' : '🧲', 0, 1);
            ctx.restore();
        });

        // 5. Draw Enemies (Realistic Spiked Balls)
        this.enemies.forEach(e => {
            const numSpikes = 8;
            const outerRadius = 18;
            const innerRadius = 12;

            ctx.save();
            ctx.translate(e.position.x, e.position.y);
            // Spin the enemy based on position to look like a rotating saw
            ctx.rotate(e.position.x / 15);

            ctx.beginPath();
            for (let i = 0; i < numSpikes * 2; i++) {
                const angle = (Math.PI / numSpikes) * i;
                const r = i % 2 === 0 ? outerRadius : innerRadius;
                if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.strokeStyle = '#ff0044';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner glowing core
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0044';
            ctx.fill();

            ctx.restore();
        });

        // 6. Draw Lava (Realistic Animated Waves)
        ctx.save();
        ctx.beginPath();
        const drawLavaPos = this.lavaHeight;
        const lavaExtra = this.gameMode === 'climb' ? 500 : -500;
        ctx.moveTo(-100, drawLavaPos + lavaExtra); // start at bottom left
        ctx.lineTo(-100, drawLavaPos); // go up to lava level

        // Draw wavy surface or sharp spikes
        if (this.gameMode === 'climb') {
            for (let x = -100; x <= CONFIG.canvasWidth + 200; x += 10) {
                const waveY = drawLavaPos + Math.sin((x / 30) + (time * 2)) * 8 + Math.cos((x / 50) - (time * 1.5)) * 6;
                ctx.lineTo(x, waveY);
            }
        } else {
            // RAZOR SHARP SPIKES for Fall mode
            const spikeWidth = 30;
            const spikeHeight = 70;
            for (let x = -100; x <= CONFIG.canvasWidth + 200; x += spikeWidth) {
                const vx = Math.sin(time * 10 + x) * 2;
                ctx.lineTo(x + spikeWidth / 2 + vx, drawLavaPos + spikeHeight + Math.cos(time * 15 + x) * 5);
                ctx.lineTo(x + spikeWidth, drawLavaPos);
            }
        }

        ctx.lineTo(CONFIG.canvasWidth + 200, drawLavaPos + lavaExtra); // down to bottom right
        ctx.closePath();

        // Fill lava with gradient
        // Using absolute world coordinates for current screen area so gradient interpolates smoothly without glitching
        const screenBottomRaw = -this.cameraY + this.canvas.height / scale;
        const lavaTop = this.gameMode === 'climb' ? drawLavaPos - 10 : drawLavaPos + 10;
        const lavaBottom = this.gameMode === 'climb' 
            ? Math.max(lavaTop + 100, screenBottomRaw)
            : Math.min(lavaTop - 100, -this.cameraY);

        const lavaGrad = ctx.createLinearGradient(0, lavaTop, 0, lavaBottom);
        lavaGrad.addColorStop(0, '#ffcc00'); // fiery yellow top
        lavaGrad.addColorStop(Math.min(0.2, Math.abs(100 / (lavaBottom - lavaTop + 1))), '#ff3300'); // burning red
        lavaGrad.addColorStop(1, '#660000'); // dark magma

        ctx.fillStyle = lavaGrad;
        ctx.fill();

        // Add a glowing top edge stroke to the lava
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // 7. Draw Player with Squash & Stretch
        if (this.player) {
            const skin = SKINS.find(s => s.id === this.activeSkinId);
            const velY = Math.abs(this.player.velocity.y);
            const stretch = 1 + Math.min(0.3, velY / 40);
            const squash = 1 / stretch;

            ctx.save();
            ctx.translate(this.player.position.x, this.player.position.y);

            // POWERUPS FX
            if (this.hasShield) {
                ctx.beginPath();
                ctx.arc(0, 0, CONFIG.playerRadius + 12, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 209, 255, ${0.4 + 0.2 * Math.sin(performance.now() / 100)})`;
                ctx.lineWidth = 4;
                ctx.stroke();
                // Subtle fill
                ctx.fillStyle = 'rgba(0, 209, 255, 0.05)';
                ctx.fill();
            }

            if (this.magnetTimer > 0) {
                ctx.beginPath();
                const magSize = 35 + Math.sin(performance.now() / 50) * 5;
                ctx.arc(0, 0, magSize, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 62, 62, 0.3)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Apply squash / stretch scale
            ctx.scale(squash, stretch);

            // Draw spinning body circle (opaque fill inside stroke)
            ctx.save();
            ctx.rotate(this.player.angle);
            ctx.beginPath();
            ctx.arc(0, 0, CONFIG.playerRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#050508';
            ctx.fill();
            ctx.strokeStyle = skin.color;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            // Draw upright Features (Eyes & thick lines for hands)
            ctx.fillStyle = '#ffffff';

            // Eyes (with cute blinking animation)
            const eyeSpacing = 6;
            const isBlinking = (performance.now() % 3500) < 150 || (velY < 0.5 && (performance.now() % 2000) < 100);

            if (isBlinking) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-eyeSpacing - 4, -2);
                ctx.lineTo(-eyeSpacing + 4, -2);
                ctx.moveTo(eyeSpacing - 4, -2);
                ctx.lineTo(eyeSpacing + 4, -2);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(-eyeSpacing, -2, 5.5, 0, Math.PI * 2); // Left Eye
                ctx.arc(eyeSpacing, -2, 5.5, 0, Math.PI * 2); // Right Eye
                ctx.fill();
            }

            // Add tiny blush for cuteness
            ctx.fillStyle = 'rgba(255, 100, 150, 0.6)';
            ctx.beginPath();
            ctx.arc(-eyeSpacing - 4, 3, 3.5, 0, Math.PI * 2);
            ctx.arc(eyeSpacing + 4, 3, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Hands (thick lines pointing outwards/downwards)
            ctx.strokeStyle = skin.color;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';

            ctx.beginPath();
            // Left hand
            ctx.moveTo(-16, 5);
            ctx.lineTo(-24, 10);
            // Right hand
            ctx.moveTo(16, 5);
            ctx.lineTo(24, 10);
            ctx.stroke();

            ctx.restore();
        }

        // 8. Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life -= 0.03;
            if (pt.life <= 0) {
                this.particlePool.push(this.particles.splice(i, 1)[0]);
                continue;
            }
            ctx.fillStyle = pt.color;
            ctx.globalAlpha = pt.life;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    createExplosion(pos, color, count) {
        for (let i = 0; i < count; i++) {
            const p = this.particlePool.pop() || {};
            p.x = pos.x; p.y = pos.y; p.vx = (Math.random() - 0.5) * 12; p.vy = (Math.random() - 0.5) * 12;
            p.life = 1; p.color = color; this.particles.push(p);
        }
    }

    createParticles(pos, color, count) {
        for (let i = 0; i < count; i++) {
            const p = this.particlePool.pop() || {};
            p.x = pos.x; p.y = pos.y; p.vx = (Math.random() - 0.5) * 15; p.vy = (Math.random() - 1) * 15;
            p.life = 1; p.color = color; this.particles.push(p);
        }
    }

    createCuteTrail() {
        if (!this.player || this.isGameOver) return;
        const speedSq = this.player.velocity.x * this.player.velocity.x + this.player.velocity.y * this.player.velocity.y;
        if (speedSq > 5 && Math.random() < 0.3) {
            const p = this.particlePool.pop() || {};
            p.x = this.player.position.x + (Math.random() - 0.5) * 20;
            p.y = this.player.position.y + (Math.random() - 0.5) * 20;
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = (Math.random() - 0.5) * 2;
            p.life = 1;
            const skin = SKINS.find(s => s.id === this.activeSkinId);
            p.color = skin ? skin.color : '#ffffff';
            this.particles.push(p);
        }
    }

    _playTone(freq, type = 'sine', when = 0, duration = 0.08) {
        if (!this.audio) return;
        try {
            const now = this.audio.currentTime + when;
            const o = this.audio.createOscillator(); const g = this.audio.createGain();
            o.type = type; o.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(0.001, now); g.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);
            o.connect(g); g.connect(this.masterGain); o.start(now); o.stop(now + duration + 0.02);
        } catch (e) { }
    }

    playJump() { this._playTone(520, 'sawtooth', 0, 0.09); }
    playCoin() { this._playTone(920, 'sine', 0, 0.08); }
    playLevelUp() { this._playTone(720, 'triangle', 0, 0.18); this._playTone(980, 'sine', 0.05, 0.12); }
    playGameOver() { this._playTone(120, 'sine', 0, 0.4); }
    playFall() { this._playTone(300, 'sawtooth', 0, 0.5); }

    showLevelUpToast(level) {
        const el = document.createElement('div'); el.id = 'level-up-toast';
        el.innerHTML = `<div class="toast-title">LEVEL UP</div><div>Tier ${level} reached!</div>`;
        document.getElementById('game-container').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    cullAndGeneratePlatforms() {
        if (!this.player || this.isGameOver) return;
        const ly = this.lavaHeight + (this.gameMode === 'climb' ? 500 : -500), py = this.player.position.y;
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            // Cull platforms below lava OR far below the player
            const toCull = this.gameMode === 'climb'
                ? (this.platforms[i].position.y > Math.min(ly, py + 1500))
                : (this.platforms[i].position.y < Math.max(ly, py - 1500));
            
            if (toCull) {
                World.remove(this.world, this.platforms[i]); this.platforms.splice(i, 1);
            }
        }
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            if (this.powerups[i].position.y > Math.min(ly, py + 1500) || this.powerups[i].position.y < Math.max(ly, py - 1500)) {
                World.remove(this.world, this.powerups[i]); this.powerups.splice(i, 1);
            }
        }
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        let nextY = this.platforms.length 
            ? (this.gameMode === 'climb' 
                ? this.platforms.reduce((m, p) => Math.min(m, p.position.y), Infinity)
                : this.platforms.reduce((m, p) => Math.max(m, p.position.y), -Infinity))
            : py;

        while (!this.isGameOver && this.platforms.length < 40) {
            const checkDist = this.gameMode === 'climb' ? (py < nextY + 2500) : (py > nextY - 2500);
            if (!checkDist) break;

            const offset = (settings.gapHeight * (0.8 + Math.random() * 0.9));
            nextY = this.gameMode === 'climb' ? nextY - offset : nextY + offset;
            this.addPlatform(nextY, this.platforms.length);
            if (this.stage >= 1 && Math.random() < 0.1) {
                const enemyOffset = this.gameMode === 'climb' ? -400 : 400;
                this.addEnemy(nextY + enemyOffset);
            }
        }
    }

    addEnemy(y) {
        const x = Math.random() * (CONFIG.canvasWidth - 100) + 50;
        const e = Bodies.rectangle(x, y, 40, 30, { isStatic: true, isSensor: true, label: 'enemy' });
        e.moveSpeed = (Math.random() < 0.5 ? 2 : -2);
        this.enemies.push(e); World.add(this.world, e);
    }

    handleResize() {
        if (window.innerWidth === 0) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Disable Matter.js render options updates as we render manually
    }

    renderPass() {
        const container = document.getElementById('pass-rewards-container');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const isUnlocked = this.passLevel >= i;
            const isClaimed = this.claimedRewards.includes(i);
            const reward = document.createElement('div');
            const clickableClass = (isUnlocked && !isClaimed) ? 'clickable-reward' : '';
            reward.className = `reward-card ${isUnlocked ? 'unlocked' : ''} ${clickableClass}`;
            let statusText = "LOCKED";
            if (isClaimed) statusText = "CLAIMED";
            else if (isUnlocked) statusText = "CLAIM";
            reward.innerHTML = `<div class="stat-label">LVL ${i}</div>
                <div style="font-size: 2rem">${i % 2 === 0 ? '👕' : '🪙'}</div>
                <div class="stat-unit">${i % 2 === 0 ? 'Xmas Skin' : '+100 Coins'}</div>
                <div style="font-size: 0.7rem; margin-top:5px; font-weight:bold; color:${isUnlocked && !isClaimed ? '#00ffa3' : '#666'}">${statusText}</div>`;
            if (isUnlocked && !isClaimed) {
                reward.style.cursor = 'pointer';
                reward.onclick = () => this.claimReward(i);
            }
            container.appendChild(reward);
        }
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
