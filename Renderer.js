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
        pctx.fillStyle = '#666666'; pctx.strokeStyle = '#222222'; pctx.lineWidth = 3;
        this.roundRect(pctx, 5, 5, w - 10, h, 8);
        pctx.fill(); pctx.stroke();
        pctx.fillStyle = '#b3b3b3';
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

        const scale = (this.canvas.width / CONFIG.canvasWidth) || 1;
        ctx.scale(scale, scale);

        if (this.game.player) {
            const viewportHeight = this.canvas.height / scale;
            const offset = (this.game.modeStrategy && this.game.modeStrategy.name === 'fall') ? -viewportHeight * 0.25 : 100;
            const targetY = -this.game.player.position.y + viewportHeight / 2 + offset;
            
            if (!isNaN(targetY)) {
                if (this.game._isResettingCamera) {
                    this.game.cameraY = targetY;
                    this.game._isResettingCamera = false;
                } else {
                    this.game.cameraY += (targetY - this.game.cameraY) * 0.1;
                    if (isNaN(this.game.cameraY)) this.game.cameraY = targetY;
                }
            }
        }
        ctx.translate(0, this.game.cameraY || 0);

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

        // Draw Earth surface (only if visible)
        const surfaceY = this.game.modeStrategy.name === 'climb' ? CONFIG.canvasHeight : 0;
        if (Math.abs(surfaceY - (-this.game.cameraY)) < 2000) {
            ctx.fillStyle = '#3a2318';
            const surfaceH = this.game.modeStrategy.name === 'climb' ? 10000 : -10000;
            ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, surfaceH);
            ctx.fillStyle = '#00af50';
            ctx.fillRect(-50, surfaceY, CONFIG.canvasWidth + 100, this.game.modeStrategy.name === 'climb' ? 20 : -20);
        }

        // 3. Draw Background Theme Particles
        const themeName = this.game.currentTheme.name;
        this.game.stars.forEach(s => {
            if (themeName === 'Space') {
                s.y = (s.y + 0.2) % (this.canvas.height / scale + 1000);
                ctx.fillStyle = `rgba(255,255,255,${s.opacity * (0.6 + 0.4 * Math.sin(time/1000 + s.x))})`;
                ctx.fillRect(s.x, s.y - 500, s.size, s.size);
            } else if (themeName === 'Rain') {
                s.y = (s.y + 15 + s.size * 2) % (this.canvas.height / scale + 1000);
                ctx.fillStyle = `rgba(150, 180, 255, ${s.opacity})`;
                ctx.fillRect(s.x, s.y - 500, 2, s.size * 5 + 10);
            } else if (themeName === 'Water') {
                s.y = (s.y - 1 - s.size) % (this.canvas.height / scale + 1000);
                if (s.y < -500) s.y = this.canvas.height / scale + 500; // Drift up
                const sway = Math.sin(time/500 + s.y/100) * 2;
                ctx.beginPath();
                ctx.arc(s.x + sway, s.y - 500, s.size * 2, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${s.opacity * 0.5})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (themeName === 'Forest') {
                s.y = (s.y + 1 + s.size/2) % (this.canvas.height / scale + 1000);
                const sway = Math.sin(time/1000 + s.y/50) * 5;
                ctx.fillStyle = `rgba(100, 255, 100, ${s.opacity * 0.4})`;
                ctx.beginPath();
                ctx.arc(s.x + sway, s.y - 500, s.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (themeName === 'Earth') {
                s.y = (s.y + 0.5) % (this.canvas.height / scale + 1000);
                ctx.fillStyle = `rgba(150, 100, 50, ${s.opacity * 0.6})`;
                ctx.fillRect(s.x, s.y - 500, s.size * 1.5, s.size * 1.5);
            }
        });

        // 4. Draw Platforms
        this.game.platforms.forEach(p => {
            const w = p.bounds.max.x - p.bounds.min.x;
            const h = p.bounds.max.y - p.bounds.min.y;
            const isFall = this.game.modeStrategy.name === 'fall';

            if (p.label === 'platform') {
                ctx.save();
                if (isFall && (w > 250 || h > 40)) {
                    // Draw as iron wall segment
                    const grad = ctx.createLinearGradient(0, p.bounds.min.y, 0, p.bounds.max.y);
                    grad.addColorStop(0, '#444'); grad.addColorStop(0.5, '#666'); grad.addColorStop(1, '#333');
                    ctx.fillStyle = grad;
                    ctx.fillRect(p.bounds.min.x, p.bounds.min.y, w, h);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
                    ctx.strokeRect(p.bounds.min.x, p.bounds.min.y, w, h);
                } else if (p.isCrumbling && p.crumbleTimer > 0) {
                    const shake = Math.sin(time * 0.1) * 3;
                    ctx.translate(shake, 0);
                    ctx.filter = 'contrast(1.5) brightness(1.2)';
                    ctx.fillStyle = '#ffae00';
                    this.roundRect(ctx, p.position.x - w / 2, p.position.y - 6, w, 15, 4);
                    ctx.fill();
                } else {
                    ctx.drawImage(this.platformCanvas, 5, 5, 190, 15, p.position.x - w / 2, p.position.y - 6, w, 15);
                }
                ctx.restore();
            } else if (p.label === 'pillar') {
                ctx.fillStyle = '#555555';
                ctx.strokeStyle = '#888888';
                ctx.lineWidth = 3;
                this.roundRect(ctx, p.bounds.min.x, p.bounds.min.y, w, h, 8);
                ctx.fill();
                ctx.stroke();
            } else if (p.label === 'hazard' || p.label === 'oscillator') {
                const yTop = p.bounds.min.y;
                const yBottom = p.bounds.max.y;

                if (p.isLaser) {
                    if (p.laserState === 'on') {
                        const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
                        grad.addColorStop(0, 'rgba(255, 0, 80, 0)');
                        grad.addColorStop(0.5, 'rgba(255, 0, 80, 0.9)');
                        grad.addColorStop(1, 'rgba(255, 0, 80, 0)');
                        ctx.fillStyle = grad;
                        ctx.fillRect(p.bounds.min.x, yTop - 10, w, h + 20);
                        
                        ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.moveTo(p.bounds.min.x, p.position.y); ctx.lineTo(p.bounds.max.x, p.position.y); ctx.stroke();
                    } else if (p.laserState === 'warning') {
                        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
                        ctx.fillRect(p.bounds.min.x, yTop, w, h);
                    }
                    return; 
                }

                if (isFall) {
                    const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
                    grad.addColorStop(0, '#555'); grad.addColorStop(0.5, '#aaa'); grad.addColorStop(1, '#333');
                    ctx.fillStyle = grad;
                    ctx.fillRect(p.bounds.min.x, yTop, w, h);
                    
                    if (p.hasSpikes) {
                        ctx.fillStyle = '#ff0000'; // RED SPIKES
                        const sSize = 12;
                        for (let sx = p.bounds.min.x; sx < p.bounds.max.x; sx += sSize) {
                            ctx.beginPath(); ctx.moveTo(sx, yTop); ctx.lineTo(sx + sSize/2, yTop - 10); ctx.lineTo(sx + sSize, yTop); ctx.fill();
                            ctx.beginPath(); ctx.moveTo(sx, yBottom); ctx.lineTo(sx + sSize/2, yBottom + 10); ctx.lineTo(sx + sSize, yBottom); ctx.fill();
                        }
                    } else if (p.label === 'oscillator') {
                        ctx.fillStyle = '#111';
                        const centerY = yTop + h / 2;
                        for (let rx = p.bounds.min.x + 10; rx < p.bounds.max.x; rx += 40) {
                            ctx.beginPath(); ctx.arc(rx, centerY, 3, 0, Math.PI*2); ctx.fill();
                        }
                    }
                } else {
                    ctx.fillStyle = p.label === 'hazard' ? '#ff2200' : '#ffff00';
                    ctx.fillRect(p.bounds.min.x, yTop, w, h);
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

        // 6. Draw Lava / Spikes (Hazard boundaries)
        ctx.save();
        const isFall = this.game.modeStrategy.name === 'fall';
        const drawLavaPos = this.game.lavaHeight;
        const timeInS = time / 1000;
        // scale is already declared above at line 57
        const viewportHeight = this.canvas.height / scale;

        ctx.beginPath();
        if (isFall) {
            // FALL MODE: Spikes at the top, filling towards top of screen
            const screenTop = -this.game.cameraY - 100;
            ctx.moveTo(-100, screenTop);
            ctx.lineTo(CONFIG.canvasWidth + 100, screenTop);
            ctx.lineTo(CONFIG.canvasWidth + 100, drawLavaPos);
            
            const spikeHeight = 50;
            const spikeWidth = 40;
            for (let x = CONFIG.canvasWidth + 100; x >= -100; x -= spikeWidth) {
                const vx = Math.sin(timeInS * 6 + x) * 2;
                ctx.lineTo(x - spikeWidth / 2 + vx, drawLavaPos + spikeHeight + Math.cos(timeInS * 8 + x) * 6);
                ctx.lineTo(x - spikeWidth + vx, drawLavaPos);
            }
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, drawLavaPos, 0, screenTop);
            grad.addColorStop(0, '#ff0000'); // Menacing red tips
            grad.addColorStop(0.3, '#880000');
            grad.addColorStop(1, '#220000');
            ctx.fillStyle = grad;
            ctx.fill();
        } else {
            // CLIMB MODE: Wave/Lava at the bottom
            const screenBottom = -this.game.cameraY + viewportHeight + 100;
            ctx.moveTo(-100, screenBottom);
            ctx.lineTo(CONFIG.canvasWidth + 100, screenBottom);
            
            for (let x = CONFIG.canvasWidth + 100; x >= -100; x -= 10) {
                const waveY = drawLavaPos + Math.sin((x / 30) + (timeInS * 2)) * 8 + Math.cos((x / 50) - (timeInS * 1.5)) * 6;
                ctx.lineTo(x, waveY);
            }
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, drawLavaPos, 0, screenBottom);
            grad.addColorStop(0, '#ffcc00');
            grad.addColorStop(0.2, '#ff3300');
            grad.addColorStop(1, '#660000');
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.restore();

        if (this.game.player) {
            const skin = SKINS.find(s => s.id === this.game.activeSkinId);
            const velY = this.game.isGameOver ? 0 : Math.abs(this.game.player.velocity.y);
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

            const eyeSpacing = 8;
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
                ctx.ellipse(-eyeSpacing, -2, 5, 8.5, 0, 0, Math.PI * 2);
                ctx.ellipse(eyeSpacing, -2, 5, 8.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Removed blush cheeks to match the second image style.

            ctx.strokeStyle = skin.color;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';

            const isFallingFast = this.game.modeStrategy && this.game.modeStrategy.name === 'fall' && velY > 2 && !this.game.isGameOver;
            const armFlapY = isFallingFast ? Math.sin(time / 40) * 8 - 12 : Math.sin(time / 150) * 2;
            const armFlapX = isFallingFast ? Math.cos(time / 40) * 3 : 0;

            ctx.beginPath();
            ctx.moveTo(-17, 7);
            ctx.lineTo(-26 - armFlapX, 14 + armFlapY);
            ctx.moveTo(17, 7);
            ctx.lineTo(26 + armFlapX, 14 + armFlapY);
            ctx.stroke();

            ctx.restore();
        }

        // 8. Draw Particles
        this.game.particleSystem.render(ctx);

        // 9. JUICE: Speed Lines
        if (this.game.player && Math.abs(this.game.player.velocity.y) > 15 && !this.game.isGameOver) {
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

        // 11. Death Animation Slow Fade Background
        if (this.game.gameState === 'DEATH_ANIMATION' || this.game.gameState === 'GAME_OVER') {
            let overlayOpacity = 0.5;
            if (this.game.gameState === 'DEATH_ANIMATION' && this.game.deathTimerAnim) {
                 const timeSinceDeath = performance.now() - this.game.deathTimerAnim;
                 overlayOpacity = Math.min(0.5, (timeSinceDeath / 1000) * 0.5);
            }
            if (overlayOpacity > 0) {
                 ctx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity})`;
                 ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }
}
