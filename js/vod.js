/* ══════════════════════════════════════════════════
   VOD Manager — Movies via Xtream API + M3U VOD
══════════════════════════════════════════════════ */
const VOD = (() => {

    let _server = '';
    let _user   = '';
    let _pass   = '';
    let _categories = [];
    let _movies     = [];
    let _activeCategory = '__all__';

    /* ── Setup ───────────────────────────────────── */
    function setCredentials(server, user, pass) {
        _server = server.replace(/\/$/, '');
        _user   = user;
        _pass   = pass;
    }

    function setFromXtream(xtreamCreds) {
        setCredentials(xtreamCreds.server, xtreamCreds.user, xtreamCreds.pass);
    }

    /* ── Xtream API calls ────────────────────────── */
    async function _api(action, extra = '') {
        const url = `${_server}/player_api.php?username=${encodeURIComponent(_user)}&password=${encodeURIComponent(_pass)}&action=${action}${extra}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'IPTV-Samsung/1.0' }, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function loadCategories() {
        const data = await _api('get_vod_categories');
        _categories = Array.isArray(data) ? data : [];
        return _categories;
    }

    async function loadMovies(categoryId = null) {
        const extra = categoryId ? `&category_id=${categoryId}` : '';
        const data  = await _api('get_vod_streams', extra);
        const raw   = Array.isArray(data) ? data : [];

        _movies = raw.map(m => ({
            id:           String(m.stream_id),
            name:         m.name || 'Sin título',
            poster:       m.stream_icon || m.cover || '',
            rating:       m.rating || m.rating_5based || '',
            year:         m.year || '',
            genre:        m.genre || '',
            duration:     m.duration || '',
            categoryId:   String(m.category_id),
            categoryName: m.category_name || '',
            added:        m.added || '',
            containerExt: m.container_extension || 'mp4',
        }));
        return _movies;
    }

    async function getMovieInfo(vodId) {
        try {
            const data = await _api('get_vod_info', `&vod_id=${vodId}`);
            return data && data.info ? data.info : null;
        } catch (_) { return null; }
    }

    function buildStreamUrl(movie) {
        return `${_server}/movie/${encodeURIComponent(_user)}/${encodeURIComponent(_pass)}/${movie.id}.${movie.containerExt}`;
    }

    /* ── M3U VOD parsing (movies in M3U marked with group) ── */
    function extractFromM3U(allChannels) {
        /* Convention: channels with group containing "VOD", "Movie", "Pelicula" */
        const vodKeywords = /vod|movie|pelicul|film|cine/i;
        return allChannels.filter(ch => ch.group && vodKeywords.test(ch.group));
    }

    /* ── Data access ─────────────────────────────── */
    function getCategories() { return _categories; }

    function getMovies(categoryId = null, searchQuery = '') {
        let list = _movies;
        if (categoryId && categoryId !== '__all__') {
            list = list.filter(m => m.categoryId === categoryId);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(m => m.name.toLowerCase().includes(q));
        }
        return list;
    }

    function hasCredentials() { return !!(  _server && _user && _pass); }

    /* ── Seek position helpers ───────────────────── */
    function savePosition(movieId, position, duration) {
        Storage.setSetting(`vod_pos_${movieId}`, { position, duration, ts: Date.now() });
    }

    function getPosition(movieId) {
        return Storage.getSetting(`vod_pos_${movieId}`);
    }

    /* ── UI rendering ────────────────────────────── */
    function renderGrid(gridEl, movies, activeUrl, onPlay, onDetail) {
        gridEl.innerHTML = '';

        if (!movies.length) {
            gridEl.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1">
                    <div class="empty-icon">🎬</div>
                    <p>No hay películas disponibles</p>
                </div>`;
            return;
        }

        movies.forEach((m, i) => {
            const pos = getPosition(m.id);
            const pct = pos && pos.duration ? Math.round((pos.position / pos.duration) * 100) : 0;

            const card = document.createElement('div');
            card.className  = 'vod-card';
            card.dataset.id = m.id;
            card.dataset.idx = i;
            card.tabIndex   = 0;
            card.innerHTML  = `
                ${m.poster
                    ? `<img class="vod-poster" src="${m.poster}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\"vod-poster-placeholder\\">🎬</div>'">`
                    : '<div class="vod-poster-placeholder">🎬</div>'}
                <div class="vod-card-info">
                    <div class="vod-card-title">${m.name}</div>
                    <div class="vod-card-meta">
                        ${m.year ? `<span>${m.year}</span>` : ''}
                        ${m.rating ? `<span class="vod-card-rating">★ ${m.rating}</span>` : ''}
                    </div>
                </div>
                ${pct > 0 ? `<div class="vod-card-progress"><div class="vod-card-progress-fill" style="width:${pct}%"></div></div>` : ''}`;

            card.addEventListener('click', () => onDetail(m));
            card.addEventListener('dblclick', () => onPlay(m));
            gridEl.appendChild(card);
        });
    }

    function renderDetail(movie, info, containerEl, onPlay, onBack) {
        const pos = getPosition(movie.id);
        const pct = pos && pos.duration ? Math.round((pos.position / pos.duration) * 100) : 0;
        const streamUrl = buildStreamUrl(movie);

        containerEl.innerHTML = `
            <div class="vod-detail-body">
                <div class="vod-detail-poster-wrap">
                    ${movie.poster
                        ? `<img class="vod-detail-poster" src="${movie.poster}" alt="" onerror="this.outerHTML='<div class=\\"vod-detail-poster-ph\\">🎬</div>'">`
                        : '<div class="vod-detail-poster-ph">🎬</div>'}
                </div>
                <div class="vod-detail-info">
                    <div class="vod-detail-title">${movie.name}</div>
                    <div class="vod-detail-badges">
                        ${movie.year ? `<span class="vod-badge">📅 ${movie.year}</span>` : ''}
                        ${movie.duration ? `<span class="vod-badge">⏱ ${movie.duration}</span>` : ''}
                        ${movie.genre ? `<span class="vod-badge">🎭 ${movie.genre}</span>` : ''}
                        ${movie.rating ? `<span class="vod-badge rating">★ ${movie.rating}</span>` : ''}
                    </div>
                    ${info && info.plot ? `<div class="vod-detail-desc">${info.plot}</div>` : ''}
                    ${info && info.cast ? `<div class="vod-detail-cast">🎬 ${info.cast}</div>` : ''}
                    ${pct > 0 ? `
                    <div class="vod-detail-progress">
                        <div class="vod-detail-progress-bar">
                            <div class="vod-detail-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="vod-detail-progress-text">Visto: ${pct}%</div>
                    </div>` : ''}
                    <div class="vod-detail-actions">
                        ${pct > 0
                            ? `<button class="vod-action-btn primary" id="vod-btn-resume">▶ Continuar (${pct}%)</button>`
                            : `<button class="vod-action-btn primary" id="vod-btn-play">▶ Reproducir</button>`}
                        ${pct > 0 ? `<button class="vod-action-btn secondary" id="vod-btn-restart">↩ Desde el inicio</button>` : ''}
                    </div>
                </div>
            </div>`;

        /* Bind buttons */
        const resumeBtn  = containerEl.querySelector('#vod-btn-resume');
        const playBtn    = containerEl.querySelector('#vod-btn-play');
        const restartBtn = containerEl.querySelector('#vod-btn-restart');

        const startMs = pos && resumeBtn ? pos.position * 1000 : 0;
        if (resumeBtn)  resumeBtn.addEventListener('click',  () => onPlay({ ...movie, url: streamUrl, startAt: startMs }));
        if (playBtn)    playBtn.addEventListener('click',    () => onPlay({ ...movie, url: streamUrl, startAt: 0 }));
        if (restartBtn) restartBtn.addEventListener('click', () => onPlay({ ...movie, url: streamUrl, startAt: 0 }));
    }

    return {
        setCredentials, setFromXtream, hasCredentials,
        loadCategories, loadMovies, getMovieInfo, buildStreamUrl,
        getCategories, getMovies, extractFromM3U,
        savePosition, getPosition,
        renderGrid, renderDetail,
    };
})();
