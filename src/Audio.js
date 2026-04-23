export class AudioManager {
    constructor() {
        this.soundOn = true;
        this.musicOn = true;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audio = new AudioContext();
                this.masterGain = this.audio.createGain();
                this.masterGain.gain.value = 0.12;
                this.masterGain.connect(this.audio.destination);
            }
        } catch (err) {
            console.warn('audio init fail', err);
        }
    }

    resume() {
        if (!this.audio) return;
        try { 
            if (this.audio.state === 'suspended') {
                this.audio.resume().then(() => {
                    console.log("AudioContext Resumed Successfully");
                    if (this.musicOn && !this.musicLoop) {
                        this.playMusic();
                    }
                });
            } else if (this.musicOn && !this.musicLoop) {
                this.playMusic();
            }
        } catch (e) {
            console.error("Audio Resume Error:", e);
        }
    }

    _playTone(freq, type = 'sine', when = 0, duration = 0.08, vol = 0.15) {
        if (!this.audio || !this.soundOn) return;
        try {
            const now = this.audio.currentTime + when;
            const o = this.audio.createOscillator(); 
            const g = this.audio.createGain();
            o.type = type; 
            o.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(0.001, now); 
            g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);
            o.connect(g); 
            g.connect(this.masterGain); 
            o.start(now); 
            o.stop(now + duration + 0.02);
        } catch (e) { }
    }

    playJump() { this._playTone(520, 'sawtooth', 0, 0.09, 0.1); }
    playCoin() { this._playTone(920, 'sine', 0, 0.08, 0.2); }
    playLevelUp() { this._playTone(720, 'triangle', 0, 0.18, 0.2); this._playTone(980, 'sine', 0.05, 0.12, 0.15); }
    playDeath() { this._playTone(120, 'sine', 0, 0.4, 0.3); this._playTone(80, 'sawtooth', 0.1, 0.3, 0.2); }
    playGameOver() { this._playTone(120, 'sine', 0, 0.4, 0.3); }
    playFall() { this._playTone(300, 'sawtooth', 0, 0.5, 0.15); }
    playShield() { this._playTone(640, 'triangle', 0, 0.18, 0.2); this._playTone(960, 'sine', 0.08, 0.14, 0.15); }
    playMagnet() { this._playTone(420, 'sawtooth', 0, 0.16, 0.15); this._playTone(220, 'sine', 0.05, 0.25, 0.2); }
    playPowerPickup() { this._playTone(880, 'square', 0, 0.12, 0.1); this._playTone(1320, 'sine', 0.06, 0.1, 0.1); }
    playPowerup() { this.playPowerPickup(); }
    playLavaWarning() { this._playTone(320, 'sawtooth', 0, 0.25, 0.15); this._playTone(180, 'sine', 0.12, 0.25, 0.2); }
    playUI() { this._playTone(640, 'triangle', 0, 0.06, 0.12); }
    playStart() { this._playTone(760, 'sine', 0, 0.12, 0.2); this._playTone(1040, 'triangle', 0.05, 0.1, 0.15); }
    
    playMusic() {
        if (!this.audio || !this.musicOn || this.musicLoop) return;
        
        let beat = 0;
        const melody = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66]; // Simple C Major loop
        
        this.musicInterval = setInterval(() => {
            if (!this.musicOn || (this.audio && this.audio.state === 'suspended')) {
                // If it's suspended, don't stop the loop, just wait
                return;
            }
            
            // Bass beat (Half notes)
            if (beat % 2 === 0) {
                this._playTone(beat % 4 === 0 ? 65 : 49, 'sine', 0, 0.4, 0.08); // C2 or G1
            }
            
            // Snare-ish sound
            if (beat % 4 === 2) {
                this._playTone(180, 'triangle', 0.05, 0.1, 0.05);
            }
            
            // Simple Melody (Eighth notes)
            const note = melody[beat % melody.length];
            this._playTone(note, 'sine', 0.1, 0.15, 0.04);
            
            beat++;
        }, 250); // Faster tempo
        this.musicLoop = true;
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        this.musicLoop = false;
    }
}
