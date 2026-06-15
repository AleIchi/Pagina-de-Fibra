/* ══════════════════════════════════════════════════
   IPTV Samsung - EPG (Electronic Program Guide)
   XMLTV parser + localStorage cache with 6h TTL
══════════════════════════════════════════════════ */

const EPG = (() => {

    const CACHE_KEY = 'epg_cache';
    const TTL_MS    = 6 * 60 * 60 * 1000; // 6 hours

    /* ── Internal state ─────────────────────────── */
    let _data = null; // { channels, programs, fetchedAt }

    /* ── Cache helpers ──────────────────────────── */
    function _saveCache(data) {
        try {
            const entry = { data, fetchedAt: Date.now() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
        } catch (e) {
            console.warn('[EPG] Could not save cache:', e);
        }
    }

    function _loadCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (!entry || !entry.data || !entry.fetchedAt) return null;
            if (Date.now() - entry.fetchedAt > TTL_MS) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
            return entry.data;
        } catch (e) {
            return null;
        }
    }

    function clearCache() {
        localStorage.removeItem(CACHE_KEY);
        _data = null;
    }

    /* ── XMLTV timestamp parsing ────────────────── */
    // Format: "20240615143000 +0000"  or "20240615143000 +0200"
    function _parseTimestamp(raw) {
        if (!raw) return null;
        raw = raw.trim();

        // Extract date/time part and optional timezone offset
        const match = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
        if (!match) return null;

        const year   = parseInt(match[1], 10);
        const month  = parseInt(match[2], 10) - 1; // 0-indexed
        const day    = parseInt(match[3], 10);
        const hour   = parseInt(match[4], 10);
        const min    = parseInt(match[5], 10);
        const sec    = parseInt(match[6], 10);
        const tzStr  = match[7] || '+0000';

        // Compute offset in minutes
        const tzSign   = tzStr[0] === '-' ? -1 : 1;
        const tzHour   = parseInt(tzStr.slice(1, 3), 10);
        const tzMin    = parseInt(tzStr.slice(3, 5), 10);
        const offsetMs = tzSign * (tzHour * 60 + tzMin) * 60 * 1000;

        // Build UTC date
        const utcMs = Date.UTC(year, month, day, hour, min, sec) - offsetMs;
        return new Date(utcMs);
    }

    /* ── XMLTV XML parser ───────────────────────── */
    function _parseXMLTV(xmlText) {
        const channels = {}; // id -> { name, icon }
        const programs = {}; // channelId -> [{ title, start, stop, desc, icon }]

        let doc;
        try {
            const parser = new DOMParser();
            doc = parser.parseFromString(xmlText, 'application/xml');
        } catch (e) {
            throw new Error('Failed to parse XMLTV XML: ' + e.message);
        }

        // Check for parse error
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('XML parse error: ' + parseError.textContent.slice(0, 120));
        }

        // Parse <channel> elements
        doc.querySelectorAll('channel').forEach(ch => {
            const id   = ch.getAttribute('id');
            if (!id) return;
            const nameEl = ch.querySelector('display-name');
            const iconEl = ch.querySelector('icon');
            channels[id] = {
                name: nameEl ? nameEl.textContent.trim() : id,
                icon: iconEl ? (iconEl.getAttribute('src') || '') : ''
            };
        });

        // Parse <programme> elements
        doc.querySelectorAll('programme').forEach(prog => {
            const channelId = prog.getAttribute('channel');
            if (!channelId) return;

            const startRaw = prog.getAttribute('start');
            const stopRaw  = prog.getAttribute('stop');
            const start    = _parseTimestamp(startRaw);
            const stop     = _parseTimestamp(stopRaw);
            if (!start) return;

            const titleEl = prog.querySelector('title');
            const descEl  = prog.querySelector('desc');
            const iconEl  = prog.querySelector('icon');

            const entry = {
                title: titleEl ? titleEl.textContent.trim() : '',
                start,
                stop:  stop || null,
                desc:  descEl ? descEl.textContent.trim() : '',
                icon:  iconEl ? (iconEl.getAttribute('src') || '') : ''
            };

            if (!programs[channelId]) programs[channelId] = [];
            programs[channelId].push(entry);
        });

        // Sort programs by start time for each channel
        Object.keys(programs).forEach(id => {
            programs[id].sort((a, b) => a.start - b.start);
        });

        return { channels, programs };
    }

    /* ── Public API ─────────────────────────────── */

    /**
     * Fetch and parse an XMLTV EPG URL.
     * Returns { channels, programs } and caches result.
     */
    async function fetchAndParse(url) {
        // Check cache first
        const cached = _loadCache();
        if (cached) {
            _data = cached;
            return _data;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`EPG fetch failed: ${response.status} ${response.statusText}`);
        }
        const xmlText = await response.text();
        const parsed  = _parseXMLTV(xmlText);

        _data = { channels: parsed.channels, programs: parsed.programs, fetchedAt: Date.now() };
        _saveCache(_data);
        return _data;
    }

    /**
     * Load EPG data from cache (used when already fetched).
     */
    function loadFromCache() {
        if (_data) return _data;
        _data = _loadCache();
        return _data;
    }

    /**
     * Returns the program currently airing for the given channelId.
     */
    function getCurrentProgram(channelId) {
        const data = _data || _loadCache();
        if (!data) return null;
        const list = data.programs[channelId];
        if (!list || !list.length) return null;
        const now = Date.now();
        return list.find(p =>
            p.start && p.stop &&
            p.start.getTime() <= now &&
            p.stop.getTime() > now
        ) || null;
    }

    /**
     * Returns the next program after the current one for the given channelId.
     */
    function getNextProgram(channelId) {
        const data = _data || _loadCache();
        if (!data) return null;
        const list = data.programs[channelId];
        if (!list || !list.length) return null;
        const now = Date.now();
        return list.find(p => p.start && p.start.getTime() > now) || null;
    }

    /**
     * Returns all programs for a given channel on a specific date (Date object).
     */
    function getProgramsForChannel(channelId, date) {
        const data = _data || _loadCache();
        if (!data) return [];
        const list = data.programs[channelId];
        if (!list || !list.length) return [];

        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        return list.filter(p =>
            p.start &&
            p.start.getTime() <= dayEnd.getTime() &&
            (!p.stop || p.stop.getTime() >= dayStart.getTime())
        );
    }

    /**
     * Returns 0-100 percent of how far through the current program we are.
     */
    function getProgressPercent(program) {
        if (!program || !program.start || !program.stop) return 0;
        const now      = Date.now();
        const start    = program.start.getTime();
        const stop     = program.stop.getTime();
        const duration = stop - start;
        if (duration <= 0) return 0;
        const elapsed  = now - start;
        return Math.min(100, Math.max(0, (elapsed / duration) * 100));
    }

    /**
     * Returns the loaded EPG data object (or null if not loaded).
     */
    function getData() {
        return _data || _loadCache();
    }

    return {
        fetchAndParse,
        loadFromCache,
        getCurrentProgram,
        getNextProgram,
        getProgramsForChannel,
        getProgressPercent,
        getData,
        clearCache
    };

})();
