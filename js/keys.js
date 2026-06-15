/* Samsung Tizen remote control key codes */
const Keys = {
    UP:        38,
    DOWN:      40,
    LEFT:      37,
    RIGHT:     39,
    ENTER:     13,
    BACK:      10009,
    EXIT:      10182,
    MENU:      18,
    CH_UP:     427,
    CH_DOWN:   428,
    NUM_0:     48,
    NUM_1:     49,
    NUM_2:     50,
    NUM_3:     51,
    NUM_4:     52,
    NUM_5:     53,
    NUM_6:     54,
    NUM_7:     55,
    NUM_8:     56,
    NUM_9:     57,
    RED:       403,
    GREEN:     404,
    YELLOW:    405,
    BLUE:      406,
    FF:        417,
    RW:        412,
    PLAY:      415,
    PAUSE:     19,
    STOP:      413,
    INFO:      457,
    SEARCH:    10225,
    CAPTION:   10221,
    /* Tizen 3+ unified key IDs */
    VOLUME_UP:   447,
    VOLUME_DOWN: 448,
    MUTE:        449,
};

/* Register all keys with Tizen InputDevice API (required on Tizen) */
function registerKeys() {
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;
    const registerList = [
        'ChannelUp', 'ChannelDown', 'ColorF0Red', 'ColorF1Green',
        'ColorF2Yellow', 'ColorF3Blue', 'MediaPlayPause', 'MediaPlay',
        'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind',
        'Info', 'Search', 'Caption'
    ];
    registerList.forEach(key => {
        try { tizen.tvinputdevice.registerKey(key); } catch (_) {}
    });
}

registerKeys();
