/* ══════════════════════════════════════════════════
   Favorites Manager — advanced favorites with folders
══════════════════════════════════════════════════ */
const Favorites = (() => {

    /* ── Data model ──────────────────────────────────
       folders: [ { id, name, channelUrls[] } ]
       favorites: [ { ...channel, folderId } ]
    ─────────────────────────────────────────────── */
    const DEFAULT_FOLDERS = [
        { id: 'all',     name: '⭐ Todos los favoritos' },
        { id: 'recent',  name: '🕐 Añadidos recientemente' },
    ];

    function getFolders() {
        const saved = Storage.getSetting('fav_folders', []);
        return [...DEFAULT_FOLDERS, ...saved];
    }

    function getUserFolders() {
        return Storage.getSetting('fav_folders', []);
    }

    function saveFolders(folders) {
        Storage.setSetting('fav_folders', folders);
    }

    function createFolder(name) {
        const folders = getUserFolders();
        const id = 'folder_' + Date.now();
        folders.push({ id, name, channelUrls: [] });
        saveFolders(folders);
        return id;
    }

    function deleteFolder(folderId) {
        let folders = getUserFolders().filter(f => f.id !== folderId);
        saveFolders(folders);
        /* Move channels from deleted folder to root (no folder) */
        const favs = getAll();
        favs.forEach(ch => { if (ch.folderId === folderId) ch.folderId = null; });
        Storage.saveFavorites(favs);
    }

    /* ── Favorites CRUD ──────────────────────────── */
    function getAll() {
        return Storage.getFavorites();
    }

    function getByFolder(folderId) {
        if (folderId === 'all')    return getAll();
        if (folderId === 'recent') return getAll().slice(0, 20);
        return getAll().filter(ch => ch.folderId === folderId);
    }

    function add(channel, folderId = null) {
        const favs = getAll();
        if (favs.find(f => f.url === channel.url)) {
            /* Already exists — just move folder if specified */
            if (folderId) moveToFolder(channel.url, folderId);
            return false;
        }
        favs.unshift({ ...channel, folderId, addedAt: Date.now() });
        Storage.saveFavorites(favs);

        /* If folderId given, also add url to folder's list */
        if (folderId) _addUrlToFolder(channel.url, folderId);
        return true;
    }

    function remove(channelUrl) {
        const favs = getAll().filter(f => f.url !== channelUrl);
        Storage.saveFavorites(favs);
    }

    function isFavorite(channel) {
        return getAll().some(f => f.url === channel.url);
    }

    function toggle(channel) {
        if (isFavorite(channel)) { remove(channel.url); return false; }
        add(channel);
        return true;
    }

    function moveToFolder(channelUrl, folderId) {
        const favs = getAll();
        const ch = favs.find(f => f.url === channelUrl);
        if (ch) {
            if (ch.folderId) _removeUrlFromFolder(channelUrl, ch.folderId);
            ch.folderId = folderId;
            Storage.saveFavorites(favs);
            _addUrlToFolder(channelUrl, folderId);
        }
    }

    /* Reorder: move item at fromIdx to toIdx */
    function reorder(fromIdx, toIdx) {
        const favs = getAll();
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= favs.length || toIdx >= favs.length) return;
        const [item] = favs.splice(fromIdx, 1);
        favs.splice(toIdx, 0, item);
        Storage.saveFavorites(favs);
    }

    /* ── Private ─────────────────────────────────── */
    function _addUrlToFolder(url, folderId) {
        const folders = getUserFolders();
        const f = folders.find(f => f.id === folderId);
        if (f) {
            if (!f.channelUrls) f.channelUrls = [];
            if (!f.channelUrls.includes(url)) f.channelUrls.push(url);
            saveFolders(folders);
        }
    }

    function _removeUrlFromFolder(url, folderId) {
        const folders = getUserFolders();
        const f = folders.find(f => f.id === folderId);
        if (f && f.channelUrls) {
            f.channelUrls = f.channelUrls.filter(u => u !== url);
            saveFolders(folders);
        }
    }

    /* ── UI rendering ────────────────────────────── */
    function renderFolderSidebar(listEl, activeFolderId, onSelect) {
        listEl.innerHTML = '';
        getFolders().forEach(folder => {
            const count = getByFolder(folder.id).length;
            const li    = document.createElement('li');
            li.className  = 'fav-folder-item' + (folder.id === activeFolderId ? ' active' : '');
            li.dataset.id = folder.id;
            li.tabIndex   = 0;
            li.innerHTML  = `
                <span>${folder.name}</span>
                <span class="fav-folder-count">${count}</span>`;
            li.addEventListener('click', () => onSelect(folder.id));
            listEl.appendChild(li);
        });

        /* Add "Nueva carpeta" at bottom */
        const newLi = document.createElement('li');
        newLi.className = 'fav-new-folder focusable';
        newLi.tabIndex  = 0;
        newLi.innerHTML = '<span>＋</span> Nueva carpeta';
        newLi.addEventListener('click', () => onNewFolder(listEl, activeFolderId, onSelect));
        listEl.appendChild(newLi);
    }

    function onNewFolder(listEl, activeFolderId, onSelect) {
        const name = prompt('Nombre de la carpeta:');
        if (name && name.trim()) {
            const id = createFolder(name.trim());
            renderFolderSidebar(listEl, activeFolderId, onSelect);
            onSelect(id);
        }
    }

    function renderChannelList(listEl, folderId, viewMode, activeUrl, onPlay, onContext) {
        const channels = getByFolder(folderId);
        listEl.innerHTML = '';

        if (!channels.length) {
            listEl.innerHTML = `
                <div class="fav-empty">
                    <div class="empty-star">★</div>
                    <p>No hay favoritos en esta carpeta.<br>
                    Presiona el botón ROJO en cualquier canal para añadirlo.</p>
                </div>`;
            return;
        }

        if (viewMode === 'grid') {
            listEl.className = 'fav-grid';
            channels.forEach((ch, i) => {
                const div = document.createElement('div');
                div.className  = 'fav-grid-item' + (ch.url === activeUrl ? ' playing' : '');
                div.dataset.url = ch.url;
                div.dataset.idx = i;
                div.tabIndex   = 0;
                div.innerHTML  = `
                    <span class="fav-grid-star">★</span>
                    ${ch.logo ? `<img class="fav-grid-logo" src="${ch.logo}" alt="" onerror="this.style.display='none'">` : ''}
                    <div class="fav-grid-name">${ch.name}</div>`;
                div.addEventListener('click',     () => onPlay(ch));
                div.addEventListener('contextmenu', e => { e.preventDefault(); onContext(ch, i, div); });
                listEl.appendChild(div);
            });
        } else {
            listEl.className = 'fav-list';
            channels.forEach((ch, i) => {
                const li = document.createElement('li');
                li.className   = 'channel-item' + (ch.url === activeUrl ? ' playing' : '');
                li.dataset.url = ch.url;
                li.dataset.idx = i;
                li.tabIndex    = 0;
                li.innerHTML   = `
                    <span class="channel-num">${i + 1}</span>
                    <div class="channel-logo-wrap">
                        ${ch.logo
                            ? `<img class="channel-logo" src="${ch.logo}" alt="" onerror="this.style.display='none'">`
                            : `<div class="channel-logo-placeholder">${ch.name.charAt(0).toUpperCase()}</div>`}
                    </div>
                    <div class="channel-info">
                        <div class="channel-name">${ch.name}</div>
                        <div class="channel-group">${ch.group || ''}</div>
                    </div>
                    <span class="badge-fav">★</span>
                    <span class="reorder-handle">⋮⋮</span>`;
                li.addEventListener('click', () => onPlay(ch));
                li.addEventListener('contextmenu', e => { e.preventDefault(); onContext(ch, i, li); });
                listEl.appendChild(li);
            });
        }
    }

    /* Context menu */
    function showContextMenu(channel, index, anchorEl, folderId, callbacks) {
        const existingMenu = document.getElementById('fav-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id        = 'fav-context-menu';
        menu.className = 'fav-context show';

        const folders = getUserFolders();
        const folderOptions = folders.length
            ? folders.map(f => `<div class="fav-ctx-item" data-action="move" data-folder="${f.id}">📁 Mover a: ${f.name}</div>`).join('')
            : '';

        menu.innerHTML = `
            <div class="fav-ctx-item" data-action="play">▶ Reproducir</div>
            <div class="fav-ctx-sep"></div>
            ${folderOptions}
            ${folders.length ? '<div class="fav-ctx-sep"></div>' : ''}
            <div class="fav-ctx-item" data-action="reorder-up">↑ Mover arriba</div>
            <div class="fav-ctx-item" data-action="reorder-down">↓ Mover abajo</div>
            <div class="fav-ctx-sep"></div>
            <div class="fav-ctx-item danger" data-action="remove">★ Quitar de favoritos</div>`;

        const rect = anchorEl.getBoundingClientRect();
        menu.style.left = Math.min(rect.right + 10, 1600) + 'px';
        menu.style.top  = Math.min(rect.top, 780) + 'px';

        document.body.appendChild(menu);

        menu.querySelectorAll('.fav-ctx-item').forEach((item, i) => {
            item.tabIndex = 0;
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                const folder = item.dataset.folder;
                if (action === 'play')         callbacks.onPlay(channel);
                if (action === 'move' && folder) { moveToFolder(channel.url, folder); callbacks.onRefresh(); }
                if (action === 'reorder-up')   { reorder(index, index - 1); callbacks.onRefresh(); }
                if (action === 'reorder-down') { reorder(index, index + 1); callbacks.onRefresh(); }
                if (action === 'remove')       { remove(channel.url); callbacks.onRefresh(); }
                menu.remove();
            });
        });

        /* Close on outside click */
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 100);

        /* Focus first item */
        const first = menu.querySelector('.fav-ctx-item');
        if (first) first.focus();
    }

    return {
        getFolders, getUserFolders, createFolder, deleteFolder,
        getAll, getByFolder, add, remove, isFavorite, toggle,
        moveToFolder, reorder,
        renderFolderSidebar, renderChannelList, showContextMenu
    };
})();

/* Extend Storage with favorites array */
Storage.getFavorites = function() {
    try { return JSON.parse(localStorage.getItem('iptv_favorites') || '[]'); }
    catch(_) { return []; }
};
Storage.saveFavorites = function(arr) {
    try { localStorage.setItem('iptv_favorites', JSON.stringify(arr)); }
    catch(_) {}
};
