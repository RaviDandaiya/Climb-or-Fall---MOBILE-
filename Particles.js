const MAX_PARTICLES = 150;

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.particlePool = [];
    }

    createExplosion(pos, color, count) {
        const remaining = MAX_PARTICLES - this.particles.length;
        const actualCount = Math.min(count, remaining);
        if (actualCount <= 0) return;

        for (let i = 0; i < actualCount; i++) {
            const p = this.particlePool.pop() || {};
            p.x = pos.x; p.y = pos.y; p.vx = (Math.random() - 0.5) * 12; p.vy = (Math.random() - 0.5) * 12;
            p.life = 1; p.color = color; this.particles.push(p);
        }
    }

    createParticles(pos, color, count) {
        const remaining = MAX_PARTICLES - this.particles.length;
        const actualCount = Math.min(count, remaining);
        if (actualCount <= 0) return;

        for (let i = 0; i < actualCount; i++) {
            const p = this.particlePool.pop() || {};
            p.x = pos.x; p.y = pos.y; p.vx = (Math.random() - 0.5) * 15; p.vy = (Math.random() - 1) * 15;
            p.life = 1; p.color = color; this.particles.push(p);
        }
    }

    createCuteTrail(player, skin, isGameOver) {
        if (!player || isGameOver) return;
        const speedSq = player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y;
        if (speedSq > 5 && Math.random() < 0.3) {
            const p = this.particlePool.pop() || {};
            p.x = player.position.x + (Math.random() - 0.5) * 20;
            p.y = player.position.y + (Math.random() - 0.5) * 20;
            p.vx = (Math.random() - 0.5) * 2;
            p.vy = (Math.random() - 0.5) * 2;
            p.life = 1;
            p.color = skin ? skin.color : '#ffffff';
            this.particles.push(p);
        }
    }

    render(ctx) {
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
    }
}
