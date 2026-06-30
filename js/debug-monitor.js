/**
 * CeraCUT Debug Monitor V1.2
 * Last Modified: 2026-06-30 MEZ
 * Build: 20260630-consolelog
 * ════════════════════════════════════════════════════════════
 * Automatisches Fehler-Monitoring für CeraCUT / CeraCUT
 *
 * Features:
 *   - Console-Interceptor: alle console.log/warn/error/debug gepuffert (NEU V1.2)
 *   - Live-Log-Tab mit Modul-Filter, Level-Filter, Freitext-Suche (NEU V1.2)
 *   - Fehler-Kontext: letzte 5 Logs vor einem Error sichtbar (NEU V1.2)
 *   - Globaler Error-Catcher (window.onerror + unhandledrejection)
 *   - Automatische Zuordnung zu bekannten CeraCUT-Fallen
 *   - Session-Log in sessionStorage (letzte 200 Einträge)
 *   - Action-Tracker: Letzte 50 User-Aktionen protokolliert
 *   - Performance-Monitor: Frames die >100ms dauern
 *   - Debug-Overlay: Strg+Shift+D → öffnet/schließt Panel
 *   - Git-Commit-Info im Footer (Hash, Datum, Message)
 *   - JSON-Export für Claude Code Analyse (inkl. Console-Log)
 *   - Kein Framework, kein Build-Tool — reines Vanilla JS
 *
 * V1.2 Änderungen:
 *   - Console-Interceptor fängt alle console.* Aufrufe ab ohne Refactoring
 *   - Neuer "Log"-Tab: scrollbarer Live-Log mit Modul-Filter-Chips,
 *     Level-Toggle (Alle / WARN+ / ERROR) und Freitext-Suche
 *   - Fehler-Tab zeigt die 5 Logs direkt vor jedem Error als Kontext
 *   - JSON-Export enthält jetzt vollständigen Console-Log
 *
 * Aktivierung: Als ERSTES Script in index.html laden
 *   <script src="js/debug-monitor.js?v=20260630-consolelog"></script>
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════
    // CONSOLE-INTERCEPTOR — muss als Erstes laufen
    // Speichert Originale VOR allen Wrappings
    // ═══════════════════════════════════════════════════════

    const _origConsole = {
        log:   console.log.bind(console),
        warn:  console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
    };

    const MAX_CONSOLE_ENTRIES = 600;
    let _consoleLog  = [];   // { ts, level, module, text }
    let _levelFilter = 'all'; // 'all' | 'warn' | 'error'
    let _moduleFilter = null; // null = alle, string = Modul-Name
    let _logSearch   = '';
    let _intercepting = false;

    function _extractModule(text) {
        const m = text.match(/^\[([^\]]+)\]/);
        if (!m) return null;
        // "[Pipeline V3.9]" → "Pipeline", "[SORT]" → "SORT", "[V3.5]" → null
        const raw = m[1].replace(/\s+V[\d.].*$/, '').trim();
        return /^V[\d.]/.test(raw) ? null : (raw || null);
    }

    function _interceptConsole() {
        ['log', 'warn', 'error', 'debug'].forEach(level => {
            console[level] = function(...args) {
                _origConsole[level].apply(console, args);
                if (_intercepting) return;
                _intercepting = true;
                try {
                    const text = args.map(a => {
                        if (a === null) return 'null';
                        if (a === undefined) return 'undefined';
                        if (typeof a === 'object') {
                            try { return JSON.stringify(a).slice(0, 300); } catch(e) { return String(a); }
                        }
                        return String(a);
                    }).join(' ');
                    _consoleLog.push({ ts: Date.now(), level, module: _extractModule(text), text });
                    if (_consoleLog.length > MAX_CONSOLE_ENTRIES) {
                        _consoleLog.splice(0, _consoleLog.length - MAX_CONSOLE_ENTRIES);
                    }
                } finally {
                    _intercepting = false;
                }
            };
        });
    }

    _interceptConsole();

    console.debug('[DebugMonitor V1.2] Strg+Shift+D für Overlay — Console-Interceptor aktiv');

    // ═══════════════════════════════════════════════════════
    // BEKANNTE CeraCUT-FALLEN (aus system-anweisung V16)
    // ═══════════════════════════════════════════════════════

    const KNOWN_TRAPS = [
        {
            id: 'duplicate-class',
            pattern: /Identifier '(.+)' has already been declared/i,
            label: '🔴 Klassen-Duplikat',
            hint: 'Klasse nur in EINER Datei definieren! Grep nach dem Klassenname in allen JS-Dateien.',
            severity: 'critical'
        },
        {
            id: 'rubberband-data',
            pattern: /Cannot read propert(?:y|ies) of undefined.*data/i,
            label: '🔴 RubberBand ohne data-Wrapper',
            hint: 'Format muss sein: { type: "line", data: { start, end } } — der data-Wrapper fehlt!',
            severity: 'critical'
        },
        {
            id: 'browser-cache',
            pattern: /SyntaxError.*unexpected token/i,
            label: '🟡 Browser-Cache veraltet',
            hint: 'Cache-Busting: ?v= Parameter in index.html hochzählen. Dann Hard-Reload (Strg+Shift+R).',
            severity: 'warning'
        },
        {
            id: 'canvas-arc-yflip',
            pattern: /arc.*scale.*-1|scale.*-1.*arc/i,
            label: '🟡 Canvas Arc Y-Flip',
            hint: 'Bei scale(1,-1): ctx.arc(cx, cy, r, -sa, -ea, false) — negative Winkel wegen Y-Spiegelung!',
            severity: 'warning'
        },
        {
            id: 'lazy-patch-order',
            pattern: /is not a constructor|Cannot read.*prototype/i,
            label: '🔴 Lazy-Patch Reihenfolge',
            hint: 'advanced-tools.js → drawing-tools-ext.js → text-tool.js MÜSSEN nach tool-manager.js geladen werden!',
            severity: 'critical'
        },
        {
            id: 'undo-missing',
            pattern: /\[UndoManager/i,
            label: '✅ UndoManager aktiv',
            hint: 'UndoManager ist registriert — gut.',
            severity: 'info',
            isPositive: true
        },
        {
            id: 'property-no-render',
            pattern: /property.*=.*value|value.*property/i,
            label: '🟡 Property ohne Render?',
            hint: '_refreshAfterUndoRedo() nach undo/redo aufrufen!',
            severity: 'warning'
        },
        {
            id: 'font-cors',
            pattern: /opentype|XHR.*font|font.*blocked|CORS.*font/i,
            label: '🟡 Font-Loading blockiert',
            hint: 'file:// blockiert XHR → FileReader API + File-Picker verwenden statt opentype.load(url).',
            severity: 'warning'
        },
        {
            id: 'flyout-not-closing',
            pattern: /flyout|document.*click/i,
            label: '🟡 Flyout schließt nicht',
            hint: 'Document-Click-Handler fehlt: document.addEventListener("click", closeFlyouts).',
            severity: 'warning'
        },
        {
            id: 'grip-click-bleed',
            pattern: /grip.*drag|drag.*grip|gripDrag/i,
            label: '🟡 Grip-Drag Click-Bleed',
            hint: 'gripDragJustEnded Guard fehlt — mouseup nach Grip-Drag hebt Selektion auf.',
            severity: 'warning'
        },
        {
            id: 'single-char-shortcut',
            pattern: /shortcut.*input|input.*shortcut/i,
            label: '🟡 Single-Char-Shortcut fängt Multi-Char ab',
            hint: 'Bei nicht-leerem cmd-input → alle Tasten dorthin routen, nicht als Shortcut behandeln.',
            severity: 'warning'
        },
        {
            id: 'cross-layer-chaining',
            pattern: /chaining|_findGridMatch|layer.*chain|chain.*layer/i,
            label: '🟡 Cross-Layer Chaining',
            hint: 'Layer-Filter in _findGridMatch() prüfen (V3.3 Fix).',
            severity: 'warning'
        },
        {
            id: 'data-tool-mismatch',
            pattern: /data-tool|ribbon.*tool|tool.*ribbon/i,
            label: '🟡 Ribbon data-tool Attribut',
            hint: 'data-tool muss exakt dem registrierten Shortcut in tool-manager.js entsprechen!',
            severity: 'warning'
        }
    ];

    // ═══════════════════════════════════════════════════════
    // SESSION LOG MANAGEMENT
    // ═══════════════════════════════════════════════════════

    const SESSION_KEY = 'ceracut_debug_log';
    const MAX_LOG_ENTRIES = 200;
    const MAX_ACTION_ENTRIES = 50;

    let _sessionLog = [];
    let _actionLog = [];
    let _perfWarnings = [];
    let _overlayVisible = false;

    function _loadFromStorage() {
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                _sessionLog = parsed.errors || [];
                _actionLog = parsed.actions || [];
                _perfWarnings = parsed.perf || [];
            }
        } catch(e) {
            _sessionLog = [];
            _actionLog = [];
        }
    }

    function _saveToStorage() {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({
                errors: _sessionLog.slice(-MAX_LOG_ENTRIES),
                actions: _actionLog.slice(-MAX_ACTION_ENTRIES),
                perf: _perfWarnings.slice(-50),
                lastUpdate: new Date().toISOString(),
                buildVersion: '6.69',
                buildDate: '20260630'
            }));
        } catch(e) {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }

    function _matchKnownTrap(message, stack) {
        const combined = (message || '') + (stack || '');
        for (const trap of KNOWN_TRAPS) {
            if (trap.pattern.test(combined)) {
                return trap;
            }
        }
        return null;
    }

    function _logError(type, message, source, line, col, stack, extra) {
        const trap = _matchKnownTrap(message, stack);
        const entry = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            type,
            message: String(message || 'Unbekannter Fehler'),
            source: source || '',
            line: line || 0,
            col: col || 0,
            stack: stack || '',
            trap: trap ? { id: trap.id, label: trap.label, hint: trap.hint, severity: trap.severity } : null,
            lastActions: _actionLog.slice(-5),
            extra: extra || null
        };

        _sessionLog.push(entry);
        if (_sessionLog.length > MAX_LOG_ENTRIES) {
            _sessionLog = _sessionLog.slice(-MAX_LOG_ENTRIES);
        }

        _saveToStorage();

        const severity = trap?.severity || 'error';
        const colors = {
            critical: 'background: #c00; color: white; padding: 2px 6px; border-radius: 2px',
            error:    'background: #900; color: white; padding: 2px 6px; border-radius: 2px',
            warning:  'background: #c60; color: white; padding: 2px 6px; border-radius: 2px',
            info:     'background: #060; color: white; padding: 2px 6px; border-radius: 2px'
        };

        if (trap && !trap.isPositive) {
            _origConsole.debug('%c' + trap.label + ' ' + message, colors[severity]);
        } else if (!trap) {
            _origConsole.debug('%c🔴 Unbekannter Fehler: ' + message, colors.error);
        }

        if (_overlayVisible) {
            _updateOverlay();
        }
    }

    // ═══════════════════════════════════════════════════════
    // ACTION TRACKER
    // ═══════════════════════════════════════════════════════

    function _trackAction(action) {
        _actionLog.push({
            timestamp: new Date().toISOString(),
            action
        });
        if (_actionLog.length > MAX_ACTION_ENTRIES) {
            _actionLog = _actionLog.slice(-MAX_ACTION_ENTRIES);
        }
    }

    function _setupActionTracking() {
        document.addEventListener('click', (e) => {
            const el = e.target;
            const tag = el.tagName;
            const id = el.id ? '#' + el.id : '';
            const cls = el.className && typeof el.className === 'string'
                ? '.' + el.className.split(' ').filter(c => c && c.length < 30).slice(0,2).join('.')
                : '';
            const tool = el.dataset?.tool || el.dataset?.ribbon || '';
            const label = el.textContent?.trim().slice(0,30) || '';
            _trackAction(`click ${tag}${id}${cls}${tool ? ' [tool:' + tool + ']' : ''}${label ? ' "' + label + '"' : ''}`);
        }, true);

        document.addEventListener('keydown', (e) => {
            if (['Shift','Control','Alt','Meta'].includes(e.key)) return;
            const mod = (e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '');
            _trackAction(`key ${mod}${e.key}`);
        }, true);

        document.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (files?.length) {
                _trackAction(`drop ${files.length} Datei(en): ${Array.from(files).map(f => f.name).join(', ')}`);
            }
        }, true);

        console.debug('[DebugMonitor V1.2] Action-Tracking aktiv');
    }

    // ═══════════════════════════════════════════════════════
    // PERFORMANCE MONITOR
    // ═══════════════════════════════════════════════════════

    function _setupPerformanceMonitor() {
        let _lastFrameTime = performance.now();
        let _frameDropCount = 0;

        function _checkFrame(now) {
            const delta = now - _lastFrameTime;
            _lastFrameTime = now;

            if (delta > 100 && delta < 5000) {
                _frameDropCount++;
                if (_frameDropCount <= 20 || _frameDropCount % 50 === 0) {
                    const warn = {
                        timestamp: new Date().toISOString(),
                        deltaMs: Math.round(delta),
                        count: _frameDropCount
                    };
                    _perfWarnings.push(warn);
                    if (_frameDropCount <= 5) {
                        _origConsole.warn(`[DebugMonitor V1.2] 🐢 Frame-Drop: ${Math.round(delta)}ms`);
                    }
                }
            }

            requestAnimationFrame(_checkFrame);
        }

        requestAnimationFrame(_checkFrame);

        setInterval(() => {
            if (_frameDropCount > 0 && _frameDropCount % 10 === 0) {
                _origConsole.warn(`[DebugMonitor V1.2] Performance: ${_frameDropCount} Frame-Drops seit Session-Start`);
            }
        }, 30000);

        console.debug('[DebugMonitor V1.2] Performance-Monitor aktiv (Schwelle: 100ms)');
    }

    // ═══════════════════════════════════════════════════════
    // GLOBALE ERROR-HANDLER
    // ═══════════════════════════════════════════════════════

    function _setupErrorHandlers() {
        const _origOnerror = window.onerror;
        window.onerror = function(message, source, line, col, error) {
            _logError('js-error', message, source, line, col, error?.stack);
            if (_origOnerror) return _origOnerror.apply(this, arguments);
            return false;
        };

        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            const msg = reason?.message || String(reason) || 'Unbehandelte Promise-Ablehnung';
            const stack = reason?.stack || '';
            _logError('promise-rejection', msg, 'Promise', 0, 0, stack);
        });

        // console.error überwachen (console[error] ist jetzt mein Interceptor als _origError)
        const _origError = console.error;
        console.error = function(...args) {
            _origError.apply(console, args); // → mein Interceptor → _origConsole.error
            const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a).slice(0,200) : String(a)).join(' ');
            if (msg.length > 3 && !msg.includes('[DebugMonitor')) {
                _logError('console-error', msg, 'console.error', 0, 0, '');
            }
        };

        console.log('[DebugMonitor V1.2] Error-Handler registriert');
    }

    // ═══════════════════════════════════════════════════════
    // LOG-TAB RENDERER
    // ═══════════════════════════════════════════════════════

    const LEVEL_COLORS = {
        log:   '#999',
        debug: '#555',
        warn:  '#e8a000',
        error: '#ff5555'
    };

    function _renderLogTab() {
        const content = document.getElementById('wdm-content');
        if (!content) return;

        // Filtern
        let entries = [..._consoleLog].reverse();
        if (_levelFilter === 'warn')  entries = entries.filter(l => l.level === 'warn' || l.level === 'error');
        if (_levelFilter === 'error') entries = entries.filter(l => l.level === 'error');
        if (_moduleFilter) entries = entries.filter(l => (l.module || '(other)') === _moduleFilter);
        if (_logSearch) {
            const q = _logSearch.toLowerCase();
            entries = entries.filter(l => l.text.toLowerCase().includes(q));
        }
        const displayEntries = entries.slice(0, 400);

        // Alle Module (aus ungefilterten Daten)
        const allModules = [...new Set(_consoleLog.map(l => l.module || '(other)'))].sort();

        const btnBase = 'border:none;padding:2px 8px;border-radius:10px;cursor:pointer;font-size:10px;font-family:Consolas,monospace;';
        const levelBtns = [
            { l: 'all',   label: 'Alle',   bg: _levelFilter==='all'   ? '#ff9800' : '#2a2a2a', fg: _levelFilter==='all'   ? '#000' : '#888' },
            { l: 'warn',  label: 'WARN+',  bg: _levelFilter==='warn'  ? '#c60'    : '#2a2a2a', fg: _levelFilter==='warn'  ? '#fff' : '#888' },
            { l: 'error', label: 'ERROR',  bg: _levelFilter==='error' ? '#c00'    : '#2a2a2a', fg: _levelFilter==='error' ? '#fff' : '#888' },
        ].map(b => `<button class="wdm-level" data-l="${b.l}" style="${btnBase}background:${b.bg};color:${b.fg};">${b.label}</button>`).join('');

        const modBtnAll = `<button class="wdm-mod" data-m="" style="${btnBase}background:${!_moduleFilter?'#ff9800':'#2a2a2a'};color:${!_moduleFilter?'#000':'#666'};">Alle</button>`;
        const modBtns = allModules.map(m =>
            `<button class="wdm-mod" data-m="${_esc(m)}" style="${btnBase}background:${_moduleFilter===m?'#005fa3':'#1e1e1e'};color:${_moduleFilter===m?'#fff':'#666'};">${_esc(m)}</button>`
        ).join('');

        const formatTs = ts => {
            const d = new Date(ts);
            return d.toLocaleTimeString('de-DE', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3,'0');
        };

        const logRows = displayEntries.length === 0
            ? '<div style="padding:20px;text-align:center;color:#444;">Keine Einträge</div>'
            : displayEntries.map(e => {
                const mod = e.module ? `<span style="color:#4fc3f7;flex-shrink:0;min-width:60px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(e.module)}</span>` : '';
                const hi = _logSearch && e.text.toLowerCase().includes(_logSearch.toLowerCase())
                    ? e.text.replace(new RegExp(`(${_logSearch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark style="background:#5a4000;color:#ffd;border-radius:2px;">$1</mark>')
                    : _esc(e.text.slice(0, 350));
                return `<div style="border-bottom:1px solid #181818;padding:2px 8px;display:flex;gap:6px;align-items:baseline;min-height:18px;">
                    <span style="color:#3a3a3a;flex-shrink:0;font-size:9px;min-width:75px;">${formatTs(e.ts)}</span>
                    <span style="color:${LEVEL_COLORS[e.level]||'#aaa'};flex-shrink:0;font-size:9px;min-width:36px;">${e.level.toUpperCase()}</span>
                    ${mod}
                    <span style="color:${LEVEL_COLORS[e.level]||'#aaa'};word-break:break-all;font-size:10px;">${_logSearch ? hi : _esc(e.text.slice(0, 350))}</span>
                </div>`;
            }).join('');

        content.innerHTML = `
            <div style="position:sticky;top:0;z-index:2;background:#111;border-bottom:1px solid #2a2a2a;">
                <div style="padding:5px 8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                    ${levelBtns}
                    <span style="color:#333;margin:0 3px;">|</span>
                    <input id="wdm-log-search" type="text" value="${_esc(_logSearch)}" placeholder="🔍 Suche in Logs..." style="background:#1e1e1e;color:#ddd;border:1px solid #3a3a3a;padding:2px 7px;border-radius:10px;font-size:10px;width:140px;font-family:Consolas,monospace;outline:none;">
                    <span style="color:#444;font-size:10px;margin-left:auto;">${displayEntries.length} / ${_consoleLog.length} Einträge</span>
                    <button id="wdm-log-refresh" style="${btnBase}background:#1a2a1a;color:#4a8;">↺ Refresh</button>
                </div>
                <div style="padding:3px 8px 5px;display:flex;flex-wrap:wrap;gap:3px;">
                    ${modBtnAll}${modBtns}
                </div>
            </div>
            <div id="wdm-log-list">${logRows}</div>
        `;

        // Event-Listener für Filter-Controls
        content.querySelectorAll('.wdm-level').forEach(btn => {
            btn.addEventListener('click', () => { _levelFilter = btn.dataset.l; _renderLogTab(); });
        });
        content.querySelectorAll('.wdm-mod').forEach(btn => {
            btn.addEventListener('click', () => { _moduleFilter = btn.dataset.m || null; _renderLogTab(); });
        });
        const searchEl = content.querySelector('#wdm-log-search');
        if (searchEl) {
            searchEl.addEventListener('input', () => { _logSearch = searchEl.value; _renderLogTab(); });
            // Fokus nicht erzwingen — würde Ribbon-Shortcuts stören
        }
        const refreshEl = content.querySelector('#wdm-log-refresh');
        if (refreshEl) {
            refreshEl.addEventListener('click', () => _renderLogTab());
        }
    }

    // ═══════════════════════════════════════════════════════
    // DEBUG OVERLAY UI
    // ═══════════════════════════════════════════════════════

    function _createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'ceracut-debug-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 560px;
            max-height: 82vh;
            background: #1a1a1a;
            color: #e0e0e0;
            border: 1px solid #ff9800;
            border-radius: 4px;
            font-family: Consolas, monospace;
            font-size: 11px;
            z-index: 999999;
            box-shadow: 0 4px 24px rgba(0,0,0,0.7);
            display: none;
            flex-direction: column;
            overflow: hidden;
        `;

        overlay.innerHTML = `
            <div id="wdm-header" style="
                background: #2a1a00;
                border-bottom: 1px solid #ff9800;
                padding: 6px 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: move;
                user-select: none;
            ">
                <span style="color: #ff9800; font-weight: bold;">🔍 CeraCUT Debug Monitor V1.2</span>
                <div style="display: flex; gap: 6px;">
                    <button id="wdm-export" style="background:#004499;color:#fff;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:10px;">📥 Export JSON</button>
                    <button id="wdm-clear" style="background:#440000;color:#fff;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:10px;">🗑 Löschen</button>
                    <button id="wdm-close" style="background:#333;color:#fff;border:none;padding:2px 8px;border-radius:2px;cursor:pointer;font-size:10px;">✕</button>
                </div>
            </div>
            <div id="wdm-tabs" style="display:flex;border-bottom:1px solid #333;">
                <button class="wdm-tab active" data-tab="log"     style="flex:1;padding:4px;background:#222;border:none;color:#e0e0e0;cursor:pointer;font-size:10px;border-bottom:2px solid #ff9800;">Log</button>
                <button class="wdm-tab"        data-tab="errors"  style="flex:1;padding:4px;background:#1a1a1a;border:none;color:#888;cursor:pointer;font-size:10px;">Fehler</button>
                <button class="wdm-tab"        data-tab="actions" style="flex:1;padding:4px;background:#1a1a1a;border:none;color:#888;cursor:pointer;font-size:10px;">Aktionen</button>
                <button class="wdm-tab"        data-tab="perf"    style="flex:1;padding:4px;background:#1a1a1a;border:none;color:#888;cursor:pointer;font-size:10px;">Perf</button>
                <button class="wdm-tab"        data-tab="traps"   style="flex:1;padding:4px;background:#1a1a1a;border:none;color:#888;cursor:pointer;font-size:10px;">Fallen (${KNOWN_TRAPS.filter(t=>!t.isPositive).length})</button>
            </div>
            <div id="wdm-content" style="overflow-y:auto;flex:1;max-height:calc(82vh - 90px);"></div>
            <div id="wdm-footer" style="background:#111;padding:4px 10px;font-size:10px;color:#666;border-top:1px solid #333;">
                <div>Strg+Shift+D zum Schließen · Letzte Aktualisierung: —</div>
                <div id="wdm-git" style="color:#4fc3f7;margin-top:2px;font-family:monospace;"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Git-Commit-Info
        const gitEl = document.getElementById('wdm-git');
        if (gitEl && typeof CERACUT_BUILD !== 'undefined' && CERACUT_BUILD.git) {
            const g = CERACUT_BUILD.git;
            gitEl.textContent = `Git: ${g.hash} · ${g.date} · ${g.message}`;
        }

        let _activeTab = 'log';

        // Tab-Switching
        overlay.querySelectorAll('.wdm-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                overlay.querySelectorAll('.wdm-tab').forEach(t => {
                    t.style.background = '#1a1a1a';
                    t.style.color = '#888';
                    t.style.borderBottom = 'none';
                });
                tab.style.background = '#222';
                tab.style.color = '#e0e0e0';
                tab.style.borderBottom = '2px solid #ff9800';
                _activeTab = tab.dataset.tab;
                _renderTab(_activeTab);
            });
        });

        // Buttons
        document.getElementById('wdm-close').addEventListener('click', () => _toggleOverlay());
        document.getElementById('wdm-clear').addEventListener('click', () => {
            _sessionLog = [];
            _actionLog = [];
            _perfWarnings = [];
            _consoleLog = [];
            sessionStorage.removeItem(SESSION_KEY);
            _renderTab(_activeTab);
            _origConsole.log('[DebugMonitor V1.2] Log geleert');
        });
        document.getElementById('wdm-export').addEventListener('click', () => _exportJSON());

        _makeDraggable(overlay, document.getElementById('wdm-header'));

        overlay._renderTab = _renderTab;
        overlay._activeTab = () => _activeTab;

        function _renderTab(tab) {
            const content = document.getElementById('wdm-content');
            const footer  = document.getElementById('wdm-footer');

            if (footer) {
                footer.firstElementChild.textContent =
                    `Strg+Shift+D zum Schließen · Aktualisiert: ${new Date().toLocaleTimeString('de-DE')}`;
            }

            if (tab === 'log') {
                _renderLogTab();
                return;
            }

            if (tab === 'errors') {
                if (_sessionLog.length === 0) {
                    content.innerHTML = '<div style="padding:20px;text-align:center;color:#0a0;">✅ Keine Fehler in dieser Session!</div>';
                    return;
                }
                const entries = [..._sessionLog].reverse().slice(0, 50);
                content.innerHTML = entries.map(e => {
                    const colors = { critical: '#ff4444', error: '#ff6666', warning: '#ffaa00', info: '#66ff66' };
                    const severity = e.trap?.severity || 'error';
                    const color = colors[severity] || '#ff6666';

                    // Kontext: letzte 5 Logs vor diesem Fehler
                    const errorTs = new Date(e.timestamp).getTime();
                    const ctxLogs = _consoleLog
                        .filter(l => l.ts < errorTs && l.ts >= errorTs - 10000)
                        .slice(-5);
                    const ctxHtml = ctxLogs.length > 0 ? `
                        <div style="margin-top:5px;padding:4px 7px;background:#13100a;border-left:2px solid #554400;border-radius:2px;">
                            <div style="color:#554;font-size:9px;margin-bottom:2px;">Kontext (${ctxLogs.length} Logs davor):</div>
                            ${ctxLogs.map(l => `<div style="font-size:9px;color:${LEVEL_COLORS[l.level]||'#666'};word-break:break-all;">${_esc(l.text.slice(0, 180))}</div>`).join('')}
                        </div>` : '';

                    return `
                        <div style="border-bottom:1px solid #2a2a2a;padding:7px 10px;">
                            <div style="color:${color};font-weight:bold;">${e.trap?.label || '🔴 ' + e.type}</div>
                            <div style="color:#ccc;margin-top:2px;word-break:break-all;">${_esc(e.message.slice(0,200))}</div>
                            ${e.trap?.hint ? `<div style="color:#ffaa00;margin-top:3px;font-size:10px;">💡 ${_esc(e.trap.hint)}</div>` : ''}
                            ${ctxHtml}
                            <div style="color:#555;margin-top:3px;font-size:10px;">${e.source ? e.source.split('/').pop() + ':' + e.line : ''} · ${new Date(e.timestamp).toLocaleTimeString('de-DE')}</div>
                        </div>
                    `;
                }).join('');
            }
            else if (tab === 'actions') {
                const actions = [..._actionLog].reverse().slice(0, 50);
                if (actions.length === 0) {
                    content.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Noch keine Aktionen</div>';
                    return;
                }
                content.innerHTML = actions.map(a => `
                    <div style="border-bottom:1px solid #1a1a1a;padding:3px 10px;color:#aaa;font-size:10px;">
                        <span style="color:#555;">${new Date(a.timestamp).toLocaleTimeString('de-DE')}</span>
                        &nbsp;${_esc(a.action)}
                    </div>
                `).join('');
            }
            else if (tab === 'perf') {
                const drops = _perfWarnings.slice(-30);
                if (drops.length === 0) {
                    content.innerHTML = '<div style="padding:20px;text-align:center;color:#0a0;">✅ Keine Frame-Drops!</div>';
                    return;
                }
                const total = drops.reduce((s, w) => s + w.deltaMs, 0);
                content.innerHTML = `
                    <div style="padding:8px 10px;color:#ffaa00;">⚠ ${drops.length} Frame-Drops · Ø ${Math.round(total/drops.length)}ms</div>
                    ${[...drops].reverse().map(w => `
                        <div style="border-bottom:1px solid #1a1a1a;padding:3px 10px;color:#aaa;font-size:10px;">
                            <span style="color:${w.deltaMs > 200 ? '#ff4444' : '#ffaa00'};">${w.deltaMs}ms</span>
                            &nbsp;·&nbsp;
                            <span style="color:#555;">${new Date(w.timestamp).toLocaleTimeString('de-DE')}</span>
                            &nbsp;·&nbsp;#${w.count}
                        </div>
                    `).join('')}
                `;
            }
            else if (tab === 'traps') {
                const activeFalls = KNOWN_TRAPS.filter(t => !t.isPositive);
                const hitIds = new Set(_sessionLog.map(e => e.trap?.id).filter(Boolean));
                content.innerHTML = activeFalls.map(trap => {
                    const hit = hitIds.has(trap.id);
                    const hitCount = _sessionLog.filter(e => e.trap?.id === trap.id).length;
                    const bg = hit ? 'background: #1a0000;' : '';
                    return `
                        <div style="border-bottom:1px solid #2a2a2a;padding:6px 10px;${bg}">
                            <div style="display:flex;justify-content:space-between;">
                                <span style="color:${hit ? '#ff4444' : '#666'};font-weight:${hit ? 'bold' : 'normal'};">${trap.label}</span>
                                ${hit ? `<span style="background:#600;color:#fff;padding:1px 6px;border-radius:10px;font-size:10px;">${hitCount}× getroffen!</span>` : '<span style="color:#333;font-size:10px;">— nicht getroffen</span>'}
                            </div>
                            <div style="color:#777;font-size:10px;margin-top:2px;">💡 ${_esc(trap.hint)}</div>
                        </div>
                    `;
                }).join('');
            }
        }

        return { overlay, renderTab: _renderTab, getActiveTab: () => _activeTab };
    }

    function _esc(str) {
        return String(str)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;');
    }

    function _makeDraggable(el, handle) {
        let startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            el.style.right = 'auto';
            el.style.left = startLeft + 'px';
            el.style.top = startTop + 'px';

            function onMove(e) {
                el.style.left = (startLeft + e.clientX - startX) + 'px';
                el.style.top  = (startTop  + e.clientY - startY) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    let _overlayRef = null;

    function _toggleOverlay() {
        if (!_overlayRef) {
            _overlayRef = _createOverlay();
        }
        const el = document.getElementById('ceracut-debug-overlay');
        _overlayVisible = !_overlayVisible;
        el.style.display = _overlayVisible ? 'flex' : 'none';
        if (_overlayVisible) {
            _overlayRef.renderTab(_overlayRef.getActiveTab());
        }
    }

    function _updateOverlay() {
        if (_overlayRef && _overlayVisible) {
            _overlayRef.renderTab(_overlayRef.getActiveTab());
        }
    }

    // ═══════════════════════════════════════════════════════
    // JSON EXPORT (für Claude Code)
    // ═══════════════════════════════════════════════════════

    function _exportJSON() {
        const data = {
            meta: {
                exportTime: new Date().toISOString(),
                sessionStart: _sessionLog[0]?.timestamp || new Date().toISOString(),
                buildVersion: '6.69',
                buildDate: '20260630',
                totalErrors: _sessionLog.length,
                totalActions: _actionLog.length,
                totalConsoleLogs: _consoleLog.length,
                totalPerfWarnings: _perfWarnings.length
            },
            summary: {
                criticalErrors: _sessionLog.filter(e => e.trap?.severity === 'critical').length,
                warnings: _sessionLog.filter(e => e.trap?.severity === 'warning').length,
                unknownErrors: _sessionLog.filter(e => !e.trap).length,
                trapsHit: [...new Set(_sessionLog.map(e => e.trap?.id).filter(Boolean))],
                modulesCalled: [...new Set(_consoleLog.map(l => l.module).filter(Boolean))].sort(),
                avgFrameDrop: _perfWarnings.length > 0
                    ? Math.round(_perfWarnings.reduce((s,w) => s + w.deltaMs, 0) / _perfWarnings.length)
                    : 0
            },
            errors: _sessionLog,
            consoleLogs: _consoleLog.slice(-300), // letzte 300 Einträge
            actions: _actionLog,
            perfWarnings: _perfWarnings,
            knownTraps: KNOWN_TRAPS.filter(t => !t.isPositive).map(t => ({
                id: t.id,
                label: t.label,
                hint: t.hint,
                severity: t.severity,
                hitCount: _sessionLog.filter(e => e.trap?.id === t.id).length
            }))
        };

        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ceracut-debug-${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        _origConsole.log(`[DebugMonitor V1.2] JSON exportiert: ${_sessionLog.length} Fehler, ${_consoleLog.length} Console-Logs`);
    }

    // ═══════════════════════════════════════════════════════
    // KEYBOARD SHORTCUT
    // ═══════════════════════════════════════════════════════

    function _setupShortcut() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                e.stopPropagation();
                _toggleOverlay();
            }
        }, true);
        console.debug('[DebugMonitor V1.2] Shortcut registriert');
    }

    // ═══════════════════════════════════════════════════════
    // PUBLIC API (window.ceracutDebug)
    // ═══════════════════════════════════════════════════════

    window.ceracutDebug = {
        toggle:      _toggleOverlay,
        getLog:      () => [..._sessionLog],
        getLogs:     () => [..._consoleLog],   // Console-Log (NEU V1.2)
        getActions:  () => [..._actionLog],
        getPerf:     () => [..._perfWarnings],
        exportJSON:  _exportJSON,

        clear: () => {
            _sessionLog = [];
            _actionLog = [];
            _perfWarnings = [];
            _consoleLog = [];
            sessionStorage.removeItem(SESSION_KEY);
            _origConsole.log('[DebugMonitor V1.2] Log geleert via API');
        },

        logError: (msg, source) => _logError('manual', msg, source || 'manual', 0, 0, ''),

        showTraps: () => {
            _origConsole.group('[DebugMonitor V1.2] Bekannte CeraCUT-Fallen:');
            KNOWN_TRAPS.filter(t => !t.isPositive).forEach(t => {
                const hits = _sessionLog.filter(e => e.trap?.id === t.id).length;
                _origConsole.log(`${t.label} [${hits > 0 ? '⚠ ' + hits + '× getroffen' : '✅ nicht getroffen'}]\n  💡 ${t.hint}`);
            });
            _origConsole.groupEnd();
        },

        /** Alle Logs eines Moduls in der Console ausgeben */
        module: (name) => {
            const logs = _consoleLog.filter(l => l.module && l.module.toLowerCase().includes(name.toLowerCase()));
            _origConsole.group(`[DebugMonitor V1.2] Modul-Log: "${name}" (${logs.length} Einträge)`);
            logs.forEach(l => _origConsole.log(`[${l.level.toUpperCase()}] ${l.text}`));
            _origConsole.groupEnd();
        },

        summary: () => {
            const crits = _sessionLog.filter(e => e.trap?.severity === 'critical').length;
            const warns = _sessionLog.filter(e => e.trap?.severity === 'warning').length;
            const unkn  = _sessionLog.filter(e => !e.trap).length;
            const traps = [...new Set(_sessionLog.map(e => e.trap?.id).filter(Boolean))];
            _origConsole.group('[DebugMonitor V1.2] Session-Zusammenfassung');
            _origConsole.log(`Fehler: ${crits} kritisch, ${warns} Warnungen, ${unkn} unbekannt`);
            _origConsole.log(`Console-Logs: ${_consoleLog.length} | Aktionen: ${_actionLog.length} | Frame-Drops: ${_perfWarnings.length}`);
            if (traps.length) _origConsole.log(`Getroffene Fallen: ${traps.join(', ')}`);
            else _origConsole.log('✅ Keine bekannten Fallen getroffen!');
            _origConsole.groupEnd();
        }
    };

    // ═══════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════

    _loadFromStorage();
    _setupErrorHandlers();
    _setupShortcut();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            _setupActionTracking();
            _setupPerformanceMonitor();
        });
    } else {
        _setupActionTracking();
        _setupPerformanceMonitor();
    }

    if (_sessionLog.length > 0) {
        _origConsole.warn(`[DebugMonitor V1.2] ⚠ ${_sessionLog.length} Fehler aus vorheriger Session — Strg+Shift+D zum Anzeigen`);
    }

})();
