import { Capacitor } from '@capacitor/core';
import { UnityAds } from 'capacitor-unity-ads';

/**
 * AdManager — manages Unity Ads initialization, loading, and showing.
 */
export class AdManager {
    constructor(game) {
        this.game = game;
    }

    async init() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await UnityAds.initialize({ gameId: '6051910', testMode: false });
            this.load();
        } catch (_) {}
    }

    async load() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await UnityAds.loadInterstitial({ placementId: 'Interstitial_Android' });
            await UnityAds.loadRewardedVideo({ placementId: 'Rewarded_Android' });
        } catch (_) {}
    }

    async showGameOverAd() {
        if (!Capacitor.isNativePlatform()) return;
        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                await UnityAds.showRewardedVideo();
                this.load();
            } else if ((await UnityAds.isInterstitialLoaded()).loaded) {
                await UnityAds.showInterstitial();
                this.load();
            }
        } catch (_) {}
    }

    async startRevive() {
        const game = this.game;
        if (!Capacitor.isNativePlatform()) {
            // Simulated fake ad for web testing
            const adOverlay = document.createElement('div');
            adOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#fff;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Outfit,sans-serif;';
            adOverlay.innerHTML = `
                <h1 style="color:#ffcc00; margin-bottom:10px; font-size:32px;">TEST ADVERTISEMENT</h1>
                <p style="font-size:18px; color:#aaa;">Simulating rewarded video ad...</p>
                <h2 id="fake-ad-timer" style="margin-top:40px;font-size:48px;">3</h2>
            `;
            document.body.appendChild(adOverlay);
            
            let timeLeft = 3;
            const interval = setInterval(() => {
                timeLeft--;
                const timerEl = document.getElementById('fake-ad-timer');
                if (timerEl) timerEl.innerText = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    adOverlay.remove();
                    game.handleAdReward();
                }
            }, 1000);
            return;
        }
        const btn = document.getElementById('ad-revive-btn');
        btn.innerText = 'LOADING...';
        btn.disabled = true;
        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                const result = await UnityAds.showRewardedVideo();
                if (result.success) {
                    game.handleAdReward();
                } else {
                    // Ad failed to finish, but we shouldn't show a blocking alert
                    game.handleAdReward(); 
                }
            } else {
                // Ad not loaded, give free revive instead of showing an alert
                game.handleAdReward();
                this.load();
            }
        } catch (_) {
            game.handleAdReward(); // fallback
        } finally {
            btn.innerText = 'REVIVE';
            btn.disabled = false;
        }
    }

    async startPowerAd() {
        const game = this.game;
        if (game.isAdPlaying) return; // Prevent spam

        game.isAdPlaying = true; // Pause game logic

        const grantPower = () => {
            game.isAdPlaying = false;
            game.powerUsesThisRun++;
            game.modeStrategy.handleDash(game, game.inputManager.vx || 0);
        };

        if (!Capacitor.isNativePlatform()) {
            const adOverlay = document.createElement('div');
            adOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#fff;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Outfit,sans-serif;';
            adOverlay.innerHTML = `
                <h1 style="color:#ffcc00; margin-bottom:10px; font-size:32px;">TEST POWER AD</h1>
                <p style="font-size:18px; color:#aaa;">Simulating rewarded video to unlock power...</p>
                <h2 id="fake-power-ad-timer" style="margin-top:40px;font-size:48px;">3</h2>
            `;
            document.body.appendChild(adOverlay);
            
            let timeLeft = 3;
            const interval = setInterval(() => {
                timeLeft--;
                const timerEl = document.getElementById('fake-power-ad-timer');
                if (timerEl) timerEl.innerText = timeLeft;
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    adOverlay.remove();
                    grantPower();
                }
            }, 1000);
            return;
        }

        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                const result = await UnityAds.showRewardedVideo();
                if (result.success) {
                    grantPower();
                } else {
                    grantPower(); 
                }
            } else {
                grantPower();
                this.load();
            }
        } catch (_) {
            grantPower(); // fallback
        }
    }
}
