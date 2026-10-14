/*
 * Valour analytics tracker — drop-in, no dependencies.
 * Sends events straight to the Supabase `analytics_events` table using the public anon key
 * (row level security only allows inserts, so the key can't be used to read anything).
 *
 * Landing page:
 *   <script src="valour-analytics.js"></script>
 *   <script>ValourAnalytics.init({ url: 'https://xxx.supabase.co', key: 'ANON_KEY', source: 'landing' });</script>
 *   <a data-track="play_button" href="/play">Play</a>
 *   <a data-track="social_discord" href="...">...</a>
 *   <section data-track-view="trailer_section">...</section>
 *
 * Game:
 *   ValourAnalytics.init({ url, key, source: 'game', userId: player.id });
 *   ValourAnalytics.startSession();                  // when the player enters the game
 *   ValourAnalytics.click('shop_button');            // button clicks
 *   ValourAnalytics.view('deck_builder_screen');     // screen / button impressions
 *   ValourAnalytics.cardPlayed('fireball', 'Fireball', { match_id: '...' });
 *   ValourAnalytics.endSession();                    // optional; also sent on tab close
 */
(function (global) {
  'use strict';

  var HEARTBEAT_MS = 30000;
  var IDLE_RESTART_MS = 5 * 60000; // hidden longer than this -> new session on return
  var FLUSH_MS = 3000;
  var MAX_BATCH = 20;

  var cfg = null;
  var queue = [];
  var flushTimer = null;
  var heartbeatTimer = null;
  var sessionId = null;
  var hiddenAt = null;
  var visitorId = null;

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem('valour_vid');
      if (!id) {
        id = uid();
        localStorage.setItem('valour_vid', id);
      }
      return id;
    } catch (e) {
      return uid();
    }
  }

  function send(events, keepalive) {
    if (!cfg || !events.length) return;
    try {
      fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/analytics_events', {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: 'Bearer ' + cfg.key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(events),
        keepalive: !!keepalive,
      }).catch(function (err) {
        if (cfg.debug) console.warn('[ValourAnalytics] send failed', err);
      });
    } catch (err) {
      if (cfg.debug) console.warn('[ValourAnalytics] send failed', err);
    }
  }

  function flush(keepalive) {
    clearTimeout(flushTimer);
    flushTimer = null;
    if (!queue.length) return;
    var batch = queue.splice(0, queue.length);
    send(batch, keepalive);
  }

  function track(eventType, element, metadata) {
    if (!cfg) {
      console.warn('[ValourAnalytics] call init() first');
      return;
    }
    var evt = {
      source: cfg.source,
      event_type: eventType,
      element: element == null ? null : String(element).slice(0, 120),
      user_id: cfg.userId == null ? null : String(cfg.userId),
      session_id: sessionId,
      visitor_id: visitorId,
      metadata: metadata || {},
    };
    if (cfg.debug) console.log('[ValourAnalytics]', evt);
    queue.push(evt);
    if (queue.length >= MAX_BATCH) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
  }

  function autoTrackClicks() {
    document.addEventListener(
      'click',
      function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
        if (!el) return;
        track('click', el.getAttribute('data-track'), {
          href: el.getAttribute('href') || undefined,
          placement: el.getAttribute('data-track-placement') || undefined,
          path: location.pathname,
        });
        // Links that navigate away: send now so the click isn't lost.
        if (el.tagName === 'A') flush(true);
      },
      true
    );
  }

  function autoTrackViews() {
    if (!('IntersectionObserver' in global)) return;
    var seen = {};
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var name = entry.target.getAttribute('data-track-view');
          if (seen[name]) return;
          seen[name] = true;
          track('view', name, { path: location.pathname });
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.5 }
    );
    document.querySelectorAll('[data-track-view]').forEach(function (el) {
      io.observe(el);
    });
  }

  function onVisibility() {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      stopHeartbeat();
      flush(true);
    } else if (sessionId) {
      if (hiddenAt && Date.now() - hiddenAt > IDLE_RESTART_MS) {
        api.endSession();
        api.startSession();
      } else {
        startHeartbeat();
      }
      hiddenAt = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(function () {
      track('heartbeat', null);
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  var api = {
    init: function (options) {
      if (!options || !options.url || !options.key) throw new Error('ValourAnalytics.init needs url and key');
      cfg = {
        url: options.url,
        key: options.key,
        source: options.source === 'game' ? 'game' : 'landing',
        userId: options.userId == null ? null : options.userId,
        debug: !!options.debug,
      };
      visitorId = getVisitorId();
      if (options.autoTrack !== false && typeof document !== 'undefined') {
        var start = function () {
          autoTrackClicks();
          autoTrackViews();
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
      }
      if (cfg.source === 'landing' && options.pageView !== false) {
        track('page_view', location.pathname, { referrer: document.referrer || undefined });
      }
      global.addEventListener('pagehide', function () {
        if (sessionId) track('session_end', null);
        flush(true);
      });
      document.addEventListener('visibilitychange', onVisibility);
    },
    setUser: function (userId) {
      if (cfg) cfg.userId = userId;
    },
    startSession: function () {
      sessionId = uid();
      track('session_start', null);
      startHeartbeat();
      flush();
    },
    endSession: function () {
      if (!sessionId) return;
      track('session_end', null);
      stopHeartbeat();
      flush(true);
      sessionId = null;
    },
    click: function (name, metadata) {
      track('click', name, metadata);
    },
    view: function (name, metadata) {
      track('view', name, metadata);
    },
    cardPlayed: function (cardId, cardName, metadata) {
      var m = metadata || {};
      if (cardName) m.card_name = cardName;
      track('card_played', cardId, m);
    },
    track: track,
    flush: flush,
  };

  global.ValourAnalytics = api;
})(typeof window !== 'undefined' ? window : this);
