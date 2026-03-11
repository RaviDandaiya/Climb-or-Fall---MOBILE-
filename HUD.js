import { SKINS, BATTLE_PASS } from './constants.js';

export class HUDManager {
    constructor(game) {
        this.game = game;
    }

    updateHUD() {
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.game.coins;
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.game.coins;
        if (document.getElementById('pass-coin-count')) document.getElementById('pass-coin-count').innerText = this.game.coins;
        if (document.getElementById('combo-value')) document.getElementById('combo-value').innerText = this.game.combo;
        
        // Progress logic: calculate based on total pass XP/task progression or just show next task
        // Find first locked pass level
        const nextLevel = BATTLE_PASS.find(p => !this.game.claimedRewards.includes(p.id)) || BATTLE_PASS[BATTLE_PASS.length - 1];
        if (document.getElementById('pass-level')) document.getElementById('pass-level').innerText = nextLevel.id;
        
        // Compute progress towards nextLevel
        if (document.getElementById('pass-progress')) {
            let progress = 0;
            if(nextLevel.reqType === 'gamesPlayed') progress = (this.game.gamesPlayed / nextLevel.reqValue);
            else if(nextLevel.reqType === 'bestHeight') progress = (this.game.bestHeight / nextLevel.reqValue);
            else if(nextLevel.reqType === 'totalCoinsAcc') progress = (this.game.totalCoinsAcc / nextLevel.reqValue);
            
            document.getElementById('pass-progress').style.width = `${Math.min(100, progress * 100)}%`;
        }
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
            const isUnlocked = skin.isUnlocked(this.game);
            const card = document.createElement('div');
            card.className = `skin-card premium-skin-card ${this.game.activeSkinId === skin.id ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
            
            let statusHTML = '';
            if(!isUnlocked) {
                let progress = 0;
                if(skin.reqType === 'gamesPlayed') progress = (this.game.gamesPlayed / skin.reqValue);
                else if(skin.reqType === 'bestHeight') progress = (this.game.bestHeight / skin.reqValue);
                else if(skin.reqType === 'totalCoinsAcc') progress = (this.game.totalCoinsAcc / skin.reqValue);
                progress = Math.min(100, Math.floor(progress * 100));

                statusHTML = `<div class="lock-overlay"><span class="lock-icon">🔒</span></div>
                              <div class="unlock-task">${skin.desc}</div>
                              <div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}%"></div></div>`;
            } else {
                statusHTML = `<div class="unlock-task unlocked-text">UNLOCKED</div>`;
            }

            card.innerHTML = `
                ${statusHTML}
                <div class="skin-preview" style="background: ${skin.color}"></div>
                <h3>${skin.name}</h3>
            `;
            card.onclick = () => {
                if(isUnlocked) {
                    this.game.activeSkinId = skin.id; 
                    localStorage.setItem('activeSkin', skin.id);
                    this.renderSkins();
                } else {
                    this.game._playTone(150, 'sawtooth', 0, 0.1); // Error tone
                }
            };
            container.appendChild(card);
        });
    }

    renderPass() {
        const container = document.getElementById('pass-rewards-container');
        if (!container) return;
        container.innerHTML = '';
        BATTLE_PASS.forEach(p => {
            const isUnlocked = p.isUnlocked(this.game);
            const isClaimed = this.game.claimedRewards.includes(p.id);
            const reward = document.createElement('div');
            const clickableClass = (isUnlocked && !isClaimed) ? 'clickable-reward' : '';
            reward.className = `reward-card premium-reward-card ${isUnlocked ? 'unlocked' : ''} ${clickableClass} ${isClaimed ? 'claimed' : ''}`;
            
            let statusText = "LOCKED";
            if (isClaimed) statusText = "CLAIMED!";
            else if (isUnlocked) statusText = "CLAIM REWARD";
            
            let progress = 0;
            if(!isUnlocked) {
                if(p.reqType === 'gamesPlayed') progress = (this.game.gamesPlayed / p.reqValue);
                else if(p.reqType === 'bestHeight') progress = (this.game.bestHeight / p.reqValue);
                else if(p.reqType === 'totalCoinsAcc') progress = (this.game.totalCoinsAcc / p.reqValue);
            } else {
                progress = 1;
            }
            progress = Math.min(100, progress * 100);

            reward.innerHTML = `
                <div class="stat-label">TIER ${p.id}</div>
                <div style="font-size: 2.5rem; filter: drop-shadow(0 0 10px rgba(255,204,0,0.5));">🪙</div>
                <div class="stat-unit" style="font-weight: 800; color: #ffcc00; font-size: 1.1rem; margin-top: 10px;">${p.rewardText}</div>
                <div class="pass-task-desc">${p.desc}</div>
                <div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}%"></div></div>
                <div class="status-btn ${isClaimed ? 'status-claimed' : (isUnlocked ? 'status-claim' : 'status-locked')}">${statusText}</div>`;
                
            if (isUnlocked && !isClaimed) {
                reward.style.cursor = 'pointer';
                reward.onclick = () => this.game.claimReward(p.id);
            }
            container.appendChild(reward);
        });
    }

    showLevelUpToast(level) {
        const el = document.createElement('div'); el.id = 'level-up-toast';
        el.innerHTML = `<div class="toast-title">LEVEL UP</div><div>Tier ${level} reached!</div>`;
        document.getElementById('game-container').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
}
