/* ══════════════════════════════════════════════════
   Mini Player (Picture-in-Picture)
   Floating 480×270 video window over any screen
══════════════════════════════════════════════════ */
const MiniPlayer = (() => {

    const POSITIONS  = ['pos-br', 'pos-bl', 'pos-tr', 'pos-tl'];
    const SIZES      = { mini: [480, 270], medium: [640, 360] };

    let _el          = null;      // the mini player DOM element
    let _videoEl     = null;      // <video> inside mini player
    let _channel     = null;      // currently playing channel
    let _posIdx      = 0;         // current position index
    let _focused     = false;     // mini player has key focus
    let _visible     = false;
    let _isMoving    = false;
    let _onExpand    = null;      // callback when user wants full screen
    let _onClose     = null;      // callback when closed

    /* ── Build DOM ───────────────────────────────── */
    function _build() {
        _el = document.createElement('div');
        _el.className = 'mini-player pos-br';
        _el.id = 'mini-player';
        _el.innerHTML = `
            <video class="mini-av" id="mini-video" preload="none" autoplay playsinline></video>
            <div class="mini-overlay">
                <div>
                    <div class="mini-live-badge">
                        <span class="mini-live-dot"></span> EN VIVO
                    </div>
                </div>
                <div>
                    <div class="mini-channel-name" id="mini-channel-name"></div>
                    <div class="mini-controls">
                        <button class="mini-ctrl-btn" id="mini-btn-ch-up" title="Canal anterior">↑</button>
                        <button class="mini-ctrl-btn" id="mini-btn-ch-down" title="Canal siguiente">↓</button>
                        <button class="mini-ctrl-btn" id="mini-btn-expand" title="Expandir">⛶</button>
                        <button class="mini-ctrl-btn close" id="mini-btn-close" title="Cerrar">✕</button>
                    </div>
                </div>
            </div>
            <div class="mini-move-hint">Mover: ↑↓←→</div>`;

        document.body.appendChild(_el);
        _videoEl = _el.querySelector('#mini-video');

        _el.querySelector('#mini-btn-expand').addEventListener('click', expandToFull);
        _el.querySelector('#mini-btn-close').addEventListener('click',  close);
        _el.querySelector('#mini-btn-ch-up').addEventListener('click',  () => changeChannel(-1));
        _el.querySelector('#mini-btn-ch-down').addEventListener('click',() => changeChannel(1));
    }

    /* ── Public API ──────────────────────────────── */
    function show(channel) {
        if (!_el) _build();
        _channel = channel;
        _visible = true;
        _el.classList.add('visible');
        _el.classList.remove(...POSITIONS);
        _el.classList.add(POSITIONS[_posIdx]);

        _playInMini(channel.url);
        _el.querySelector('#mini-channel-name').textContent = channel.name;
    }

    function hide() {
        if (!_el || !_visible) return;
        _visible = false;
        _focused = false;
        _stopMiniVideo();
        _el.classList.remove('visible', 'focused');
    }

    function close() {
        hide();
        if (_onClose) _onClose();
    }

    function isVisible()  { return _visible; }
    function isFocused()  { return _focused; }

    function focus() {
        if (!_el || !_visible) return;
        _focused = true;
        _el.classList.add('focused');
    }

    function blur() {
        if (!_el) return;
        _focused = false;
        _el.classList.remove('focused');
    }

    function toggleFocus() {
        if (_focused) blur(); else focus();
        return _focused;
    }

    function expandToFull() {
        if (_onExpand) _onExpand(_channel);
    }

    /* ── Channel switching ────────────────────────── */
    let _channelList  = [];
    let _channelIdx   = 0;

    function setChannelList(list, currentIdx) {
        _channelList = list;
        _channelIdx  = currentIdx;
    }

    function changeChannel(dir) {
        if (!_channelList.length) return;
        _channelIdx = (_channelIdx + dir + _channelList.length) % _channelList.length;
        const ch    = _channelList[_channelIdx];
        _channel    = ch;
        _playInMini(ch.url);
        _el.querySelector('#mini-channel-name').textContent = ch.name;
    }

    /* ── Position cycling ─────────────────────────── */
    function cyclePosition() {
        _posIdx = (_posIdx + 1) % POSITIONS.length;
        _el.classList.remove(...POSITIONS);
        _el.classList.add(POSITIONS[_posIdx]);
    }

    function movePosition(direction) {
        /* direction: 'up'|'down'|'left'|'right' — maps to corner */
        const map = {
            up:    { left: 'pos-tl', right: 'pos-tr' },
            down:  { left: 'pos-bl', right: 'pos-br' },
            left:  { top: 'pos-tl',  bottom: 'pos-bl' },
            right: { top: 'pos-tr',  bottom: 'pos-br' },
        };
        const cur = POSITIONS[_posIdx];
        const isTop    = cur === 'pos-tr' || cur === 'pos-tl';
        const isLeft   = cur === 'pos-bl' || cur === 'pos-tl';

        let newPos = cur;
        if (direction === 'up' && !isTop)    newPos = isLeft ? 'pos-tl' : 'pos-tr';
        if (direction === 'down' && isTop)   newPos = isLeft ? 'pos-bl' : 'pos-br';
        if (direction === 'left' && !isLeft) newPos = isTop  ? 'pos-tl' : 'pos-bl';
        if (direction === 'right' && isLeft) newPos = isTop  ? 'pos-tr' : 'pos-br';

        _posIdx = POSITIONS.indexOf(newPos);
        _el.classList.remove(...POSITIONS);
        _el.classList.add(newPos);
    }

    /* ── Key handler (when mini player has focus) ── */
    function handleKey(k) {
        if (!_focused) return false;

        if (k === Keys.UP)    { changeChannel(-1); return true; }
        if (k === Keys.DOWN)  { changeChannel(1);  return true; }
        if (k === Keys.ENTER) { expandToFull(); return true; }
        if (k === Keys.BACK)  { close(); return true; }

        /* Move position with LEFT/RIGHT while in move mode */
        if (_isMoving) {
            if (k === Keys.LEFT)  { movePosition('left');  return true; }
            if (k === Keys.RIGHT) { movePosition('right'); return true; }
        }

        /* YELLOW = cycle position */
        if (k === Keys.YELLOW) { cyclePosition(); return true; }
        return false;
    }

    /* ── Internal video playback ──────────────────── */
    function _playInMini(url) {
        if (!_videoEl) return;
        _videoEl.src = url;
        _videoEl.load();
        _videoEl.play().catch(() => {});
    }

    function _stopMiniVideo() {
        if (!_videoEl) return;
        _videoEl.pause();
        _videoEl.removeAttribute('src');
        _videoEl.load();
    }

    /* ── Callbacks ────────────────────────────────── */
    function onExpand(cb)  { _onExpand = cb; }
    function onClose(cb)   { _onClose  = cb; }

    function getCurrentChannel() { return _channel; }

    return {
        show, hide, close, isVisible, isFocused,
        focus, blur, toggleFocus, expandToFull,
        setChannelList, changeChannel,
        cyclePosition, movePosition,
        handleKey, onExpand, onClose,
        getCurrentChannel
    };
})();
