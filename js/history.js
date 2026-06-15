/* ══════════════════════════════════════════════════
   History Manager — watch history + continue watching
══════════════════════════════════════════════════ */
const History = (() => {

    const MAX_ITEMS = 200;
    const KEY       = 'iptv_history';

    /* ── Data access ─────────────────────────────── */
    function getAll() {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch(_) { return []; }
    }

    function saveAll(arr) {
        try { localStorage.setItem(KEY, JSON.stringify(arr)); }
        catch(_) {}
    }

    /* ── Write ───────────────────────────────────── */
    function addEntry(entry) {
        /* entry: { type, name, logo, url, group, position, duration, meta } */
        const all = getAll();
        /* Remove existing entry for same URL */
        const filtered = all.filter(e => e.url !== entry.url);
        filtered.unshift({
            ...entry,
            watchedAt: Date.now(),
            position: entry.position || 0,
            duration: entry.duration || 0,
        });
        if (filtered.length > MAX_ITEMS) filtered.length = MAX_ITEMS;
        saveAll(filtered);
    }

    function updatePosition(url, position) {
        const all = getAll();
        const item = all.find(e => e.url === url);
        if (item) { item.position = position; saveAll(all); }
    }

    function remove(url) {
        saveAll(getAll().filter(e => e.url !== url));
    }

    function clearAll() { localStorage.removeItem(KEY); }

    function clearByType(type) {
        saveAll(getAll().filter(e => e.type !== type));
    }

    /* ── Query ───────────────────────────────────── */
    function getByType(type) {
        return type ? getAll().filter(e => e.type === type) : getAll();
    }

    function getRecent(limit = 10) {
        return getAll().slice(0, limit);
    }

    function getContinueWatching() {
        /* Only VOD/series with progress between 5% and 95% */
        return getAll().filter(e => {
            if (!e.duration || e.type === 'live') return false;
            const pct = e.position / e.duration;
            return pct > 0.05 && pct < 0.95;
        });
    }

    function getProgressPercent(entry) {
        if (!entry.duration || !entry.position) return 0;
        return Math.round((entry.position / entry.duration) * 100);
    }

    /* ── Stats ───────────────────────────────────── */
    function getStats() {
        const all       = getAll();
        const totalSecs = all.reduce((sum, e) => sum + (e.position || 0), 0);
        const hours     = Math.round(totalSecs / 3600);

        const channelCount = {};
        all.forEach(e => { channelCount[e.name] = (channelCount[e.name] || 0) + 1; });
        const mostWatched = Object.entries(channelCount)
            .sort((a,b) => b[1]-a[1])[0];

        const groupCount = {};
        all.forEach(e => { if (e.group) groupCount[e.group] = (groupCount[e.group]||0)+1; });
        const topGroup = Object.entries(groupCount).sort((a,b) => b[1]-a[1])[0];

        return {
            totalHours:  hours,
            mostWatched: mostWatched ? mostWatched[0] : '-',
            topCategory: topGroup    ? topGroup[0]    : '-',
            totalItems:  all.length,
        };
    }

    /* ── Grouping by day ─────────────────────────── */
    function groupByDay(items) {
        const groups = {};
        const now    = new Date();
        const today  = dateStr(now);
        const yest   = dateStr(new Date(now - 86400000));

        items.forEach(item => {
            const d   = new Date(item.watchedAt);
            const key = dateStr(d);
            const lbl = key === today ? 'Hoy'
                      : key === yest  ? 'Ayer'
                      : formatDate(d);
            if (!groups[lbl]) groups[lbl] = [];
            groups[lbl].push(item);
        });
        return groups;
    }

    function dateStr(d) {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    function formatDate(d) {
        return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function formatTime(ts) {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    /* ── UI Rendering ────────────────────────────── */
    function renderHistoryScreen(containerId, filter, onPlay) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let items = getByType(filter === 'all' ? null : filter);

        if (!items.length) {
            container.innerHTML = `
                <div class="hist-empty">
                    <div class="empty-icon">🕐</div>
                    <p>No hay historial todavía</p>
                </div>`;
            return;
        }

        const groups  = groupByDay(items);
        container.innerHTML = '';

        Object.entries(groups).forEach(([dayLabel, dayItems]) => {
            const section = document.createElement('div');
            section.className = 'hist-day-group';
            section.innerHTML = `<div class="hist-day-label">${dayLabel}</div>`;

            const list = document.createElement('ul');
            list.className = 'hist-list';

            dayItems.forEach(item => {
                const pct = getProgressPercent(item);
                const li  = document.createElement('li');
                li.className  = 'hist-item';
                li.tabIndex   = 0;
                li.dataset.url = item.url;

                const typeIcon = item.type === 'live'   ? '📺'
                               : item.type === 'vod'    ? '🎬'
                               : item.type === 'series' ? '📂' : '▶';
                const typeClass = item.type || 'live';

                li.innerHTML = `
                    <div class="hist-type-icon ${typeClass}">${typeIcon}</div>
                    <div class="hist-logo-wrap">
                        ${item.logo
                            ? `<img class="hist-logo" src="${item.logo}" alt="" onerror="this.style.display='none'">`
                            : `<div class="channel-logo-placeholder" style="width:36px;height:36px;font-size:16px">${item.name.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="hist-info">
                        <div class="hist-name">${item.name}</div>
                        <div class="hist-meta">
                            <span>${item.group || ''}</span>
                            ${item.meta ? `<span>· ${item.meta}</span>` : ''}
                        </div>
                    </div>
                    <div class="hist-time">${formatTime(item.watchedAt)}</div>
                    ${pct > 0 ? `
                    <div class="hist-progress-wrap">
                        <div class="hist-progress-bar">
                            <div class="hist-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="hist-progress-pct">${pct}%</div>
                    </div>` : ''}`;

                li.addEventListener('click', () => onPlay(item));
                list.appendChild(li);
            });

            section.appendChild(list);
            container.appendChild(section);
        });
    }

    function renderContinueWatching(rowEl, onPlay) {
        const items = getContinueWatching();
        rowEl.innerHTML = '';
        if (!items.length) { rowEl.parentElement.style.display = 'none'; return; }
        rowEl.parentElement.style.display = '';

        items.slice(0, 8).forEach(item => {
            const pct  = getProgressPercent(item);
            const card = document.createElement('div');
            card.className  = 'continue-card';
            card.tabIndex   = 0;
            card.dataset.url = item.url;
            card.innerHTML   = `
                ${item.logo
                    ? `<img class="continue-card-logo" src="${item.logo}" alt="" onerror="this.src=''">`
                    : `<div class="continue-card-logo" style="background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:32px">🎬</div>`}
                <div class="continue-card-info">
                    <div class="continue-card-name">${item.name}</div>
                    <div class="continue-card-bar">
                        <div class="continue-card-fill" style="width:${pct}%"></div>
                    </div>
                </div>`;
            card.addEventListener('click', () => onPlay(item));
            rowEl.appendChild(card);
        });
    }

    function renderRecentInSidebar(listEl, onPlay) {
        const recent = getRecent(8).filter(e => e.type === 'live');
        if (!recent.length) return;

        /* Prepend a "Recientes" group before categories */
        const header = document.createElement('div');
        header.className = 'sidebar-title';
        header.style.fontSize = '16px';
        header.textContent = 'Recientes';
        listEl.insertBefore(header, listEl.firstChild);

        recent.reverse().forEach(item => {
            const li = document.createElement('li');
            li.className = 'category-item';
            li.style.fontSize = '20px';
            li.style.paddingLeft = '28px';
            li.tabIndex = 0;
            li.innerHTML = `
                ${item.logo ? `<img src="${item.logo}" style="width:28px;height:20px;object-fit:contain;border-radius:4px" onerror="this.style.display='none'">` : '📺'}
                <span class="cat-name" style="font-size:20px">${item.name}</span>`;
            li.addEventListener('click', () => onPlay(item));
            listEl.insertBefore(li, header.nextSibling);
        });

        /* Separator */
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.06);margin:8px 0';
        listEl.insertBefore(sep, header);
    }

    function renderStatsSection(containerId) {
        const el    = document.getElementById(containerId);
        if (!el) return;
        const stats = getStats();
        el.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.totalHours}h</div>
                <div class="stat-label">Tiempo visto</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size:22px">${stats.mostWatched}</div>
                <div class="stat-label">Canal favorito</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="font-size:22px">${stats.topCategory || '-'}</div>
                <div class="stat-label">Categoría top</div>
            </div>`;
    }

    return {
        addEntry, updatePosition, remove, clearAll, clearByType,
        getByType, getRecent, getContinueWatching, getProgressPercent,
        getStats, groupByDay,
        renderHistoryScreen, renderContinueWatching,
        renderRecentInSidebar, renderStatsSection,
    };
})();
