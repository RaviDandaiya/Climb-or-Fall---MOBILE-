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
        const numStars = window.innerWidth <= 768 ? 50 : 150;
        for (let i = 0; i < numStars; i++) {
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
        this.totalDistance = parseInt(localStorage.getItem('totalDistance')) || 0;
        this.magnetTimer = 0; // Fixed: initialize magnet timer
        this.dashCooldown = 0;
        this.maxDashCooldown = 0;
        this.isDashingFrames = 0;
        this.powerUsesSinceAd = 0;
        this.hasShield = false;
        this.shake = 0;
        this.dashEffectTimer = 0;
        this.lastGameOverY = null;
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
        
        // --- New Audio & Haptic State ---
        this.soundOn = (localStorage.getItem('soundOn') !== 'false');
        this.musicOn = (localStorage.getItem('musicOn') !== 'false');
        this.vibrateOn = (localStorage.getItem('vibrateOn') !== 'false');

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
            
            const tick = () => {
                try {
                    if (this.gameState === 'PLAYING' && !this.isGameOver && !this.isAdPlaying) {
                        const substeps = 2;
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
            try { 
                this.audioManager = new AudioManager(); 
                if (this.audioManager) {
                    this.audioManager.soundOn = this.soundOn;
                    this.audioManager.musicOn = this.musicOn;
                    if (this.musicOn) this.audioManager.playMusic();
                }
            } catch (err) { console.warn('Audio Init Failed', err); }

            this.hud.updateHUD();
            this.hud.renderSkins();
            this.hud.renderPass();
            this.setupNativeBridge();
            
            // Fade out splash screen after a short delay
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.classList.add('fade-out');
                    setTimeout(() => splash.remove(), 800);
                }
                this.showMainMenu();
            }, 2200); // Wait for loading bar animation
            
            console.log("Game Init Sequence Complete");
        } catch (e) {
            console.error('Fatal Init Error:', e);
            this.showMainMenu();
        }
    }

    async setupNativeBridge() {
        // Safe check for Capacitor
        if (typeof window === 'undefined' || !window.Capacitor) return;
        
        console.log("Initializing Native Bridge...");
        
        try {
            // Use global access to avoid import resolution errors in Vite
            const App = window.Capacitor.Plugins.App;
            if (!App) {
                console.warn("Capacitor App plugin not found globally.");
                return;
            }
            
            App.addListener('backButton', () => {
                console.log("Hardware Back Button Pressed");
                
                // 1. If any overlay is open, close it
                const overlays = ['stats-screen', 'leaderboard-screen', 'reward-menu', 'settings-screen', 'death-screen'];
                let anyOpen = false;
                
                for (const id of overlays) {
                    const el = document.getElementById(id);
                    if (el && !el.classList.contains('hidden')) {
                        this.showMainMenu();
                        anyOpen = true;
                        break;
                    }
                }
                
                // 2. If already in main menu, exit app
                if (!anyOpen && !document.getElementById('difficulty-screen').classList.contains('hidden')) {
                    App.exitApp();
                }
                
                // 3. If in game, pause/show menu
                if (!anyOpen && !this.isGameOver) {
                    this.isGameOver = true;
                    this.gameState = 'MENU';
                    this.showMainMenu();
                }
            });
        } catch (err) {
            console.warn("Native Bridge Initialization failed (likely web mode):", err);
        }
    }

    setupUIListeners() {
        const uiClick = () => { if(this.audioManager) { this.audioManager.resume(); this.audioManager.playUI(); } };
        
        const registerImmediateClick = (id, callback) => {
            const el = document.getElementById(id);
            if (el) {
                let lastTime = 0;
                const handler = (e) => {
                    const now = Date.now();
                    if (now - lastTime < 400) return; 
                    lastTime = now;
                    
                    if (e && e.cancelable) e.preventDefault();
                    if (e) e.stopPropagation();
                    
                    console.log(`Immediate Click: ${id}`);
                    callback(e);
                };
                // Multi-event support for maximum device compatibility
                el.onpointerdown = handler;
                el.ontouchstart = handler;
                el.onclick = handler;
            }
        };
        
        registerImmediateClick('retry-button', () => {
            if (this.adManager) this.adManager.showGameOverAd();
            document.getElementById('death-screen').classList.add('hidden');
            this.startGame(this.difficulty);
        });
        
        registerImmediateClick('home-button', () => {
            if (this.adManager) this.adManager.showGameOverAd();
            this.showMainMenu();
        });

        registerImmediateClick('ad-revive-btn', () => {
            if (this.adManager) {
                this.adManager.startRevive();
            }
        });


        const diffHub = document.getElementById('difficulty-hub');
        const diffOptions = document.getElementById('difficulty-options');
        
        const diffNames = { easy: 'EASY', medium: 'NORMAL', hard: 'HARD' };
        if (diffHub) {
            diffHub.innerText = diffNames[this.difficulty] || 'NORMAL';
            registerImmediateClick('difficulty-hub', () => {
                if (diffOptions) diffOptions.classList.toggle('hidden');
            });
        }

        document.querySelectorAll('.hub-opt').forEach(btn => {
            const diffId = `diff-${btn.dataset.difficulty}`;
            btn.id = btn.id || diffId; // Ensure id for registerImmediateClick
            registerImmediateClick(btn.id, () => {
                uiClick();
                document.querySelectorAll('.hub-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.difficulty;
                if (document.getElementById('difficulty-hub')) {
                    document.getElementById('difficulty-hub').innerText = btn.innerText;
                }
            });
        });

        registerImmediateClick('btn-start-run', () => {
            uiClick();
            this.startGame(this.difficulty || 'medium');
        });

        const rewardMenu = document.getElementById('reward-menu');
        const shopView = document.getElementById('shop-view');
        const passView = document.getElementById('pass-view');
        const tabBtns = document.querySelectorAll('.tab-btn');

        const switchTab = (tab) => {
            uiClick();
            tabBtns.forEach(b => b.classList.toggle('active', b.id === `tab-${tab}`));
            if (tab === 'shop') {
                shopView.classList.remove('hidden');
                passView.classList.add('hidden');
                if(this.hud) this.hud.renderSkins();
            } else {
                shopView.classList.add('hidden');
                passView.classList.remove('hidden');
                if(this.hud) this.hud.renderPass();
            }
        };

        registerImmediateClick('tab-shop', () => switchTab('shop'));
        registerImmediateClick('tab-pass', () => switchTab('pass'));

        const openRewards = (tab) => {
            uiClick();
            if (rewardMenu) rewardMenu.classList.remove('hidden');
            document.getElementById('home-header').classList.add('hidden');
            document.querySelectorAll('.floating-fab').forEach(el => el.classList.add('hidden'));
            document.getElementById('difficulty-screen').classList.add('hidden'); // Clean mode
            switchTab(tab);
        };

        if (document.getElementById('btn-rewards-hub')) {
            registerImmediateClick('btn-rewards-hub', () => {
                this.showOverlay('reward-menu');
                switchTab('shop');
            });
        }
        



        document.querySelectorAll('.close-btn').forEach(btn => {
            if (!btn.id) btn.id = 'btn-close-' + Math.random().toString(36).substr(2, 9);
            registerImmediateClick(btn.id, (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                uiClick();
                this.showMainMenu();
            });
        });

        // Mode Toggles (Climb vs Fall)
        const climbBtn = document.getElementById('mode-climb');
        const fallBtn = document.getElementById('mode-fall');
        
        if (climbBtn) climbBtn.onclick = () => {
            uiClick();
            this.setGameMode('climb');
        };
        // Fall is disabled by default in HTML, but we add listener for future-proofing
        if (fallBtn) fallBtn.onclick = () => {
             if (fallBtn.classList.contains('disabled')) return;
             uiClick();
             this.setGameMode('fall');
        };

        // Control Toggles (Touch vs Tilt)
        const touchBtn = document.getElementById('control-touch');
        const tiltBtn = document.getElementById('control-tilt');
        
        const updateControlUI = () => {
            if (touchBtn) touchBtn.classList.toggle('active', this.controlMode === 'touch');
            if (tiltBtn) tiltBtn.classList.toggle('active', this.controlMode === 'tilt');
        };
        updateControlUI();

        if (touchBtn) touchBtn.onclick = () => {
            uiClick();
            this.controlMode = 'touch';
            localStorage.setItem('controlMode', 'touch');
            updateControlUI();
        };
        if (tiltBtn) tiltBtn.onclick = () => {
            uiClick();
            this.controlMode = 'tilt';
            localStorage.setItem('controlMode', 'tilt');
            updateControlUI();
        };

        // --- New Premium Header Listeners ---
        const statsMenu = document.getElementById('stats-screen');

        registerImmediateClick('btn-stats-hub', () => {
            this.showOverlay('stats-screen');
            this.syncStats();
        });

        registerImmediateClick('btn-share-stats', () => {
            const shareText = `🚀 I've climbed ${this.bestHeight}m in Climb-or-Fall! Can you beat my score? Total distance traveled: ${this.totalDistance}m. Play now!`;
            if (navigator.share) {
                navigator.share({
                    title: 'Climb-or-Fall Stats',
                    text: shareText,
                    url: window.location.href
                }).catch(() => {});
            } else {
                alert(shareText);
            }
        });

        registerImmediateClick('btn-settings-hub', () => {
            this.showOverlay('settings-screen');
        });



        registerImmediateClick('btn-exit-game', (e) => {
            this.isGameOver = true;
            this.gameState = 'MENU';
            this.showMainMenu();
        });


        const nameInput = document.getElementById('player-name-input');
        if (nameInput) {
            nameInput.value = this.playerName;
            nameInput.oninput = (e) => {
                this.playerName = e.target.value || 'Survivor';
                localStorage.setItem('playerName', this.playerName);
                this.syncHomeProfile(); // Update header real-time
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

        // Audio & Haptic Toggles
        const soundBtn = document.getElementById('toggle-sound');
        const musicBtn = document.getElementById('toggle-music');
        const vibrateBtn = document.getElementById('toggle-vibrate');

        const updateAudioUI = () => {
             if (soundBtn) {
                 soundBtn.innerText = this.soundOn ? 'ON' : 'OFF';
                 soundBtn.classList.toggle('active', this.soundOn);
                 soundBtn.classList.toggle('off', !this.soundOn);
                 if (this.audioManager) this.audioManager.soundOn = this.soundOn;
             }
             if (musicBtn) {
                 musicBtn.innerText = this.musicOn ? 'ON' : 'OFF';
                 musicBtn.classList.toggle('active', this.musicOn);
                 musicBtn.classList.toggle('off', !this.musicOn);
                 if (this.audioManager) {
                     this.audioManager.musicOn = this.musicOn;
                     if (this.musicOn) this.audioManager.playMusic();
                     else this.audioManager.stopMusic();
                 }
             }
             if (vibrateBtn) {
                 vibrateBtn.innerText = this.vibrateOn ? 'ON' : 'OFF';
                 vibrateBtn.classList.toggle('active', this.vibrateOn);
                 vibrateBtn.classList.toggle('off', !this.vibrateOn);
             }
        };
        updateAudioUI();

        if (soundBtn) soundBtn.onclick = () => {
             uiClick();
             this.soundOn = !this.soundOn;
             localStorage.setItem('soundOn', this.soundOn);
             updateAudioUI();
        };
        if (musicBtn) musicBtn.onclick = () => {
             uiClick();
             this.musicOn = !this.musicOn;
             localStorage.setItem('musicOn', this.musicOn);
             updateAudioUI();
        };
        if (vibrateBtn) vibrateBtn.onclick = () => {
             uiClick();
             this.vibrateOn = !this.vibrateOn;
             localStorage.setItem('vibrateOn', this.vibrateOn);
             updateAudioUI();
             if (this.vibrateOn && navigator.vibrate) navigator.vibrate(50);
        };
    }

    handleResize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.renderer) this.renderer.handleResize();
    }

    vibrate(ms = 50) {
        if (this.vibrateOn && navigator.vibrate) {
            navigator.vibrate(ms);
        }
    }

    showMenuOverlay() {
        const overlay = document.getElementById('difficulty-screen');
        if (overlay) overlay.classList.remove('hidden');
    }

    showOverlay(id) {
        if (this.audioManager) {
            this.audioManager.resume();
            this.audioManager.playUI();
        }
        
        // Hide core home UI
        const homeHeader = document.getElementById('home-header');
        const diffScreen = document.getElementById('difficulty-screen');
        if (homeHeader) homeHeader.classList.add('hidden');
        if (diffScreen) diffScreen.classList.add('hidden');
        document.querySelectorAll('.floating-fab').forEach(el => el.classList.add('hidden'));

        // Show target overlay
        const target = document.getElementById(id);
        if (target) target.classList.remove('hidden');
        
        console.log(`Showing Overlay: ${id}`);
    }

    showMainMenu() {
        this.gameState = 'MENU';
        this.isGameOver = true;
        
        // Hide EVERYTHING overlay-related
        const overlays = ['death-screen', 'ui-overlay', 'mobile-controls', 'reward-menu', 'settings-screen', 'stats-screen', 'leaderboard-screen', 'difficulty-screen'];
        overlays.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });

        // Show Home Core UI
        const homeHeader = document.getElementById('home-header');
        const diffScreen = document.getElementById('difficulty-screen');
        if (homeHeader) homeHeader.classList.remove('hidden');
        if (diffScreen) diffScreen.classList.remove('hidden');
        
        document.querySelectorAll('.floating-fab').forEach(el => el.classList.remove('hidden'));
        document.body.classList.add('menu-open');

        this.syncHomeScore();
        this.syncHomeProfile();
        
        const fallBtn = document.getElementById('mode-fall');
        if (fallBtn) {
            fallBtn.classList.add('disabled');
            fallBtn.disabled = true;
            fallBtn.innerText = 'FALL 🔒';
        }

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
        this.currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
        
        document.getElementById('difficulty-screen').classList.add('hidden');
        document.getElementById('ui-overlay').classList.remove('hidden');
        document.getElementById('mobile-controls').classList.remove('hidden');
        document.getElementById('home-header').classList.add('hidden');
        document.querySelectorAll('.floating-fab').forEach(el => el.classList.add('hidden'));
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
                    if (this.worldManager.collectCoin) {
                        this.worldManager.collectCoin(otherBody);
                        this.vibrate(30);
                    }
                }

                // 3. Powerup Collection
                if (otherLabel === 'powerup') {
                    if (this.worldManager.collectPowerup) {
                        this.worldManager.collectPowerup(otherBody);
                        this.vibrate(80);
                    } else {
                        // Inline fallback
                        const type = otherBody.powerupType;
                        if (type === 'shield') this.hasShield = true;
                        if (type === 'magnet') this.magnetTimer = 600;
                        Matter.World.remove(this.world, otherBody);
                        this.powerups = this.powerups.filter(p => p !== otherBody);
                        this.pool.powerup.push(otherBody);
                        if (this.audioManager?.playPowerup) this.audioManager.playPowerup();
                        this.vibrate(80);
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
        if (this.dashEffectTimer > 0) this.dashEffectTimer--;
        
        // --- MOVEMENT & INPUT ---
        this.inputManager.updateTilt();
        let impulseX = 0;
        const jumpForce = -23.0; // Standard jump
        
        // Adjusted horizontal force: 7.5 provides a tight, responsive platformer speed.
        const horizForce = 7.5 * this.sensitivity; 
        // Stricter onGround check to prevent \"infinite jumping\" or floaty peaks
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

        // Smooth screen wrap-around
        const wrapPadding = 30;
        if (this.player.position.x < -wrapPadding) {
            Body.setPosition(this.player, { x: CONFIG.canvasWidth + wrapPadding - 5, y: this.player.position.y });
        } else if (this.player.position.x > CONFIG.canvasWidth + wrapPadding) {
            Body.setPosition(this.player, { x: -wrapPadding + 5, y: this.player.position.y });
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
            if (true) { // Ads disabled
                if (this.modeStrategy.handleDash) {
                    this.modeStrategy.handleDash(this, dashVx);
                    this.powerUsesSinceAd = 0; // Infinite uses
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

        this.lastGameOverY = this.player.position.y;
        console.log("DEATH TRIGGERED! Reason: " + reason + " | PlayerY: " + Math.round(this.player.position.y) + " | LavaY: " + Math.round(this.lavaHeight));
        this.isGameOver = true;
        this.gameState = 'GAME_OVER';
        
        const rEl = document.getElementById('death-reason');
        if (rEl) rEl.innerText = reason;
        
        document.getElementById('death-screen').classList.remove('hidden');
        document.getElementById('ui-overlay').classList.add('hidden');
        document.getElementById('mobile-controls').classList.add('hidden');
        this.vibrate([100, 50, 100]); // Intense pattern for death
        
        // Update stats
        this.totalDistance += this.score;
        localStorage.setItem('totalDistance', this.totalDistance);
        
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
            
            // Safe Revive Protocol
            this.hasShield = true; // Give a shield immediately
            this.dashEffectTimer = 60; // Show speed lines for brief reentry
            this._isResettingCamera = true; // Snap camera to new position

            // Reset momentum to zero
            Body.setVelocity(this.player, { x: 0, y: 0 });
            Body.setAngularVelocity(this.player, 0);

            // Calculate safe position based on mode (away from the hazard that killed them)
            const safeDistance = 450;
            const moveDir = (this.modeStrategy.name === 'fall') ? 1 : -1;
            const newY = this.player.position.y + (moveDir * safeDistance);
            
            Body.setPosition(this.player, { x: CONFIG.canvasWidth / 2, y: newY });
            
            // Create a "New Wall" / Safety Floor that spans the entire width
            // This ensures the user has a safe place to land after the revive
            const safetyPlatform = Bodies.rectangle(CONFIG.canvasWidth / 2, newY + 120, CONFIG.canvasWidth, 30, {
                isStatic: true,
                label: 'platform',
                isSafety: true, // Special flag for the renderer to draw it as a "Holy Wall"
                friction: 0.5
            });
            
            World.add(this.world, safetyPlatform);
            this.platforms.push(safetyPlatform);

            // Push lava down immediately gives them time to land
            this.lavaHeight = this.player.position.y + 700; 

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
        const needsAd = false; // Ads disabled
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
                overlay.style.background = "conic-gradient(from -90deg, rgba(0, 0, 0, 0.72) 0deg " + darkAngle + "deg, rgba(0, 0, 0, 0.06) " + darkAngle + "deg 360deg)";
            } else {
                overlay.style.opacity = '0';
                overlay.style.background = '';
            }
        }
    }

    setGameMode(mode) {
        if (mode === 'fall') {
            console.log("Fall mode is locked!");
            return;
        }

        const modeKey = mode.charAt(0).toUpperCase() + mode.slice(1) + 'Mode';
        if (this._modeClasses[modeKey]) {
            this.modeStrategy = new this._modeClasses[modeKey](this);
            
            const climbBtn = document.getElementById('mode-climb');
            const fallBtn = document.getElementById('mode-fall');
            if (climbBtn) climbBtn.classList.toggle('active', mode === 'climb');
            if (fallBtn) {
                fallBtn.classList.toggle('active', mode === 'fall');
                fallBtn.classList.add('disabled');
            }
            
            console.log("Switched mode to:", mode);
            if (this.audioManager) this.audioManager.playUI();
        }
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

    setActiveSkin(skinId) {
        const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
        if (!this.canUseSkin(skin.id)) return false;
        this.activeSkinId = skin.id;
        localStorage.setItem('activeSkin', skin.id);
        if (this.hud) this.hud.renderSkins();
        this.syncHomeProfile(); // Update header avatar immediately
        return true;
    }

    syncHomeProfile() {
        // Update name
        const nameEl = document.getElementById('home-player-name');
        if (nameEl) nameEl.innerText = this.playerName;

        // Update coin count in header
        const coinEl = document.getElementById('home-coin-count');
        if (coinEl) coinEl.innerText = this.coins;

        // Update skin avatar
        const avatarContainer = document.getElementById('home-skin-avatar');
        if (avatarContainer) {
            const skin = SKINS.find(s => s.id === this.activeSkinId) || SKINS[0];
            const shape = skin.shape || 'round';
            const color = skin.bodyColor || skin.color;
            const eyeColor = skin.eyeColor || '#ffffff';
            
            avatarContainer.innerHTML = `
                <div class="skin-preview skin-preview-${shape}" style="background: ${color}; --preview-eye-color: ${eyeColor}; width: 34px; height: 34px; margin: 0; box-shadow: none; border: none;">
                    ${shape !== 'eye' ? `
                    <span class="skin-preview-eye skin-preview-eye-left" style="width: 5px; height: 5px;"></span>
                    <span class="skin-preview-eye skin-preview-eye-right" style="width: 5px; height: 5px;"></span>
                    ` : ''}
                </div>
            `;
        }
    }

    syncStats() {
        const stats = {
            'stats-high-score': this.bestHeight,
            'stats-total-dist': this.totalDistance,
            'stats-total-deaths': this.gamesPlayed,
            'stats-total-coins': this.totalCoinsAcc
        };
        Object.entries(stats).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        });
    }
}

window.onload = () => {
    window.game = new Game();
};
