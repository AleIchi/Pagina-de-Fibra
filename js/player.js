/* Video player: Samsung AVPlay with HTML5 fallback */
const Player = (() => {
    const MAX_RETRIES  = 3;
    const RETRY_DELAYS = [2000, 4000, 8000];

    let _avPlayerEl    = document.getElementById('av-player');
    let _html5El       = document.getElementById('html5-player');
    let _useAVPlay     = typeof webapis !== 'undefined' && webapis.avplay;
    let _currentUrl    = '';
    let _retryCount    = 0;
    let _retryTimer    = null;
    let _onStateChange = null;

    /* ── AVPlay setup ── */
    function avInit(url) {
        try {
            webapis.avplay.open(url);
            webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
            webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
            webapis.avplay.setListener({
                onbufferingstart() { emitState('buffering'); },
                onbufferingcomplete() { emitState('playing'); },
                oncurrentplaytime() {},
                onevent(eventType) {
                    if (eventType === 'PLAYER_MSG_NONE') return;
                },
                onerror(errCode) {
                    console.warn('AVPlay error:', errCode);
                    scheduleRetry();
                },
                oneom()    { scheduleRetry(); },
                onsubtitlechange() {},
            });
            webapis.avplay.prepareAsync(
                () => { webapis.avplay.play(); emitState('playing'); },
                (err) => { console.warn('prepareAsync error:', err); scheduleRetry(); }
            );
        } catch (e) {
            console.warn('AVPlay init error:', e);
            fallbackToHTML5(url);
        }
    }

    function avStop() {
        try {
            if (webapis.avplay.getState() !== 'NONE') {
                webapis.avplay.stop();
                webapis.avplay.close();
            }
        } catch (_) {}
    }

    /* ── HTML5 fallback ── */
    function html5Play(url) {
        _html5El.classList.add('active');
        _html5El.src = url;
        _html5El.load();
        _html5El.play().catch(scheduleRetry);

        _html5El.onplaying    = () => emitState('playing');
        _html5El.onwaiting    = () => emitState('buffering');
        _html5El.onstalled    = () => emitState('buffering');
        _html5El.onerror      = () => scheduleRetry();
        _html5El.onended      = () => scheduleRetry();
    }

    function html5Stop() {
        _html5El.pause();
        _html5El.removeAttribute('src');
        _html5El.load();
        _html5El.classList.remove('active');
        _html5El.onplaying = _html5El.onwaiting =
        _html5El.onstalled = _html5El.onerror = _html5El.onended = null;
    }

    /* ── Retry logic ── */
    function scheduleRetry() {
        if (_retryCount >= MAX_RETRIES) {
            emitState('error');
            return;
        }
        const delay = RETRY_DELAYS[_retryCount] || 8000;
        emitState('retry', { attempt: _retryCount + 1, delay });
        _retryTimer = setTimeout(() => {
            _retryCount++;
            playUrl(_currentUrl);
        }, delay);
    }

    function fallbackToHTML5(url) {
        _useAVPlay = false;
        html5Play(url);
    }

    /* ── Public API ── */
    function playUrl(url) {
        stopAll();
        _currentUrl = url;
        emitState('loading');

        if (_useAVPlay) {
            avInit(url);
        } else {
            html5Play(url);
        }
    }

    function stopAll() {
        clearTimeout(_retryTimer);
        if (_useAVPlay) { try { avStop(); } catch (_) {} }
        try { html5Stop(); } catch (_) {}
    }

    function play(channel) {
        _retryCount = 0;
        clearTimeout(_retryTimer);
        playUrl(channel.url);
    }

    function stop() {
        _retryCount = 0;
        clearTimeout(_retryTimer);
        stopAll();
        emitState('stopped');
    }

    function onStateChange(cb) { _onStateChange = cb; }

    function emitState(state, data = {}) {
        if (_onStateChange) _onStateChange(state, data);
    }

    function getState() {
        if (!_useAVPlay) return 'unknown';
        try { return webapis.avplay.getState(); }
        catch (_) { return 'unknown'; }
    }

    return { play, stop, onStateChange, getState };
})();
