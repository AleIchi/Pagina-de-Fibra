/* ══════════════════════════════════════════════════
   Audio & Subtitle Track Manager (Phase 8)
   Uses Samsung AVPlay API — falls back gracefully
══════════════════════════════════════════════════ */
const Tracks = (() => {

    /* ── Audio tracks ────────────────────────────── */
    function getAudioTracks() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay) return [];
            const info  = webapis.avplay.getTrackInfo('AUDIO');
            return Array.isArray(info) ? info.map((t, i) => ({
                index: i,
                lang:  t.extra_info ? (JSON.parse(t.extra_info).language || `Audio ${i+1}`) : `Audio ${i+1}`,
                codec: t.extra_info ? (JSON.parse(t.extra_info).codec || '') : '',
            })) : [];
        } catch(_) { return []; }
    }

    function setAudioTrack(index) {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setSelectTrack('AUDIO', index);
                return true;
            }
        } catch(e) { console.warn('setAudioTrack error:', e); }
        return false;
    }

    function getCurrentAudioTrack() {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                const cur = webapis.avplay.getCurrentStreamInfo();
                return cur ? cur.index : 0;
            }
        } catch(_) {}
        return 0;
    }

    function getCurrentSubtitleTrack() {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                const tracks = webapis.avplay.getTrackInfo('TEXT');
                if (!Array.isArray(tracks) || !tracks.length) return -1;
                /* AVPlay doesn't have direct getCurrentStreamInfo for TEXT;
                   iterate to find the active one via a separate query */
                const cur = webapis.avplay.getCurrentStreamInfo();
                if (cur && cur.type === 'TEXT') return cur.index;
            }
        } catch(_) {}
        return -1;
    }

    /* ── Subtitle tracks ─────────────────────────── */
    function getSubtitleTracks() {
        try {
            if (typeof webapis === 'undefined' || !webapis.avplay) return [];
            const info = webapis.avplay.getTrackInfo('TEXT');
            return Array.isArray(info) ? [
                { index: -1, lang: 'Desactivado' },
                ...info.map((t, i) => ({
                    index: i,
                    lang:  t.extra_info ? (JSON.parse(t.extra_info).language || `Sub ${i+1}`) : `Sub ${i+1}`,
                }))
            ] : [{ index: -1, lang: 'Desactivado' }];
        } catch(_) { return [{ index: -1, lang: 'Desactivado' }]; }
    }

    function setSubtitleTrack(index) {
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                if (index === -1) {
                    webapis.avplay.setSelectTrack('TEXT', -1);
                } else {
                    webapis.avplay.setSelectTrack('TEXT', index);
                }
                return true;
            }
        } catch(e) { console.warn('setSubtitleTrack error:', e); }
        return false;
    }

    /* ── UI: Track selection modal ───────────────── */
    function showTrackModal(type, onClose) {
        const existing = document.getElementById('track-modal');
        if (existing) existing.remove();

        const tracks  = type === 'audio' ? getAudioTracks() : getSubtitleTracks();
        const title   = type === 'audio' ? '🔊 Pista de audio' : '💬 Subtítulos';
        const curIdx  = type === 'audio' ? getCurrentAudioTrack() : getCurrentSubtitleTrack();

        if (!tracks.length) {
            if (typeof UI !== 'undefined') UI.showToast('No hay pistas disponibles');
            return;
        }

        const modal = document.createElement('div');
        modal.id        = 'track-modal';
        modal.className = 'track-modal';
        modal.innerHTML = `
            <div class="track-modal-content">
                <div class="track-modal-title">${title}</div>
                <ul class="track-list" id="track-list">
                    ${tracks.map(t => `
                        <li class="track-item ${t.index === curIdx ? 'active' : ''}"
                            data-index="${t.index}" tabindex="0">
                            <span class="track-check">${t.index === curIdx ? '●' : '○'}</span>
                            <span class="track-label">${t.lang}</span>
                            ${t.codec ? `<span class="track-codec">${t.codec}</span>` : ''}
                        </li>`).join('')}
                </ul>
                <div class="track-modal-hint">BACK para cerrar</div>
            </div>`;

        document.body.appendChild(modal);

        /* Focus first item */
        const items = modal.querySelectorAll('li');
        let focusIdx = 0;
        const setActive = (i) => {
            focusIdx = i;
            items.forEach((el, j) => el.classList.toggle('focused', j === i));
            items[i].scrollIntoView({ block: 'nearest' });
        };
        setActive(0);

        /* Key handler */
        const keyHandler = (e) => {
            if (e.keyCode === Keys.UP)    { setActive(Math.max(0, focusIdx - 1)); e.preventDefault(); }
            if (e.keyCode === Keys.DOWN)  { setActive(Math.min(items.length - 1, focusIdx + 1)); e.preventDefault(); }
            if (e.keyCode === Keys.ENTER) {
                const idx = parseInt(items[focusIdx].dataset.index, 10);
                if (type === 'audio')    setAudioTrack(idx);
                else                     setSubtitleTrack(idx);
                items.forEach(el => {
                    const active = parseInt(el.dataset.index, 10) === idx;
                    el.classList.toggle('active', active);
                    el.querySelector('.track-check').textContent = active ? '●' : '○';
                });
                if (typeof UI !== 'undefined') UI.showToast(type === 'audio' ? 'Audio cambiado' : 'Subtítulo cambiado');
            }
            if (e.keyCode === Keys.BACK) {
                closeModal();
                e.preventDefault();
            }
        };

        document.addEventListener('keydown', keyHandler);

        const closeModal = () => {
            document.removeEventListener('keydown', keyHandler);
            modal.remove();
            if (onClose) onClose();
        };

        /* Click on items */
        items.forEach((el, i) => {
            el.addEventListener('click', () => {
                setActive(i);
                el.dispatchEvent(new KeyboardEvent('keydown', { keyCode: Keys.ENTER }));
            });
        });

        return { close: closeModal };
    }

    return { getAudioTracks, setAudioTrack, getSubtitleTracks, setSubtitleTrack, showTrackModal };
})();
