/* UI Manager: screens, focus, lists, toasts */
const UI = (() => {

    /* ── Screen management ────────────────────────── */
    let _currentScreen = null;
    const screens = {};

    function init() {
        document.querySelectorAll('.screen').forEach(el => {
            screens[el.id.replace('screen-', '')] = el;
        });
    }

    function showScreen(name) {
        if (_currentScreen === name) return;
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
        _currentScreen = name;
    }

    function currentScreen() { return _currentScreen; }

    /* ── Focus management ─────────────────────────── */
    let _focused = null;

    function setFocus(el) {
        if (!el) return;
        if (_focused) _focused.classList.remove('focused');
        _focused = el;
        el.classList.add('focused');
        el.scrollIntoViewIfNeeded
            ? el.scrollIntoViewIfNeeded(false)
            : el.scrollIntoView({ block: 'nearest' });
    }

    function getFocused() { return _focused; }

    function clearFocus() {
        if (_focused) _focused.classList.remove('focused');
        _focused = null;
    }

    /* Navigate a list with arrow keys, returns true if consumed */
    function navigateList(list, key) {
        const items = Array.from(list.querySelectorAll('li'));
        if (!items.length) return false;

        const idx = _focused ? items.indexOf(_focused) : -1;

        if (key === Keys.UP) {
            const prev = idx > 0 ? items[idx - 1] : items[items.length - 1];
            setFocus(prev);
            return true;
        }
        if (key === Keys.DOWN) {
            const next = idx < items.length - 1 ? items[idx + 1] : items[0];
            setFocus(next);
            return true;
        }
        return false;
    }

    /* ── Channel list rendering ────────────────────── */
    function renderChannels(channels, listEl, activeUrl = '') {
        listEl.innerHTML = '';
        if (!channels.length) {
            listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📺</div><p>No hay canales</p></div>';
            return;
        }
        channels.forEach((ch, i) => {
            const li = document.createElement('li');
            li.className  = 'channel-item' + (ch.url === activeUrl ? ' playing' : '');
            li.dataset.url = ch.url;
            li.dataset.idx = i;
            li.tabIndex   = 0;

            const isFav = Storage.isFavorite(ch);
            li.innerHTML = `
                <span class="channel-num">${i + 1}</span>
                <div class="channel-logo-wrap">
                    ${ch.logo
                        ? `<img class="channel-logo" src="${escHtml(ch.logo)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\"channel-logo-placeholder\\">${ch.name.charAt(0).toUpperCase()}</div>'">`
                        : `<div class="channel-logo-placeholder">${ch.name.charAt(0).toUpperCase()}</div>`
                    }
                </div>
                <div class="channel-info">
                    <div class="channel-name">${escHtml(ch.name)}</div>
                    <div class="channel-group">${escHtml(ch.group || '')}</div>
                </div>
                <div class="channel-badges">
                    ${isFav ? '<span class="badge-fav">★</span>' : ''}
                    <span class="badge-live"><span class="live-dot"></span> EN VIVO</span>
                </div>`;
            listEl.appendChild(li);
        });
    }

    /* ── Category list rendering ───────────────────── */
    function renderCategories(groups, listEl, activeGroup = '') {
        listEl.innerHTML = '';
        const all = [
            { name: '⭐ Favoritos', key: '__favorites__' },
            { name: '📋 Todos',     key: '__all__' },
            ...groups.map(g => ({ name: g, key: g }))
        ];
        all.forEach(({ name, key }) => {
            const li     = document.createElement('li');
            li.className = 'category-item' + (key === activeGroup ? ' active' : '');
            li.dataset.group = key;
            li.tabIndex  = 0;
            li.innerHTML = `<span class="cat-name">${escHtml(name)}</span>`;
            listEl.appendChild(li);
        });
    }

    /* ── Player sidebar channel list ───────────────── */
    function renderPlayerSidebar(channels, listEl, activeUrl = '') {
        listEl.innerHTML = '';
        channels.forEach((ch, i) => {
            const li = document.createElement('li');
            li.className  = 'ps-item' + (ch.url === activeUrl ? ' playing' : '');
            li.dataset.url = ch.url;
            li.dataset.idx = i;
            li.tabIndex   = 0;
            li.innerHTML  = `
                ${ch.logo
                    ? `<img class="ps-item-logo" src="${escHtml(ch.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">`
                    : ''}
                <span class="ps-item-name">${escHtml(ch.name)}</span>`;
            listEl.appendChild(li);
        });
    }

    /* ── Toast ──────────────────────────────────────── */
    let _toastTimer = null;
    const _toastEl  = () => document.getElementById('toast');

    function showToast(msg, duration = 2500) {
        const el = _toastEl();
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(_toastTimer);
        _toastTimer = setTimeout(() => el.classList.remove('show'), duration);
    }

    /* ── Clock ──────────────────────────────────────── */
    function startClock() {
        const el = document.getElementById('header-time');
        if (!el) return;
        function tick() {
            const now  = new Date();
            const h    = String(now.getHours()).padStart(2, '0');
            const m    = String(now.getMinutes()).padStart(2, '0');
            el.textContent = `${h}:${m}`;
        }
        tick();
        setInterval(tick, 30000);
    }

    /* ── OSD ──────────────────────────────────────── */
    let _osdTimer   = null;
    const _osdEl    = () => document.getElementById('player-osd');

    function showOSD(channel, channelNum) {
        const osd = _osdEl();
        document.getElementById('osd-channel-name').textContent = channel.name;
        document.getElementById('osd-channel-group').textContent = channel.group || '';
        document.getElementById('osd-channel-num').textContent  = channelNum + 1;

        const logo = document.getElementById('osd-logo');
        if (channel.logo) { logo.src = channel.logo; logo.style.display = ''; }
        else { logo.style.display = 'none'; }

        // Update EPG info if available
        _updateOSDEPG(channel);

        osd.classList.add('visible');
        clearTimeout(_osdTimer);
        _osdTimer = setTimeout(() => osd.classList.remove('visible'), 5000);
    }

    function _updateOSDEPG(channel) {
        const progTitleEl = document.getElementById('osd-prog-title');
        const progBarEl   = document.getElementById('osd-prog-bar');
        const nextTitleEl = document.getElementById('osd-next-title');
        if (!progTitleEl) return;

        // Try to find channel ID from tvgId or use channel name
        const channelId = channel.tvgId || channel.id || channel.url;

        let current = null;
        let next    = null;
        try {
            if (typeof EPG !== 'undefined') {
                current = EPG.getCurrentProgram(channelId);
                next    = EPG.getNextProgram(channelId);
            }
        } catch (_) {}

        if (current) {
            progTitleEl.textContent = current.title || '-';
            if (progBarEl) {
                const pct = typeof EPG !== 'undefined' ? EPG.getProgressPercent(current) : 0;
                progBarEl.style.width = pct + '%';
            }
        } else {
            progTitleEl.textContent = '-';
            if (progBarEl) progBarEl.style.width = '0%';
        }

        if (nextTitleEl) {
            nextTitleEl.textContent = next ? (next.title || '-') : '-';
        }
    }

    function hideOSD() {
        clearTimeout(_osdTimer);
        _osdEl().classList.remove('visible');
    }

    /* ── Player message (buffering / error) ──────── */
    function showPlayerMessage(icon, text, sub = '', isError = false) {
        const el      = document.getElementById('player-message');
        const iconEl  = document.getElementById('message-icon');
        const textEl  = document.getElementById('message-text');
        const subEl   = document.getElementById('message-sub');
        iconEl.textContent  = icon;
        iconEl.className    = 'message-icon' + (isError ? ' error' : '');
        textEl.textContent  = text;
        subEl.textContent   = sub;
        el.classList.add('visible');
    }

    function hidePlayerMessage() {
        document.getElementById('player-message').classList.remove('visible');
    }

    /* ── Helpers ────────────────────────────────────── */
    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    return {
        init, showScreen, currentScreen,
        setFocus, getFocused, clearFocus, navigateList,
        renderChannels, renderCategories, renderPlayerSidebar,
        showToast, startClock,
        showOSD, hideOSD,
        showPlayerMessage, hidePlayerMessage,
        escHtml
    };
})();
