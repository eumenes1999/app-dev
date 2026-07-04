document.addEventListener('DOMContentLoaded', () => {
    const goalsContainer = document.getElementById('goals-container');
    const goalInput = document.getElementById('goal-input');
    const addGoalBtn = document.getElementById('add-goal-btn');
    const goalCountDisplay = document.getElementById('goal-count-display');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const bgUpload = document.getElementById('bg-upload');
    
    const TOTAL_DAYS = 100;
    const MAX_GOALS = 10;
    
    // データマイグレーション（古い completedDays[1,2] モデルから、日付文字列表現['2026-04-26']の配列へ変換）
    let rawData = localStorage.getItem('100days_goals');
    let goals = JSON.parse(rawData) || [];
    
    const todayStr = new Date().toDateString(); // "Sun Apr 26 2026"

    goals = goals.map(g => {
        // もし古い形式(数字配列)だったら、長さを日数とみなすマイグレーション
        if (g.completedDays && g.completedDays.length > 0 && typeof g.completedDays[0] === 'number') {
            const count = g.completedDays.length;
            // 仮想的に過去の日付文字列などで埋めることもできるが、シンプルに「今日までにCount回達成した」状態にする
            g.completedDates = Array(count).fill('past-date');
            delete g.completedDays;
        }
        // なければ初期化
        if (!g.completedDates && g.completedDays) {
            g.completedDates = g.completedDays; 
        }
        if (!g.completedDates) {
            g.completedDates = [];
        }
        return g;
    });

    // 背景画像の処理
    if (bgUpload) {
        bgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64Image = event.target.result;
                    document.body.style.backgroundImage = `url(${base64Image})`;
                    try {
                        localStorage.setItem('100days_bg', base64Image);
                    } catch (error) {
                        alert('画像が大きすぎるため、次回起動時の自動復元ができない場合があります。');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function loadBackground() {
        const savedBg = localStorage.getItem('100days_bg');
        if (savedBg) {
            document.body.style.backgroundImage = `url(${savedBg})`;
        }
    }

    // 目標の保存
    function saveGoals() {
        localStorage.setItem('100days_goals', JSON.stringify(goals));
        updateGoalCount();
    }

    function updateGoalCount() {
        goalCountDisplay.textContent = goals.length;
        if (goals.length >= MAX_GOALS) {
            addGoalBtn.disabled = true;
            goalInput.placeholder = "上限（10個）に達しました";
            goalInput.disabled = true;
        } else {
            addGoalBtn.disabled = false;
            goalInput.placeholder = "新しい目標を入力 (例: 読書を15分する)";
            goalInput.disabled = false;
        }
    }

    // 目標の追加
    addGoalBtn.addEventListener('click', () => {
        const title = goalInput.value.trim();
        if (title && goals.length < MAX_GOALS) {
            const newGoal = {
                id: Date.now().toString(),
                title: title,
                completedDates: []
            };
            goals.push(newGoal);
            saveGoals();
            goalInput.value = '';
            renderGoals(); // 再描画
        }
    });

    goalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addGoalBtn.click();
        }
    });

    // 全リセット
    resetAllBtn.addEventListener('click', () => {
        if (confirm('すべての目標と進捗データを削除しますか？この操作は元に戻せません。')) {
            goals = [];
            saveGoals();
            renderGoals();
        }
    });

    // 1日分のチェックトグル処理
    function checkToday(goalId, btnElement) {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;

        if (goal.completedDates.includes(todayStr)) {
            // 既に完了済みの場合は取り消し可能にするオプション（今回は完了後に押せなくしているのでここは基本的に呼ばれない）
            return;
        } else {
            // 今日の分を達成！
            goal.completedDates.push(todayStr);
            triggerConfetti(btnElement);
            saveGoals();
            renderGoals(); // 画面を再描画して状態を反映
        }
    }

    // 目標の削除
    function deleteGoal(goalId) {
        if (confirm('この習慣を削除しますか？')) {
            goals = goals.filter(g => g.id !== goalId);
            saveGoals();
            renderGoals();
        }
    }

    // 画面の描画（カード生成）
    function renderGoals() {
        goalsContainer.innerHTML = '';
        
        if(goals.length === 0) {
            goalsContainer.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding: 2rem;">目標がありません。上の入力欄から新しい習慣を追加してください！</div>`;
            return;
        }

        goals.forEach(goal => {
            const card = document.createElement('div');
            card.className = 'goal-card';
            
            // ヘッダー（タイトルと削除ボタン）
            const header = document.createElement('div');
            header.className = 'goal-header';
            header.innerHTML = `
                <div class="goal-title">${goal.title}</div>
                <button class="delete-goal-btn" data-id="${goal.id}">✖</button>
            `;
            
            // 日数カウントと進捗計算
            const count = goal.completedDates.length;
            const percentage = Math.min((count / TOTAL_DAYS) * 100, 100);
            
            // 日数表示エリア
            const dayDisplay = document.createElement('div');
            dayDisplay.className = 'day-display';
            dayDisplay.innerHTML = `
                <div class="day-number-text">現在は...</div>
                <div class="day-number-large">${count} <span style="font-size: 1rem; color: var(--text-secondary);">日目</span></div>
            `;

            // 進捗バー
            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'progress-wrapper';
            progressWrapper.innerHTML = `
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                </div>
            `;
            
            // 今日の分チェックアクション
            const isCompletedToday = goal.completedDates.includes(todayStr);
            const checkBtn = document.createElement('button');
            checkBtn.className = 'check-today-btn';
            
            if (isCompletedToday) {
                checkBtn.classList.add('completed');
                checkBtn.innerHTML = '今日は達成済み！ ✓';
                // 完了済みでもう一度押したら取り消せるようにしたい場合は、以下のpointer-eventsやdisabledを解除します
                // ここでは連打防止のためCSSでpointer-events: noneにしています
            } else {
                checkBtn.innerHTML = '今日の分をチェック';
                checkBtn.addEventListener('click', (e) => {
                    checkToday(goal.id, e.target);
                });
            }

            card.appendChild(header);
            card.appendChild(dayDisplay);
            card.appendChild(progressWrapper);
            card.appendChild(checkBtn);
            
            goalsContainer.appendChild(card);
        });

        // 削除ボタンにイベント割り当て
        document.querySelectorAll('.delete-goal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                deleteGoal(e.target.dataset.id);
            });
        });
        
        updateGoalCount();
    }

    // 紙吹雪エフェクト
    function triggerConfetti(element) {
        const rect = element.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        
        confetti({
            particleCount: 50,
            spread: 70,
            origin: { x, y },
            colors: ['#E52E2D', '#111111', '#ffffff'],
            disableForReducedMotion: true
        });
    }

    // 初期化
    loadBackground();
    renderGoals();
});
