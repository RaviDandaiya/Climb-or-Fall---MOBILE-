import { SKINS } from './constants.js';

export class HUDManager {
    constructor(game) {
        this.game = game;
    }

    updateHUD() {
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.game.coins;
        if (document.getElementById('pass-coin-count')) document.getElementById('pass-coin-count').innerText = this.game.coins;
        if (document.getElementById('pass-level')) document.getElementById('pass-level').innerText = this.game.passLevel;
        if (document.getElementById('pass-progress')) document.getElementById('pass-progress').style.width = `${(this.game.passXP / 1000) * 100}%`;
        if (document.getElementById('combo-value')) document.getElementById('combo-value').innerText = this.game.combo;
    }

    showMenu() {
        document.getElementById('difficulty-screen').classList.remove('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.game.coins;
    }

    renderSkins() {
        const container = document.getElementById('skin-container');
        if (!container) return;
        container.innerHTML = '';
        SKINS.forEach(skin => {
            const card = document.createElement('div');
            card.className = `skin-card ${this.game.activeSkinId === skin.id ? 'selected' : ''}`;
            card.innerHTML = `<div class="skin-preview" style="background: ${skin.color}"></div><h3>${skin.name}</h3>`;
            card.onclick = () => {
                this.game.activeSkinId = skin.id; 
                localStorage.setItem('activeSkin', skin.id);
                this.renderSkins();
            };
            container.appendChild(card);
        });
    }

    renderPass() {
        const container = document.getElementById('pass-rewards-container');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const isUnlocked = this.game.passLevel >= i;
            const isClaimed = this.game.claimedRewards.includes(i);
            const reward = document.createElement('div');
            const clickableClass = (isUnlocked && !isClaimed) ? 'clickable-reward' : '';
            reward.className = `reward-card ${isUnlocked ? 'unlocked' : ''} ${clickableClass}`;
            let statusText = "LOCKED";
            if (isClaimed) statusText = "CLAIMED";
            else if (isUnlocked) statusText = "CLAIM";
            reward.innerHTML = `<div class="stat-label">LVL ${i}</div>
                <div style="font-size: 2rem">${i % 2 === 0 ? '👕' : '🪙'}</div>
                <div class="stat-unit">${i % 2 === 0 ? 'Xmas Skin' : '+100 Coins'}</div>
                <div style="font-size: 0.7rem; margin-top:5px; font-weight:bold; color:${isUnlocked && !isClaimed ? '#00ffa3' : '#666'}">${statusText}</div>`;
            if (isUnlocked && !isClaimed) {
                reward.style.cursor = 'pointer';
                reward.onclick = () => this.game.claimReward(i);
            }
            container.appendChild(reward);
        }
    }

    showLevelUpToast(level) {
        const el = document.createElement('div'); el.id = 'level-up-toast';
        el.innerHTML = `<div class="toast-title">LEVEL UP</div><div>Tier ${level} reached!</div>`;
        document.getElementById('game-container').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
}
