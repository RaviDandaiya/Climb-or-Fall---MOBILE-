import { CONFIG, SKINS } from './constants.js';

export class Renderer {
    constructor(game) {
        this.game = game;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.platformCanvas = document.createElement('canvas');
        this.platformCanvas.width = 300;
        this.platformCanvas.height = 40;
        this.drawCachedPlatform();
    }

    drawPlayerBody(ctx, skin, radius) {
        const shape = skin.shape || 'round';
        const bodyColor = skin.bodyColor || skin.color;

        ctx.beginPath();
        if (shape === 'flame') {
            ctx.moveTo(0, -radius * 1.2);
            ctx.bezierCurveTo(radius * 0.95, -radius * 0.65, radius * 0.95, radius * 0.25, 0, radius * 1.15);
            ctx.bezierCurveTo(-radius * 0.95, radius * 0.25, -radius * 0.95, -radius * 0.65, 0, -radius * 1.2);
            ctx.closePath();
        } else if (shape === 'crystal') {
            ctx.moveTo(0, -radius * 1.15);
            ctx.lineTo(radius * 0.72, -radius * 0.45);
            ctx.lineTo(radius * 1.05, 0);
            ctx.lineTo(radius * 0.72, radius * 0.55);
            ctx.lineTo(0, radius * 1.15);
            ctx.lineTo(-radius * 0.72, radius * 0.55);
            ctx.lineTo(-radius * 1.05, 0);
            ctx.lineTo(-radius * 0.72, -radius * 0.45);
            ctx.closePath();
        } else if (shape === 'spike') {
            const points = 10;
            const outer = radius * 1.12;
            const inner = radius * 0.62;
            for (let i = 0; i < points * 2; i++) {
                const angle = (Math.PI / points) * i - Math.PI / 2;
                const r = i % 2 === 0 ? outer : inner;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else if (shape === 'star') {
            const points = 8;
            const outer = radius * 1.15;
            const inner = radius * 0.5;
            for (let i = 0; i < points * 2; i++) {
                const angle = (Math.PI / points) * i - Math.PI / 2;
                const r = i % 2 === 0 ? outer : inner;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else if (shape === 'robo') {
            // Square mechanical head
            ctx.rect(-radius * 0.95, -radius * 0.95, radius * 1.9, radius * 1.9);
            
            // Side "bolts" or ears
            ctx.rect(-radius * 1.15, -radius * 0.3, radius * 0.2, radius * 0.6);
            ctx.rect(radius * 0.95, -radius * 0.3, radius * 0.2, radius * 0.6);
            
            // Antenna
            ctx.moveTo(0, -radius * 0.95);
            ctx.lineTo(0, -radius * 1.4);
            ctx.arc(0, -radius * 1.5, 3, 0, Math.PI * 2);
            ctx.closePath();
        } else if (shape === 'blob') {
            const points = 8;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                const r = radius * (0.9 + Math.sin(angle * 3 + performance.now() / 200) * 0.1);
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else if (shape === 'ghost') {
            ctx.arc(0, -radius * 0.2, radius, Math.PI, 0);
            ctx.lineTo(radius, radius);
            for (let i = 0; i < 3; i++) {
                const x = radius - (i * radius * 0.66) - radius * 0.33;
                ctx.quadraticCurveTo(x, radius + 10, x - radius * 0.33, radius);
            }
            ctx.lineTo(-radius, -radius * 0.2);
            ctx.closePath();
        } else if (shape === 'diamond') {
            ctx.moveTo(0, -radius * 1.3);
            ctx.lineTo(radius * 0.9, 0);
            ctx.lineTo(0, radius * 1.3);
            ctx.lineTo(-radius * 0.9, 0);
            ctx.closePath();
        } else if (shape === 'eye') {
            ctx.ellipse(0, 0, radius * 1.2, radius * 0.8, 0, 0, Math.PI * 2);
            ctx.closePath();
        } else if (shape === 'cube') {
            ctx.rect(-radius, -radius, radius * 2, radius * 2);
        } else {
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
        }

        const fill = ctx.createRadialGradient(-radius * 0.25, -radius * 0.35, radius * 0.1, 0, 0, radius * 1.2);
        fill.addColorStop(0, '#0b0b12');
        fill.addColorStop(0.65, bodyColor);
        fill.addColorStop(1, '#050508');
        ctx.fillStyle = fill;
        ctx.fill();
    }

    handleResize() {
        if (window.innerWidth === 0) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    drawCachedPlatform() {
        const pctx = this.platformCanvas.getContext('2d');
        const w = 200, h = CONFIG.platformHeight;
        pctx.clearRect(0, 0, 300, 40);
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

        const isMobile = window.innerWidth <= 768;
        // 1. Clear with animated gradient background
        if (isMobile) {
            ctx.fillStyle = this.game.currentTheme.bg[1] || '#000';
        } else {
            const bgTime = time / 2000;
            const bgOffset1 = Math.sin(bgTime) * 300;
            const bgOffset2 = Math.cos(bgTime) * 300;
            const grad = ctx.createLinearGradient(0, bgOffset1, 0, Math.max(window.innerHeight, this.canvas.height) + bgOffset2);
            grad.addColorStop(0, this.game.currentTheme.bg[0]);
            grad.addColorStop(1, this.game.currentTheme.bg[1]);
            ctx.fillStyle = grad;
        }
        ctx.fillRect(0, 0, this.canvas.width + 1000, this.canvas.height + 1000);

        // 2. Camera & Global Transform
        ctx.save();

        // Correct scaling for mobile: always fit the 600-unit logical width (CONFIG.canvasWidth)
        const baseWidth = CONFIG.canvasWidth;
        const scale = (this.canvas.width / baseWidth) || 1;
        ctx.scale(scale, scale);

        if (this.game.player) {
            const viewportHeight = this.canvas.height / scale;
            // Adaptive camera offset: keep the player above the mobile buttons
            const offset = (this.game.modeStrategy && this.game.modeStrategy.name === 'fall') 
                ? -viewportHeight * 0.25 
                : (viewportHeight * 0.15);
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

        // Draw Speed Lines if dashing
        if (this.game.dashEffectTimer > 0) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Overlay on top
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 2;
            const lineCount = 15;
            for(let i=0; i<lineCount; i++) {
                const x = (Math.random() * this.canvas.width);
                const y = (Math.random() * this.canvas.height);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 100);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw Side Walls (Pillar Walls) - logical width 600
        this.drawSideWalls(ctx);

        // Apply Juice: Screen Shake
        if (this.game.shake > 0.5) {
            const sx = (Math.random() - 0.5) * this.game.shake;
            const sy = (Math.random() - 0.5) * this.game.shake;
            ctx.translate(sx, sy);
            this.game.shake *= 0.9;
        }

        const viewTop = -this.game.cameraY;
        const viewHeight = this.canvas.height / scale;

        // Draw Earth surface (only if visible)
        const surfaceY = this.game.modeStrategy.name === 'climb' ? (CONFIG.canvasHeight + 300) : 0;
        if (Math.abs(surfaceY - (-this.game.cameraY)) < 2500) {
            ctx.fillStyle = '#3a2318';
            // Anchor firmly: use a massive height so it always touches the screen bottom
            const surfaceH = this.game.modeStrategy.name === 'climb' ? 10000 : -10000;
            ctx.fillRect(-150, surfaceY, CONFIG.canvasWidth + 300, surfaceH);
            ctx.fillStyle = '#00ff88'; // Bright Green ground topper
            ctx.fillRect(-150, surfaceY, CONFIG.canvasWidth + 300, this.game.modeStrategy.name === 'climb' ? 12 : -12);
        }

        // Draw Last Death / Best Height Line (Green Line)
        if (this.game.lastGameOverY !== null) {
            ctx.save();
            ctx.setLineDash([10, 10]);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(0, this.game.lastGameOverY);
            ctx.lineTo(CONFIG.canvasWidth, this.game.lastGameOverY);
            ctx.stroke();
            // Label
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('LAST BEST', 20, this.game.lastGameOverY - 10);
            ctx.restore();
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
            } else if (themeName === 'Cyber') {
                // Horizontal data streams
                const speed = 2 + s.size;
                s.x = (s.x + speed) % (CONFIG.canvasWidth + 200);
                if (s.x > CONFIG.canvasWidth + 100) s.x = -100;
                ctx.fillStyle = `rgba(0, 255, 204, ${s.opacity * 0.3})`;
                ctx.fillRect(s.x, s.y - 500, s.size * 10, 1);
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
                    if (window.innerWidth <= 768) {
                        ctx.fillStyle = '#555';
                    } else {
                        const grad = ctx.createLinearGradient(0, p.bounds.min.y, 0, p.bounds.max.y);
                        grad.addColorStop(0, '#444'); grad.addColorStop(0.5, '#666'); grad.addColorStop(1, '#333');
                        ctx.fillStyle = grad;
                    }
                    ctx.fillRect(p.bounds.min.x, p.bounds.min.y, w, h);
                    ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
                    ctx.strokeRect(p.bounds.min.x, p.bounds.min.y, w, h);
                } else if (p.isCrumbling && p.crumbleTimer > 0) {
                    const shake = Math.sin(time * 0.1) * 3;
                    ctx.translate(shake, 0);
                    ctx.filter = window.innerWidth <= 768 ? 'none' : 'contrast(1.5) brightness(1.2)';
                    ctx.fillStyle = '#ffae00';
                    this.roundRect(ctx, p.position.x - w / 2, p.position.y - 6, w, 15, 4);
                    ctx.fill();
                } else if (p.isSafety) {
                    // Draw the "Holy Wall" safety platform
                    if (window.innerWidth <= 768) {
                        ctx.fillStyle = 'rgba(0, 255, 136, 0.4)';
                    } else {
                        const grad = ctx.createLinearGradient(p.bounds.min.x, 0, p.bounds.max.x, 0);
                        grad.addColorStop(0, 'rgba(0, 255, 136, 0)');
                        grad.addColorStop(0.5, 'rgba(0, 255, 136, 0.8)');
                        grad.addColorStop(1, 'rgba(0, 255, 136, 0)');
                        ctx.fillStyle = grad;
                    }
                    ctx.fillRect(p.bounds.min.x, p.bounds.min.y, w, h);
                    
                    // Add a glowing core
                    ctx.shadowBlur = window.innerWidth <= 768 ? 0 : 15;
                    ctx.shadowColor = '#00ff88';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(p.bounds.min.x, p.position.y - 2, w, 4);
                    ctx.shadowBlur = 0;
                } else {
                    const ph = CONFIG.platformHeight;
                    ctx.drawImage(this.platformCanvas, 5, 5, 190, ph, p.position.x - w / 2, p.position.y - ph/2, w, ph);
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
                        if (window.innerWidth <= 768) {
                            ctx.fillStyle = 'rgba(255, 0, 80, 0.5)';
                        } else {
                            const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
                            grad.addColorStop(0, 'rgba(255, 0, 80, 0)');
                            grad.addColorStop(0.5, 'rgba(255, 0, 80, 0.9)');
                            grad.addColorStop(1, 'rgba(255, 0, 80, 0)');
                            ctx.fillStyle = grad;
                        }
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
                    if (window.innerWidth <= 768) {
                        ctx.fillStyle = '#888';
                    } else {
                        const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
                        grad.addColorStop(0, '#555'); grad.addColorStop(0.5, '#aaa'); grad.addColorStop(1, '#333');
                        ctx.fillStyle = grad;
                    }
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

            if (window.innerWidth <= 768) {
                ctx.fillStyle = glowC;
            } else {
                const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 25);
                glow.addColorStop(0, glowC);
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
            }
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
            
            if (window.innerWidth <= 768) {
                ctx.fillStyle = '#aa0000';
            } else {
                const grad = ctx.createLinearGradient(0, drawLavaPos, 0, screenTop);
                grad.addColorStop(0, '#ff0000'); // Menacing red tips
                grad.addColorStop(0.3, '#880000');
                grad.addColorStop(1, '#220000');
                ctx.fillStyle = grad;
            }
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
            
            if (window.innerWidth <= 768) {
                ctx.fillStyle = '#ff3300';
            } else {
                const grad = ctx.createLinearGradient(0, drawLavaPos, 0, screenBottom);
                grad.addColorStop(0, '#ffcc00');
                grad.addColorStop(0.2, '#ff3300');
                grad.addColorStop(1, '#660000');
                ctx.fillStyle = grad;
            }
            ctx.fill();
        }
        ctx.restore();

        if (this.game.player) {
            const skin = SKINS.find(s => s.id === this.game.activeSkinId) || SKINS[0];
            const bodyColor = skin.bodyColor || skin.color;
            const strokeColor = skin.strokeColor || skin.color;
            const eyeColor = skin.eyeColor || '#ffffff';
            const glowColor = skin.glowColor || strokeColor;
            const velY = this.game.isGameOver ? 0 : Math.abs(this.game.player.velocity.y);
            const stretch = 1 + Math.min(0.3, velY / 40);
            const squash = 1 / stretch;

            ctx.save();
            ctx.translate(this.game.player.position.x, this.game.player.position.y);

            // Ghost effect for invincibility/dash
            if (this.game.isDashingFrames > 0) {
                ctx.globalAlpha = 0.5;
            }

            // Powerup Visual Enhancements
            if (this.game.hasShield) {
                // Energetic Energy Ring
                ctx.save();
                ctx.rotate(time / 400); // Slowly rotate shield
                ctx.beginPath();
                ctx.arc(0, 0, CONFIG.playerRadius + 15, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 209, 255, ${0.4 + 0.3 * Math.sin(time / 80)})`;
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]); // Dashed "energy" look
                ctx.stroke();
                ctx.restore();
                
                // Outer shimmer
                ctx.beginPath();
                ctx.arc(0, 0, CONFIG.playerRadius + 18, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 209, 255, 0.05)';
                ctx.fill();
            }

            if (this.game.magnetTimer > 0) {
                // Inward attraction particles (Simulated)
                for (let i = 0; i < 4; i++) {
                    const angle = (time / 150) + (i * Math.PI / 2);
                    const dist = 40 + (Math.sin(time / 200 + i) * 10);
                    const px = Math.cos(angle) * dist;
                    const py = Math.sin(angle) * dist;
                    ctx.fillStyle = 'rgba(255, 62, 62, 0.6)';
                    ctx.beginPath();
                    ctx.arc(px, py, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                ctx.beginPath();
                const magSize = 38 + Math.sin(time / 50) * 4;
                ctx.arc(0, 0, magSize, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 62, 62, 0.2)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.scale(squash, stretch);

            // Add Bloom/Glow to character when powered up
            if (this.game.hasShield || this.game.magnetTimer > 0) {
                ctx.shadowBlur = window.innerWidth <= 768 ? 0 : 15;
                ctx.shadowColor = this.game.hasShield ? '#00d1ff' : '#ff3e3e';
            }

            ctx.save();
            ctx.rotate(this.game.player.angle);
            this.drawPlayerBody(ctx, skin, CONFIG.playerRadius);
            ctx.shadowBlur = window.innerWidth <= 768 ? 0 : 10;
            ctx.shadowColor = glowColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
            
            ctx.shadowBlur = 0; // Reset glow for eyes
            ctx.fillStyle = '#ffffff';

            const eyeSpacing = 8;
            const isBlinking = (time % 3500) < 150 || (velY < 0.5 && (time % 2000) < 100);

            if (skin.shape === 'eye') {
                // One Big Central Eye
                if (isBlinking) {
                    ctx.strokeStyle = eyeColor;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(-10, 0);
                    ctx.lineTo(10, 0);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, 10, 0, Math.PI * 2);
                    ctx.fillStyle = eyeColor;
                    ctx.fill();
                    // Pupil
                    ctx.beginPath();
                    ctx.arc(0, 0, 5, 0, Math.PI * 2);
                    ctx.fillStyle = '#000';
                    ctx.fill();
                }
            } else if (isBlinking) {
                ctx.strokeStyle = eyeColor;
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
                ctx.fillStyle = eyeColor;
                ctx.fill();
            }

            // Removed blush cheeks to match the second image style.

            ctx.strokeStyle = strokeColor;
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
            const isBig = c.value > 1;
            ctx.translate(c.position.x, c.position.y);
            
            // 3D Rotation effect using math
            const rotSpeed = isBig ? 0.02 : 0.03;
            const tilt = Math.sin(time * rotSpeed); 
            ctx.scale(Math.abs(tilt), 1); // Horizontal squash for rotation feel

            if (isBig) {
                // Glow for big coin
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
                grad.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI*2); ctx.fill();
            }

            const cSize = isBig ? 13 : 9;
            const baseColor = isBig ? '#ffcc00' : '#ffaa00';
            const lightColor = isBig ? '#fff5cc' : '#ffeb99';
            const darkColor = isBig ? '#b38f00' : '#996600';

            // Outer rim
            ctx.beginPath();
            ctx.arc(0, 0, cSize, 0, Math.PI * 2);
            ctx.fillStyle = darkColor;
            ctx.fill();

            // Main body
            ctx.beginPath();
            ctx.arc(0, 0, cSize - 1.5, 0, Math.PI * 2);
            ctx.fillStyle = baseColor;
            ctx.fill();

            // Highlight
            ctx.beginPath();
            ctx.arc(-2, -2, cSize / 2.5, 0, Math.PI * 2);
            ctx.fillStyle = lightColor;
            ctx.fill();

            // Inner Detail (The "C" or circle)
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, cSize / 2, 0, Math.PI * 2);
            ctx.stroke();

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

    drawSideWalls(ctx) {
        // Draw Side Walls (Pillar Walls) - use logical width 600
        const wallWidth = 15;
        const viewTop = -this.game.cameraY;
        const scale = (this.canvas.width / CONFIG.canvasWidth) || 1;
        const viewHeight = this.canvas.height / scale;
        
        // Left Wall
        ctx.save();
        const grad = ctx.createLinearGradient(0, 0, wallWidth, 0);
        grad.addColorStop(0, '#222'); grad.addColorStop(0.5, '#444'); grad.addColorStop(1, '#111');
        ctx.fillStyle = grad;
        ctx.fillRect(0, viewTop, wallWidth, viewHeight);
        
        // Right Wall
        const gradRight = ctx.createLinearGradient(CONFIG.canvasWidth - wallWidth, 0, CONFIG.canvasWidth, 0);
        gradRight.addColorStop(0, '#111'); gradRight.addColorStop(0.5, '#444'); gradRight.addColorStop(1, '#222');
        ctx.fillStyle = gradRight;
        ctx.fillRect(CONFIG.canvasWidth - wallWidth, viewTop, wallWidth, viewHeight);

        // Add some metallic rivets to the walls
        ctx.fillStyle = '#666';
        const startY = Math.floor(viewTop / 80) * 80;
        for (let y = startY; y < viewTop + viewHeight + 80; y += 80) {
            ctx.beginPath(); ctx.arc(wallWidth / 2, y, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(CONFIG.canvasWidth - wallWidth / 2, y, 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}
