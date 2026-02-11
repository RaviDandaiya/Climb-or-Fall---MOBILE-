const { Engine, Render, Runner, World, Bodies, Body, Events, Vector, Composite } = Matter;

const CONFIG = {
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    playerRadius: 18,
    jumpForce: -13, // Direct velocity value
    moveSpeed: 6.5,  // Direct velocity value
    maxHorizontalVelocity: 8,
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
    { id: 'gold', name: 'Gilded', color: '#ffcc00', price: 500 }
];

class Game {
    constructor() {
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
        this.keys = {};
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

        this.isGameOver = true;
        this.revivesLeft = 1;
        this.particles = [];
        this.shake = 0;
        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;

        this.init();
    }

    init() {
        this.updateHUD();
        this.setupEventListeners();
        this.renderSkins();
        this.renderPass();

        this.world.gravity.y = 1.35;

        // Start the engine ONCE
        Render.run(this.render);
        Runner.run(this.runner, this.engine);

        Events.on(this.runner, 'beforeUpdate', () => this.update());
        Events.on(this.render, 'afterRender', () => this.postProcess());
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

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('resize', () => this.handleResize());
    }

    updateHUD() {
        document.getElementById('coin-count').innerText = this.coins;
        document.getElementById('best-value').innerText = this.bestHeight;
        document.getElementById('pass-level').innerText = this.passLevel;
        document.getElementById('pass-fill').style.width = `${(this.passXP / 1000) * 100}%`;
    }

    startGame(diff) {
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = CONFIG.canvasHeight + 400;
        this.revivesLeft = 1;

        // Force Game State Active
        this.isGameOver = false;

        document.getElementById('difficulty-screen').classList.add('hidden');

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
        this.generateInitialPlatforms(settings);

        // Force Body Active
        Body.setStatic(this.player, false);
        Body.setSleeping(this.player, false);

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
            this.addPlatform(CONFIG.canvasHeight - 250 - (i * (settings.gapHeight / 1.5)), i);
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
            const platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, {
                isStatic: true,
                label: isHazard ? 'hazard' : 'platform',
                render: { fillStyle: isHazard ? '#ff0000' : '#1e1e26', strokeStyle: isHazard ? '#fff' : '#4a4a5e', lineWidth: 2 }
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
        const collisions = Matter.Query.colliding(this.player, Composite.allBodies(this.world));
        collisions.forEach(collision => {
            if (collision.bodyA.label === 'coin' || collision.bodyB.label === 'coin') {
                const coin = collision.bodyA.label === 'coin' ? collision.bodyA : collision.bodyB;
                this.collectCoin(coin);
            }
        });
    }

    collectCoin(coin) {
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
        const baseSpeed = CONFIG.moveSpeed || 6.5;
        const jumpForce = CONFIG.jumpForce || -13;

        // Dash Logic
        const isDashing = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const currentSpeed = isDashing ? baseSpeed * 1.6 : baseSpeed;

        // Ground Check
        const onGround = this.checkGrounded();

        // Horizontal Movement
        let targetVx = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            targetVx = -currentSpeed;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            targetVx = currentSpeed;
        }

        // Apply Horizontal Velocity instantly (snappy controls)
        if (targetVx !== 0) {
            Body.setVelocity(this.player, { x: targetVx, y: velocity.y });
        } else {
            // Strong friction for instant stop
            Body.setVelocity(this.player, { x: velocity.x * 0.8, y: velocity.y });
        }

        // Jump Logic (with debounce)
        if ((this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) && onGround && !this.jumpDebounce) {
            Body.setVelocity(this.player, { x: this.player.velocity.x, y: jumpForce });
            this.jumpDebounce = true;
            setTimeout(() => this.jumpDebounce = false, 200);
        }

        // Wall Climb Logic
        if (this.checkWallContact()) {
            if (this.keys['ArrowUp'] || this.keys['KeyW']) {
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
        document.getElementById('height-value').innerText = this.currentHeight;
    }

    triggerDeath(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.shake = 35;
        document.getElementById('fall-distance').innerText = this.maxHeight;
        document.getElementById('death-screen').classList.remove('hidden');
        document.getElementById('ad-revive-btn').disabled = (this.revivesLeft <= 0);
        document.getElementById('ad-revive-btn').innerText = `📺 REVIVE (${this.revivesLeft} LEFT)`;

        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight;
            localStorage.setItem('bestHeight', this.bestHeight);
            this.updateHUD();
        }
    }

    startAdRevive() {
        if (this.revivesLeft <= 0) return;
        document.getElementById('ad-prompt').classList.remove('hidden');
        let timeLeft = 5;
        const timerEl = document.getElementById('ad-timer');
        const skipBtn = document.getElementById('skip-ad-btn');
        skipBtn.classList.add('hidden');

        const interval = setInterval(() => {
            timeLeft--;
            timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(interval);
                skipBtn.classList.remove('hidden');
            }
        }, 1000);

        skipBtn.onclick = () => {
            document.getElementById('ad-prompt').classList.add('hidden');
            document.getElementById('death-screen').classList.add('hidden');
            this.revive();
        };
    }

    revive() {
        this.revivesLeft--;
        this.isGameOver = false;
        Body.setPosition(this.player, { x: CONFIG.canvasWidth / 2, y: this.player.position.y - 300 });
        Body.setVelocity(this.player, { x: 0, y: 0 });
        this.lavaHeight += 600; // Give breathing room
        this.shake = 10;
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
            const reward = document.createElement('div');
            reward.className = `reward-card ${isUnlocked ? 'unlocked' : ''}`;
            reward.innerHTML = `
                <div class="stat-label">LVL ${i}</div>
                <div style="font-size: 2rem">${i % 2 === 0 ? '🪙' : '👕'}</div>
                <div class="stat-unit">${i % 2 === 0 ? '+100 Coins' : 'Xmas Skin'}</div>
            `;
            container.appendChild(reward);
        }
    }

    drawWorldExt(ctx) {
        const lavaY = this.lavaHeight + this.cameraY;
        const time = this.engine.timing.timestamp * 0.002;

        // Red Lava
        ctx.save();
        ctx.fillStyle = `rgba(255, 30, 0, ${0.5 + Math.sin(time) * 0.15})`;
        ctx.shadowBlur = 60;
        ctx.shadowColor = '#ff2200';
        ctx.fillRect(0, lavaY, CONFIG.canvasWidth, 3000);
        ctx.beginPath();
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 10;
        for (let i = 0; i <= CONFIG.canvasWidth; i += 25) {
            ctx.lineTo(i, lavaY + Math.sin(time + i * 0.015) * 18);
        }
        ctx.stroke();
        ctx.restore();

        // Player with skin
        const skin = SKINS.find(s => s.id === this.activeSkinId);
        const p = this.player ? this.player.position : { x: 0, y: 0 };
        const sy = p.y + this.cameraY;

        ctx.save();
        ctx.translate(p.x, sy);

        // Draw Hands
        ctx.strokeStyle = skin.color;
        ctx.lineWidth = 4;
        const armWave = Math.sin(time * 5) * 10;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-25, armWave + (this.isClimbing ? -15 : 10)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(25, -armWave + (this.isClimbing ? -15 : 10)); ctx.stroke();

        if (this.player) ctx.rotate(this.player.angle);
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

        // Particles
        this.particles.forEach((pt, i) => {
            pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life -= 0.025;
            if (pt.life <= 0) this.particles.splice(i, 1);
            ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life;
            ctx.beginPath(); ctx.arc(pt.x, pt.y + this.cameraY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
        });
    }

    createParticles(pos, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 1) * 12, life: 1, color });
        }
    }

    postProcess() {
        const ctx = this.render.context;
        const targetY = -this.player.position.y + CONFIG.canvasHeight / 2 + 100;
        this.cameraY += (targetY - this.cameraY) * 0.15;
        const bx = (Math.random() - 0.5) * this.shake;
        Render.lookAt(this.render, { min: { x: bx, y: -this.cameraY }, max: { x: CONFIG.canvasWidth + bx, y: CONFIG.canvasHeight - this.cameraY } });
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

    handleResize() {
        this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight;
        this.render.options.width = window.innerWidth; this.render.options.height = window.innerHeight;
    }
}

window.onload = () => new Game();
