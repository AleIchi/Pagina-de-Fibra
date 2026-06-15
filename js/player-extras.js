/* ══════════════════════════════════════════════════
   Player Extras — Aspect Ratio + Sleep Timer (Phase 9 & 14)
══════════════════════════════════════════════════ */

/* ── Aspect Ratio ────────────────────────────────── */
const AspectRatio = (() => {
    const MODES = [
        { id: 'FULL',      label: '16:9 Normal',  avplay: 'PLAYER_DISPLAY_MODE_FULL_SCREEN' },
        { id: 'LETTER',    label: '4:3 Pillarbox', avplay: 'PLAYER_DISPLAY_MODE_AUTO_FIT' },
        { id: 'STRETCH',   label: 'Estirar',       avplay: 'PLAYER_DISPLAY_MODE_LETTER_BOX' },
        { id: 'ZOOM',      label: 'Zoom',          avplay: 'PLAYER_DISPLAY_MODE_ZOOM' },
    ];

    let _idx = 0;

    function current() { return MODES[_idx]; }

    function cycle() {
        _idx = (_idx + 1) % MODES.length;
        _apply();
        return MODES[_idx];
    }

    function _apply() {
        const mode = MODES[_idx];
        try {
            if (typeof webapis !== 'undefined' && webapis.avplay) {
                webapis.avplay.setDisplayMethod(mode.avplay);
                if (mode.id === 'STRETCH') {
                    webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
                } else if (mode.id === 'LETTER') {
                    /* 4:3 pillarbox: center 1440px wide with 240px margins */
                    webapis.avplay.setDisplayRect(240, 0, 1440, 1080);
                } else if (mode.id === 'ZOOM') {
                    /* 10% crop on all sides */
                    webapis.avplay.setDisplayRect(-96, -54, 2112, 1188);
                } else {
                    webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
                }
            } else {
                /* HTML5 fallback: use object-fit */
                const vid = document.getElementById('html5-player');
                if (!vid) return;
                if (mode.id === 'STRETCH') {
                    vid.style.objectFit = 'fill';
                } else if (mode.id === 'LETTER') {
                    vid.style.objectFit = 'contain';
                } else if (mode.id === 'ZOOM') {
                    vid.style.objectFit = 'cover';
                    vid.style.transform = 'scale(1.1)';
                    return;
                } else {
                    vid.style.objectFit = 'cover';
                }
                vid.style.transform = '';
            }
        } catch (e) { console.warn('AspectRatio apply error:', e); }
    }

    function reset() {
        _idx = 0;
        _apply();
    }

    return { current, cycle, reset };
})();

/* ── Sleep Timer ─────────────────────────────────── */
const SleepTimer = (() => {
    const OPTIONS = [15, 30, 60, 90, 120]; /* minutes */
    let _timer    = null;
    let _endTime  = 0;
    let _warnTimer = null;

    function set(minutes) {
        cancel();
        if (!minutes) return;
        _endTime = Date.now() + minutes * 60000;

        /* Warning 2 min before */
        const warnDelay = (minutes - 2) * 60000;
        if (warnDelay > 0) {
            _warnTimer = setTimeout(() => {
                if (typeof UI !== 'undefined') {
                    UI.showToast('El temporizador se activa en 2 minutos', 4000);
                }
            }, warnDelay);
        }

        _timer = setTimeout(() => {
            _endTime = 0;
            if (typeof Player !== 'undefined') Player.stop();
            if (typeof UI !== 'undefined') {
                UI.showScreen('main');
                UI.showToast('Temporizador de apagado activado');
            }
        }, minutes * 60000);
    }

    function cancel() {
        if (_timer)     { clearTimeout(_timer);     _timer     = null; }
        if (_warnTimer) { clearTimeout(_warnTimer); _warnTimer = null; }
        _endTime = 0;
    }

    function isActive()    { return !!_timer; }
    function remaining()   { return _endTime ? Math.max(0, Math.round((_endTime - Date.now()) / 60000)) : 0; }
    function getOptions()  { return OPTIONS; }

    /* Show selection modal */
    function showModal() {
        const existing = document.getElementById('sleep-modal');
        if (existing) { existing.remove(); return; }

        const modal = document.createElement('div');
        modal.id        = 'sleep-modal';
        modal.className = 'track-modal'; /* reuse track-modal CSS */
        modal.innerHTML = `
            <div class="track-modal-content">
                <div class="track-modal-title">⏱ Temporizador de apagado</div>
                <ul class="track-list" id="sleep-list">
                    ${isActive() ? `<li class="track-item focused" data-val="0" tabindex="0">
                        <span class="track-check">✕</span>
                        <span class="track-label">Cancelar (${remaining()} min restantes)</span></li>` : ''}
                    ${OPTIONS.map(m => `
                        <li class="track-item" data-val="${m}" tabindex="0">
                            <span class="track-check">○</span>
                            <span class="track-label">${m} minutos</span>
                        </li>`).join('')}
                </ul>
                <div class="track-modal-hint">BACK para cerrar</div>
            </div>`;

        document.body.appendChild(modal);

        const items = modal.querySelectorAll('li');
        let focusIdx = 0;

        const setActive = (i) => {
            focusIdx = i;
            items.forEach((el, j) => el.classList.toggle('focused', j === i));
            items[i].scrollIntoView({ block: 'nearest' });
        };
        setActive(0);

        const close = () => {
            document.removeEventListener('keydown', keyHandler);
            modal.remove();
        };

        const keyHandler = (e) => {
            const k = e.keyCode;
            if (k === Keys.UP)   { setActive(Math.max(0, focusIdx - 1)); e.preventDefault(); }
            if (k === Keys.DOWN) { setActive(Math.min(items.length - 1, focusIdx + 1)); e.preventDefault(); }
            if (k === Keys.ENTER) {
                const val = parseInt(items[focusIdx].dataset.val, 10);
                if (val === 0) {
                    cancel();
                    if (typeof UI !== 'undefined') UI.showToast('Temporizador cancelado');
                } else {
                    set(val);
                    if (typeof UI !== 'undefined') UI.showToast(`Apagado en ${val} minutos`);
                }
                close();
                e.preventDefault();
            }
            if (k === Keys.BACK) { close(); e.preventDefault(); }
        };

        document.addEventListener('keydown', keyHandler);

        items.forEach((el, i) => {
            el.addEventListener('click', () => {
                setActive(i);
                el.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13 }));
            });
        });
    }

    return { set, cancel, isActive, remaining, getOptions, showModal };
})();
