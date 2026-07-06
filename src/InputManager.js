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

        // Initialize Virtual Joystick
        this.setupJoystick();

        // Circular Jump Button
        const jumpBtn = document.getElementById('touch-jump');
        if (jumpBtn) {
            const down = (e) => {
                e.preventDefault();
                this.keys['TapJumpDirect'] = true;
                try { if (game.audioManager) game.audioManager.resume(); } catch (_) {}
            };
            const up = () => { this.keys['TapJumpDirect'] = false; };
            jumpBtn.addEventListener('pointerdown', down);
            jumpBtn.addEventListener('pointerup', up);
            jumpBtn.addEventListener('pointercancel', up);
            jumpBtn.addEventListener('pointerleave', up);
        }

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

        // Game mode toggles
        this.setupGameModeToggles();
    }

    setupJoystick() {
        const base = document.getElementById('joystick-base');
        const knob = document.getElementById('joystick-knob');
        if (!base || !knob) return;

        let active = false;
        let pointerId = null;

        const moveKnob = (x, y) => {
            const rect = base.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const maxDist = rect.width / 2;
            
            let dx = x - centerX;
            // Lock vertical movement to 0
            let dy = 0; 
            
            const dist = Math.abs(dx);
            
            if (dist > maxDist) {
                dx *= maxDist / dist;
            }

            knob.style.transform = `translate(${dx}px, ${dy}px)`;

            // Update Game Keys
            const threshold = 10;
            this.keys['ArrowLeft'] = dx < -threshold;
            this.keys['ArrowRight'] = dx > threshold;
        };

        const handleDown = (e) => {
            if (active) return;
            active = true;
            pointerId = e.pointerId;
            base.setPointerCapture(e.pointerId);
            moveKnob(e.clientX, e.clientY);
            knob.style.background = 'rgba(255, 255, 255, 0.8)';
            try { if (this.game.audioManager) this.game.audioManager.resume(); } catch (_) {}
        };

        const handleMove = (e) => {
            if (!active || e.pointerId !== pointerId) return;
            moveKnob(e.clientX, e.clientY);
        };

        const handleUp = (e) => {
            if (e.pointerId !== pointerId) return;
            active = false;
            pointerId = null;
            knob.style.transform = 'translate(0, 0)';
            knob.style.background = 'rgba(255, 255, 255, 0.4)';
            this.keys['ArrowLeft'] = false;
            this.keys['ArrowRight'] = false;
        };

        base.addEventListener('pointerdown', handleDown);
        base.addEventListener('pointermove', handleMove);
        base.addEventListener('pointerup', handleUp);
        base.addEventListener('pointercancel', handleUp);
        
        // Prevent default touch behavior (like scrolling) on the joystick
        base.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
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
