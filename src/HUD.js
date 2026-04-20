import { SKINS, BATTLE_PASS } from './constants.js';

export class HUDManager {
    constructor(game) {
        this.game = game;
    }

    updateHUD() {
        if (document.getElementById('coin-count')) document.getElementById('coin-count').innerText = this.game.coins;
        if (document.getElementById('height-value')) document.getElementById('height-value').innerText = this.game.score;
        if (document.getElementById('best-value')) document.getElementById('best-value').innerText = this.game.bestHeight;
        if (typeof this.game.syncHomeScore === 'function') this.game.syncHomeScore();
        else if (document.getElementById('home-best-score')) document.getElementById('home-best-score').innerText = this.game.bestHeight;
        if (document.getElementById('combo-value')) document.getElementById('combo-value').innerText = this.game.combo;
        
        // Update death screen if visible
        if (document.getElementById('fall-distance')) document.getElementById('fall-distance').innerText = this.game.score;
        if (document.getElementById('best-distance-death')) document.getElementById('best-distance-death').innerText = this.game.bestHeight;
        
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
            const isCoinSkin = skin.unlockMode === 'coins';
            const isOwned = isCoinSkin ? this.game.isSkinOwned(skin.id) : skin.isUnlocked(this.game);
            const canBuy = isCoinSkin && !isOwned && this.game.coins >= skin.cost;
            const isUnlocked = isOwned;
            const card = document.createElement('div');
            card.className = `skin-card premium-skin-card ${this.game.activeSkinId === skin.id ? 'selected' : ''} ${isCoinSkin && !isOwned ? 'locked' : ''} ${canBuy ? 'buyable' : ''} ${isOwned ? 'owned' : ''}`;
            
            let statusHTML = '';
            if (isCoinSkin) {
                if (isOwned) {
                    statusHTML = `<div class="unlock-task unlocked-text">OWNED</div>`;
                } else {
                    const shortfall = Math.max(0, skin.cost - this.game.coins);
                    const progress = skin.cost > 0 ? Math.min(100, Math.floor((this.game.coins / skin.cost) * 100)) : 0;
                    statusHTML = canBuy
                        ? `<div class="unlock-task unlocked-text">BUY ${skin.cost} COINS</div>
                           <div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}%"></div></div>`
                        : `<div class="unlock-task">${shortfall} MORE COINS</div>
                           <div class="task-progress-bar"><div class="task-progress-fill" style="width:${progress}%"></div></div>`;
                }
            } else if(!isUnlocked) {
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

            const previewShape = skin.shape || 'round';
            const previewColor = skin.bodyColor || skin.color;
            const previewEyeColor = skin.eyeColor || '#ffffff';
            card.innerHTML = `
                ${statusHTML}
                <div class="skin-preview skin-preview-${previewShape}" style="background: ${previewColor}; --preview-eye-color: ${previewEyeColor};">
                    ${previewShape !== 'eye' ? `
                    <span class="skin-preview-eye skin-preview-eye-left"></span>
                    <span class="skin-preview-eye skin-preview-eye-right"></span>
                    ` : ''}
                </div>
                <h3>${skin.name}</h3>
            `;
            card.onclick = () => {
                if (isCoinSkin) {
                    if (isOwned) {
                        this.game.setActiveSkin(skin.id);
                    } else if (canBuy) {
                        this.game.purchaseSkin(skin.id);
                    } else {
                        this.game._playTone(150, 'sawtooth', 0, 0.1); // Error tone
                    }
                } else if(isUnlocked) {
                    this.game.setActiveSkin(skin.id);
                } else {
                    this.game._playTone(150, 'sawtooth', 0, 0.1); // Error tone
                }
            };
            container.appendChild(card);
        });

        // Add bottom spacers to ensure the last items are visible
        const spacer = document.createElement('div');
        spacer.style.gridColumn = '1 / -1';
        spacer.style.height = '150px';
        container.appendChild(spacer);
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

        const spacer = document.createElement('div');
        spacer.style.height = '150px';
        container.appendChild(spacer);
    }

    showLevelUpToast(level) {
        const el = document.createElement('div'); el.id = 'level-up-toast';
        el.className = 'level-toast';
        el.innerHTML = `<h3>LEVEL UP!</h3><p>New Height Reached!</p>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }

    showFloatingText(x, y, text, color = '#ffcc00') {
        const el = document.createElement('div');
        el.className = 'floating-game-text';
        el.style.left = `${(x / CONFIG.canvasWidth) * 100}%`;
        el.style.top = `${((y + this.game.cameraY) / (this.game.canvas.height / 1)) * 100}%`;
        el.style.color = color;
        el.innerText = text;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 800);
    }
}
