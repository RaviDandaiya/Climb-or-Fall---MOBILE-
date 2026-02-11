const { Engine, Render, Runner, World, Bodies, Body, Events, Vector, Composite } = Matter;

const CONFIG = {
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    playerRadius: 18,
    jumpForce: 0.015,
    moveForce: 0.002,
    maxHorizontalVelocity: 6,
    dashForce: 0.06,
    platformWidth: 140,
    platformHeight: 25,
};

const DIFFICULTY_SETTINGS = {
    easy: {
        lavaSpeed: 0.35,
        platformWidth: 180,
        gapHeight: 110,
        hazardChance: 0.0,
        movingChance: 0.1,
    },
    medium: {
        lavaSpeed: 0.45,
        platformWidth: 160,
        gapHeight: 120,
        hazardChance: 0.04,
        movingChance: 0.25,
    },
    hard: {
        lavaSpeed: 0.75,
        platformWidth: 130,
        gapHeight: 140,
        hazardChance: 0.12,
        movingChance: 0.5,
    }
};

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
        this.bestHeight = localStorage.getItem('bestHeight') || 0;
        this.isGameOver = true;
        this.particles = [];
        this.shake = 0;
        this.horrorPulse = 0;

        this.difficulty = 'medium';
        this.lavaSpeed = 0.6;
        this.lavaHeight = CONFIG.canvasHeight + 1000;
        this.isClimbing = false;

        this.init();
    }

    init() {
        document.getElementById('best-value').innerText = this.bestHeight;
        document.getElementById('retry-button').onclick = () => location.reload();

        const buttons = document.querySelectorAll('.menu-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.startGame(btn.dataset.difficulty);
            });
        });

        this.world.gravity.y = 1.35;
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('resize', () => this.handleResize());

        Events.on(this.runner, 'beforeUpdate', () => this.update());
        Events.on(this.render, 'afterRender', () => this.postProcess());
    }

    startGame(diff) {
        this.difficulty = diff;
        const settings = DIFFICULTY_SETTINGS[diff];
        this.lavaSpeed = settings.lavaSpeed;
        this.lavaHeight = CONFIG.canvasHeight + 400;
        this.isGameOver = false;

        document.getElementById('difficulty-screen').classList.add('hidden');

        this.createPlayer();
        this.createStartPlatform();
        this.generateInitialPlatforms(settings);

        Render.run(this.render);
        Runner.run(this.runner, this.engine);
    }

    handleResize() {
        CONFIG.canvasWidth = window.innerWidth;
        CONFIG.canvasHeight = window.innerHeight;
        this.canvas.width = CONFIG.canvasWidth;
        this.canvas.height = CONFIG.canvasHeight;
        this.render.options.width = CONFIG.canvasWidth;
        this.render.options.height = CONFIG.canvasHeight;
    }

    createPlayer() {
        this.player = Bodies.circle(CONFIG.canvasWidth / 2, CONFIG.canvasHeight - 150, CONFIG.playerRadius, {
            friction: 0.1,
            frictionAir: 0.02,
            restitution: 0.05,
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
        const isPillar = Math.random() < 0.3; // 30% chance of a pillar instead of a platform

        if (isPillar) {
            this.addVerticalPillar(y, index);
        } else {
            const x = Math.random() * (CONFIG.canvasWidth - settings.platformWidth) + settings.platformWidth / 2;
            const width = settings.platformWidth * (0.8 + Math.random() * 0.4);
            const isMoving = index > 5 && Math.random() < settings.movingChance;
            const isHazard = index > 15 && Math.random() < settings.hazardChance;

            const platform = Bodies.rectangle(x, y, width, CONFIG.platformHeight, {
                isStatic: true,
                label: isHazard ? 'hazard' : 'platform',
                render: {
                    fillStyle: isHazard ? '#ff0000' : '#1e1e26',
                    strokeStyle: isHazard ? '#fff' : '#4a4a5e',
                    lineWidth: 2
                },
                plugin: {
                    initialX: x,
                    speed: 0.012 + (Math.random() * 0.02),
                    range: 100 + Math.random() * 150,
                    isMoving: isMoving
                }
            });
            this.platforms.push(platform);
            World.add(this.world, platform);
        }
    }

    addVerticalPillar(y, index) {
        const height = 150 + Math.random() * 100;
        const x = Math.random() * (CONFIG.canvasWidth - 60) + 30;

        const pillar = Bodies.rectangle(x, y, 30, height, {
            isStatic: true,
            label: 'platform',
            render: {
                fillStyle: '#2d3436',
                strokeStyle: '#9d00ff',
                lineWidth: 2
            }
        });
        this.platforms.push(pillar);
        World.add(this.world, pillar);
    }

    update() {
        if (this.isGameOver) return;

        this.handleInput();
        this.updateStats();
        this.updateWorld();
        this.updateParticles();
        this.checkFall();
        this.cullAndGeneratePlatforms();

        this.horrorPulse *= 0.95;

        if (this.shake > 0) this.shake *= 0.9;
    }

    updateWorld() {
        this.platforms.forEach(p => {
            if (p.plugin && p.plugin.isMoving) {
                const newX = p.plugin.initialX + Math.sin(this.engine.timing.timestamp * p.plugin.speed) * p.plugin.range;
                Body.setPosition(p, { x: newX, y: p.position.y });
            }
        });

        this.lavaHeight -= this.lavaSpeed * (1 + this.currentHeight / 2000);

        if (this.player.position.y > this.lavaHeight) {
            this.triggerDeath("THE ABYSS CONSUMES");
        }
    }

    handleInput() {
        if (!this.player) return;

        const onGround = this.checkGrounded();
        const wallHit = this.checkWallContact();
        const velocity = this.player.velocity;

        // Climbing Logic
        if (wallHit && (this.keys['ArrowUp'] || this.keys['KeyW'])) {
            this.isClimbing = true;
            Body.setVelocity(this.player, { x: velocity.x, y: -4 }); // Slow climb up
            this.createParticles(this.player.position, '#9d00ff', 1);
        } else {
            this.isClimbing = false;
        }

        if (!this.isClimbing) {
            if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
                Body.applyForce(this.player, this.player.position, { x: -CONFIG.moveForce, y: 0 });
            }
            if (this.keys['ArrowRight'] || this.keys['KeyD']) {
                Body.applyForce(this.player, this.player.position, { x: CONFIG.moveForce, y: 0 });
            }
        }

        if ((this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.dashCooldown) {
            const dir = (this.keys['ArrowLeft'] || this.keys['KeyA']) ? -1 : 1;
            Body.applyForce(this.player, this.player.position, { x: CONFIG.dashForce * dir, y: 0 });
            this.dashCooldown = true;
            this.shake = 6;
            this.createParticles(this.player.position, '#ff0055', 25);
            setTimeout(() => this.dashCooldown = false, 1100);
        }

        const currentMaxX = this.dashCooldown ? CONFIG.maxHorizontalVelocity * 2 : CONFIG.maxHorizontalVelocity;
        if (Math.abs(velocity.x) > currentMaxX) {
            Body.setVelocity(this.player, { x: Math.sign(velocity.x) * currentMaxX, y: velocity.y });
        }

        if ((this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) && onGround && !this.jumpDebounce && !this.isClimbing) {
            Body.setVelocity(this.player, { x: velocity.x, y: -18.5 });
            this.jumpDebounce = true;
            this.createParticles(this.player.position, '#ffffff', 20);
            this.shake = 2;
            setTimeout(() => this.jumpDebounce = false, 180);
        }
    }

    checkWallContact() {
        const bodies = Composite.allBodies(this.world).filter(b => b.label !== 'player' && b.label !== 'hazard');
        const sideOffsets = [-CONFIG.playerRadius - 5, CONFIG.playerRadius + 5];
        let contact = false;

        for (let offset of sideOffsets) {
            const start = { x: this.player.position.x, y: this.player.position.y };
            const end = { x: this.player.position.x + offset, y: this.player.position.y };
            const hits = Matter.Query.ray(bodies, start, end);
            if (hits.length > 0) {
                contact = true;
                break;
            }
        }
        return contact;
    }

    checkGrounded() {
        const bodies = Composite.allBodies(this.world).filter(b => b.label !== 'player' && b.label !== 'hazard');
        const offsets = [-15, 0, 15];
        let grounded = false;

        for (let offset of offsets) {
            const start = { x: this.player.position.x + offset, y: this.player.position.y };
            const end = { x: this.player.position.x + offset, y: this.player.position.y + CONFIG.playerRadius + 12 };
            const hits = Matter.Query.ray(bodies, start, end);
            if (hits.length > 0) {
                grounded = true;
                break;
            }
        }

        const hazards = Composite.allBodies(this.world).filter(b => b.label === 'hazard');
        for (let offset of offsets) {
            const start = { x: this.player.position.x + offset, y: this.player.position.y };
            const end = { x: this.player.position.x + offset, y: this.player.position.y + CONFIG.playerRadius + 8 };
            const hazardHits = Matter.Query.ray(hazards, start, end);
            if (hazardHits.length > 0) {
                this.triggerDeath("SHATTERED INTO DARKNESS");
                this.shake = 25;
                break;
            }
        }

        return grounded;
    }

    updateStats() {
        const height = Math.floor((CONFIG.canvasHeight - 150 - this.player.position.y) / 10);
        this.currentHeight = Math.max(0, height);
        if (this.currentHeight > this.maxHeight) this.maxHeight = this.currentHeight;
        document.getElementById('height-value').innerText = this.currentHeight;
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= 0.025;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    createParticles(pos, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: pos.x,
                y: pos.y,
                vx: (Math.random() - 0.5) * 14,
                vy: (Math.random() - 1) * 10,
                life: 1.0,
                color: color
            });
        }
    }

    postProcess() {
        const ctx = this.render.context;
        const targetY = -this.player.position.y + CONFIG.canvasHeight / 2 + 100;
        this.cameraY += (targetY - this.cameraY) * 0.15;

        const shakeX = (Math.random() - 0.5) * this.shake;
        const shakeY = (Math.random() - 0.5) * this.shake;

        Render.lookAt(this.render, {
            min: { x: shakeX, y: -this.cameraY + shakeY },
            max: { x: CONFIG.canvasWidth + shakeX, y: CONFIG.canvasHeight - this.cameraY + shakeY }
        });

        this.drawWorldExt(ctx);
        // this.drawVignette(ctx);
    }

    drawWorldExt(ctx) {
        const lavaY = this.lavaHeight + this.cameraY;
        const time = this.engine.timing.timestamp * 0.002;

        ctx.save();
        ctx.fillStyle = `rgba(255, 30, 0, ${0.5 + Math.sin(time) * 0.15})`; // Back to Red Lava
        ctx.shadowBlur = 60;
        ctx.shadowColor = '#ff2200';
        ctx.fillRect(0, lavaY, CONFIG.canvasWidth, 3000);

        ctx.beginPath();
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 10;
        for (let i = 0; i <= CONFIG.canvasWidth; i += 25) {
            const wave = Math.sin(time + i * 0.015) * 18;
            ctx.lineTo(i, lavaY + wave);
        }
        ctx.stroke();
        ctx.restore();

        const bgHue = 240;
        this.canvas.style.backgroundColor = `hsla(${bgHue}, 20%, 15%, 1)`; // Lightened for visibility

        const p = this.player.position;
        const sx = p.x;
        const sy = p.y + this.cameraY;

        // Draw Arms/Hands
        ctx.save();
        ctx.translate(sx, sy);

        const armWave = Math.sin(time * 5) * 10;
        const climbAngle = this.isClimbing ? Math.sin(time * 10) * 0.5 : 0;

        ctx.strokeStyle = '#9d00ff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Left Arm
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-25, armWave + (this.isClimbing ? -20 : 10));
        ctx.stroke();

        // Right Arm
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(25, -armWave + (this.isClimbing ? -20 : 10));
        ctx.stroke();

        ctx.rotate(this.player.angle);

        ctx.shadowBlur = 20;
        ctx.shadowColor = '#9d00ff';
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(0, 0, CONFIG.playerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9d00ff';
        ctx.lineWidth = 4;
        ctx.stroke();

        const blink = Math.sin(time * 2.5) > 0.97 ? 0.1 : 1;
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.ellipse(-8, -5, 5, 7 * blink, 0, 0, Math.PI * 2);
        ctx.ellipse(8, -5, 5, 7 * blink, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 5, 9, 0.5, Math.PI - 0.5);
        ctx.stroke();
        ctx.restore();

        this.particles.forEach(pt => {
            ctx.save();
            ctx.globalAlpha = pt.life;
            ctx.fillStyle = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y + this.cameraY, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    drawVignette(ctx) {
        const grd = ctx.createRadialGradient(
            CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2, CONFIG.canvasHeight / 3,
            CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2, CONFIG.canvasHeight / 1.1
        );

        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0, 0, 0, 0.9)'); // Pure black vignette

        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    }

    checkFall() {
        if (this.player.position.y > this.lavaHeight + 50) {
            this.triggerDeath("THE ABYSS CONSUMES");
        }
    }

    triggerDeath(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.shake = 35;

        document.querySelector('.horror-text').innerText = reason;
        document.getElementById('fall-distance').innerText = this.maxHeight;
        document.getElementById('death-screen').classList.remove('hidden');

        if (this.maxHeight > this.bestHeight) {
            this.bestHeight = this.maxHeight;
            localStorage.setItem('bestHeight', this.bestHeight);
            document.getElementById('best-value').innerText = this.bestHeight;
        }
    }

    restart() {
        location.reload();
    }

    cullAndGeneratePlatforms() {
        const settings = DIFFICULTY_SETTINGS[this.difficulty];
        const highestPlatform = this.platforms.reduce((min, p) => Math.min(min, p.position.y), Infinity);
        if (this.player.position.y < highestPlatform + 800) {
            this.addPlatform(highestPlatform - settings.gapHeight, this.platforms.length);
        }
    }
}

window.onload = () => {
    new Game();
};
