/* ══════════════════════════════════════════════════
   Series Manager — TV Series via Xtream API
══════════════════════════════════════════════════ */
const Series = (() => {

    let _server     = '';
    let _user       = '';
    let _pass       = '';
    let _categories = [];
    let _series     = [];
    let _countdownTimer = null;

    function setCredentials(server, user, pass) {
        _server = server.replace(/\/$/, '');
        _user   = user;
        _pass   = pass;
    }

    async function _api(action, extra = '') {
        const url = `${_server}/player_api.php?username=${encodeURIComponent(_user)}&password=${encodeURIComponent(_pass)}&action=${action}${extra}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'IPTV-Samsung/1.0' }, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function loadCategories() {
        const data = await _api('get_series_categories');
        _categories = Array.isArray(data) ? data : [];
        return _categories;
    }

    async function loadSeries(categoryId = null) {
        const extra = categoryId ? `&category_id=${categoryId}` : '';
        const data  = await _api('get_series', extra);
        const raw   = Array.isArray(data) ? data : [];

        _series = raw.map(s => ({
            id:           String(s.series_id),
            name:         s.name || 'Sin título',
            poster:       s.cover || '',
            backdrop:     s.backdrop_path || [],
            rating:       s.rating || '',
            year:         s.year || '',
            genre:        s.genre || '',
            desc:         s.plot || '',
            cast:         s.cast || '',
            categoryId:   String(s.category_id),
        }));
        return _series;
    }

    async function getSeriesInfo(seriesId) {
        const data = await _api('get_series_info', `&series_id=${seriesId}`);
        if (!data || !data.episodes) return null;

        /* episodes: { "1": [ {...ep...}, ...], "2": [...] } keyed by season number */
        const seasons = {};
        Object.entries(data.episodes).forEach(([seasonNum, eps]) => {
            seasons[seasonNum] = eps.map(ep => ({
                id:           String(ep.id),
                episodeNum:   ep.episode_num,
                seasonNum:    ep.season,
                title:        ep.title || `Episodio ${ep.episode_num}`,
                duration:     ep.info ? ep.info.duration : '',
                plot:         ep.info ? ep.info.plot : '',
                thumb:        ep.info ? (ep.info.movie_image || '') : '',
                containerExt: ep.container_extension || 'mkv',
                url:          buildEpisodeUrl(ep.id, ep.container_extension || 'mkv'),
            }));
        });

        return {
            info:    data.info    || {},
            seasons: seasons,
        };
    }

    function buildEpisodeUrl(episodeId, ext = 'mkv') {
        return `${_server}/series/${encodeURIComponent(_user)}/${encodeURIComponent(_pass)}/${episodeId}.${ext}`;
    }

    /* ── Data access ─────────────────────────────── */
    function getCategories() { return _categories; }

    function getSeriesList(categoryId = null, searchQuery = '') {
        let list = _series;
        if (categoryId && categoryId !== '__all__') {
            list = list.filter(s => s.categoryId === categoryId);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(s => s.name.toLowerCase().includes(q));
        }
        return list;
    }

    function hasCredentials() { return !!(_server && _user && _pass); }

    /* ── Progress tracking ───────────────────────── */
    function saveEpisodePosition(episodeId, position, duration) {
        Storage.setSetting(`ep_pos_${episodeId}`, { position, duration, ts: Date.now() });
    }

    function getEpisodePosition(episodeId) {
        return Storage.getSetting(`ep_pos_${episodeId}`);
    }

    function getEpisodeProgressPct(episodeId) {
        const pos = getEpisodePosition(episodeId);
        if (!pos || !pos.duration) return 0;
        return Math.round((pos.position / pos.duration) * 100);
    }

    /* ── "Next episode" auto-play ────────────────── */
    function startNextEpisodeCountdown(nextEp, onPlay, onCancel) {
        const overlayEl  = document.getElementById('next-episode-overlay');
        const titleEl    = document.getElementById('next-ep-title');
        const countEl    = document.getElementById('next-ep-countdown');
        const barFillEl  = document.getElementById('next-ep-bar-fill');

        if (!overlayEl) return;

        titleEl.textContent = `${nextEp.title}`;
        overlayEl.classList.add('show');

        let seconds = 10;
        countEl.textContent = `Reproduciendo en ${seconds}s...`;
        barFillEl.style.width = '100%';

        _countdownTimer = setInterval(() => {
            seconds--;
            countEl.textContent = `Reproduciendo en ${seconds}s...`;
            barFillEl.style.width = `${(seconds / 10) * 100}%`;
            if (seconds <= 0) {
                stopCountdown();
                onPlay(nextEp);
            }
        }, 1000);

        overlayEl.querySelector('#next-ep-play').addEventListener('click', () => {
            stopCountdown(); onPlay(nextEp);
        }, { once: true });
        overlayEl.querySelector('#next-ep-cancel').addEventListener('click', () => {
            stopCountdown(); onCancel();
        }, { once: true });
    }

    function stopCountdown() {
        clearInterval(_countdownTimer);
        const el = document.getElementById('next-episode-overlay');
        if (el) el.classList.remove('show');
    }

    /* ── UI rendering ────────────────────────────── */
    function renderGrid(gridEl, seriesList, onSelect) {
        gridEl.innerHTML = '';
        if (!seriesList.length) {
            gridEl.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <div class="empty-icon">📂</div>
                    <p>No hay series disponibles</p>
                </div>`;
            return;
        }

        seriesList.forEach((s, i) => {
            const card = document.createElement('div');
            card.className   = 'series-card';
            card.dataset.id  = s.id;
            card.dataset.idx = i;
            card.tabIndex    = 0;
            card.innerHTML   = `
                ${s.poster
                    ? `<img class="series-poster" src="${s.poster}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\"series-poster-ph\\">📂</div>'">`
                    : '<div class="series-poster-ph">📂</div>'}
                <div class="series-card-info">
                    <div class="series-card-title">${s.name}</div>
                    <div class="series-card-meta">
                        ${s.year || ''}
                        ${s.rating ? ` · ★ ${s.rating}` : ''}
                    </div>
                </div>`;
            card.addEventListener('click', () => onSelect(s));
            gridEl.appendChild(card);
        });
    }

    function renderDetail(series, infoData, containerEl, onPlayEpisode, onBack) {
        const seasons      = infoData ? infoData.seasons : {};
        const seasonNums   = Object.keys(seasons).sort((a,b) => parseInt(a)-parseInt(b));
        let activeSeason   = seasonNums[0] || '1';

        function buildEpisodeList(seasonNum) {
            const eps  = seasons[seasonNum] || [];
            return eps.map((ep, i) => {
                const pct = getEpisodeProgressPct(ep.id);
                return `
                    <li class="episode-item" data-url="${ep.url}" data-ep-idx="${i}" tabindex="0">
                        <div class="ep-num">E${ep.episodeNum}</div>
                        ${ep.thumb
                            ? `<img class="ep-thumb" src="${ep.thumb}" alt="" onerror="this.outerHTML='<div class=\\"ep-thumb-ph\\">▶</div>'">`
                            : '<div class="ep-thumb-ph">▶</div>'}
                        <div class="ep-info">
                            <div class="ep-title">${ep.title}</div>
                            <div class="ep-meta">${ep.duration || ''}</div>
                        </div>
                        ${pct > 0 ? `
                        <div class="ep-progress-wrap">
                            <div class="ep-progress-bar">
                                <div class="ep-progress-fill" style="width:${pct}%"></div>
                            </div>
                            <div class="ep-progress-pct">${pct}%</div>
                        </div>` : ''}
                    </li>`;
            }).join('');
        }

        containerEl.innerHTML = `
            <div class="series-detail-body">
                <div class="series-detail-left">
                    ${series.poster
                        ? `<img class="series-detail-poster" src="${series.poster}" alt="" onerror="this.outerHTML='<div class=\\"series-detail-poster-ph\\">📂</div>'">`
                        : '<div class="series-detail-poster-ph">📂</div>'}
                    <div class="series-detail-title">${series.name}</div>
                    <div class="series-detail-badges">
                        ${series.year   ? `<span class="vod-badge">📅 ${series.year}</span>` : ''}
                        ${series.genre  ? `<span class="vod-badge">🎭 ${series.genre}</span>` : ''}
                        ${series.rating ? `<span class="vod-badge rating">★ ${series.rating}</span>` : ''}
                    </div>
                    ${series.desc ? `<div class="series-detail-desc">${series.desc}</div>` : ''}
                </div>
                <div class="series-detail-right">
                    <div class="season-tabs" id="season-tabs">
                        ${seasonNums.map(n => `
                            <button class="season-tab ${n === activeSeason ? 'active' : ''}" data-season="${n}" tabindex="0">
                                Temporada ${n}
                            </button>`).join('')}
                    </div>
                    <ul class="episode-list" id="episode-list">
                        ${buildEpisodeList(activeSeason)}
                    </ul>
                </div>
            </div>`;

        /* Season tab switching */
        containerEl.querySelectorAll('.season-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activeSeason = tab.dataset.season;
                containerEl.querySelectorAll('.season-tab').forEach(t =>
                    t.classList.toggle('active', t.dataset.season === activeSeason));
                const epList = containerEl.querySelector('#episode-list');
                epList.innerHTML = buildEpisodeList(activeSeason);
                bindEpisodeClicks(epList, seasons[activeSeason], onPlayEpisode);
            });
        });

        const epList = containerEl.querySelector('#episode-list');
        bindEpisodeClicks(epList, seasons[activeSeason], onPlayEpisode);
    }

    function bindEpisodeClicks(listEl, episodes, onPlay) {
        if (!episodes) return;
        listEl.querySelectorAll('li').forEach((li, i) => {
            li.addEventListener('click', () => {
                const ep = episodes[i];
                const pos = getEpisodePosition(ep.id);
                onPlay(ep, i, pos);
            });
        });
    }

    return {
        setCredentials, hasCredentials,
        loadCategories, loadSeries, getSeriesInfo, buildEpisodeUrl,
        getCategories, getSeriesList,
        saveEpisodePosition, getEpisodePosition, getEpisodeProgressPct,
        startNextEpisodeCountdown, stopCountdown,
        renderGrid, renderDetail,
    };
})();
