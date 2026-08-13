import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as d3 from 'https://esm.sh/d3@7';

document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://wgfchfcfgznfhdyefnpg.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_F-fw5O5XBoxsm9dHciOijg_U3ta5mmM';
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const appContainer = document.getElementById('app-container');
    const initErrorEl = document.getElementById('init-error');
    const toastEl = document.getElementById('toast');

    const reportForm = document.getElementById('report-form');
    const monthInput = document.getElementById('input-month');
    const searchInput = document.getElementById('input-search');
    const mapInput = document.getElementById('input-map');
    const clicksInput = document.getElementById('input-clicks');
    const callsInput = document.getElementById('input-calls');
    const directionsInput = document.getElementById('input-directions');
    const reviewsInput = document.getElementById('input-reviews');
    const ratingInput = document.getElementById('input-rating');

    const kpiRow = document.getElementById('kpi-row');
    const lineLegend = document.getElementById('line-legend');
    const lineChartSvg = document.getElementById('line-chart');
    const lineTooltip = document.getElementById('line-tooltip');
    const lineEmpty = document.getElementById('line-empty');
    const barLegend = document.getElementById('bar-legend');
    const barChartSvg = document.getElementById('bar-chart');
    const barTooltip = document.getElementById('bar-tooltip');
    const barEmpty = document.getElementById('bar-empty');
    const recordsTbody = document.getElementById('records-tbody');
    const recordsEmpty = document.getElementById('records-empty');

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

    // ---- 日付ユーティリティ ----
    function todayIso() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function monthLabel(monthIso) {
        const [, m] = monthIso.split('-');
        return `${Number(m)}月`;
    }

    function nextMonthStr(monthIso) {
        const [y, m] = monthIso.split('-').map(Number);
        const d = new Date(y, m, 1); // m は1始まりの「今月」なので、Dateのmonthに渡すと自動的に翌月になる
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function formatNumber(n) {
        return Math.round(n).toLocaleString('ja-JP');
    }

    // ---- データ層 ----
    let reports = [];

    function rowToReport(row) {
        return {
            id: row.id,
            month: row.month,
            searchImpressions: row.search_impressions,
            mapImpressions: row.map_impressions,
            websiteClicks: row.website_clicks,
            phoneTaps: row.phone_taps,
            directionRequests: row.direction_requests,
            newReviews: row.new_reviews,
            avgRating: row.avg_rating !== null ? Number(row.avg_rating) : null,
        };
    }

    async function loadReports() {
        const { data, error } = await supabase
            .from('meo_reports')
            .select('*')
            .order('month', { ascending: true });
        if (error) {
            console.error(error);
            showToast('データの読み込みに失敗しました');
            reports = [];
            return;
        }
        reports = data.map(rowToReport);
    }

    reportForm.addEventListener('submit', async (evt) => {
        evt.preventDefault();
        if (!monthInput.value) return;
        const monthIso = `${monthInput.value}-01`;

        const payload = {
            month: monthIso,
            search_impressions: Number(searchInput.value) || 0,
            map_impressions: Number(mapInput.value) || 0,
            website_clicks: Number(clicksInput.value) || 0,
            phone_taps: Number(callsInput.value) || 0,
            direction_requests: Number(directionsInput.value) || 0,
            new_reviews: Number(reviewsInput.value) || 0,
            avg_rating: ratingInput.value ? Number(ratingInput.value) : null,
        };

        const { data, error } = await supabase
            .from('meo_reports')
            .upsert(payload, { onConflict: 'user_id,month' })
            .select()
            .single();

        if (error) {
            console.error(error);
            showToast('保存に失敗しました');
            return;
        }

        const next = rowToReport(data);
        reports = reports.filter(r => r.month !== next.month);
        reports.push(next);
        reports.sort((a, b) => a.month.localeCompare(b.month));

        reportForm.reset();
        monthInput.value = nextMonthStr(monthIso); // 連続入力しやすいよう翌月を自動セット
        renderAll();
        showToast(`${monthLabel(monthIso)}のデータを保存しました`);
    });

    async function deleteReport(id) {
        if (!confirm('この月のデータを削除しますか？')) return;
        const prev = reports;
        reports = reports.filter(r => r.id !== id);
        renderAll();
        const { error } = await supabase.from('meo_reports').delete().eq('id', id);
        if (error) {
            console.error(error);
            showToast('削除に失敗しました');
            reports = prev;
            renderAll();
        }
    }

    // ---- KPIタイル ----
    function formatDelta(current, previous, { unit = '' } = {}) {
        if (previous === null || previous === undefined) {
            return { text: '前月データなし', cls: 'neutral' };
        }
        const diff = current - previous;
        if (diff === 0) return { text: '前月と同じ', cls: 'neutral' };
        const sign = diff > 0 ? '+' : '';
        const cls = diff > 0 ? 'good' : 'critical';
        if (unit === 'rating') {
            return { text: `${sign}${diff.toFixed(1)} 前月比`, cls };
        }
        const pct = previous === 0 ? null : (diff / previous) * 100;
        const pctText = pct === null ? '' : `（${sign}${pct.toFixed(0)}%）`;
        return { text: `${sign}${formatNumber(diff)} 前月比${pctText}`, cls };
    }

    function renderKPI() {
        kpiRow.innerHTML = '';
        if (reports.length === 0) return;

        const latest = reports[reports.length - 1];
        const prev = reports.length >= 2 ? reports[reports.length - 2] : null;
        const latestActions = latest.websiteClicks + latest.phoneTaps + latest.directionRequests;
        const prevActions = prev ? prev.websiteClicks + prev.phoneTaps + prev.directionRequests : null;

        const tiles = [
            { label: '検索表示回数', value: formatNumber(latest.searchImpressions), delta: formatDelta(latest.searchImpressions, prev ? prev.searchImpressions : null) },
            { label: 'マップ表示回数', value: formatNumber(latest.mapImpressions), delta: formatDelta(latest.mapImpressions, prev ? prev.mapImpressions : null) },
            { label: 'アクション数合計', value: formatNumber(latestActions), delta: formatDelta(latestActions, prevActions) },
            { label: '平均評価', value: latest.avgRating !== null ? latest.avgRating.toFixed(1) : '—', delta: latest.avgRating !== null ? formatDelta(latest.avgRating, prev ? prev.avgRating : null, { unit: 'rating' }) : { text: '', cls: 'neutral' } },
        ];

        tiles.forEach(t => {
            const tile = document.createElement('div');
            tile.className = 'stat-tile';
            tile.innerHTML = `
                <div class="stat-label">${t.label}（${monthLabel(latest.month)}）</div>
                <div class="stat-value">${t.value}</div>
                <div class="stat-delta ${t.delta.cls}">${t.delta.text}</div>
            `;
            kpiRow.appendChild(tile);
        });
    }

    // ---- SVGユーティリティ ----
    const SVG_NS = 'http://www.w3.org/2000/svg';
    function themeColor(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    // viewBox(W×H)と実際の描画矩形(svgRect)から、preserveAspectRatio="xMidYMid meet"による
    // 拡大縮小率と、アスペクト比の違いで生じるレターボックス分のオフセットを求める。
    // (svgRectの幅・高さは、CSS上のサイズとviewBoxのアスペクト比が食い違う場合に
    //  横または縦のどちらかにレターボックス(余白)ができるため、単純な幅比・高さ比では
    //  ズレる。両者に共通する縮小率＝小さい方の比率を使うのがポイント)
    function getSvgFit(svgRect, W, H) {
        const scale = Math.min(svgRect.width / W, svgRect.height / H);
        const offsetX = (svgRect.width - W * scale) / 2;
        const offsetY = (svgRect.height - H * scale) / 2;
        return { scale, offsetX, offsetY };
    }
    // viewBox基準のSVG内部座標 → ページ上のCSS px座標（clientX/Y相当）に変換する。
    function svgPointToClient(svgEl, W, H, svgX, svgY) {
        const svgRect = svgEl.getBoundingClientRect();
        const { scale, offsetX, offsetY } = getSvgFit(svgRect, W, H);
        return { x: svgRect.left + offsetX + svgX * scale, y: svgRect.top + offsetY + svgY * scale };
    }
    // ページ上のCSS px座標（pointerイベントのclientX/Y） → viewBox基準のSVG内部座標に変換する。
    function clientPointToSvg(svgEl, W, H, clientX, clientY) {
        const svgRect = svgEl.getBoundingClientRect();
        const { scale, offsetX, offsetY } = getSvgFit(svgRect, W, H);
        return { x: (clientX - svgRect.left - offsetX) / scale, y: (clientY - svgRect.top - offsetY) / scale };
    }

    // ---- 折れ線チャート：表示回数の推移（検索 / マップ） ----
    function renderLineChart() {
        const svg = d3.select(lineChartSvg);
        svg.selectAll('*').remove();
        lineLegend.innerHTML = '';
        lineTooltip.hidden = true; // 再描画でヒット領域が作り直されるため、古いツールチップの残留を防ぐ

        if (reports.length === 0) {
            lineEmpty.hidden = false;
            svg.style('display', 'none');
            return;
        }
        lineEmpty.hidden = true;
        svg.style('display', '');

        const W = 600, H = 260;
        const padL = 44, padR = 24, padT = 20, padB = 34;
        svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

        const gridline = themeColor('--gridline');
        const baseline = themeColor('--baseline');
        const textMuted = themeColor('--text-muted');
        const textPrimary = themeColor('--text-primary');
        const surface = themeColor('--surface-1');
        const series1 = themeColor('--series-1');
        const series2 = themeColor('--series-2');

        const series = [
            { key: 'searchImpressions', label: '検索表示回数', color: series1 },
            { key: 'mapImpressions', label: 'マップ表示回数', color: series2 },
        ];

        const months = reports.map(r => r.month);
        const x = d3.scalePoint(months, [padL, W - padR]);
        const maxVal = d3.max(reports, r => Math.max(r.searchImpressions, r.mapImpressions)) || 1;
        const y = d3.scaleLinear([0, maxVal * 1.2], [H - padB, padT]);

        // gridlines
        const yTicks = y.ticks(4);
        svg.append('g').selectAll('line')
            .data(yTicks)
            .join('line')
            .attr('x1', padL).attr('x2', W - padR)
            .attr('y1', d => y(d)).attr('y2', d => y(d))
            .attr('stroke', gridline).attr('stroke-width', 1);

        yTicks.forEach(t => {
            svg.append('text')
                .attr('x', padL - 10).attr('y', y(t))
                .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
                .attr('font-size', 10).attr('fill', textMuted)
                .text(d3.format('~s')(t));
        });

        // baseline
        svg.append('line')
            .attr('x1', padL).attr('x2', W - padR)
            .attr('y1', H - padB).attr('y2', H - padB)
            .attr('stroke', baseline).attr('stroke-width', 1);

        // x labels
        months.forEach(m => {
            svg.append('text')
                .attr('x', x(m)).attr('y', H - padB + 18)
                .attr('text-anchor', 'middle')
                .attr('font-size', 10).attr('fill', textMuted)
                .text(monthLabel(m));
        });

        series.forEach(s => {
            const path = d3.line().x(d => x(d.month)).y(d => y(d[s.key]));
            svg.append('path')
                .datum(reports)
                .attr('d', path)
                .attr('fill', 'none')
                .attr('stroke', s.color)
                .attr('stroke-width', 2)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round');

            svg.selectAll(`.dot-${s.key}`)
                .data(reports)
                .join('circle')
                .attr('cx', d => x(d.month))
                .attr('cy', d => y(d[s.key]))
                .attr('r', 4)
                .attr('fill', s.color)
                .attr('stroke', surface)
                .attr('stroke-width', 2);

            // 直近値ラベル(終点のみ)
            const last = reports[reports.length - 1];
            svg.append('text')
                .attr('x', x(last.month) + 8)
                .attr('y', y(last[s.key]))
                .attr('dominant-baseline', 'middle')
                .attr('font-size', 11).attr('font-weight', 700)
                .attr('fill', textPrimary)
                .text(formatNumber(last[s.key]));
        });

        // 凡例
        series.forEach(s => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const key = document.createElement('span');
            key.className = 'legend-line';
            key.style.background = s.color;
            const label = document.createElement('span');
            label.textContent = s.label;
            item.appendChild(key);
            item.appendChild(label);
            lineLegend.appendChild(item);
        });

        // クロスヘア + ツールチップ
        const crosshair = svg.append('line')
            .attr('y1', padT).attr('y2', H - padB)
            .attr('stroke', baseline).attr('stroke-width', 1)
            .style('opacity', 0);

        const hitRect = svg.append('rect')
            .attr('x', padL).attr('y', padT)
            .attr('width', W - padL - padR).attr('height', H - padT - padB)
            .attr('fill', 'transparent')
            .style('cursor', 'crosshair')
            .attr('tabindex', 0)
            .attr('role', 'img')
            .attr('aria-label', '表示回数の推移グラフ。左右矢印キーで月を選択すると、その月の検索表示回数とマップ表示回数を確認できます。');

        function renderTooltipForIndex(idx) {
            idx = Math.max(0, Math.min(months.length - 1, idx));
            const d = reports[idx];

            crosshair.attr('x1', x(d.month)).attr('x2', x(d.month)).style('opacity', 1);

            lineTooltip.hidden = false;
            lineTooltip.innerHTML = '';
            const title = document.createElement('div');
            title.className = 'tt-title';
            title.textContent = monthLabel(d.month);
            lineTooltip.appendChild(title);
            series.forEach(s => {
                const row = document.createElement('div');
                row.className = 'tt-row';
                const key = document.createElement('span');
                key.className = 'tt-key';
                key.style.background = s.color;
                const label = document.createElement('span');
                label.textContent = s.label + ' ';
                const value = document.createElement('span');
                value.className = 'tt-value';
                value.textContent = formatNumber(d[s.key]);
                row.appendChild(key);
                row.appendChild(label);
                row.appendChild(value);
                lineTooltip.appendChild(row);
            });

            const wrap = lineChartSvg.parentElement.getBoundingClientRect();
            const pt = svgPointToClient(lineChartSvg, W, H, x(d.month), padT);
            lineTooltip.style.left = `${pt.x - wrap.left}px`;
            lineTooltip.style.top = `${pt.y - wrap.top - 10}px`;
            return idx;
        }
        function showLineTooltip(evt) {
            const svgPt = clientPointToSvg(lineChartSvg, W, H, evt.clientX, evt.clientY);
            const eachBand = (W - padL - padR) / Math.max(months.length - 1, 1);
            const idx = Math.round((svgPt.x - padL) / eachBand);
            focusedIndex = renderTooltipForIndex(idx);
        }
        function hideLineTooltip() {
            crosshair.style('opacity', 0);
            lineTooltip.hidden = true;
        }
        let focusedIndex = months.length - 1;
        hitRect.on('pointermove', showLineTooltip)
            .on('pointerenter', showLineTooltip)
            .on('pointerleave', hideLineTooltip)
            .on('focus', () => { focusedIndex = renderTooltipForIndex(focusedIndex); })
            .on('blur', hideLineTooltip)
            .on('keydown', (evt) => {
                if (evt.key === 'ArrowLeft') {
                    evt.preventDefault();
                    focusedIndex = renderTooltipForIndex(focusedIndex - 1);
                } else if (evt.key === 'ArrowRight') {
                    evt.preventDefault();
                    focusedIndex = renderTooltipForIndex(focusedIndex + 1);
                } else if (evt.key === 'Escape') {
                    hideLineTooltip();
                }
            });
    }

    // ---- 棒グラフ：最新月のアクション内訳 ----
    function renderBarChart() {
        const svg = d3.select(barChartSvg);
        svg.selectAll('*').remove();
        barLegend.innerHTML = '';
        barTooltip.hidden = true; // 再描画でヒット領域が作り直されるため、古いツールチップの残留を防ぐ

        if (reports.length === 0) {
            barEmpty.hidden = false;
            svg.style('display', 'none');
            return;
        }
        barEmpty.hidden = true;
        svg.style('display', '');

        const latest = reports[reports.length - 1];
        const series1 = themeColor('--series-1');
        const series2 = themeColor('--series-2');
        const series3 = themeColor('--series-3');
        const gridline = themeColor('--gridline');
        const baseline = themeColor('--baseline');
        const textMuted = themeColor('--text-muted');
        const textPrimary = themeColor('--text-primary');

        const categories = [
            { key: 'websiteClicks', label: 'サイトクリック', color: series1, value: latest.websiteClicks },
            { key: 'phoneTaps', label: '電話タップ', color: series2, value: latest.phoneTaps },
            { key: 'directionRequests', label: 'ルート検索', color: series3, value: latest.directionRequests },
        ];

        const W = 400, H = 260;
        const padL = 20, padR = 20, padT = 28, padB = 34;
        svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

        const x = d3.scaleBand(categories.map(c => c.key), [padL, W - padR]).padding(0.45);
        const maxVal = d3.max(categories, c => c.value) || 1;
        const y = d3.scaleLinear([0, maxVal * 1.25], [H - padB, padT]);

        const yTicks = y.ticks(3);
        svg.append('g').selectAll('line')
            .data(yTicks)
            .join('line')
            .attr('x1', padL).attr('x2', W - padR)
            .attr('y1', d => y(d)).attr('y2', d => y(d))
            .attr('stroke', gridline).attr('stroke-width', 1);

        svg.append('line')
            .attr('x1', padL).attr('x2', W - padR)
            .attr('y1', H - padB).attr('y2', H - padB)
            .attr('stroke', baseline).attr('stroke-width', 1);

        const barW = Math.min(24, x.bandwidth());

        categories.forEach(c => {
            const cx = x(c.key) + x.bandwidth() / 2;
            const barH = y(0) - y(c.value);
            const bx = cx - barW / 2;
            const by = y(c.value);
            const r = 4;

            const path = `M ${bx} ${by + barH} L ${bx} ${by + r} Q ${bx} ${by} ${bx + r} ${by} L ${bx + barW - r} ${by} Q ${bx + barW} ${by} ${bx + barW} ${by + r} L ${bx + barW} ${by + barH} Z`;
            const group = svg.append('g').attr('tabindex', 0).attr('role', 'img').attr('aria-label', `${c.label} ${c.value}`);
            const rect = group.append('path').attr('d', path).attr('fill', c.color);

            group.append('text')
                .attr('x', cx).attr('y', by - 8)
                .attr('text-anchor', 'middle')
                .attr('font-size', 11).attr('font-weight', 700)
                .attr('fill', textPrimary)
                .text(formatNumber(c.value));

            group.append('text')
                .attr('x', cx).attr('y', H - padB + 18)
                .attr('text-anchor', 'middle')
                .attr('font-size', 10).attr('fill', textMuted)
                .text(c.label);

            const hit = group.append('rect')
                .attr('x', x(c.key)).attr('y', padT)
                .attr('width', x.bandwidth()).attr('height', H - padT - padB)
                .attr('fill', 'transparent')
                .style('cursor', 'pointer');

            const showBarTooltip = () => {
                rect.attr('opacity', 0.85);
                barTooltip.hidden = false;
                barTooltip.innerHTML = '';
                const row = document.createElement('div');
                row.className = 'tt-row';
                const key = document.createElement('span');
                key.className = 'tt-key';
                key.style.background = c.color;
                const label = document.createElement('span');
                label.textContent = c.label + ' ';
                const value = document.createElement('span');
                value.className = 'tt-value';
                value.textContent = formatNumber(c.value);
                row.appendChild(key);
                row.appendChild(label);
                row.appendChild(value);
                barTooltip.appendChild(row);

                const wrap = barChartSvg.parentElement.getBoundingClientRect();
                const pt = svgPointToClient(barChartSvg, W, H, cx, by);
                barTooltip.style.left = `${pt.x - wrap.left}px`;
                barTooltip.style.top = `${pt.y - wrap.top - 10}px`;
            };
            const hideBarTooltip = () => {
                rect.attr('opacity', 1);
                barTooltip.hidden = true;
            };
            hit.on('pointerenter', showBarTooltip).on('pointermove', showBarTooltip).on('pointerleave', hideBarTooltip);
            group.on('focus', showBarTooltip).on('blur', hideBarTooltip);
        });

        categories.forEach(c => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const swatch = document.createElement('span');
            swatch.className = 'legend-swatch';
            swatch.style.background = c.color;
            const label = document.createElement('span');
            label.textContent = c.label;
            item.appendChild(swatch);
            item.appendChild(label);
            barLegend.appendChild(item);
        });
    }

    // ---- テーブル ----
    function renderTable() {
        recordsTbody.innerHTML = '';
        const sorted = [...reports].sort((a, b) => b.month.localeCompare(a.month));
        recordsEmpty.hidden = sorted.length > 0;

        sorted.forEach(r => {
            const tr = document.createElement('tr');
            const cells = [
                monthLabel(r.month) + ' (' + r.month.slice(0, 7) + ')',
                formatNumber(r.searchImpressions),
                formatNumber(r.mapImpressions),
                formatNumber(r.websiteClicks),
                formatNumber(r.phoneTaps),
                formatNumber(r.directionRequests),
                formatNumber(r.newReviews),
                r.avgRating !== null ? r.avgRating.toFixed(1) : '—',
            ];
            cells.forEach(text => {
                const td = document.createElement('td');
                td.textContent = text;
                tr.appendChild(td);
            });
            const tdDelete = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-row-btn';
            delBtn.textContent = '✕';
            delBtn.setAttribute('aria-label', '削除');
            delBtn.addEventListener('click', () => deleteReport(r.id));
            tdDelete.appendChild(delBtn);
            tr.appendChild(tdDelete);
            recordsTbody.appendChild(tr);
        });
    }

    function renderAll() {
        renderKPI();
        renderLineChart();
        renderBarChart();
        renderTable();
    }

    // ---- セッション（匿名ログイン） ----
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
        monthInput.value = todayIso().slice(0, 7);
        await loadReports();
        renderAll();
    }

    initSession();
});
