/**
 * InputManager — handles keyboard, touch buttons, tilt, and canvas tap input.
 * Keeps movement state (vx) and exposes it for the Game loop.
 */
export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.gyroGamma = 0;
        this.smoothedGamma = 0;
        this.vx = 0; // Smoothed horizontal velocity
    }

    /** Bind all DOM event listeners — call once during init() */
    setup() {
        const game = this.game;

        // Keyboard
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.keys[e.key] = true;
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keys[e.key] = false;
        });

        // Mobile buttons
        const bindZone = (id, key) => {
            const el = document.getElementById(id);
            if (!el) return;
            const down = (e) => {
                e.preventDefault();
                this.keys[key] = true;
                try { if (game.audioManager?.audio?.state === 'suspended') game.audioManager.audio.resume(); } catch (_) {}
            };
            const up = () => { this.keys[key] = false; };
            el.addEventListener('pointerdown', down);
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
            el.addEventListener('pointerleave', up);
        };

        bindZone('touch-left', 'ArrowLeft');
        bindZone('touch-right', 'ArrowRight');
        bindZone('touch-jump', 'TapJumpDirect');

        const btnPower = document.getElementById('btn-power');
        if (btnPower) {
            btnPower.onpointerdown = (e) => {
                e.preventDefault();
                this.keys['PowerDash'] = true;
                btnPower.classList.add('active');
            };
            btnPower.onpointerup = () => {
                this.keys['PowerDash'] = false;
                btnPower.classList.remove('active');
            };
        }

        // Device orientation (tilt)
        window.addEventListener('deviceorientation', (e) => {
            if (game.controlMode === 'tilt' && e.gamma !== null) {
                this.gyroGamma = e.gamma;
            }
        });

        // Canvas tap → jump (REMOVED to prevent auto-jump/accidental jumping)
        /*
        const handleTapStart = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                this.keys['TouchJump'] = true;
                try { if (game.audioManager?.audio?.state === 'suspended') game.audioManager.audio.resume(); } catch (_) {}
            }
        };
        const handleTapEnd = () => { this.keys['TouchJump'] = false; };

        game.canvas.addEventListener('pointerdown', handleTapStart);
        game.canvas.addEventListener('pointerup', handleTapEnd);
        game.canvas.addEventListener('pointercancel', handleTapEnd);
        game.canvas.addEventListener('pointerleave', handleTapEnd);
        */

        // Control mode toggles
        this.setupControlModeToggles();
        // Game mode toggles
        this.setupGameModeToggles();
    }

    setupControlModeToggles() {
        const game = this.game;
        const btnTouch = document.getElementById('btn-touch-mode');
        const btnTilt = document.getElementById('btn-tilt-mode');
        const mc = document.getElementById('mobile-controls');

        if (!btnTouch || !btnTilt) return;

        if (game.controlMode === 'tilt') {
            btnTouch.classList.remove('active');
            btnTilt.classList.add('active');
            if (mc) mc.style.display = 'none';
        }

        btnTouch.onclick = () => {
            game.controlMode = 'touch';
            localStorage.setItem('controlMode', 'touch');
            btnTouch.classList.add('active');
            btnTilt.classList.remove('active');
            if (mc) mc.style.display = 'flex';
        };

        btnTilt.onclick = async (e) => {
            console.log("Tilt selection triggered");
            if (e) e.preventDefault();
            
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try { 
                    const permission = await DeviceOrientationEvent.requestPermission();
                    console.log("Orientation permission result:", permission);
                } catch (err) { 
                    console.warn("Tilt permission request failed:", err);
                }
            }
            
            game.controlMode = 'tilt';
            localStorage.setItem('controlMode', 'tilt');
            
            // Visual Update
            btnTilt.classList.add('active');
            btnTouch.classList.remove('active');
            
            if (mc) mc.style.display = 'none';
        };
    }

    setupGameModeToggles() {
        const game = this.game;
        const { ClimbMode, FallMode } = game._modeClasses;

        const btnClimb = document.getElementById('mode-climb');
        const btnFall = document.getElementById('mode-fall');
        const easyDesc = document.querySelector('.menu-btn.easy .btn-desc');
        const medDesc = document.querySelector('.menu-btn.medium .btn-desc');
        const hardDesc = document.querySelector('.menu-btn.hard .btn-desc');

        if (!btnClimb || !btnFall) return;

        const handleClimb = (e) => {
            if (e) e.preventDefault();
            game.gameMode = 'climb';
            game.modeStrategy = new ClimbMode(game);
            btnClimb.classList.add('active');
            btnFall.classList.remove('active');
            if(easyDesc) easyDesc.innerText = "Steady climb";
            if(medDesc) medDesc.innerText = "Balanced challenge";
            if(hardDesc) hardDesc.innerText = "Pure agony";
        };
        const handleFall = (e) => {
            if (btnFall.disabled || btnFall.classList.contains('disabled')) {
                if (e) e.preventDefault();
                return;
            }
            if (e) e.preventDefault();
            game.gameMode = 'fall';
            game.modeStrategy = new FallMode(game);
            btnFall.classList.add('active');
            btnClimb.classList.remove('active');
            if(easyDesc) easyDesc.innerText = "Free falling";
            if(medDesc) medDesc.innerText = "Lethal velocity";
            if(hardDesc) hardDesc.innerText = "Absolute static";
        };

        btnClimb.addEventListener('pointerdown', handleClimb);
        btnFall.addEventListener('pointerdown', handleFall);
    }

    /**
     * Smooth tilt input via exponential moving average.
     */
    updateTilt() {
        if (this.game.controlMode !== 'tilt' || this.gyroGamma === 0) return;
        this.smoothedGamma += (this.gyroGamma - this.smoothedGamma) * 0.2;
    }

    /** Reset smoothed velocity — call on game restart */
    reset() {
        this.vx = 0;
    }

    /** Consume a one-shot key (returns true the first frame it was pressed) */
    consume(key) {
        if (this.keys[key]) {
            this.keys[key] = false;
            return true;
        }
        return false;
    }
}
