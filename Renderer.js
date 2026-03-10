import { CONFIG, SKINS } from './constants.js';

export class Renderer {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.platformCanvas = document.createElement('canvas');
        this.platformCanvas.width = 300;
        this.platformCanvas.height = 30;
        this.drawCachedPlatform();
    }

    handleResize() {
        if (window.innerWidth === 0) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
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

    render() {
        const ctx = this.ctx;
        if (!ctx) return;
        const time = performance.now();

        // 1. Clear with animated gradient background
        const bgTime = time / 2000;
        const bgOffset1 = Math.sin(bgTime) * 300;
        const bgOffset2 = Math.cos(bgTime) * 300;
        const grad = ctx.createLinearGradient(0, bgOffset1, 0, Math.max(window.innerHeight, this.canvas.height) + bgOffset2);
        grad.addColorStop(0, this.game.currentTheme.bg[0]);
        grad.addColorStop(1, this.game.currentTheme.bg[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width + 1000, this.canvas.height + 1000);

        // 2. Camera & Global Transform
        ctx.save();

        const scale = this.canvas.width / CONFIG.canvasWidth;
        ctx.scale(scale, scale);

        if (this.game.player) {
            const targetY = -this.game.player.position.y + (this.canvas.height / scale) / 2 + 100;
            this.game.cameraY += (targetY - this.game.cameraY) * 0.1;
        }
        ctx.translate(0, this.game.cameraY);

        // Apply Juice: Screen Shake
        if (this.game.shake > 0.5) {
            const sx = (Math.random() - 0.5) * this.game.shake;
            const sy = (Math.random() - 0.5) * this.game.shake;
            ctx.translate(sx, sy);
            this.game.shake *= 0.9;
        }

        const viewTop = -this.game.cameraY;
        const viewHeight = this.canvas.height / scale;

        // Draw Walls
        const pulse = 0.5 + 0.5 * Math.sin(time / 200);
        ctx.fillStyle = `rgba(0, 255, 136, ${0.4 * pulse})`;
        ctx.fillRect(18, viewTop, 2, viewHeight);
        ctx.fillRect(CONFIG.canvasWidth - 20, viewTop, 2, viewHeight);

        // Draw Earth surface
        ctx.fillStyle = '#3a2318';
        const surfaceY = this.game.modeStrategy.name === 'climb' ? CONFIG.canvasHeight : 0;
        const surfaceH = this.game.modeStrategy.name === 'climb' ? 10000 : -10000;
        ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, surfaceH);
        ctx.fillStyle = '#00af50';
        ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, this.game.modeStrategy.name === 'climb' ? 20 : -20);

        // 3. Draw Stars
        this.game.stars.forEach(s => {
            s.y = (s.y + 0.2) % (this.canvas.height / scale + 1000);
            ctx.fillStyle = `rgba(255,255,255,${s.opacity * (0.6 + 0.4 * Math.sin(time/1000 + s.x))})`;
            ctx.fillRect(s.x, s.y - 500, s.size, s.size);
        });

        // 4. Draw Platforms
        this.game.platforms.forEach(p => {
            if (p.label === 'platform') {
                const w = p.bounds.max.x - p.bounds.min.x;
                ctx.save();
                if (p.isCrumbling && p.crumbleTimer > 0) {
                    const shake = Math.sin(time * 0.1) * 3;
                    ctx.translate(shake, 0);
                    ctx.filter = 'contrast(1.5) brightness(1.2)';
                }
                
                if (p.isCrumbling) {
                    ctx.fillStyle = p.crumbleTimer > 0 ? '#ffae00' : '#d2b48c';
                    ctx.strokeStyle = '#8b4513';
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, p.position.x - w / 2, p.position.y - 6, w, 15, 4);
                    ctx.fill();
                    ctx.stroke();
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
            } else if (p.label === 'hazard' || p.label === 'oscillator') {
                if (this.game.modeStrategy.name === 'fall') {
                    // Iron metallic style
                    const w = p.bounds.max.x - p.bounds.min.x;
                    const h = 15;
                    const grad = ctx.createLinearGradient(0, p.position.y - 6, 0, p.position.y + 9);
                    grad.addColorStop(0, '#555');
                    grad.addColorStop(0.5, '#aaa');
                    grad.addColorStop(1, '#333');
                    ctx.fillStyle = grad;
                    ctx.fillRect(p.bounds.min.x, p.position.y - 6, w, h);
                    
                    if (p.label === 'hazard') {
                        // Draw mini spikes on the top/bottom
                        ctx.fillStyle = '#222';
                        const sSize = 10;
                        for (let sx = p.bounds.min.x; sx < p.bounds.max.x; sx += sSize) {
                            ctx.beginPath();
                            ctx.moveTo(sx, p.position.y - 6);
                            ctx.lineTo(sx + sSize/2, p.position.y - 12);
                            ctx.lineTo(sx + sSize, p.position.y - 6);
                            ctx.fill();
                            
                            ctx.beginPath();
                            ctx.moveTo(sx, p.position.y + 9);
                            ctx.lineTo(sx + sSize/2, p.position.y + 15);
                            ctx.lineTo(sx + sSize, p.position.y + 9);
                            ctx.fill();
                        }
                    } else {
                        // Oscillator look (rivets)
                        ctx.fillStyle = '#111';
                        for (let rx = p.bounds.min.x + 10; rx < p.bounds.max.x; rx += 40) {
                            ctx.beginPath(); ctx.arc(rx, p.position.y, 3, 0, Math.PI*2); ctx.fill();
                        }
                    }
                } else {
                    ctx.fillStyle = p.label === 'hazard' ? '#ff2200' : '#ffff00';
                    ctx.fillRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
                }
            } else if (p.label === 'glass') {
                ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.fillRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
                ctx.strokeRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
            } else if (p.label === 'crusher') {
                ctx.fillStyle = '#ff5500';
                ctx.strokeStyle = '#220000';
                ctx.lineWidth = 2;
                ctx.fillRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
                ctx.strokeRect(p.bounds.min.x, p.position.y - 6, p.bounds.max.x - p.bounds.min.x, 15);
                
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.fillText(p.crusherDir > 0 ? ">>" : "<<", p.position.x - 10, p.position.y + 5);
            }
        });

        // 4.5 Draw Powerups
        this.game.powerups.forEach(p => {
            ctx.save();
            ctx.translate(p.position.x, p.position.y);
            ctx.translate(0, Math.sin(time / 200) * 10);
            
            const glowC = p.powerupType === 'shield' ? 'rgba(0, 209, 255, 0.4)' : (p.powerupType === 'magnet' ? 'rgba(255, 62, 62, 0.4)' : 'rgba(100, 100, 100, 0.6)');
            const strokeC = p.powerupType === 'shield' ? '#00d1ff' : (p.powerupType === 'magnet' ? '#ff3e3e' : '#888');

            const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
            glow.addColorStop(0, glowC);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 25, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.strokeStyle = strokeC;
            ctx.lineWidth = 3;
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '800 14px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.powerupType === 'shield' ? '🛡️' : '🧲', 0, 1);
            ctx.restore();
        });

        // 5. Draw Enemies
        this.game.enemies.forEach(e => {
            const numSpikes = 8;
            const outerRadius = 18;
            const innerRadius = 12;

            ctx.save();
            ctx.translate(e.position.x, e.position.y);
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

            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0044';
            ctx.fill();

            ctx.restore();
        });

        // 6. Draw Lava
        ctx.save();
        ctx.beginPath();
        const drawLavaPos = this.game.lavaHeight;
        const lavaExtra = this.game.modeStrategy.name === 'climb' ? 500 : -500;
        ctx.moveTo(-100, drawLavaPos + lavaExtra);
        ctx.lineTo(-100, drawLavaPos);

        const timeInS = time / 1000;
        if (this.game.modeStrategy.name === 'climb') {
            for (let x = -100; x <= CONFIG.canvasWidth + 200; x += 10) {
                const waveY = drawLavaPos + Math.sin((x / 30) + (timeInS * 2)) * 8 + Math.cos((x / 50) - (timeInS * 1.5)) * 6;
                ctx.lineTo(x, waveY);
            }
        } else {
            // High quality iron spikes
            const spikeWidth = 40;
            const spikeHeight = 60;
            const grad = ctx.createLinearGradient(0, drawLavaPos, 0, drawLavaPos + 150);
            grad.addColorStop(0, '#111');
            grad.addColorStop(0.1, '#555');
            grad.addColorStop(0.5, '#222');
            ctx.fillStyle = grad;
            
            for (let x = -100; x <= CONFIG.canvasWidth + 200; x += spikeWidth) {
                const vx = Math.sin(timeInS * 8 + x) * 3;
                ctx.beginPath();
                ctx.moveTo(x + vx, drawLavaPos);
                ctx.lineTo(x + spikeWidth / 2 + vx, drawLavaPos + spikeHeight + Math.cos(timeInS * 10 + x) * 8);
                ctx.lineTo(x + spikeWidth + vx, drawLavaPos);
                ctx.lineTo(x + spikeWidth + vx, drawLavaPos - 500); // Fill up
                ctx.lineTo(x + vx, drawLavaPos - 500); 
                ctx.closePath();
                ctx.fill();
                
                // Highlight edge
                ctx.strokeStyle = '#888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + vx, drawLavaPos);
                ctx.lineTo(x + spikeWidth / 2 + vx, drawLavaPos + spikeHeight + Math.cos(timeInS * 10 + x) * 8);
                ctx.lineTo(x + spikeWidth + vx, drawLavaPos);
                ctx.stroke();
            }
        }

        ctx.lineTo(CONFIG.canvasWidth + 200, drawLavaPos + lavaExtra);
        ctx.closePath();

        const screenBottomRaw = -this.game.cameraY + this.canvas.height / scale;
        const lavaTop = this.game.modeStrategy.name === 'climb' ? drawLavaPos - 10 : drawLavaPos + 10;
        const lavaBottom = this.game.modeStrategy.name === 'climb' 
            ? Math.max(lavaTop + 100, screenBottomRaw)
            : Math.min(lavaTop - 100, -this.game.cameraY);

        const lavaGrad = ctx.createLinearGradient(0, lavaTop, 0, lavaBottom);
        lavaGrad.addColorStop(0, '#ffcc00');
        lavaGrad.addColorStop(Math.min(0.2, Math.abs(100 / (lavaBottom - lavaTop + 1))), '#ff3300');
        lavaGrad.addColorStop(1, '#660000');

        ctx.fillStyle = lavaGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // 7. Draw Player
        if (this.game.player) {
            const skin = SKINS.find(s => s.id === this.game.activeSkinId);
            const velY = Math.abs(this.game.player.velocity.y);
            const stretch = 1 + Math.min(0.3, velY / 40);
            const squash = 1 / stretch;

            ctx.save();
            ctx.translate(this.game.player.position.x, this.game.player.position.y);

            // Ghost effect for invincibility/dash
            if (this.game.isDashingFrames > 0) {
                ctx.globalAlpha = 0.5;
            }

            if (this.game.hasShield) {
                ctx.beginPath();
                ctx.arc(0, 0, CONFIG.playerRadius + 12, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 209, 255, ${0.4 + 0.2 * Math.sin(time / 100)})`;
                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.fillStyle = 'rgba(0, 209, 255, 0.05)';
                ctx.fill();
            }

            if (this.game.magnetTimer > 0) {
                ctx.beginPath();
                const magSize = 35 + Math.sin(time / 50) * 5;
                ctx.arc(0, 0, magSize, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 62, 62, 0.3)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.scale(squash, stretch);

            ctx.save();
            ctx.rotate(this.game.player.angle);
            ctx.beginPath();
            ctx.arc(0, 0, CONFIG.playerRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#050508';
            ctx.fill();
            ctx.strokeStyle = skin.color;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#ffffff';

            const eyeSpacing = 6;
            const isBlinking = (time % 3500) < 150 || (velY < 0.5 && (time % 2000) < 100);

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
                ctx.arc(-eyeSpacing, -2, 5.5, 0, Math.PI * 2);
                ctx.arc(eyeSpacing, -2, 5.5, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.fillStyle = 'rgba(255, 100, 150, 0.6)';
            ctx.beginPath();
            ctx.arc(-eyeSpacing - 4, 3, 3.5, 0, Math.PI * 2);
            ctx.arc(eyeSpacing + 4, 3, 3.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = skin.color;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';

            ctx.beginPath();
            ctx.moveTo(-16, 5);
            ctx.lineTo(-24, 10);
            ctx.moveTo(16, 5);
            ctx.lineTo(24, 10);
            ctx.stroke();

            ctx.restore();
        }

        // 8. Draw Particles
        this.game.particleSystem.render(ctx);

        // 9. JUICE: Speed Lines
        if (this.game.player && Math.abs(this.game.player.velocity.y) > 15) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            const lineCount = Math.floor(Math.abs(this.game.player.velocity.y) / 2);
            const viewTop = -this.game.cameraY;
            const viewBottom = -this.game.cameraY + (this.canvas.height / (this.canvas.width / CONFIG.canvasWidth));
            
            ctx.beginPath();
            for(let i=0; i<lineCount; i++) {
                const x = Math.random() * CONFIG.canvasWidth;
                const length = 50 + Math.random() * 100;
                const y = viewTop + Math.random() * (viewBottom - viewTop);
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + (this.game.player.velocity.y > 0 ? -length : length));
            }
            ctx.stroke();
            ctx.restore();
        }

        // 9.5 JUICE: Hazard proximity warning
        if (this.game.player && !this.game.isGameOver) {
            const drawLavaPos = this.game.lavaHeight;
            const dist = this.game.modeStrategy.name === 'fall' 
                ? this.game.player.position.y - drawLavaPos
                : drawLavaPos - this.game.player.position.y;
                
            if (dist < 800 && dist > 0) {
                const alpha = Math.max(0, (800 - dist) / 800) * 0.5;
                const viewTop = -this.game.cameraY;
                const viewHeight = this.canvas.height / scale;
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha * (0.6 + 0.4 * Math.sin(time/50))})`;
                ctx.fillRect(0, viewTop, CONFIG.canvasWidth, viewHeight);
            }
        }

        ctx.restore();

        // 10. Draw Active Coins (Overlayed so it isn't transformed)
        ctx.save();
        ctx.scale(scale, scale);
        ctx.translate(0, this.game.cameraY);
        const cmult = Math.min(1.5, 1 + this.game.coins / 500);
        this.game.activeCoins.forEach(c => {
            ctx.translate(c.position.x, c.position.y);
            ctx.rotate(time / 500);
            ctx.beginPath();
            ctx.arc(0, 0, 8 * cmult, 0, Math.PI * 2);
            ctx.fillStyle = '#ffb300'; // rich gold
            ctx.fill();
            ctx.beginPath();
            ctx.arc(0, 0, 6 * cmult, 0, Math.PI * 2);
            ctx.fillStyle = '#ffe066'; // bright highlight
            ctx.fill();
            ctx.resetTransform();
            ctx.scale(scale, scale);
            ctx.translate(0, this.game.cameraY);
        });
        ctx.restore();
    }
}
