(() => {
    'use strict';

    const STORAGE_KEY = 'kakeibo_entries_v1';

    // 順序はパレットのカテゴリカル配色スロット(1〜8)と対応させる
    const CATEGORIES = [
        { key: 'food',      name: '食費',      color: '--series-1' },
        { key: 'daily',     name: '日用品',    color: '--series-2' },
        { key: 'transport', name: '交通',      color: '--series-3' },
        { key: 'fun',       name: '娯楽',      color: '--series-4' },
        { key: 'housing',   name: '住居',      color: '--series-5' },
        { key: 'utility',   name: '光熱・通信', color: '--series-6' },
        { key: 'medical',   name: '医療',      color: '--series-7' },
        { key: 'other',     name: 'その他',    color: '--series-8' },
    ];

    const categoryByKey = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

    const $ = (id) => document.getElementById(id);

    const el = {
        monthLabel: $('month-label'),
        prevMonthBtn: $('prev-month-btn'),
        nextMonthBtn: $('next-month-btn'),
        statIncome: $('stat-income'),
        statExpense: $('stat-expense'),
        statBalance: $('stat-balance'),
        form: $('entry-form'),
        dateInput: $('entry-date'),
        typeBtns: Array.from(document.querySelectorAll('.type-btn')),
        categoryRow: $('category-row'),
        categorySelect: $('entry-category'),
        amountInput: $('entry-amount'),
        memoInput: $('entry-memo'),
        chartSvg: $('category-chart'),
        chartTooltip: $('chart-tooltip'),
        chartLegend: $('chart-legend'),
        chartEmpty: $('chart-empty'),
        tbody: $('entries-tbody'),
        listEmpty: $('list-empty'),
        resetAllBtn: $('reset-all-btn'),
    };

    let entries = loadEntries();
    let currentType = 'expense';
    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth() + 1; // 1-12

    function loadEntries() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveEntries() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    function monthKey(y, m) { return `${y}-${pad2(m)}`; }

    function formatYen(n) {
        return `¥${Math.round(n).toLocaleString('ja-JP')}`;
    }

    function initCategorySelect() {
        el.categorySelect.textContent = '';
        for (const cat of CATEGORIES) {
            const opt = document.createElement('option');
            opt.value = cat.key;
            opt.textContent = cat.name;
            el.categorySelect.appendChild(opt);
        }
    }

    function setType(type) {
        currentType = type;
        el.typeBtns.forEach(btn => {
            const isActive = btn.dataset.type === type;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('income', isActive && type === 'income');
        });
        el.categoryRow.hidden = type === 'income';
    }

    function renderMonthLabel() {
        el.monthLabel.textContent = `${viewYear}年${pad2(viewMonth)}月`;
    }

    function entriesForCurrentMonth() {
        const key = monthKey(viewYear, viewMonth);
        return entries.filter(e => e.date.startsWith(key));
    }

    function renderStats(monthEntries) {
        const income = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
        const expense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
        const balance = income - expense;

        el.statIncome.textContent = formatYen(income);
        el.statExpense.textContent = formatYen(expense);
        el.statBalance.textContent = formatYen(balance);
        el.statBalance.classList.toggle('positive', balance >= 0);
        el.statBalance.classList.toggle('negative', balance < 0);
    }

    function renderList(monthEntries) {
        el.tbody.textContent = '';
        const sorted = [...monthEntries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

        el.listEmpty.hidden = sorted.length > 0;

        for (const entry of sorted) {
            const tr = document.createElement('tr');

            const tdDate = document.createElement('td');
            tdDate.textContent = entry.date.slice(5).replace('-', '/');
            tr.appendChild(tdDate);

            const tdType = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `type-badge ${entry.type}`;
            badge.textContent = entry.type === 'income' ? '収入' : '支出';
            tdType.appendChild(badge);
            tr.appendChild(tdType);

            const tdCategory = document.createElement('td');
            tdCategory.textContent = entry.type === 'income' ? '—' : (categoryByKey[entry.category]?.name ?? '—');
            tr.appendChild(tdCategory);

            const tdAmount = document.createElement('td');
            tdAmount.className = `col-amount ${entry.type}`;
            const sign = entry.type === 'income' ? '+' : '-';
            tdAmount.textContent = `${sign}${formatYen(entry.amount)}`;
            tr.appendChild(tdAmount);

            const tdMemo = document.createElement('td');
            tdMemo.textContent = entry.memo || '';
            tr.appendChild(tdMemo);

            const tdDelete = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'delete-btn';
            delBtn.setAttribute('aria-label', '削除');
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', () => deleteEntry(entry.id));
            tdDelete.appendChild(delBtn);
            tr.appendChild(tdDelete);

            el.tbody.appendChild(tr);
        }
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';
    function svgEl(tag, attrs) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        return node;
    }

    function roundedTopBarPath(x, yTop, w, h, r) {
        const rr = Math.min(r, w / 2, h);
        const yBottom = yTop + h;
        if (h <= 0) return `M ${x} ${yBottom} L ${x + w} ${yBottom} Z`;
        return [
            `M ${x} ${yBottom}`,
            `L ${x} ${yTop + rr}`,
            `Q ${x} ${yTop} ${x + rr} ${yTop}`,
            `L ${x + w - rr} ${yTop}`,
            `Q ${x + w} ${yTop} ${x + w} ${yTop + rr}`,
            `L ${x + w} ${yBottom}`,
            'Z',
        ].join(' ');
    }

    function renderChart(monthEntries) {
        const svg = el.chartSvg;
        svg.textContent = '';
        el.chartLegend.textContent = '';

        const totals = CATEGORIES.map(cat => ({
            cat,
            total: monthEntries
                .filter(e => e.type === 'expense' && e.category === cat.key)
                .reduce((s, e) => s + e.amount, 0),
        })).filter(t => t.total > 0);

        const hasData = totals.length > 0;
        el.chartEmpty.hidden = hasData;
        svg.style.display = hasData ? '' : 'none';
        if (!hasData) return;

        const W = 600, H = 220;
        const padTop = 28, padBottom = 28, padSide = 16;
        const plotW = W - padSide * 2;
        const plotH = H - padTop - padBottom;
        const maxVal = Math.max(...totals.map(t => t.total));
        const niceMax = maxVal * 1.15;

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const gridlineColor = getComputedStyle(document.documentElement).getPropertyValue('--gridline').trim();
        const baselineColor = getComputedStyle(document.documentElement).getPropertyValue('--baseline').trim();
        const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
        const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();

        // gridlines (hairline, recessive) — 3 horizontal divisions
        for (let i = 1; i <= 3; i++) {
            const y = padTop + (plotH * i) / 4;
            svg.appendChild(svgEl('line', {
                x1: padSide, x2: W - padSide, y1: y, y2: y,
                stroke: gridlineColor, 'stroke-width': 1,
            }));
        }

        // baseline
        const baseY = padTop + plotH;
        svg.appendChild(svgEl('line', {
            x1: padSide, x2: W - padSide, y1: baseY, y2: baseY,
            stroke: baselineColor, 'stroke-width': 1,
        }));

        const n = totals.length;
        const slot = plotW / n;
        const barW = Math.min(24, slot * 0.5);
        const gap = 2;

        totals.forEach((t, i) => {
            const cx = padSide + slot * i + slot / 2;
            const barH = (t.total / niceMax) * plotH;
            const x = cx - barW / 2;
            const yTop = baseY - barH;
            const color = `var(${t.cat.color})`;

            const barGroup = svgEl('g', { tabindex: '0', role: 'img', 'aria-label': `${t.cat.name} ${formatYen(t.total)}` });

            const path = svgEl('path', {
                d: roundedTopBarPath(x + gap / 2, yTop, barW - gap, barH, 4),
                fill: color,
            });
            barGroup.appendChild(path);

            // value at cap
            const valueLabel = svgEl('text', {
                x: cx, y: yTop - 8,
                'text-anchor': 'middle',
                'font-size': '11',
                fill: textPrimary,
                'font-weight': '600',
            });
            valueLabel.textContent = formatYen(t.total);
            barGroup.appendChild(valueLabel);

            // category tick label
            const catLabel = svgEl('text', {
                x: cx, y: baseY + 18,
                'text-anchor': 'middle',
                'font-size': '11',
                fill: textMuted,
            });
            catLabel.textContent = t.cat.name;
            barGroup.appendChild(catLabel);

            // hit target — wider than the bar, full plot height
            const hitRect = svgEl('rect', {
                x: cx - slot / 2, y: padTop, width: slot, height: plotH,
                fill: 'transparent',
                style: 'cursor:pointer',
            });
            barGroup.appendChild(hitRect);

            const showTooltip = (evt) => {
                path.setAttribute('opacity', '0.85');
                const tooltip = el.chartTooltip;
                tooltip.hidden = false;
                const valueSpan = document.createElement('span');
                valueSpan.className = 'tt-value';
                valueSpan.textContent = formatYen(t.total);
                tooltip.textContent = '';
                tooltip.appendChild(document.createTextNode(`${t.cat.name} `));
                tooltip.appendChild(valueSpan);

                const wrapRect = svg.getBoundingClientRect();
                const svgX = wrapRect.left + (cx / W) * wrapRect.width;
                const svgY = wrapRect.top + (yTop / H) * wrapRect.height;
                const wrap = svg.parentElement.getBoundingClientRect();
                tooltip.style.left = `${svgX - wrap.left}px`;
                tooltip.style.top = `${svgY - wrap.top - 8}px`;
            };
            const hideTooltip = () => {
                path.setAttribute('opacity', '1');
                el.chartTooltip.hidden = true;
            };

            hitRect.addEventListener('pointermove', showTooltip);
            hitRect.addEventListener('pointerenter', showTooltip);
            hitRect.addEventListener('pointerleave', hideTooltip);
            barGroup.addEventListener('focus', showTooltip);
            barGroup.addEventListener('blur', hideTooltip);

            svg.appendChild(barGroup);
        });

        // legend — fixed categorical order, only categories present this month
        for (const t of totals) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'legend-swatch';
            swatch.style.background = `var(${t.cat.color})`;
            const label = document.createElement('span');
            label.textContent = t.cat.name;
            item.appendChild(swatch);
            item.appendChild(label);
            el.chartLegend.appendChild(item);
        }
    }

    function render() {
        renderMonthLabel();
        const monthEntries = entriesForCurrentMonth();
        renderStats(monthEntries);
        renderChart(monthEntries);
        renderList(monthEntries);
    }

    function deleteEntry(id) {
        entries = entries.filter(e => e.id !== id);
        saveEntries();
        render();
    }

    function handleSubmit(evt) {
        evt.preventDefault();
        const date = el.dateInput.value;
        const amount = Number(el.amountInput.value);
        if (!date || !amount || amount <= 0) return;

        const entry = {
            id: Date.now() + Math.random(),
            date,
            type: currentType,
            category: currentType === 'expense' ? el.categorySelect.value : null,
            amount,
            memo: el.memoInput.value.trim(),
        };
        entries.push(entry);
        saveEntries();

        const [y, m] = date.split('-').map(Number);
        viewYear = y;
        viewMonth = m;

        el.amountInput.value = '';
        el.memoInput.value = '';
        render();
    }

    function shiftMonth(delta) {
        viewMonth += delta;
        if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
        if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
        render();
    }

    function init() {
        initCategorySelect();
        setType('expense');
        el.dateInput.value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

        el.typeBtns.forEach(btn => {
            btn.addEventListener('click', () => setType(btn.dataset.type));
        });

        el.form.addEventListener('submit', handleSubmit);
        el.prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
        el.nextMonthBtn.addEventListener('click', () => shiftMonth(1));

        el.resetAllBtn.addEventListener('click', () => {
            if (confirm('すべてのデータを削除します。よろしいですか？')) {
                entries = [];
                saveEntries();
                render();
            }
        });

        render();
    }

    init();
})();
