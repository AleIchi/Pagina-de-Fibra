/* Xtream Codes API client */
const Xtream = (() => {
    let _server = '';
    let _user   = '';
    let _pass   = '';

    function buildUrl(action, extra = '') {
        const base = _server.replace(/\/$/, '');
        return `${base}/player_api.php?username=${encodeURIComponent(_user)}&password=${encodeURIComponent(_pass)}&action=${action}${extra}`;
    }

    async function apiFetch(url) {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'IPTV-Samsung/1.0' },
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    async function login(server, user, pass) {
        _server = server;
        _user   = user;
        _pass   = pass;

        const data = await apiFetch(buildUrl('get_account_info')
            .replace('&action=get_account_info', ''));

        if (!data || !data.user_info) {
            throw new Error('Credenciales incorrectas');
        }

        if (data.user_info.auth === 0) {
            throw new Error('Acceso denegado por el servidor');
        }

        return data.user_info;
    }

    async function getLiveCategories() {
        const data = await apiFetch(buildUrl('get_live_categories'));
        return Array.isArray(data) ? data : [];
    }

    async function getLiveStreams(categoryId = null) {
        const extra  = categoryId ? `&category_id=${categoryId}` : '';
        const data   = await apiFetch(buildUrl('get_live_streams', extra));
        const raw    = Array.isArray(data) ? data : [];

        return raw.map(ch => ({
            name:       ch.name || 'Sin nombre',
            logo:       ch.stream_icon || '',
            group:      ch.category_name || ch.category_id || 'Sin grupo',
            id:         String(ch.stream_id),
            url:        buildStreamUrl(ch.stream_id),
            num:        ch.num,
            epgId:      ch.epg_channel_id,
        }));
    }

    function buildStreamUrl(streamId, ext = 'm3u8') {
        const base = _server.replace(/\/$/, '');
        return `${base}/live/${encodeURIComponent(_user)}/${encodeURIComponent(_pass)}/${streamId}.${ext}`;
    }

    /* Fetches categories then all channels mapped with category names */
    async function getAllChannels() {
        const [categories, streams] = await Promise.all([
            getLiveCategories(),
            getLiveStreams()
        ]);

        const catMap = {};
        categories.forEach(c => { catMap[c.category_id] = c.category_name; });

        return streams.map(ch => ({
            ...ch,
            group: catMap[ch.group] || ch.group || 'Sin grupo'
        }));
    }

    return { login, getLiveStreams, getAllChannels, getLiveCategories };
})();
