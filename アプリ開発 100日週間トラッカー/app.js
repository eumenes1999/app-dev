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
    const resetBgBtn = document.getElementById('reset-bg-btn');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataInput = document.getElementById('import-data-input');

    const appContainer = document.getElementById('app-container');
    const initErrorEl = document.getElementById('init-error');
    const toastEl = document.getElementById('toast');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    const tabHabitsBtn = document.getElementById('tab-habits-btn');
    const tabMemosBtn = document.getElementById('tab-memos-btn');
    const tabSettingsBtn = document.getElementById('tab-settings-btn');
    const habitsView = document.getElementById('habits-view');
    const memosView = document.getElementById('memos-view');
    const settingsView = document.getElementById('settings-view');
    const memoHabitSelect = document.getElementById('memo-habit-select');
    const memoWeekSection = document.getElementById('memo-week-section');
    const memoWeekList = document.getElementById('memo-week-list');
    const memoArchiveTitle = document.getElementById('memo-archive-title');
    const memoArchiveList = document.getElementById('memo-archive-list');
    const memoEmptyEl = document.getElementById('memo-empty');

    const heroHeadlineEl = document.getElementById('hero-headline');
    const heroSubtextEl = document.getElementById('hero-subtext');
    const headlineInput = document.getElementById('headline-input');
    const subtextInput = document.getElementById('subtext-input');

    // ---- トップページの文言（端末ローカルのみ。未設定時はデフォルト文言） ----
    const HEADLINE_KEY = '100days_headline';
    const SUBTEXT_KEY = '100days_subtext';
    const DEFAULT_HEADLINE = '続けることが、いちばんの力になる。';
    const DEFAULT_SUBTEXT = '今日という1日を積み重ねて、100日後の自分をつくる。';

    function applyHeroText() {
        const headline = localStorage.getItem(HEADLINE_KEY) || DEFAULT_HEADLINE;
        const subtext = localStorage.getItem(SUBTEXT_KEY) || DEFAULT_SUBTEXT;
        heroHeadlineEl.textContent = headline;
        heroSubtextEl.textContent = subtext;
        headlineInput.value = localStorage.getItem(HEADLINE_KEY) || '';
        subtextInput.value = localStorage.getItem(SUBTEXT_KEY) || '';
    }

    headlineInput.addEventListener('blur', () => {
        const value = headlineInput.value.trim();
        if (value) localStorage.setItem(HEADLINE_KEY, value);
        else localStorage.removeItem(HEADLINE_KEY);
        applyHeroText();
    });

    subtextInput.addEventListener('blur', () => {
        const value = subtextInput.value.trim();
        if (value) localStorage.setItem(SUBTEXT_KEY, value);
        else localStorage.removeItem(SUBTEXT_KEY);
        applyHeroText();
    });

    // ---- テーマ切り替え（ダーク/ライト。未選択時はOS設定に追従） ----
    const THEME_KEY = '100days_theme';

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        if (themeToggleBtn) {
            themeToggleBtn.textContent = theme === 'dark' ? '☀️ ライト' : '🌙 ダーク';
        }
    }

    function initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(theme);
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.dataset.theme === 'dark';
            const next = isDark ? 'light' : 'dark';
            localStorage.setItem(THEME_KEY, next);
            applyTheme(next);
        });
    }

    let toastTimer = null;
    function showToast(message) {
        toastEl.textContent = message;
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3000);
    }

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

    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            localStorage.removeItem('100days_bg');
            document.body.style.backgroundImage = '';
            showToast('背景画像をデフォルトに戻しました');
        });
    }

    // ---- Supabase読み書き ----
    async function loadHabits() {
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) {
            console.error(error);
            showToast('データの読み込みに失敗しました');
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
            skippedDates: row.skipped_dates || [],
            createdAt: row.created_at.slice(0, 10),
            color: row.color || null,
        };
    }

    const CARD_COLORS = ['pink', 'purple', 'orange', 'green', 'blue', 'teal', 'red', 'indigo'];

    async function setHabitColor(habit, colorKey) {
        const prevColor = habit.color;
        const nextColor = habit.color === colorKey ? null : colorKey; // もう一度押したら自動ローテーションに戻す
        habit.color = nextColor;
        renderGoals();

        const { error } = await supabase
            .from('habits')
            .update({ color: nextColor })
            .eq('id', habit.id);

        if (error) {
            console.error(error);
            showToast('色の変更に失敗しました');
            habit.color = prevColor;
            renderGoals();
        }
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
            showToast('目標の追加に失敗しました');
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
            showToast('リセットに失敗しました');
            habits = prev;
            renderGoals();
        }
    });

    // 直前に操作したカードのid。renderGoals()側でポップアニメーションを付けるのに使う
    let lastToggledHabitId = null;

    // 継続チェック時にランダムで出す応援コメント（また明日も続けたくなるようなポジティブな言葉）
    const ENCOURAGEMENTS = [
        'その調子、いい流れ！🔥',
        '今日もやり切ったね',
        'また一歩、積み上がった',
        '続けてる自分、えらい',
        '小さな一歩が未来を作る',
        'この調子で明日もいこう',
        '着実に前進してるよ',
        '今日のあなた、最高',
        '積み重ねが力になる',
        'よくやった、自分！',
        'コツコツが一番強い',
        '今日も有言実行だね',
        '習慣になりつつあるね',
        'この一歩が未来を変える',
        '続けるって、才能だよ',
        '今日も自分に勝った',
        '地道な努力、見てるよ',
        'また記録が伸びたね',
        'この流れ、大事にしよう',
        '毎日の積み重ね、すごい',
    ];

    function pickEncouragement() {
        return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    }

    // 1日分のチェック（即座に画面へ反映し、裏でSupabaseへ保存。失敗時のみ元に戻す）
    async function checkToday(habitId, btnElement) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;
        const today = todayIso();
        if (habit.completedDates.includes(today)) return;

        const prevCompleted = habit.completedDates;
        const prevSkipped = habit.skippedDates;
        habit.completedDates = [...habit.completedDates, today];
        habit.skippedDates = habit.skippedDates.filter(d => d !== today);
        lastToggledHabitId = habitId;
        triggerConfetti(btnElement);
        renderGoals();
        showToast(pickEncouragement());

        const { data, error } = await supabase
            .from('habits')
            .update({ completed_dates: habit.completedDates, skipped_dates: habit.skippedDates })
            .eq('id', habitId)
            .select()
            .single();

        if (error) {
            console.error(error);
            showToast('保存に失敗しました。もう一度お試しください');
            habit.completedDates = prevCompleted;
            habit.skippedDates = prevSkipped;
            renderGoals();
            return;
        }
        habit.completedDates = data.completed_dates || habit.completedDates;
        habit.skippedDates = data.skipped_dates || habit.skippedDates;
    }

    // 1日分をスキップ（連続日数は途切れさせないが、達成日数にも加算しない）
    async function skipToday(habitId) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;
        const today = todayIso();
        if (habit.skippedDates.includes(today) || habit.completedDates.includes(today)) return;

        const prevSkipped = habit.skippedDates;
        habit.skippedDates = [...habit.skippedDates, today];
        lastToggledHabitId = habitId;
        renderGoals();

        const { data, error } = await supabase
            .from('habits')
            .update({ skipped_dates: habit.skippedDates })
            .eq('id', habitId)
            .select()
            .single();

        if (error) {
            console.error(error);
            showToast('保存に失敗しました。もう一度お試しください');
            habit.skippedDates = prevSkipped;
            renderGoals();
            return;
        }
        habit.skippedDates = data.skipped_dates || habit.skippedDates;
    }

    // 今日の記録（達成/スキップ）を取り消して未定に戻す
    async function undoToday(habitId) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;
        const today = todayIso();
        const prevCompleted = habit.completedDates;
        const prevSkipped = habit.skippedDates;
        habit.completedDates = habit.completedDates.filter(d => d !== today);
        habit.skippedDates = habit.skippedDates.filter(d => d !== today);
        lastToggledHabitId = habitId;
        renderGoals();

        const { data, error } = await supabase
            .from('habits')
            .update({ completed_dates: habit.completedDates, skipped_dates: habit.skippedDates })
            .eq('id', habitId)
            .select()
            .single();

        if (error) {
            console.error(error);
            showToast('取り消しに失敗しました。もう一度お試しください');
            habit.completedDates = prevCompleted;
            habit.skippedDates = prevSkipped;
            renderGoals();
            return;
        }
        habit.completedDates = data.completed_dates || habit.completedDates;
        habit.skippedDates = data.skipped_dates || habit.skippedDates;
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
            showToast('削除に失敗しました');
            habits = prev;
            renderGoals();
        }
    }

    // 連続日数（今日 or 昨日を起点に遡ってカウント。スキップ日は途切れさせず、加算もしない）
    function calcStreak(completedDates, skippedDates, today) {
        const doneSet = new Set(completedDates);
        const skipSet = new Set(skippedDates);
        let cursor = doneSet.has(today) ? today : addDaysIso(today, -1);
        let streak = 0;
        while (doneSet.has(cursor) || skipSet.has(cursor)) {
            if (doneSet.has(cursor)) streak += 1;
            cursor = addDaysIso(cursor, -1);
        }
        return streak;
    }

    // 100日ぶんのマス目データを生成
    function buildDayCells(habit, today) {
        const doneSet = new Set(habit.completedDates);
        const skipSet = new Set(habit.skippedDates);
        const cells = [];
        for (let i = 0; i < TOTAL_DAYS; i++) {
            const iso = addDaysIso(habit.createdAt, i);
            let state;
            if (doneSet.has(iso)) state = 'done';
            else if (skipSet.has(iso)) state = 'skipped';
            else if (iso === today) state = 'today';
            else if (iso < today) state = 'missed';
            else state = 'future';
            cells.push({ iso, state });
        }
        return cells;
    }

    // 習慣カード内に直接置く「今日のメモ」欄（メモタブと同じデータ・同じ保存処理を使い回す）
    function buildInlineMemo(habit, today) {
        const wrap = document.createElement('div');
        wrap.className = 'inline-memo';

        const label = document.createElement('div');
        label.className = 'inline-memo-label';
        label.textContent = '📝 今日のメモ';

        const stateEl = document.createElement('span');
        stateEl.className = 'memo-save-state';
        label.appendChild(stateEl);

        const existing = memos.find(m => m.habitId === habit.id && m.date === today);
        const textarea = document.createElement('textarea');
        textarea.className = 'inline-memo-textarea';
        textarea.placeholder = '今日感じたこと・気づきをひとこと';
        textarea.value = existing ? existing.content : '';
        textarea.addEventListener('blur', () => {
            const latest = memos.find(m => m.habitId === habit.id && m.date === today);
            if (textarea.value === (latest ? latest.content : '')) return;
            saveMemo(habit, today, textarea.value, stateEl);
        });

        wrap.appendChild(label);
        wrap.appendChild(textarea);
        return wrap;
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
            if (habit.color) {
                card.classList.add(`card-color-${habit.color}`);
            }
            if (habit.id === lastToggledHabitId) {
                card.classList.add('just-checked');
            }

            const header = document.createElement('div');
            header.className = 'goal-header';
            header.innerHTML = `
                <div class="goal-title">${habit.title}</div>
                <button class="delete-goal-btn" data-id="${habit.id}">✖</button>
            `;

            const colorPicker = document.createElement('div');
            colorPicker.className = 'card-color-picker';
            CARD_COLORS.forEach(colorKey => {
                const swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = `card-color-swatch${habit.color === colorKey ? ' selected' : ''}`;
                swatch.dataset.color = colorKey;
                swatch.setAttribute('aria-label', `カード色: ${colorKey}`);
                swatch.addEventListener('click', () => setHabitColor(habit, colorKey));
                colorPicker.appendChild(swatch);
            });

            const count = habit.completedDates.length;
            const streak = calcStreak(habit.completedDates, habit.skippedDates, today);
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
            const isSkippedToday = habit.skippedDates.includes(today);

            const actionArea = document.createElement('div');
            actionArea.className = 'today-action';

            if (isCompletedToday) {
                const doneBtn = document.createElement('button');
                doneBtn.className = 'check-today-btn completed';
                doneBtn.innerHTML = '今日は達成済み！ ✓';
                doneBtn.disabled = true;
                const undoBtn = document.createElement('button');
                undoBtn.className = 'undo-today-btn';
                undoBtn.textContent = '取り消す';
                undoBtn.addEventListener('click', () => undoToday(habit.id));
                actionArea.appendChild(doneBtn);
                actionArea.appendChild(undoBtn);
            } else if (isSkippedToday) {
                const skippedBtn = document.createElement('button');
                skippedBtn.className = 'check-today-btn skipped';
                skippedBtn.innerHTML = '今日はお休み中 ⏭';
                skippedBtn.disabled = true;
                const undoBtn = document.createElement('button');
                undoBtn.className = 'undo-today-btn';
                undoBtn.textContent = '取り消す';
                undoBtn.addEventListener('click', () => undoToday(habit.id));
                actionArea.appendChild(skippedBtn);
                actionArea.appendChild(undoBtn);
            } else {
                const checkBtn = document.createElement('button');
                checkBtn.className = 'check-today-btn';
                checkBtn.innerHTML = '今日の分をチェック';
                checkBtn.addEventListener('click', (e) => {
                    checkToday(habit.id, e.target);
                });
                const skipBtn = document.createElement('button');
                skipBtn.className = 'skip-today-btn';
                skipBtn.textContent = '今日はお休みにする';
                skipBtn.addEventListener('click', () => {
                    skipToday(habit.id);
                });
                actionArea.appendChild(checkBtn);
                actionArea.appendChild(skipBtn);
            }

            card.appendChild(header);
            card.appendChild(colorPicker);
            card.appendChild(dayDisplay);
            card.appendChild(subStats);
            card.appendChild(progressWrapper);
            card.appendChild(dayGrid);
            card.appendChild(actionArea);
            card.appendChild(buildInlineMemo(habit, today));

            goalsContainer.appendChild(card);
        });

        lastToggledHabitId = null;

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

    // ---- メモ機能（習慣ごとに1日1件。直近7日だけ編集可、それ以前は閲覧専用アーカイブ。習慣を削除しても消えない） ----
    let memos = [];

    function rowToMemo(row) {
        return {
            id: row.id,
            habitId: row.habit_id,
            habitTitle: row.habit_title,
            date: row.date,
            content: row.content,
        };
    }

    async function loadMemos() {
        const { data, error } = await supabase
            .from('habit_memos')
            .select('*')
            .order('date', { ascending: false });
        if (error) {
            console.error(error);
            showToast('メモの読み込みに失敗しました');
            memos = [];
            return;
        }
        memos = data.map(rowToMemo);
    }

    function populateMemoHabitSelect() {
        const current = memoHabitSelect.value || '__all__';
        memoHabitSelect.innerHTML = '<option value="__all__">すべて（閲覧のみ）</option>';
        habits.forEach(habit => {
            const opt = document.createElement('option');
            opt.value = habit.id;
            opt.textContent = habit.title;
            memoHabitSelect.appendChild(opt);
        });
        const stillExists = current === '__all__' || habits.some(h => h.id === current);
        memoHabitSelect.value = stillExists ? current : '__all__';
    }

    async function saveMemo(habit, date, content, stateEl) {
        const existing = memos.find(m => m.habitId === habit.id && m.date === date);
        if (!existing && content.trim() === '') return;

        if (stateEl) stateEl.textContent = '保存中…';

        const { data, error } = await supabase
            .from('habit_memos')
            .upsert(
                { habit_id: habit.id, habit_title: habit.title, date, content, updated_at: new Date().toISOString() },
                { onConflict: 'habit_id,date' }
            )
            .select()
            .single();

        if (error) {
            console.error(error);
            showToast('メモの保存に失敗しました');
            if (stateEl) stateEl.textContent = '';
            return;
        }

        if (existing) {
            existing.content = data.content;
        } else {
            memos.unshift(rowToMemo(data));
        }
        if (stateEl) {
            stateEl.textContent = '保存済み';
            setTimeout(() => { stateEl.textContent = ''; }, 1500);
        }
    }

    function renderMemoWeek(habit) {
        memoWeekList.innerHTML = '';
        const today = todayIso();
        for (let i = 0; i < 7; i++) {
            const date = addDaysIso(today, -i);
            const existing = memos.find(m => m.habitId === habit.id && m.date === date);

            const row = document.createElement('div');
            row.className = 'memo-week-row';

            const rowHeader = document.createElement('div');
            rowHeader.className = 'memo-week-row-header';
            const dateLabel = document.createElement('span');
            dateLabel.className = `memo-week-date${date === today ? ' is-today' : ''}`;
            dateLabel.textContent = date === today ? `${date}（今日）` : date;
            const stateEl = document.createElement('span');
            stateEl.className = 'memo-save-state';
            rowHeader.appendChild(dateLabel);
            rowHeader.appendChild(stateEl);

            const textarea = document.createElement('textarea');
            textarea.placeholder = 'この日のメモを書く';
            textarea.value = existing ? existing.content : '';
            textarea.addEventListener('blur', () => {
                if (textarea.value === (existing ? existing.content : '')) return;
                saveMemo(habit, date, textarea.value, stateEl);
            });

            row.appendChild(rowHeader);
            row.appendChild(textarea);
            memoWeekList.appendChild(row);
        }
    }

    function renderMemoArchive(selectedValue) {
        memoArchiveList.innerHTML = '';
        const today = todayIso();
        const weekStart = addDaysIso(today, -6);

        let list;
        if (selectedValue === '__all__') {
            memoArchiveTitle.textContent = 'すべてのメモ';
            list = memos;
        } else {
            const habit = habits.find(h => h.id === selectedValue);
            memoArchiveTitle.textContent = '過去のメモ（直近7日より前）';
            list = memos.filter(m => m.habitId === selectedValue && m.date < weekStart);
            void habit;
        }

        memoEmptyEl.hidden = list.length > 0;

        list.forEach(memo => {
            const item = document.createElement('div');
            item.className = 'memo-archive-item';
            const header = document.createElement('div');
            header.className = 'memo-archive-item-header';
            const dateSpan = document.createElement('span');
            dateSpan.textContent = memo.date;
            const titleSpan = document.createElement('span');
            titleSpan.textContent = memo.habitTitle;
            header.appendChild(dateSpan);
            header.appendChild(titleSpan);
            const body = document.createElement('div');
            body.className = 'memo-archive-item-body';
            body.textContent = memo.content || '（本文なし）';
            item.appendChild(header);
            item.appendChild(body);
            memoArchiveList.appendChild(item);
        });
    }

    function renderMemoView() {
        populateMemoHabitSelect();
        const selected = memoHabitSelect.value;

        if (selected === '__all__') {
            memoWeekSection.hidden = true;
        } else {
            const habit = habits.find(h => h.id === selected);
            if (habit) {
                memoWeekSection.hidden = false;
                renderMemoWeek(habit);
            } else {
                memoWeekSection.hidden = true;
            }
        }

        renderMemoArchive(selected);
    }

    memoHabitSelect.addEventListener('change', renderMemoView);

    function switchView(view) {
        habitsView.hidden = view !== 'habits';
        memosView.hidden = view !== 'memos';
        settingsView.hidden = view !== 'settings';
        tabHabitsBtn.classList.toggle('active', view === 'habits');
        tabMemosBtn.classList.toggle('active', view === 'memos');
        tabSettingsBtn.classList.toggle('active', view === 'settings');
        if (view === 'memos') {
            renderMemoView();
        }
    }

    tabHabitsBtn.addEventListener('click', () => switchView('habits'));
    tabMemosBtn.addEventListener('click', () => switchView('memos'));
    tabSettingsBtn.addEventListener('click', () => switchView('settings'));

    // ---- データのバックアップ（匿名ログインはこの端末のストレージが消えると復元不能なため、書き出し/読み込みを用意） ----
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', () => {
            const payload = {
                exportedAt: new Date().toISOString(),
                version: 1,
                habits: habits.map(h => ({
                    id: h.id,
                    title: h.title,
                    completedDates: h.completedDates,
                    skippedDates: h.skippedDates,
                    createdAt: h.createdAt,
                    color: h.color,
                })),
                memos: memos.map(m => ({
                    habitId: m.habitId,
                    habitTitle: m.habitTitle,
                    date: m.date,
                    content: m.content,
                })),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `100days-backup-${todayIso()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast('データを書き出しました');
        });
    }

    if (importDataInput) {
        importDataInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            importDataInput.value = '';
            if (!file) return;

            let backup;
            try {
                const text = await file.text();
                backup = JSON.parse(text);
            } catch (err) {
                showToast('ファイルの読み込みに失敗しました');
                return;
            }

            if (!backup || !Array.isArray(backup.habits)) {
                showToast('バックアップファイルの形式が正しくありません');
                return;
            }

            const habitCount = backup.habits.length;
            const memoCount = Array.isArray(backup.memos) ? backup.memos.length : 0;
            const ok = confirm(`習慣${habitCount}件・メモ${memoCount}件を取り込みます。既存のデータに追加される形になります。よろしいですか？`);
            if (!ok) return;

            const idMap = {};
            for (const h of backup.habits) {
                const { data, error } = await supabase
                    .from('habits')
                    .insert({
                        title: (h.title || '習慣').slice(0, 30),
                        completed_dates: Array.isArray(h.completedDates) ? h.completedDates : [],
                        skipped_dates: Array.isArray(h.skippedDates) ? h.skippedDates : [],
                        color: h.color || null,
                        created_at: h.createdAt ? `${h.createdAt}T00:00:00Z` : new Date().toISOString(),
                    })
                    .select()
                    .single();
                if (error) {
                    console.error(error);
                    continue;
                }
                if (h.id) idMap[h.id] = data.id;
            }

            if (Array.isArray(backup.memos)) {
                for (const m of backup.memos) {
                    const newHabitId = m.habitId ? (idMap[m.habitId] || null) : null;
                    const { error } = await supabase.from('habit_memos').insert({
                        habit_id: newHabitId,
                        habit_title: m.habitTitle || '習慣',
                        date: m.date,
                        content: m.content || '',
                    });
                    if (error) console.error(error);
                }
            }

            await loadHabits();
            await loadMemos();
            populateMemoHabitSelect();
            renderGoals();
            showToast('データを取り込みました');
        });
    }

    // ---- セッション（匿名ログイン。ログイン画面なし、この端末専用の識別子を自動発行） ----
    function showInitError(message) {
        initErrorEl.textContent = message;
        initErrorEl.hidden = !message;
    }

    async function initSession() {
        const { data: { session: existing } } = await supabase.auth.getSession();
        let session = existing;

        if (!session) {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
                showInitError(`データの初期化に失敗しました: ${error.message}`);
                return;
            }
            session = data.session;
        }

        appContainer.hidden = false;
        await loadHabits();
        await importLocalGoalsIfAny();
        renderGoals();
        await loadMemos();
        populateMemoHabitSelect();
    }

    initTheme();
    applyHeroText();
    loadBackground();
    initSession();
});
