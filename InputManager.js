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
        const bindButton = (btn, key) => {
            if (!btn) return;
            const down = (e) => {
                e.preventDefault();
                this.keys[key] = true;
                btn.classList.add('active');
                try { if (game.audioManager?.audio?.state === 'suspended') game.audioManager.audio.resume(); } catch (_) {}
            };
            const up = (e) => {
                e.preventDefault();
                this.keys[key] = false;
                btn.classList.remove('active');
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            btn.addEventListener('pointerleave', up);
        };

        bindButton(document.getElementById('btn-left'), 'ArrowLeft');
        bindButton(document.getElementById('btn-right'), 'ArrowRight');
        bindButton(document.getElementById('btn-jump'), 'TouchJump');
        bindButton(document.getElementById('btn-power'), 'PowerDash');

        // Device orientation (tilt)
        window.addEventListener('deviceorientation', (e) => {
            if (game.controlMode === 'tilt' && e.gamma !== null) {
                this.gyroGamma = e.gamma;
            }
        });

        // Canvas tap → jump
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

        // Control mode toggles
        this.setupControlModeToggles();
        // Game mode toggles
        this.setupGameModeToggles();
    }

    setupControlModeToggles() {
        const game = this.game;
        const btnTouch = document.getElementById('btn-touch-mode');
        const btnTilt = document.getElementById('btn-tilt-mode');
        const leftGroup = document.querySelector('.control-group.left');
        const rightGroup = document.querySelector('.control-group.right');

        if (!btnTouch || !btnTilt) return;

        if (game.controlMode === 'tilt') {
            btnTouch.classList.remove('active');
            btnTilt.classList.add('active');
            if (leftGroup) leftGroup.style.display = 'none';
            if (rightGroup) rightGroup.style.display = 'none';
        }

        btnTouch.onclick = () => {
            game.controlMode = 'touch';
            localStorage.setItem('controlMode', 'touch');
            btnTouch.classList.add('active');
            btnTilt.classList.remove('active');
            if (leftGroup) leftGroup.style.display = 'flex';
            if (rightGroup) rightGroup.style.display = 'flex';
        };

        btnTilt.onclick = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try { await DeviceOrientationEvent.requestPermission(); } catch (_) {}
            }
            game.controlMode = 'tilt';
            localStorage.setItem('controlMode', 'tilt');
            btnTilt.classList.add('active');
            btnTouch.classList.remove('active');
            if (leftGroup) leftGroup.style.display = 'none';
            if (rightGroup) rightGroup.style.display = 'none';
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
