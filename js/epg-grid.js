/* ══════════════════════════════════════════════════
   IPTV Samsung - EPG Grid Component
   TV guide grid: channels on Y-axis, time on X-axis
══════════════════════════════════════════════════ */

const EPGGrid = (() => {

    /* ── Constants ──────────────────────────────── */
    const CHANNEL_COL_W = 200;  // px – fixed left column
    const SLOT_W        = 200;  // px per 30-minute slot
    const ROW_H         = 80;   // px per channel row
    const TIME_BAR_H    = 50;   // px – time labels row
    const VISIBLE_HOURS = 3;    // hours visible at once
    const MS_PER_PX     = (30 * 60 * 1000) / SLOT_W; // ms per pixel

    /* ── State ──────────────────────────────────── */
    let _containerId  = null;
    let _channels     = [];   // array of channel objects { id, name, logo, url, ... }
    let _epgData      = null; // { channels, programs }
    let _currentDate  = new Date();
    let _focusRow     = 0;
    let _focusCol     = 0;    // index within focused row's visible cells
    let _scrollLeft   = 0;    // horizontal scroll offset in px
    let _scrollTop    = 0;    // vertical scroll offset in px
    let _nowLineTimer = null;

    /* ── Callback ───────────────────────────────── */
    let onSelect = null; // (channelId, program) => {}

    /* ── Time helpers ───────────────────────────── */
    function _dayStart(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function _timeToX(time) {
        // Returns pixel offset from the start of the day
        const base = _dayStart(_currentDate).getTime();
        return Math.round((time.getTime() - base) / MS_PER_PX);
    }

    function _xToTime(x) {
        const base = _dayStart(_currentDate).getTime();
        return new Date(base + x * MS_PER_PX);
    }

    function _formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    function _formatDuration(startMs, stopMs) {
        const mins = Math.round((stopMs - startMs) / 60000);
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
    }

    /* ── Build programs list for a row ─────────── */
    function _getPrograms(channelId) {
        if (!_epgData || !_epgData.programs) return [];
        const list = _epgData.programs[channelId] || [];
        const dayS = _dayStart(_currentDate).getTime();
        const dayE = dayS + 24 * 60 * 60 * 1000;

        return list.filter(p =>
            p.start &&
            p.start.getTime() < dayE &&
            (!p.stop || p.stop.getTime() > dayS)
        );
    }

    /* ── Render ─────────────────────────────────── */
    function render(containerId, channels, epgData) {
        _containerId = containerId;
        _channels    = channels || [];
        _epgData     = epgData;

        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear previous content and timers
        container.innerHTML = '';
        if (_nowLineTimer) { clearInterval(_nowLineTimer); _nowLineTimer = null; }

        /* ── Outer wrapper ── */
        const wrapper = document.createElement('div');
        wrapper.className = 'epg-wrapper';

        /* ── Time bar row ── */
        const timebar = _buildTimeBar();
        wrapper.appendChild(timebar);

        /* ── Scrollable area: channel col + program grid ── */
        const scrollArea = document.createElement('div');
        scrollArea.className = 'epg-scroll-area';
        scrollArea.id = 'epg-scroll-area';

        /* ── Fixed channel column ── */
        const chanCol = document.createElement('div');
        chanCol.className = 'epg-channel-col';
        chanCol.id = 'epg-channel-col';

        /* ── Program grid ── */
        const grid = document.createElement('div');
        grid.className = 'epg-grid';
        grid.id = 'epg-grid';

        /* ── Now line ── */
        const nowLine = document.createElement('div');
        nowLine.className = 'epg-now-line';
        nowLine.id = 'epg-now-line';
        grid.appendChild(nowLine);

        /* ── Rows ── */
        _channels.forEach((ch, rowIdx) => {
            /* Channel label */
            const chCell = document.createElement('div');
            chCell.className = 'epg-channel-item';
            chCell.dataset.row = rowIdx;

            const logo = document.createElement('img');
            logo.className = 'epg-channel-logo';
            logo.src = ch.logo || '';
            logo.alt = '';
            logo.onerror = () => { logo.style.display = 'none'; };

            const nameEl = document.createElement('span');
            nameEl.className = 'epg-channel-name';
            nameEl.textContent = ch.name || '';

            chCell.appendChild(logo);
            chCell.appendChild(nameEl);
            chanCol.appendChild(chCell);

            /* Program row */
            const row = document.createElement('div');
            row.className = 'epg-row';
            row.dataset.row = rowIdx;

            const programs = _getPrograms(ch.tvgId || ch.id || ch.url || String(rowIdx));
            const now      = Date.now();
            const dayS     = _dayStart(_currentDate).getTime();

            if (programs.length === 0) {
                // No EPG data – show one full-day empty slot
                const emptyCell = document.createElement('div');
                emptyCell.className = 'epg-cell no-data';
                emptyCell.style.left  = '0px';
                emptyCell.style.width = _timeToX(new Date(dayS + 24 * 60 * 60 * 1000)) + 'px';
                emptyCell.textContent = 'Sin información';
                row.appendChild(emptyCell);
            } else {
                programs.forEach((prog, colIdx) => {
                    const startMs = prog.start.getTime();
                    const stopMs  = prog.stop ? prog.stop.getTime() : startMs + 30 * 60 * 1000;

                    const x = Math.max(0, _timeToX(prog.start));
                    const w = Math.max(4, _timeToX(new Date(stopMs)) - x);

                    const cell = document.createElement('div');
                    cell.className = 'epg-cell';
                    cell.style.left  = x + 'px';
                    cell.style.width = w + 'px';
                    cell.dataset.row = rowIdx;
                    cell.dataset.col = colIdx;

                    if (stopMs <= now) {
                        cell.classList.add('past');
                    } else if (startMs <= now && stopMs > now) {
                        cell.classList.add('current');
                    } else {
                        cell.classList.add('future');
                    }

                    const titleEl = document.createElement('span');
                    titleEl.className = 'epg-cell-title';
                    titleEl.textContent = prog.title || '(Sin título)';

                    const timeEl = document.createElement('span');
                    timeEl.className = 'epg-cell-time';
                    timeEl.textContent = _formatTime(prog.start) +
                        (prog.stop ? ' – ' + _formatTime(prog.stop) : '');

                    cell.appendChild(titleEl);
                    cell.appendChild(timeEl);

                    cell.addEventListener('click', () => {
                        _focusCellElement(cell, rowIdx, colIdx);
                        _selectFocused();
                    });

                    row.appendChild(cell);
                });
            }

            grid.appendChild(row);
        });

        scrollArea.appendChild(chanCol);
        scrollArea.appendChild(grid);
        wrapper.appendChild(scrollArea);
        container.appendChild(wrapper);

        /* ── Sync channel col scroll with grid scroll ── */
        grid.addEventListener('scroll', () => {
            chanCol.scrollTop = grid.scrollTop;
            _scrollLeft = grid.scrollLeft;
            _scrollTop  = grid.scrollTop;
            _updateTimeBarScroll(timebar, grid.scrollLeft);
            _updateNowLine();
        });

        /* ── Auto-scroll to current time on render ── */
        _scrollToNow(grid, timebar);

        /* ── Focus first row ── */
        _focusRow = 0;
        _focusCol = 0;
        _applyFocus();

        /* ── Update now-line every minute ── */
        _nowLineTimer = setInterval(() => _updateNowLine(), 60 * 1000);
        _updateNowLine();
    }

    /* ── Time bar ────────────────────────────────── */
    function _buildTimeBar() {
        const bar = document.createElement('div');
        bar.className = 'epg-time-bar';
        bar.id = 'epg-time-bar';

        /* Left spacer matching channel column */
        const spacer = document.createElement('div');
        spacer.className = 'epg-timebar-spacer';
        spacer.style.width = CHANNEL_COL_W + 'px';
        bar.appendChild(spacer);

        /* Scrollable time labels */
        const labels = document.createElement('div');
        labels.className = 'epg-timebar-labels';
        labels.id = 'epg-timebar-labels';

        const dayStart = _dayStart(_currentDate);
        for (let h = 0; h < 24; h++) {
            for (let half = 0; half < 2; half++) {
                const slotTime = new Date(dayStart);
                slotTime.setHours(h, half * 30, 0, 0);
                const x = _timeToX(slotTime);

                const label = document.createElement('div');
                label.className = 'epg-time-label';
                label.style.left  = x + 'px';
                label.style.width = SLOT_W + 'px';
                label.textContent = _formatTime(slotTime);
                labels.appendChild(label);
            }
        }

        bar.appendChild(labels);
        return bar;
    }

    function _updateTimeBarScroll(timebar, scrollLeft) {
        const labels = timebar.querySelector('#epg-timebar-labels');
        if (labels) labels.style.transform = `translateX(-${scrollLeft}px)`;
    }

    /* ── Now line ─────────────────────────────────── */
    function _updateNowLine() {
        const nowLine = document.getElementById('epg-now-line');
        if (!nowLine) return;

        const now  = Date.now();
        const dayS = _dayStart(_currentDate).getTime();
        const dayE = dayS + 24 * 60 * 60 * 1000;

        if (now < dayS || now > dayE) {
            nowLine.style.display = 'none';
            return;
        }

        nowLine.style.display = 'block';
        nowLine.style.left = _timeToX(new Date(now)) + 'px';
    }

    function _scrollToNow(grid, timebar) {
        const now  = Date.now();
        const nowX = _timeToX(new Date(now));
        // Scroll so current time is ~1/4 from left
        const offset = Math.max(0, nowX - SLOT_W * 2);
        grid.scrollLeft = offset;
        _scrollLeft = offset;
        _updateTimeBarScroll(timebar, offset);
        _updateNowLine();
    }

    /* ── Focus management ─────────────────────────── */
    function _getFocusedCell() {
        const grid = document.getElementById('epg-grid');
        if (!grid) return null;
        const rows = grid.querySelectorAll('.epg-row');
        if (!rows[_focusRow]) return null;
        const cells = rows[_focusRow].querySelectorAll('.epg-cell');
        return cells[_focusCol] || null;
    }

    function _applyFocus() {
        // Clear all focused classes
        document.querySelectorAll('.epg-cell.focused').forEach(el => el.classList.remove('focused'));
        document.querySelectorAll('.epg-channel-item.focused').forEach(el => el.classList.remove('focused'));

        const grid    = document.getElementById('epg-grid');
        const chanCol = document.getElementById('epg-channel-col');
        if (!grid || !chanCol) return;

        // Focus channel item
        const chItems = chanCol.querySelectorAll('.epg-channel-item');
        if (chItems[_focusRow]) chItems[_focusRow].classList.add('focused');

        // Focus cell
        const cell = _getFocusedCell();
        if (cell) {
            cell.classList.add('focused');
            _scrollCellIntoView(cell, grid);
            _updateDetail(cell);
        }
    }

    function _focusCellElement(cell, row, col) {
        _focusRow = row;
        _focusCol = col;
        _applyFocus();
    }

    function _scrollCellIntoView(cell, grid) {
        const cellLeft  = parseInt(cell.style.left, 10);
        const cellRight = cellLeft + parseInt(cell.style.width, 10);
        const viewLeft  = grid.scrollLeft;
        const viewRight = viewLeft + grid.clientWidth;

        if (cellLeft < viewLeft + 40) {
            grid.scrollLeft = Math.max(0, cellLeft - 40);
        } else if (cellRight > viewRight - 40) {
            grid.scrollLeft = cellRight - grid.clientWidth + 40;
        }

        // Vertical scroll
        const rowH       = ROW_H;
        const cellTop    = _focusRow * rowH;
        const cellBottom = cellTop + rowH;
        const viewTop    = grid.scrollTop;
        const viewBottom = viewTop + grid.clientHeight;

        if (cellTop < viewTop + 10) {
            grid.scrollTop = Math.max(0, cellTop - 10);
        } else if (cellBottom > viewBottom - 10) {
            grid.scrollTop = cellBottom - grid.clientHeight + 10;
        }
    }

    /* ── Detail tooltip update ─────────────────── */
    function _updateDetail(cell) {
        // Find the program from data
        const rowIdx = parseInt(cell.dataset.row, 10);
        const colIdx = parseInt(cell.dataset.col, 10);
        const ch = _channels[rowIdx];
        if (!ch) return;

        const channelId = ch.tvgId || ch.id || ch.url || String(rowIdx);
        const programs  = _getPrograms(channelId);
        const prog      = programs[colIdx];

        const detailEl = document.getElementById('epg-detail');
        if (!detailEl) return;

        if (!prog) {
            detailEl.classList.remove('visible');
            return;
        }

        const titleEl = document.getElementById('epg-detail-title');
        const timeEl  = document.getElementById('epg-detail-time');
        const descEl  = document.getElementById('epg-detail-desc');
        const iconEl  = document.getElementById('epg-detail-icon');

        if (titleEl) titleEl.textContent = prog.title || '(Sin título)';
        if (timeEl)  timeEl.textContent  = prog.start
            ? (_formatTime(prog.start) + (prog.stop ? ' – ' + _formatTime(prog.stop) : ''))
            : '';
        if (descEl)  descEl.textContent  = prog.desc || '';
        if (iconEl) {
            if (prog.icon) {
                iconEl.innerHTML = `<img src="${prog.icon}" alt="" onerror="this.style.display='none'">`;
            } else {
                iconEl.innerHTML = '';
            }
        }

        detailEl.classList.add('visible');
    }

    /* ── Navigation ──────────────────────────────── */
    function navigateUp() {
        if (_focusRow <= 0) return;
        _focusRow--;
        // Try to keep same approximate time position
        _keepTimePosition();
        _applyFocus();
        _syncChannelScroll();
    }

    function navigateDown() {
        if (_focusRow >= _channels.length - 1) return;
        _focusRow++;
        _keepTimePosition();
        _applyFocus();
        _syncChannelScroll();
    }

    function navigateLeft() {
        if (_focusCol > 0) {
            _focusCol--;
        } else {
            // Scroll time left by one slot
            const grid = document.getElementById('epg-grid');
            if (grid) {
                grid.scrollLeft = Math.max(0, grid.scrollLeft - SLOT_W);
            }
        }
        _applyFocus();
    }

    function navigateRight() {
        const grid = document.getElementById('epg-grid');
        if (!grid) return;
        const rows  = grid.querySelectorAll('.epg-row');
        const cells = rows[_focusRow] ? rows[_focusRow].querySelectorAll('.epg-cell') : [];

        if (_focusCol < cells.length - 1) {
            _focusCol++;
        } else {
            // Scroll time right by one slot
            grid.scrollLeft = grid.scrollLeft + SLOT_W;
        }
        _applyFocus();
    }

    function _keepTimePosition() {
        // Find program at roughly same scroll position in new row
        const grid = document.getElementById('epg-grid');
        if (!grid) return;

        const midX   = grid.scrollLeft + grid.clientWidth / 2;
        const ch     = _channels[_focusRow];
        if (!ch) return;

        const channelId = ch.tvgId || ch.id || ch.url || String(_focusRow);
        const programs  = _getPrograms(channelId);

        // Find closest program to midX
        let bestCol = 0;
        let bestDist = Infinity;
        programs.forEach((p, i) => {
            const x = _timeToX(p.start);
            const d = Math.abs(x - midX);
            if (d < bestDist) { bestDist = d; bestCol = i; }
        });
        _focusCol = bestCol;
    }

    function _syncChannelScroll() {
        const chanCol = document.getElementById('epg-channel-col');
        const grid    = document.getElementById('epg-grid');
        if (!chanCol || !grid) return;
        const targetTop = _focusRow * ROW_H;
        const viewTop   = grid.scrollTop;
        const viewBot   = viewTop + grid.clientHeight;
        if (targetTop < viewTop + 10) {
            grid.scrollTop = Math.max(0, targetTop - 10);
            chanCol.scrollTop = grid.scrollTop;
        } else if (targetTop + ROW_H > viewBot - 10) {
            grid.scrollTop = targetTop + ROW_H - grid.clientHeight + 10;
            chanCol.scrollTop = grid.scrollTop;
        }
    }

    function _selectFocused() {
        const rowIdx    = _focusRow;
        const colIdx    = _focusCol;
        const ch        = _channels[rowIdx];
        if (!ch) return;

        const channelId = ch.tvgId || ch.id || ch.url || String(rowIdx);
        const programs  = _getPrograms(channelId);
        const prog      = programs[colIdx] || null;

        if (typeof onSelect === 'function') {
            onSelect(channelId, prog, ch);
        }
    }

    function selectCurrent() {
        _selectFocused();
    }

    /* ── Public API ─────────────────────────────── */
    return {
        render,
        navigateUp,
        navigateDown,
        navigateLeft,
        navigateRight,
        selectCurrent,
        set onSelect(fn) { onSelect = fn; },
        get onSelect()   { return onSelect; },
        destroy() {
            if (_nowLineTimer) { clearInterval(_nowLineTimer); _nowLineTimer = null; }
        }
    };

})();
