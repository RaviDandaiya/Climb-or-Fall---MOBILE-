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
        if (!Capacitor.isNativePlatform() || this.isInitialized) return;
        try {
            console.log("Initializing Unity Ads for PRODUCTION...");
            await UnityAds.initialize({ 
                gameId: '6051910', 
                testMode: false // ENSURED: Production Mode
            });
            this.isInitialized = true;
            this.load();
        } catch (err) {
            console.error("Ad Initialization Failed:", err);
        }
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
            if ((await UnityAds.isRewardedVideoLoaded({ placementId: 'Rewarded_Android' })).loaded) {
                await UnityAds.showRewardedVideo({ placementId: 'Rewarded_Android' });
                this.load();
            } else if ((await UnityAds.isInterstitialLoaded({ placementId: 'Interstitial_Android' })).loaded) {
                await UnityAds.showInterstitial({ placementId: 'Interstitial_Android' });
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
                <div style="background:#1a1a2e; padding:30px; border-radius:20px; border:2px solid #ffcc00; text-align:center; box-shadow:0 0 50px rgba(0,0,0,0.8);">
                    <h1 style="color:#ffcc00; margin-bottom:10px; font-size:32px; letter-spacing:2px;">WATCHING AD...</h1>
                    <p style="font-size:18px; color:#aaa; margin-bottom:20px;">Granting reward in...</p>
                    <h2 id="fake-ad-timer" style="font-size:64px; color:#fff; text-shadow:0 0 20px #ffcc00;">3</h2>
                </div>
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
                    if (game.handleAdReward) game.handleAdReward();
                }
            }, 1000);
            return;
        }

        const btn = document.getElementById('ad-revive-btn');
        const originalText = btn ? btn.innerText : 'REVIVE';
        
        if (btn) { 
            btn.innerText = 'LOADING AD...'; 
            btn.disabled = true; 
            btn.style.opacity = '0.7';
        }

        try {
            // Check if loaded, if not, try to load one last time
            let isLoaded = (await UnityAds.isRewardedVideoLoaded({ placementId: 'Rewarded_Android' })).loaded;
            
            if (!isLoaded) {
                await UnityAds.loadRewardedVideo({ placementId: 'Rewarded_Android' });
                // Short wait to see if it loads
                await new Promise(r => setTimeout(r, 1500));
                isLoaded = (await UnityAds.isRewardedVideoLoaded({ placementId: 'Rewarded_Android' })).loaded;
            }

            if (isLoaded) {
                const result = await UnityAds.showRewardedVideo({ placementId: 'Rewarded_Android' });
                // SUCCESS: Grant reward only if completed/success
                if (result && (result.completed || result.success)) {
                    if (game.handleAdReward) game.handleAdReward();
                } else {
                    if (btn) btn.innerText = 'SKIPPED';
                    setTimeout(() => { if(btn) btn.innerText = originalText; }, 2000);
                }
            } else {
                if (btn) btn.innerText = 'NO AD READY';
                setTimeout(() => { if(btn) btn.innerText = originalText; }, 2000);
            }
        } catch (error) {
            console.error('Ad Show Error:', error);
            if (btn) btn.innerText = 'ERROR';
            setTimeout(() => { if(btn) btn.innerText = originalText; }, 2000);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
            this.load(); // Reload for next opportunity
        }
    }

    async startPowerAd(targetVx) {
        const game = this.game;
        if (game.isAdPlaying) return; 

        game.isAdPlaying = true; // Pause game

        const grantPower = () => {
            game.isAdPlaying = false;
            game.powerUsesSinceAd = 0;
            if (game.modeStrategy.handleDash) game.modeStrategy.handleDash(game, targetVx);
        };

        if (!Capacitor.isNativePlatform()) {
            const adOverlay = document.createElement('div');
            adOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#111;color:#fff;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Outfit,sans-serif;';
            adOverlay.innerHTML = `
                <div style="background:#1a1a2e; padding:30px; border-radius:20px; border:2px solid #00d1ff; text-align:center;">
                    <h1 style="color:#00d1ff; margin-bottom:10px; font-size:32px;">POWER AD</h1>
                    <p style="font-size:18px; color:#aaa;">Unlocking Super Dash...</p>
                    <h2 id="fake-power-ad-timer" style="margin-top:20px;font-size:48px;">3</h2>
                </div>
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
            const isLoaded = (await UnityAds.isRewardedVideoLoaded({ placementId: 'Rewarded_Android' })).loaded;
            if (isLoaded) {
                const result = await UnityAds.showRewardedVideo({ placementId: 'Rewarded_Android' });
                if (result && (result.completed || result.success)) {
                    grantPower();
                } else {
                    game.isAdPlaying = false; // Unpause without reward
                }
            } else {
                // If no ad, maybe offer a fallback or just unpause
                game.isAdPlaying = false;
                alert("Ads are not ready yet. Please try again in a moment!");
            }
        } catch (error) {
            console.error('Power Ad Error:', error);
            game.isAdPlaying = false;
        } finally {
            this.load();
        }
    }
}
