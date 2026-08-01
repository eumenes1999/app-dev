import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://wgfchfcfgznfhdyefnpg.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_F-fw5O5XBoxsm9dHciOijg_U3ta5mmM';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const LOCAL_GOALS_KEY = '100days_goals';

    const goalsContainer = document.getElementById('goals-container');
    const goalInput = document.getElementById('goal-input');
    const addGoalBtn = document.getElementById('add-goal-btn');
    const goalCountDisplay = document.getElementById('goal-count-display');
    const resetAllBtn = document.getElementById('reset-all-btn');
    const bgUpload = document.getElementById('bg-upload');

    const authScreen = document.getElementById('auth-screen');
    const appContainer = document.getElementById('app-container');
    const authForm = document.getElementById('auth-form');
    const authEmail = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authError = document.getElementById('auth-error');
    const authNotice = document.getElementById('auth-notice');
    const authSignupBtn = document.getElementById('auth-signup-btn');
    const userEmailEl = document.getElementById('user-email');
    const logoutBtn = document.getElementById('logout-btn');

    const TOTAL_DAYS = 100;
    const MAX_GOALS = 10;

    let habits = [];

    // ---- 日付ユーティリティ（すべてローカルタイムのYYYY-MM-DD文字列で統一） ----
    function toIso(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseIso(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function addDaysIso(iso, n) {
        const date = parseIso(iso);
        date.setDate(date.getDate() + n);
        return toIso(date);
    }

    function todayIso() {
        return toIso(new Date());
    }

    // ---- 背景画像（端末ローカルのみ。同期はしない） ----
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

    // ---- Supabase読み書き ----
    async function loadHabits() {
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) {
            console.error(error);
            habits = [];
            return;
        }
        habits = data.map(rowToHabit);
    }

    function rowToHabit(row) {
        return {
            id: row.id,
            title: row.title,
            completedDates: row.completed_dates || [],
            createdAt: row.created_at.slice(0, 10),
        };
    }

    function updateGoalCount() {
        goalCountDisplay.textContent = habits.length;
        if (habits.length >= MAX_GOALS) {
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
    addGoalBtn.addEventListener('click', async () => {
        const title = goalInput.value.trim();
        if (!title || habits.length >= MAX_GOALS) return;

        const { data, error } = await supabase
            .from('habits')
            .insert({ title })
            .select()
            .single();

        if (error) {
            console.error(error);
            return;
        }

        habits.push(rowToHabit(data));
        goalInput.value = '';
        renderGoals();
    });

    goalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addGoalBtn.click();
        }
    });

    // 全リセット
    resetAllBtn.addEventListener('click', async () => {
        if (!confirm('すべての目標と進捗データを削除しますか？この操作は元に戻せません。')) return;
        const prev = habits;
        habits = [];
        renderGoals();
        const { error } = await supabase.from('habits').delete().not('id', 'is', null);
        if (error) {
            console.error(error);
            habits = prev;
            renderGoals();
        }
    });

    // 1日分のチェック
    async function checkToday(habitId, btnElement) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;
        const today = todayIso();
        if (habit.completedDates.includes(today)) return;

        const nextDates = [...habit.completedDates, today];
        const { data, error } = await supabase
            .from('habits')
            .update({ completed_dates: nextDates })
            .eq('id', habitId)
            .select()
            .single();

        if (error) {
            console.error(error);
            return;
        }

        habit.completedDates = data.completed_dates || nextDates;
        triggerConfetti(btnElement);
        renderGoals();
    }

    // 目標の削除
    async function deleteHabit(habitId) {
        if (!confirm('この習慣を削除しますか？')) return;
        const prev = habits;
        habits = habits.filter(h => h.id !== habitId);
        renderGoals();
        const { error } = await supabase.from('habits').delete().eq('id', habitId);
        if (error) {
            console.error(error);
            habits = prev;
            renderGoals();
        }
    }

    // 連続日数（今日 or 昨日を起点に遡ってカウント）
    function calcStreak(completedDates, today) {
        const doneSet = new Set(completedDates);
        let cursor = doneSet.has(today) ? today : addDaysIso(today, -1);
        let streak = 0;
        while (doneSet.has(cursor)) {
            streak += 1;
            cursor = addDaysIso(cursor, -1);
        }
        return streak;
    }

    // 100日ぶんのマス目データを生成
    function buildDayCells(habit, today) {
        const doneSet = new Set(habit.completedDates);
        const cells = [];
        for (let i = 0; i < TOTAL_DAYS; i++) {
            const iso = addDaysIso(habit.createdAt, i);
            let state;
            if (doneSet.has(iso)) state = 'done';
            else if (iso === today) state = 'today';
            else if (iso < today) state = 'missed';
            else state = 'future';
            cells.push({ iso, state });
        }
        return cells;
    }

    // 画面の描画（カード生成）
    function renderGoals() {
        goalsContainer.innerHTML = '';
        const today = todayIso();

        if (habits.length === 0) {
            goalsContainer.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding: 2rem;">目標がありません。上の入力欄から新しい習慣を追加してください！</div>`;
            updateGoalCount();
            return;
        }

        habits.forEach(habit => {
            const card = document.createElement('div');
            card.className = 'goal-card';

            const header = document.createElement('div');
            header.className = 'goal-header';
            header.innerHTML = `
                <div class="goal-title">${habit.title}</div>
                <button class="delete-goal-btn" data-id="${habit.id}">✖</button>
            `;

            const count = habit.completedDates.length;
            const streak = calcStreak(habit.completedDates, today);
            const percentage = Math.min((count / TOTAL_DAYS) * 100, 100);

            const dayDisplay = document.createElement('div');
            dayDisplay.className = 'day-display';
            dayDisplay.innerHTML = `
                <div class="day-number-text">現在は...</div>
                <div class="day-number-large">${count} <span style="font-size: 1rem; color: var(--text-secondary);">日目</span></div>
            `;

            const subStats = document.createElement('div');
            subStats.className = 'sub-stats';
            subStats.innerHTML = `
                <div class="sub-stat">
                    <div class="sub-stat-value">🔥 ${streak}</div>
                    <div class="sub-stat-label">連続日数</div>
                </div>
                <div class="sub-stat">
                    <div class="sub-stat-value">${Math.round(percentage)}%</div>
                    <div class="sub-stat-label">達成率</div>
                </div>
            `;

            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'progress-wrapper';
            progressWrapper.innerHTML = `
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                </div>
            `;

            const dayGrid = document.createElement('div');
            dayGrid.className = 'day-grid';
            buildDayCells(habit, today).forEach(cell => {
                const cellEl = document.createElement('div');
                cellEl.className = `day-cell ${cell.state}`;
                cellEl.title = cell.iso;
                dayGrid.appendChild(cellEl);
            });

            const isCompletedToday = habit.completedDates.includes(today);
            const checkBtn = document.createElement('button');
            checkBtn.className = 'check-today-btn';

            if (isCompletedToday) {
                checkBtn.classList.add('completed');
                checkBtn.innerHTML = '今日は達成済み！ ✓';
            } else {
                checkBtn.innerHTML = '今日の分をチェック';
                checkBtn.addEventListener('click', (e) => {
                    checkToday(habit.id, e.target);
                });
            }

            card.appendChild(header);
            card.appendChild(dayDisplay);
            card.appendChild(subStats);
            card.appendChild(progressWrapper);
            card.appendChild(dayGrid);
            card.appendChild(checkBtn);

            goalsContainer.appendChild(card);
        });

        document.querySelectorAll('.delete-goal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                deleteHabit(e.target.dataset.id);
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

    // ---- 既存localStorageデータの初回インポート ----
    async function importLocalGoalsIfAny() {
        const raw = localStorage.getItem(LOCAL_GOALS_KEY);
        if (!raw) return;

        let localGoals;
        try {
            localGoals = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!Array.isArray(localGoals) || localGoals.length === 0) return;
        if (habits.length > 0) return; // 既にクラウド側にデータがあれば何もしない

        const ok = confirm(`この端末に保存されていた過去の習慣データ（${localGoals.length}件）が見つかりました。アカウントに取り込みますか？`);
        if (!ok) return;

        for (const g of localGoals) {
            const rawDates = Array.isArray(g.completedDates) ? g.completedDates : [];
            const parsedDates = rawDates
                .map(s => new Date(s))
                .filter(d => !isNaN(d.getTime()))
                .map(toIso);
            const uniqueDates = [...new Set(parsedDates)].sort();
            const createdAt = uniqueDates.length > 0 ? uniqueDates[0] : todayIso();

            const { error } = await supabase.from('habits').insert({
                title: (g.title || '習慣').slice(0, 30),
                completed_dates: uniqueDates,
                created_at: `${createdAt}T00:00:00Z`,
            });
            if (error) console.error(error);
        }

        localStorage.removeItem(LOCAL_GOALS_KEY);
        await loadHabits();
    }

    // ---- 認証 ----
    function showAuthError(message) {
        authError.textContent = message;
        authError.hidden = !message;
    }

    function showAuthNotice(message) {
        authNotice.textContent = message;
        authNotice.hidden = !message;
    }

    async function showApp(session) {
        authScreen.hidden = true;
        appContainer.hidden = false;
        userEmailEl.textContent = session.user.email ?? '';
        await loadHabits();
        await importLocalGoalsIfAny();
        renderGoals();
    }

    function showAuthScreen() {
        appContainer.hidden = true;
        authScreen.hidden = false;
        habits = [];
    }

    function initAuth() {
        authForm.addEventListener('submit', async (evt) => {
            evt.preventDefault();
            showAuthError('');
            showAuthNotice('');
            const email = authEmail.value.trim();
            const password = authPassword.value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) showAuthError(error.message);
        });

        authSignupBtn.addEventListener('click', async () => {
            showAuthError('');
            showAuthNotice('');
            const email = authEmail.value.trim();
            const password = authPassword.value;
            if (!email || !password) {
                showAuthError('メールアドレスとパスワードを入力してください。');
                return;
            }
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                showAuthError(error.message);
                return;
            }
            showAuthNotice('登録しました。確認メールが届いた場合はリンクを開いてからログインしてください。');
        });

        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                showApp(session);
            } else {
                showAuthScreen();
            }
        });
    }

    loadBackground();
    initAuth();
});
