export class AudioManager {
    constructor() {
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

    _playTone(freq, type = 'sine', when = 0, duration = 0.08) {
        if (!this.audio) return;
        try {
            const now = this.audio.currentTime + when;
            const o = this.audio.createOscillator(); 
            const g = this.audio.createGain();
            o.type = type; 
            o.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(0.001, now); 
            g.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);
            o.connect(g); 
            g.connect(this.masterGain); 
            o.start(now); 
            o.stop(now + duration + 0.02);
        } catch (e) { }
    }

    playJump() { this._playTone(520, 'sawtooth', 0, 0.09); }
    playCoin() { this._playTone(920, 'sine', 0, 0.08); }
    playLevelUp() { this._playTone(720, 'triangle', 0, 0.18); this._playTone(980, 'sine', 0.05, 0.12); }
    playGameOver() { this._playTone(120, 'sine', 0, 0.4); }
    playFall() { this._playTone(300, 'sawtooth', 0, 0.5); }
}
