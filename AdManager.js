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
            await UnityAds.initialize({ gameId: '6051910', testMode: true });
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
            game.handleAdReward();
            return;
        }
        const btn = document.getElementById('ad-revive-btn');
        btn.innerText = 'LOADING...';
        btn.disabled = true;
        try {
            if ((await UnityAds.isRewardedVideoLoaded()).loaded) {
                if ((await UnityAds.showRewardedVideo()).success) game.handleAdReward();
                else alert('Ad not finished!');
            } else {
                alert('Ad still loading... try in 3s');
                this.load();
            }
        } catch (_) {
            game.handleAdReward(); // fallback
        } finally {
            btn.innerText = 'REVIVE';
            btn.disabled = false;
        }
    }
}
