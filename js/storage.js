/* Persistent storage wrapper (localStorage) */
const Storage = (() => {
    const PREFIX = 'iptv_';

    function get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch (_) { return fallback; }
    }

    function set(key, value) {
        try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); }
        catch (_) {}
    }

    function remove(key) {
        try { localStorage.removeItem(PREFIX + key); }
        catch (_) {}
    }

    function clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith(PREFIX))
            .forEach(k => localStorage.removeItem(k));
    }

    return {
        /* Credentials */
        saveCredentials(type, data) { set('creds', { type, data }); },
        getCredentials()            { return get('creds'); },
        clearCredentials()          { remove('creds'); },

        /* Cached channel list */
        saveChannels(channels)  { set('channels', channels); },
        getChannels()           { return get('channels', []); },
        clearChannels()         { remove('channels'); },

        /* Favorites */
        getFavorites()            { return get('favorites', []); },
        saveFavorite(channel) {
            const favs = this.getFavorites();
            if (!favs.find(f => f.url === channel.url)) {
                favs.push(channel);
                set('favorites', favs);
            }
        },
        removeFavorite(channel) {
            const favs = this.getFavorites().filter(f => f.url !== channel.url);
            set('favorites', favs);
        },
        isFavorite(channel) {
            return this.getFavorites().some(f => f.url === channel.url);
        },
        clearFavorites() { remove('favorites'); },

        /* Last played */
        saveLastChannel(channel) { set('last_channel', channel); },
        getLastChannel()         { return get('last_channel'); },

        /* Recent history (last 30) */
        addRecent(channel) {
            let recent = get('recent', []);
            recent = recent.filter(r => r.url !== channel.url);
            recent.unshift(channel);
            if (recent.length > 30) recent.pop();
            set('recent', recent);
        },
        getRecent() { return get('recent', []); },

        /* EPG URL */
        saveEpgUrl(url) { set('epg_url', url); },
        getEpgUrl()     { return get('epg_url', ''); },

        /* App settings */
        getSetting(key, fallback = null) { return get('setting_' + key, fallback); },
        setSetting(key, value)           { set('setting_' + key, value); },

        /* Full clear */
        clearAll: clear
    };
})();
