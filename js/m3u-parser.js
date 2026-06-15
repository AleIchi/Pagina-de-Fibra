/* M3U / M3U8 playlist parser */
const M3UParser = (() => {

    function parseM3U(text) {
        const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
        const channels = [];
        const groups   = new Set();
        let current    = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#EXTINF:')) {
                current = parseExtInf(line);
            } else if (current && !line.startsWith('#')) {
                current.url = line.trim();
                if (current.group) groups.add(current.group);
                channels.push(current);
                current = null;
            }
        }

        return {
            channels,
            groups: Array.from(groups).sort()
        };
    }

    function parseExtInf(line) {
        const channel = {
            name:  '',
            logo:  '',
            group: '',
            id:    '',
            url:   ''
        };

        /* Extract attributes */
        const attrStr = line.substring(8, line.lastIndexOf(','));
        const nameStr = line.substring(line.lastIndexOf(',') + 1).trim();

        channel.name  = nameStr || 'Canal sin nombre';
        channel.logo  = extractAttr(attrStr, 'tvg-logo');
        channel.group = extractAttr(attrStr, 'group-title') || 'Sin grupo';
        channel.id    = extractAttr(attrStr, 'tvg-id') || sanitizeName(nameStr);

        return channel;
    }

    function extractAttr(str, attr) {
        /* Matches: attr="value" or attr='value' */
        const re = new RegExp(`${attr}=["']([^"']*)["']`, 'i');
        const m  = str.match(re);
        return m ? m[1].trim() : '';
    }

    function sanitizeName(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    /* Fetch an M3U from a URL and parse it */
    async function fetchAndParse(url) {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'IPTV-Samsung/1.0' },
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
            throw new Error('El archivo no es una lista M3U válida');
        }
        return parseM3U(text);
    }

    return { parseM3U, fetchAndParse };
})();
