/* ══════════════════════════════════════════════════
   IPTV Samsung - Main Application Controller
══════════════════════════════════════════════════ */

const App = (() => {

    /* ── State ──────────────────────────────────────── */
    let state = {
        allChannels:     [],
        filteredChannels:[],
        groups:          [],
        activeGroup:     '__all__',
        activeChannel:   null,
        activeIndex:     0,
        searchQuery:     '',
        focus:           'sidebar',   // 'sidebar' | 'channels' | 'setup' | 'player' | 'player-sidebar' | 'epg'
        playerSidebarOpen: false,
        sourceType:      null,        // 'm3u' | 'xtream'
        setupTab:        'm3u',
        numBuffer:       '',
        numTimer:        null,
        epgDate:         new Date(),
    };

    /* ── DOM References ─────────────────────────────── */
    const $ = id => document.getElementById(id);

    /* ── Boot sequence ──────────────────────────────── */
    async function boot() {
        UI.init();
        UI.showScreen('splash');
        UI.startClock();
        bindGlobalKeys();

        await delay(2200);

        const creds = Storage.getCredentials();
        const cached = Storage.getChannels();

        if (creds && cached && cached.length) {
            state.sourceType   = creds.type;
            state.allChannels  = cached;
            buildGroups();
            filterChannels();
            renderMain();
            UI.showScreen('main');
            focusSidebar();
            /* Silent background refresh */
            _scheduleAutoRefresh(creds);
        } else if (creds) {
            await reconnectSource(creds);
        } else {
            UI.showScreen('setup');
            initSetupScreen();
        }
    }

    let _autoRefreshTimer = null;
    function _scheduleAutoRefresh(creds) {
        if (_autoRefreshTimer) clearTimeout(_autoRefreshTimer);
        const intervalH = parseInt(Storage.getSetting('auto_refresh_hours') || '0', 10);
        if (!intervalH) return;
        _autoRefreshTimer = setTimeout(async () => {
            try {
                let channels;
                if (creds.type === 'm3u') {
                    const r = await M3UParser.fetchAndParse(creds.data.url);
                    channels = r.channels;
                } else {
                    await Xtream.login(creds.data.server, creds.data.user, creds.data.pass);
                    channels = await Xtream.getAllChannels();
                }
                const prev = state.allChannels.length;
                Storage.saveChannels(channels);
                state.allChannels = channels;
                buildGroups();
                filterChannels();
                renderMain();
                const diff = channels.length - prev;
                if (diff > 0) UI.showToast(`Lista actualizada: +${diff} canales nuevos`);
                _scheduleAutoRefresh(creds);
            } catch (_) { _scheduleAutoRefresh(creds); }
        }, intervalH * 3600000);
    }

    async function reconnectSource(creds) {
        try {
            /* Show skeleton while loading */
            UI.showScreen('main');
            UI.renderSkeleton($('channel-list'), 14);
            focusSidebar();

            if (creds.type === 'm3u') {
                const result = await M3UParser.fetchAndParse(creds.data.url);
                state.allChannels = result.channels;
            } else {
                await Xtream.login(creds.data.server, creds.data.user, creds.data.pass);
                state.allChannels = await Xtream.getAllChannels();
            }
            Storage.saveChannels(state.allChannels);
            state.sourceType = creds.type;
            buildGroups();
            filterChannels();
            renderMain();
            _scheduleAutoRefresh(creds);
        } catch (e) {
            UI.showScreen('setup');
            initSetupScreen();
            UI.showToast('Error al reconectar: ' + e.message, 4000);
        }
    }

    /* ── Setup Screen ───────────────────────────────── */
    function initSetupScreen() {
        bindSetupEvents();
        setTimeout(() => {
            UI.setFocus($('tab-m3u'));
            state.focus = 'setup';
        }, 100);
    }

    function bindSetupEvents() {
        /* Tabs */
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchSetupTab(btn.dataset.tab));
        });

        /* Connect button */
        $('btn-connect').addEventListener('click', onConnectClick);
    }

    function switchSetupTab(tab) {
        state.setupTab = tab;
        document.querySelectorAll('.tab-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.tab-panel').forEach(p =>
            p.classList.toggle('active', p.id === 'panel-' + tab));
    }

    async function onConnectClick() {
        const statusEl = $('setup-status');
        statusEl.className = 'setup-status';
        statusEl.textContent = 'Conectando...';
        $('btn-connect').disabled = true;

        try {
            let channels, creds;

            if (state.setupTab === 'm3u') {
                const url = $('m3u-url').value.trim();
                if (!url) throw new Error('Ingresa una URL');
                const result = await M3UParser.fetchAndParse(url);
                channels = result.channels;
                creds    = { type: 'm3u', data: { url } };
            } else {
                const server = $('xtream-server').value.trim();
                const user   = $('xtream-user').value.trim();
                const pass   = $('xtream-pass').value.trim();
                if (!server || !user || !pass) throw new Error('Completa todos los campos');
                await Xtream.login(server, user, pass);
                channels = await Xtream.getAllChannels();
                creds    = { type: 'xtream', data: { server, user, pass } };
            }

            if (!channels.length) throw new Error('No se encontraron canales');

            Storage.saveCredentials(creds.type, creds.data);
            Storage.saveChannels(channels);
            state.allChannels = channels;
            state.sourceType  = creds.type;

            statusEl.className   = 'setup-status success';
            statusEl.textContent = `✓ ${channels.length} canales cargados`;

            await delay(1000);
            buildGroups();
            filterChannels();
            renderMain();
            UI.showScreen('main');
            focusSidebar();

        } catch (e) {
            statusEl.className   = 'setup-status error';
            statusEl.textContent = '✗ ' + (e.message || 'Error desconocido');
        } finally {
            $('btn-connect').disabled = false;
        }
    }

    /* ── Main Screen ────────────────────────────────── */
    function buildGroups() {
        const gs = new Set();
        state.allChannels.forEach(ch => { if (ch.group) gs.add(ch.group); });
        state.groups = Array.from(gs).sort();
    }

    function filterChannels() {
        let list = state.allChannels;

        if (state.activeGroup === '__favorites__') {
            const favUrls = new Set(Storage.getFavorites().map(f => f.url));
            list = list.filter(ch => favUrls.has(ch.url));
        } else if (state.activeGroup !== '__all__') {
            list = list.filter(ch => ch.group === state.activeGroup);
        }

        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            list = list.filter(ch => ch.name.toLowerCase().includes(q));
        }

        state.filteredChannels = list;
    }

    function renderMain() {
        const catList  = $('category-list');
        const chanList = $('channel-list');
        const countEl  = $('channel-count');

        UI.renderCategories(state.groups, catList, state.activeGroup);
        UI.renderChannels(state.filteredChannels, chanList,
            state.activeChannel ? state.activeChannel.url : '');
        countEl.innerHTML = `<span class="channel-count-text">${state.filteredChannels.length} canales</span>`;

        /* Recents row */
        const recentsContainer = $('recents-row-container');
        if (recentsContainer && typeof History !== 'undefined') {
            const recentEntries = History.getRecent(8);
            const recentChannels = recentEntries
                .filter(e => e.type === 'live')
                .map(e => e.channel)
                .filter(Boolean);
            UI.renderRecentsRow(recentsContainer, recentChannels, ch => {
                const idx = state.filteredChannels.findIndex(c => c.url === ch.url);
                if (idx !== -1) playChannelByIndex(idx);
            });
        }

        /* Bind click events on category items */
        catList.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                selectCategory(li.dataset.group);
            });
        });

        /* Bind click events on channel items */
        chanList.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                playChannelByIndex(parseInt(li.dataset.idx, 10));
            });
            li.addEventListener('dblclick', () => {
                toggleFavorite(parseInt(li.dataset.idx, 10));
            });
        });

        /* Update settings info */
        const stEl = $('settings-source-type');
        if (stEl) stEl.textContent = state.sourceType === 'xtream' ? 'Xtream Codes' : 'Lista M3U';
        const scEl = $('settings-channel-count');
        if (scEl) scEl.textContent = state.allChannels.length;
    }

    function selectCategory(group) {
        state.activeGroup  = group;
        state.searchQuery  = '';
        $('search-input').value = '';
        filterChannels();
        renderMain();
        UI.setFocus($('category-list').querySelector(`[data-group="${group}"]`));
    }

    /* ── Player ─────────────────────────────────────── */
    function playChannelByIndex(idx) {
        const ch = state.filteredChannels[idx];
        if (!ch) return;

        state.activeChannel = ch;
        state.activeIndex   = idx;

        Storage.saveLastChannel(ch);
        Storage.addRecent(ch);
        History.addEntry({ type: 'live', name: ch.name, logo: ch.logo, url: ch.url, group: ch.group });

        /* Update player sidebar */
        const psList = $('ps-list');
        UI.renderPlayerSidebar(state.filteredChannels, psList, ch.url);
        psList.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => {
                playChannelByIndex(parseInt(li.dataset.idx, 10));
                closePlayerSidebar();
            });
        });

        if (typeof AspectRatio !== 'undefined') AspectRatio.reset();
        Player.play(ch);
        UI.showScreen('player');
        state.focus = 'player';
        UI.showOSD(ch, idx);
    }

    function playChannelByUrl(url) {
        const idx = state.filteredChannels.findIndex(ch => ch.url === url);
        if (idx !== -1) playChannelByIndex(idx);
    }

    function changeChannel(dir) {
        const total = state.filteredChannels.length;
        if (!total) return;
        const next = ((state.activeIndex + dir) + total) % total;
        playChannelByIndex(next);
    }

    /* ── Player Sidebar ─────────────────────────────── */
    function openPlayerSidebar() {
        state.playerSidebarOpen = true;
        state.focus = 'player-sidebar';
        const sb = $('player-sidebar');
        sb.classList.add('open');
        /* Focus current channel in sidebar */
        const items = sb.querySelectorAll('li');
        const cur   = sb.querySelector('li.playing') || items[0];
        if (cur) UI.setFocus(cur);
    }

    function closePlayerSidebar() {
        state.playerSidebarOpen = false;
        state.focus = 'player';
        $('player-sidebar').classList.remove('open');
        UI.clearFocus();
    }

    /* ── Settings Screen ─────────────────────────────── */
    function initSettings() {
        $('settings-back').addEventListener('click', () => {
            UI.showScreen('main');
            state.focus = 'sidebar';
            focusSidebar();
        });
        $('btn-change-source').addEventListener('click', () => {
            Storage.clearCredentials();
            Storage.clearChannels();
            UI.showScreen('setup');
            initSetupScreen();
        });
        $('btn-clear-cache').addEventListener('click', () => {
            Storage.clearChannels();
            UI.showToast('Caché eliminado');
        });
        $('btn-clear-favorites').addEventListener('click', () => {
            Storage.clearFavorites();
            UI.showToast('Favoritos eliminados');
            filterChannels();
            renderMain();
        });
        if ($('btn-sleep-timer') && typeof SleepTimer !== 'undefined') {
            $('btn-sleep-timer').addEventListener('click', () => {
                SleepTimer.showModal();
                _updateSleepStatus();
            });
        }

        /* Auto-refresh settings */
        const refreshBtns = document.querySelectorAll('.settings-refresh-opt');
        const savedH = parseInt(Storage.getSetting('auto_refresh_hours') || '0', 10);
        _updateRefreshLabel(savedH);
        refreshBtns.forEach(btn => {
            const h = parseInt(btn.dataset.h, 10);
            btn.classList.toggle('active', h === savedH);
            btn.addEventListener('click', () => {
                Storage.setSetting('auto_refresh_hours', h);
                refreshBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.h,10) === h));
                _updateRefreshLabel(h);
                const creds = Storage.getCredentials();
                if (creds) _scheduleAutoRefresh(creds);
                UI.showToast(h ? `Auto-refresh: cada ${h}h` : 'Auto-refresh desactivado');
            });
        });

        if ($('btn-refresh-now')) {
            $('btn-refresh-now').addEventListener('click', async () => {
                const creds = Storage.getCredentials();
                if (!creds) return;
                UI.showToast('Actualizando lista...');
                try {
                    let channels;
                    if (creds.type === 'm3u') {
                        const r = await M3UParser.fetchAndParse(creds.data.url);
                        channels = r.channels;
                    } else {
                        await Xtream.login(creds.data.server, creds.data.user, creds.data.pass);
                        channels = await Xtream.getAllChannels();
                    }
                    Storage.saveChannels(channels);
                    state.allChannels = channels;
                    buildGroups(); filterChannels(); renderMain();
                    UI.showToast(`Lista actualizada: ${channels.length} canales`);
                } catch (e) {
                    UI.showToast('Error al actualizar: ' + e.message, 4000);
                }
            });
        }
    }

    function _updateRefreshLabel(h) {
        const el = $('settings-refresh-label');
        if (!el) return;
        el.textContent = h ? `Cada ${h} horas` : 'Manual';
    }

    function _updateSleepStatus() {
        const el = $('settings-sleep-status');
        if (!el || typeof SleepTimer === 'undefined') return;
        el.textContent = SleepTimer.isActive()
            ? `${SleepTimer.remaining()} min restantes`
            : 'Desactivado';
    }

    /* ── Favorites (toggle with GREEN button or long OK) ─ */
    function toggleFavorite(idx) {
        const ch = state.filteredChannels[idx];
        if (!ch) return;
        const added = Favorites.toggle(ch);
        UI.showToast(added ? 'Añadido a favoritos ★' : 'Eliminado de favoritos');
        renderMain();
    }

    /* ── Search ─────────────────────────────────────── */
    function handleSearch(query) {
        state.searchQuery = query;
        filterChannels();
        renderMain();
        if (state.filteredChannels.length) {
            UI.setFocus($('channel-list').querySelector('li'));
        }
    }

    /* ── Focus helpers ──────────────────────────────── */
    function focusSidebar() {
        state.focus = 'sidebar';
        const active = $('category-list').querySelector('.active') ||
                       $('category-list').querySelector('li');
        if (active) UI.setFocus(active);
    }

    function focusChannels() {
        state.focus = 'channels';
        const first = $('channel-list').querySelector('.playing') ||
                      $('channel-list').querySelector('li');
        if (first) UI.setFocus(first);
    }

    /* ── Player state listener ──────────────────────── */
    function initPlayerListener() {
        Player.onStateChange((s, data) => {
            switch (s) {
                case 'loading':
                    UI.showPlayerMessage('⟳', 'Cargando canal...', '', false);
                    break;
                case 'buffering':
                    UI.showPlayerMessage('⟳', 'Buffering...', '', false);
                    break;
                case 'playing':
                    UI.hidePlayerMessage();
                    break;
                case 'retry':
                    UI.showPlayerMessage('⟳',
                        `Reconectando... (${data.attempt}/${3})`,
                        `Reintentando en ${data.delay / 1000}s`, false);
                    break;
                case 'error':
                    UI.showPlayerMessage('✕', 'Error de reproducción',
                        'Presiona BACK o elige otro canal', true);
                    break;
            }
        });
    }

    /* ── Global keyboard handler ────────────────────── */
    function bindGlobalKeys() {
        document.addEventListener('keydown', e => {
            const k = e.keyCode;
            handleKey(k, e);
        });

        /* Search input */
        $('search-input').addEventListener('input', e => {
            handleSearch(e.target.value);
        });
    }

    function handleKey(k, e) {
        const screen = UI.currentScreen();

        /* EXIT always exits */
        if (k === Keys.EXIT) {
            try { tizen.application.getCurrentApplication().exit(); } catch (_) {}
            return;
        }

        switch (screen) {
            case 'setup':          handleSetupKeys(k, e);    break;
            case 'main':           handleMainKeys(k, e);     break;
            case 'player':         handlePlayerKeys(k, e);   break;
            case 'settings':       handleSettingsKeys(k, e); break;
            case 'epg':            handleEPGKeys(k, e);      break;
            default:               _handleNewScreenKeys(screen, k, e); break;
            case 'epg':      handleEPGKeys(k, e); break;
        }
    }

    /* Setup screen keys */
    function handleSetupKeys(k, e) {
        const focusables = [
            $('tab-m3u'), $('tab-xtream'),
            ...(state.setupTab === 'm3u'
                ? [$('m3u-url')]
                : [$('xtream-server'), $('xtream-user'), $('xtream-pass')]),
            $('btn-connect')
        ].filter(Boolean);

        const cur = UI.getFocused();
        const idx = cur ? focusables.indexOf(cur) : 0;

        if (k === Keys.DOWN || k === Keys.TAB) {
            e.preventDefault();
            const next = focusables[(idx + 1) % focusables.length];
            UI.setFocus(next);
            if (next.tagName === 'INPUT') { next.focus(); }
        } else if (k === Keys.UP) {
            e.preventDefault();
            const prev = focusables[(idx - 1 + focusables.length) % focusables.length];
            UI.setFocus(prev);
            if (prev.tagName === 'INPUT') { prev.focus(); }
        } else if (k === Keys.ENTER) {
            if (cur && cur.tagName === 'BUTTON') { cur.click(); }
        } else if (k === Keys.LEFT) {
            switchSetupTab('m3u');
            UI.setFocus($('tab-m3u'));
        } else if (k === Keys.RIGHT) {
            switchSetupTab('xtream');
            UI.setFocus($('tab-xtream'));
        }
    }

    /* Main screen keys */
    function handleMainKeys(k, e) {
        if (k === Keys.RIGHT && state.focus === 'sidebar') {
            focusChannels();
            e.preventDefault();
            return;
        }
        if (k === Keys.LEFT && state.focus === 'channels') {
            focusSidebar();
            e.preventDefault();
            return;
        }

        if (state.focus === 'sidebar') {
            const catList = $('category-list');
            if (UI.navigateList(catList, k)) { e.preventDefault(); return; }
            if (k === Keys.ENTER) {
                const cur = UI.getFocused();
                if (cur && cur.dataset.group) selectCategory(cur.dataset.group);
            }
        }

        if (state.focus === 'channels') {
            const chanList = $('channel-list');
            if (UI.navigateList(chanList, k)) { e.preventDefault(); return; }
            if (k === Keys.ENTER) {
                const cur = UI.getFocused();
                if (cur && cur.dataset.idx !== undefined) {
                    playChannelByIndex(parseInt(cur.dataset.idx, 10));
                }
            }
            if (k === Keys.GREEN) {
                const cur = UI.getFocused();
                if (cur) toggleFavorite(parseInt(cur.dataset.idx, 10));
            }
        }

        if (k === Keys.BACK) {
            /* If search active, clear it */
            if (state.searchQuery) {
                handleSearch('');
                $('search-input').value = '';
            }
        }

        if (k === Keys.SEARCH) {
            $('search-input').focus();
        }

        if (k === Keys.MENU) {
            UI.showScreen('settings');
            state.focus = 'settings';
            UI.setFocus($('settings-back'));
            _updateSleepStatus();
        }

        if (k === Keys.YELLOW) {
            openEPGScreen();
        }
    }

    /* Player screen keys */
    function handlePlayerKeys(k, e) {
        e.preventDefault();

        if (state.playerSidebarOpen) {
            handlePlayerSidebarKeys(k);
            return;
        }

        // Number keys 0-9: accumulate into numBuffer
        if (k >= Keys.NUM_0 && k <= Keys.NUM_9) {
            const digit = k - Keys.NUM_0;
            handleNumericInput(String(digit));
            return;
        }

        // If digits buffered and ENTER pressed → navigate immediately
        if (k === Keys.ENTER && state.numBuffer.length > 0) {
            commitNumericInput();
            return;
        }

        switch (k) {
            case Keys.UP:
            case Keys.CH_UP:
                changeChannel(-1);
                break;
            case Keys.DOWN:
            case Keys.CH_DOWN:
                changeChannel(1);
                break;
            case Keys.LEFT:
                openPlayerSidebar();
                break;
            case Keys.ENTER:
            case Keys.INFO:
                UI.showOSD(state.activeChannel, state.activeIndex);
                break;
            case Keys.BACK:
                _handlePlayerBackWithMini(e);
                break;
            case Keys.GREEN:
                if (state.activeChannel) {
                    const idx = state.filteredChannels.findIndex(
                        ch => ch.url === state.activeChannel.url);
                    if (idx !== -1) toggleFavorite(idx);
                }
                break;
            case Keys.YELLOW:
                openEPGScreen();
                break;
            case Keys.RED:
                if (typeof Tracks !== 'undefined') {
                    Tracks.showTrackModal('audio', () => { state.focus = 'player'; });
                }
                break;
            case Keys.BLUE:
                if (typeof Tracks !== 'undefined') {
                    Tracks.showTrackModal('subtitle', () => { state.focus = 'player'; });
                }
                break;
            case Keys.CAPTION:
                if (typeof Tracks !== 'undefined') {
                    Tracks.showTrackModal('subtitle', () => { state.focus = 'player'; });
                }
                break;
            case Keys.MENU:
                if (typeof AspectRatio !== 'undefined') {
                    const ar = AspectRatio.cycle();
                    if (typeof UI !== 'undefined') UI.showToast(`Aspecto: ${ar.label}`);
                }
                break;
        }
    }

    /* Numeric channel input */
    function handleNumericInput(digit) {
        // Clear previous timer
        if (state.numTimer) {
            clearTimeout(state.numTimer);
            state.numTimer = null;
        }

        state.numBuffer += digit;

        // Show / update indicator overlay
        const indicator = $('channel-number-indicator');
        if (indicator) {
            indicator.textContent = state.numBuffer;
            indicator.classList.add('show');
        }

        // Set 2s timer to auto-navigate
        state.numTimer = setTimeout(() => {
            commitNumericInput();
        }, 2000);
    }

    function commitNumericInput() {
        if (state.numTimer) {
            clearTimeout(state.numTimer);
            state.numTimer = null;
        }

        const num = parseInt(state.numBuffer, 10);
        state.numBuffer = '';

        // Hide indicator
        const indicator = $('channel-number-indicator');
        if (indicator) indicator.classList.remove('show');

        if (isNaN(num) || num < 1) return;

        const targetIdx = num - 1; // channel numbers are 1-based
        if (targetIdx >= 0 && targetIdx < state.filteredChannels.length) {
            playChannelByIndex(targetIdx);
        } else {
            UI.showToast('Canal ' + num + ' no encontrado', 2000);
        }
    }

    function handlePlayerSidebarKeys(k) {
        const psList = $('ps-list');
        if (UI.navigateList(psList, k)) return;

        if (k === Keys.ENTER) {
            const cur = UI.getFocused();
            if (cur && cur.dataset.idx !== undefined) {
                playChannelByIndex(parseInt(cur.dataset.idx, 10));
                closePlayerSidebar();
            }
        }
        if (k === Keys.BACK || k === Keys.RIGHT) {
            closePlayerSidebar();
        }
    }

    /* ── EPG Screen ──────────────────────────────────── */
    function openEPGScreen() {
        state.epgDate = new Date();
        state.focus   = 'epg';
        UI.showScreen('epg');
        initEPGScreen();
    }

    function initEPGScreen() {
        // Bind back button
        const backBtn = $('epg-back');
        if (backBtn && !backBtn._bound) {
            backBtn._bound = true;
            backBtn.addEventListener('click', closeEPGScreen);
        }

        // Bind date nav buttons
        const prevBtn = $('epg-prev-day');
        if (prevBtn && !prevBtn._bound) {
            prevBtn._bound = true;
            prevBtn.addEventListener('click', () => {
                state.epgDate.setDate(state.epgDate.getDate() - 1);
                renderEPGGrid();
            });
        }
        const nextBtn = $('epg-next-day');
        if (nextBtn && !nextBtn._bound) {
            nextBtn._bound = true;
            nextBtn.addEventListener('click', () => {
                state.epgDate.setDate(state.epgDate.getDate() + 1);
                renderEPGGrid();
            });
        }

        // Set up EPGGrid select callback
        EPGGrid.onSelect = (channelId, program, channel) => {
            // Find channel and play it
            if (channel) {
                const idx = state.filteredChannels.findIndex(
                    ch => ch.url === channel.url);
                if (idx !== -1) {
                    playChannelByIndex(idx);
                }
            }
        };

        renderEPGGrid();
    }

    function renderEPGGrid() {
        // Update date label
        const dateEl = $('epg-current-date');
        if (dateEl) {
            dateEl.textContent = state.epgDate.toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
        }

        // Render grid with current channels and EPG data
        const epgData = EPG.getData();
        EPGGrid.render('epg-grid-wrap', state.filteredChannels, epgData || { channels: {}, programs: {} });
    }

    function closeEPGScreen() {
        EPGGrid.destroy();
        UI.showScreen('main');
        state.focus = 'channels';
        focusChannels();
    }

    function handleEPGKeys(k, e) {
        e.preventDefault();
        switch (k) {
            case Keys.UP:
                EPGGrid.navigateUp();
                break;
            case Keys.DOWN:
                EPGGrid.navigateDown();
                break;
            case Keys.LEFT:
                EPGGrid.navigateLeft();
                break;
            case Keys.RIGHT:
                EPGGrid.navigateRight();
                break;
            case Keys.ENTER:
                EPGGrid.selectCurrent();
                break;
            case Keys.BACK:
                closeEPGScreen();
                break;
        }
    }

    /* Settings screen keys */
    function handleSettingsKeys(k, e) {
        const settingsBtns = document.querySelectorAll('.settings-btn, .back-btn');
        const arr = Array.from(settingsBtns);
        const cur = UI.getFocused();
        const idx = cur ? arr.indexOf(cur) : 0;

        if (k === Keys.DOWN) {
            e.preventDefault();
            UI.setFocus(arr[(idx + 1) % arr.length]);
        } else if (k === Keys.UP) {
            e.preventDefault();
            UI.setFocus(arr[(idx - 1 + arr.length) % arr.length]);
        } else if (k === Keys.ENTER) {
            if (cur && cur.tagName === 'BUTTON') cur.click();
        } else if (k === Keys.BACK) {
            UI.showScreen('main');
            state.focus = 'sidebar';
            focusSidebar();
        }
    }

    /* ══════════════════════════════════════════════════
       FAVORITES SCREEN
    ══════════════════════════════════════════════════ */
    let _favFolder   = 'all';
    let _favViewMode = 'grid';

    function openFavoritesScreen() {
        UI.showScreen('favorites');
        state.focus = 'favorites';
        _renderFavoritesScreen();
        $('fav-back').onclick = () => { UI.showScreen('main'); state.focus = 'sidebar'; focusSidebar(); };
        $('fav-view-list').onclick  = () => { _favViewMode = 'list';  _renderFavoritesScreen(); };
        $('fav-view-grid').onclick  = () => { _favViewMode = 'grid';  _renderFavoritesScreen(); };
        $('fav-view-list').classList.toggle('active', _favViewMode === 'list');
        $('fav-view-grid').classList.toggle('active', _favViewMode === 'grid');
    }

    function _renderFavoritesScreen() {
        const all   = Favorites.getAll();
        $('fav-count').textContent = all.length;
        Favorites.renderFolderSidebar($('fav-folders'), _favFolder, folderId => {
            _favFolder = folderId;
            _renderFavoritesChannels();
        });
        _renderFavoritesChannels();
    }

    function _renderFavoritesChannels() {
        const container = $('fav-channel-container');
        Favorites.renderChannelList(container, _favFolder, _favViewMode,
            state.activeChannel ? state.activeChannel.url : '',
            ch => { playChannelByUrl(ch.url); },
            (ch, idx, el) => Favorites.showContextMenu(ch, idx, el, _favFolder, {
                onPlay:    c => playChannelByUrl(c.url),
                onRefresh: _renderFavoritesScreen
            })
        );
    }

    /* ══════════════════════════════════════════════════
       HISTORY SCREEN
    ══════════════════════════════════════════════════ */
    let _histFilter = 'all';

    function openHistoryScreen() {
        UI.showScreen('history');
        state.focus = 'history';
        _renderHistoryScreen();
        $('hist-back').onclick = () => { UI.showScreen('main'); state.focus = 'sidebar'; focusSidebar(); };
        $('hist-clear').onclick = () => {
            History.clearAll();
            _renderHistoryScreen();
            UI.showToast('Historial eliminado');
        };
        document.querySelectorAll('.hist-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _histFilter = btn.dataset.filter;
                document.querySelectorAll('.hist-filter-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.filter === _histFilter));
                _renderHistoryScreen();
            });
        });
    }

    function _renderHistoryScreen() {
        History.renderHistoryScreen('hist-body', _histFilter, item => {
            if (item.type === 'live') {
                const idx = state.allChannels.findIndex(ch => ch.url === item.url);
                if (idx !== -1) playChannelByIndex(idx);
            }
        });
        History.renderStatsSection('hist-stats');
    }

    /* ══════════════════════════════════════════════════
       MINI PLAYER integration
    ══════════════════════════════════════════════════ */
    function initMiniPlayer() {
        MiniPlayer.onExpand(ch => {
            /* Expand mini player back to full screen */
            if (ch) {
                MiniPlayer.hide();
                Player.play(ch);
                UI.showScreen('player');
                state.focus = 'player';
                state.activeChannel = ch;
                UI.showOSD(ch, 0);
            }
        });
        MiniPlayer.onClose(() => {
            UI.showToast('Mini reproductor cerrado');
        });
    }

    /* ══════════════════════════════════════════════════
       NAV TABS
    ══════════════════════════════════════════════════ */
    function initNavTabs() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const screen = btn.dataset.screen;
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                switch (screen) {
                    case 'channels':  UI.showScreen('main'); focusSidebar(); break;
                    case 'epg':       openEPGScreen();       break;
                    case 'favorites': openFavoritesScreen(); break;
                    case 'history':   openHistoryScreen();   break;
                }
            });
        });
    }

    /* Update handleKey to cover new screens */
    function _handleNewScreenKeys(screen, k, e) {
        if (screen === 'favorites' || screen === 'history') {
            if (k === Keys.BACK) {
                e.preventDefault();
                UI.showScreen('main');
                state.focus = 'sidebar';
                focusSidebar();
            }
            /* Mini player toggle with INFO key */
            if (k === Keys.INFO && MiniPlayer.isVisible()) {
                MiniPlayer.toggleFocus();
            }
            if (MiniPlayer.isFocused()) {
                MiniPlayer.handleKey(k);
            }
        }
    }

    /* Override BACK in player to show mini player instead of closing */
    function _handlePlayerBackWithMini(e) {
        e.preventDefault();
        if (state.activeChannel) {
            /* Shrink to mini player */
            MiniPlayer.setChannelList(state.filteredChannels, state.activeIndex);
            MiniPlayer.show(state.activeChannel);
            /* Keep AVPlay running; only switch to HTML5 for mini */
            UI.showScreen('main');
            state.focus = 'sidebar';
            focusSidebar();
        } else {
            Player.stop();
            UI.showScreen('main');
            state.focus = 'sidebar';
            focusSidebar();
        }
    }

    /* ── Utility ────────────────────────────────────── */
    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ── Initialize ─────────────────────────────────── */
    function init() {
        initPlayerListener();
        initSettings();
        initMiniPlayer();
        initNavTabs();
        boot();
    }

    return { init };
})();

/* Start the app when DOM is ready */
document.addEventListener('DOMContentLoaded', () => App.init());
