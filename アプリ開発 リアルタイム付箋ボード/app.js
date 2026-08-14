import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://wgfchfcfgznfhdyefnpg.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_F-fw5O5XBoxsm9dHciOijg_U3ta5mmM';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const appContainer = document.getElementById('app-container');
    const initErrorEl = document.getElementById('init-error');
    const toastEl = document.getElementById('toast');
    const board = document.getElementById('board');
    const boardEmpty = document.getElementById('board-empty');
    const addNoteBtn = document.getElementById('add-note-btn');
    const summarizeBtn = document.getElementById('summarize-btn');
    const summaryPanel = document.getElementById('summary-panel');
    const summaryPanelBody = document.getElementById('summary-panel-body');
    const summaryCloseBtn = document.getElementById('summary-close-btn');
    const presenceCountEl = document.getElementById('presence-count');
    const presenceDotsEl = document.getElementById('presence-dots');

    const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange'];
    const COLOR_HEX = {
        yellow: '#ffd966', pink: '#ff9eb0', blue: '#7ec8f2',
        green: '#8fe3c0', purple: '#c9a8f5', orange: '#ffb86b',
    };

    function myColor() {
        let c = localStorage.getItem('sticky-board-color');
        if (!c || !NOTE_COLORS.includes(c)) {
            c = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
            localStorage.setItem('sticky-board-color', c);
        }
        return c;
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function shortLabel(id) { return `ゲスト${id.slice(0, 4)}`; }

    let toastTimer = null;
    function showToast(message) {
        toastEl.textContent = message;
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3000);
    }

    function showInitError(message) {
        initErrorEl.textContent = message;
        initErrorEl.hidden = !message;
    }

    // ---- 状態 ----
    let myUserId = null;
    let boardChannel = null;
    let draggingId = null;
    const notesById = new Map();
    const noteEls = new Map();
    const remoteCursors = new Map();

    function rowToNote(row) {
        return {
            id: row.id,
            text: row.text,
            color: row.color,
            x: Number(row.x),
            y: Number(row.y),
            rotation: Number(row.rotation),
            createdBy: row.created_by,
        };
    }

    function updateEmptyState() {
        boardEmpty.hidden = notesById.size > 0;
    }

    // ---- データ層 ----
    // 初回接続時・Realtime再接続時の両方でここを通す(切断中に他セッションが行った
    // 変更を取りこぼしたまま放置しないため、フェッチ結果と現在の表示を突き合わせて同期する)
    async function syncNotes() {
        const { data, error } = await supabase
            .from('sticky_notes')
            .select('*')
            .order('updated_at', { ascending: true });
        if (error) {
            console.error(error);
            showToast('付箋の読み込みに失敗しました');
            return;
        }

        const freshIds = new Set(data.map(row => row.id));
        Array.from(notesById.keys()).forEach(id => {
            if (!freshIds.has(id) && draggingId !== id) {
                notesById.delete(id);
                unmountNote(id);
            }
        });

        data.forEach(row => {
            const note = rowToNote(row);
            if (!notesById.has(note.id)) {
                notesById.set(note.id, note);
                mountNote(note);
                return;
            }
            if (draggingId === note.id) return;
            notesById.set(note.id, note);
            const el = noteEls.get(note.id);
            if (!el) return;
            el.style.left = `${note.x}%`;
            el.style.top = `${note.y}%`;
            const textarea = el.querySelector('.note-text');
            if (textarea && document.activeElement !== textarea) {
                textarea.value = note.text;
            }
        });

        updateEmptyState();
    }

    async function addNote() {
        const payload = {
            text: '',
            color: myColor(),
            x: clamp(20 + Math.random() * 60, 8, 92),
            y: clamp(20 + Math.random() * 60, 8, 92),
            rotation: Math.round((Math.random() * 16 - 8) * 10) / 10,
        };
        const { data, error } = await supabase.from('sticky_notes').insert(payload).select().single();
        if (error) {
            console.error(error);
            showToast('付箋の追加に失敗しました');
            return;
        }
        const note = rowToNote(data);
        if (!notesById.has(note.id)) {
            notesById.set(note.id, note);
            mountNote(note);
        }
        const el = noteEls.get(note.id);
        el?.querySelector('.note-text')?.focus();
    }

    async function updateNoteText(id, text) {
        const note = notesById.get(id);
        if (!note) return;
        const previousText = note.text;
        note.text = text;
        const { error } = await supabase
            .from('sticky_notes')
            .update({ text, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) {
            console.error(error);
            showToast('メモの保存に失敗しました');
            note.text = previousText;
            const textarea = noteEls.get(id)?.querySelector('.note-text');
            if (textarea && document.activeElement !== textarea) {
                textarea.value = previousText;
            }
        }
    }

    async function commitNotePosition(id, x, y) {
        const note = notesById.get(id);
        if (!note) return;
        const previousX = note.x;
        const previousY = note.y;
        note.x = x;
        note.y = y;
        const { error } = await supabase
            .from('sticky_notes')
            .update({ x, y, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) {
            console.error(error);
            showToast('位置の保存に失敗しました');
            note.x = previousX;
            note.y = previousY;
            const el = noteEls.get(id);
            if (el && draggingId !== id) {
                el.style.left = `${previousX}%`;
                el.style.top = `${previousY}%`;
            }
        }
    }

    async function deleteNote(id) {
        const note = notesById.get(id);
        if (!note) return;
        notesById.delete(id);
        unmountNote(id);
        const { error } = await supabase.from('sticky_notes').delete().eq('id', id);
        if (error) {
            console.error(error);
            showToast('削除に失敗しました');
            notesById.set(id, note);
            mountNote(note);
        }
    }

    // ---- DOM構築 ----
    function createNoteElement(note) {
        const el = document.createElement('div');
        el.className = `sticky-note note-${note.color}`;
        el.style.setProperty('--rot', `${note.rotation}deg`);
        el.style.left = `${note.x}%`;
        el.style.top = `${note.y}%`;
        el.dataset.id = note.id;

        const handle = document.createElement('div');
        handle.className = 'note-handle';
        const delBtn = document.createElement('button');
        delBtn.className = 'note-delete-btn';
        delBtn.textContent = '✕';
        delBtn.setAttribute('aria-label', 'この付箋を削除');
        delBtn.addEventListener('click', () => deleteNote(note.id));
        handle.appendChild(delBtn);

        const textarea = document.createElement('textarea');
        textarea.className = 'note-text';
        textarea.placeholder = 'メモを書く…';
        textarea.value = note.text;
        textarea.addEventListener('blur', () => {
            const current = notesById.get(note.id);
            if (current && textarea.value !== current.text) {
                updateNoteText(note.id, textarea.value);
            }
        });

        el.appendChild(handle);
        el.appendChild(textarea);

        attachDragHandlers(handle, el, note.id);
        return el;
    }

    function mountNote(note) {
        const el = createNoteElement(note);
        noteEls.set(note.id, el);
        board.appendChild(el);
        updateEmptyState();
    }

    function unmountNote(id) {
        const el = noteEls.get(id);
        if (el) el.remove();
        noteEls.delete(id);
        updateEmptyState();
    }

    // ---- ドラッグ(確定前はBroadcast中継、ドロップ時にDB確定) ----
    function attachDragHandlers(handle, el, id) {
        handle.addEventListener('pointerdown', (evt) => {
            evt.preventDefault();
            handle.setPointerCapture(evt.pointerId);
            draggingId = id;
            el.classList.add('dragging');

            const boardRect = board.getBoundingClientRect();
            const note = notesById.get(id);
            const startX = evt.clientX;
            const startY = evt.clientY;
            const startLeftPct = note.x;
            const startTopPct = note.y;
            let lastBroadcast = 0;
            let pending = null;

            function onMove(moveEvt) {
                const dxPct = (moveEvt.clientX - startX) / boardRect.width * 100;
                const dyPct = (moveEvt.clientY - startY) / boardRect.height * 100;
                const nx = clamp(startLeftPct + dxPct, 4, 96);
                const ny = clamp(startTopPct + dyPct, 4, 96);
                el.style.left = `${nx}%`;
                el.style.top = `${ny}%`;
                pending = { x: nx, y: ny };

                const now = performance.now();
                if (now - lastBroadcast > 40) {
                    lastBroadcast = now;
                    boardChannel?.send({ type: 'broadcast', event: 'note-drag', payload: { id, x: nx, y: ny, from: myUserId } });
                }
            }
            function endDrag(endEvt) {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', endDrag);
                window.removeEventListener('pointercancel', endDrag);
                try { handle.releasePointerCapture(endEvt.pointerId); } catch { /* 既に解放済みなら無視 */ }
                el.classList.remove('dragging');
                draggingId = null;
                // pointercancel(タッチのジェスチャー割り込み等)でも、Broadcastで
                // 既に周知済みの座標とDBがズレたままにならないよう同じく確定させる
                if (pending) commitNotePosition(id, pending.x, pending.y);
            }
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', endDrag);
            window.addEventListener('pointercancel', endDrag);
        });
    }

    // ---- Postgres Changes(確定済みデータの同期) ----
    function handleDbChange(payload) {
        if (payload.eventType === 'INSERT') {
            const note = rowToNote(payload.new);
            if (notesById.has(note.id)) return;
            notesById.set(note.id, note);
            mountNote(note);
        } else if (payload.eventType === 'UPDATE') {
            const note = rowToNote(payload.new);
            if (!notesById.has(note.id)) return;
            notesById.set(note.id, note);
            const el = noteEls.get(note.id);
            if (!el) return;
            if (draggingId !== note.id) {
                el.style.left = `${note.x}%`;
                el.style.top = `${note.y}%`;
            }
            const textarea = el.querySelector('.note-text');
            if (textarea && document.activeElement !== textarea) {
                textarea.value = note.text;
            }
        } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id;
            if (!notesById.has(id)) return;
            notesById.delete(id);
            unmountNote(id);
        }
    }

    // ---- Presence(在室状況) ----
    function renderPresence(state) {
        const keys = Object.keys(state);
        presenceCountEl.textContent = String(Math.max(keys.length, 1));
        presenceDotsEl.innerHTML = '';
        keys.forEach(key => {
            const meta = state[key][0];
            const dot = document.createElement('span');
            dot.className = 'presence-dot';
            dot.style.background = COLOR_HEX[meta?.color] || COLOR_HEX.yellow;
            presenceDotsEl.appendChild(dot);
        });
    }

    // ---- Broadcast(カーソル位置の一時中継) ----
    function upsertCursor(payload) {
        if (!payload || payload.id === myUserId) return;
        let el = remoteCursors.get(payload.id);
        if (!el) {
            el = document.createElement('div');
            el.className = 'remote-cursor';
            const dot = document.createElement('div');
            dot.className = 'cursor-dot';
            const label = document.createElement('div');
            label.className = 'cursor-label';
            el.appendChild(dot);
            el.appendChild(label);
            board.appendChild(el);
            remoteCursors.set(payload.id, el);
        }
        el.style.left = `${payload.x}%`;
        el.style.top = `${payload.y}%`;
        const hex = COLOR_HEX[payload.color] || COLOR_HEX.yellow;
        el.querySelector('.cursor-dot').style.background = hex;
        el.querySelector('.cursor-label').style.background = hex;
        el.querySelector('.cursor-label').textContent = shortLabel(payload.id);
    }

    function removeCursor(id) {
        const el = remoteCursors.get(id);
        if (el) el.remove();
        remoteCursors.delete(id);
    }

    let lastCursorBroadcast = 0;
    function onBoardPointerMove(evt) {
        if (!boardChannel) return;
        const now = performance.now();
        if (now - lastCursorBroadcast < 50) return;
        lastCursorBroadcast = now;
        const rect = board.getBoundingClientRect();
        const xPct = (evt.clientX - rect.left) / rect.width * 100;
        const yPct = (evt.clientY - rect.top) / rect.height * 100;
        if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
        boardChannel.send({ type: 'broadcast', event: 'cursor', payload: { id: myUserId, color: myColor(), x: xPct, y: yPct } });
    }

    // ---- AIによる要約(Supabase Edge Function経由でClaude APIを呼ぶ) ----
    async function summarizeNotes() {
        const texts = Array.from(notesById.values())
            .map(n => n.text.trim())
            .filter(Boolean);

        summarizeBtn.disabled = true;
        summaryPanel.hidden = false;
        summaryPanelBody.textContent = '要約を生成しています…';

        const { data, error } = await supabase.functions.invoke('summarize-notes', {
            body: { notes: texts },
        });

        summarizeBtn.disabled = false;

        if (error) {
            console.error(error);
            summaryPanelBody.textContent = 'AI要約の生成に失敗しました。Edge Functionのデプロイ状況を確認してください。';
            return;
        }
        summaryPanelBody.textContent = data?.summary || '要約を取得できませんでした。';
    }

    // ---- セッション(匿名ログイン) + Realtime購読 ----
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
        myUserId = session.user.id;

        appContainer.hidden = false;

        boardChannel = supabase.channel('board:main', {
            config: { presence: { key: myUserId }, broadcast: { self: false } },
        });

        boardChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sticky_notes' }, handleDbChange)
            .on('broadcast', { event: 'note-drag' }, ({ payload }) => {
                if (payload.from === myUserId) return;
                const el = noteEls.get(payload.id);
                if (el && draggingId !== payload.id) {
                    el.style.left = `${payload.x}%`;
                    el.style.top = `${payload.y}%`;
                }
            })
            .on('broadcast', { event: 'cursor' }, ({ payload }) => upsertCursor(payload))
            .on('broadcast', { event: 'cursor-leave' }, ({ payload }) => removeCursor(payload.id))
            .on('presence', { event: 'sync' }, () => renderPresence(boardChannel.presenceState()))
            .on('presence', { event: 'leave' }, ({ key }) => removeCursor(key))
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // 初回接続・再接続いずれもここを通る。再接続時は切断中に
                    // 他セッションが行った変更を取りこぼしている可能性があるため、都度syncNotesで補う
                    await syncNotes();
                    await boardChannel.track({ color: myColor() });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    showToast('接続が不安定です。再接続を試みています…');
                } else if (status === 'CLOSED') {
                    showToast('接続が切断されました');
                }
            });

        addNoteBtn.addEventListener('click', addNote);
        summarizeBtn.addEventListener('click', summarizeNotes);
        summaryCloseBtn.addEventListener('click', () => { summaryPanel.hidden = true; });
        board.addEventListener('pointermove', onBoardPointerMove);
        board.addEventListener('pointerleave', () => {
            boardChannel?.send({ type: 'broadcast', event: 'cursor-leave', payload: { id: myUserId } });
        });
    }

    initSession();
});
