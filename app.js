  var currentState = 0;
  var procInterval;
  var cameraStream = null;
  var facingMode = 'user';
  var photos = [];
  var photoCount = 0;
  var totalPhotos = 2;
  var lastCaptured = null;
  var introTimer = null;
  var confirmRevealTimer = null;

  // Per-frame box rects for the polaroid clip (fractions of the frame W/H);
  // the captured photo is drawn into rects[k] each frame so it rides the moving box.
  var POLAROID_RECTS = [[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1894,0.1888,0.6083,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1903,0.1888,0.6074,0.4818],[0.1875,0.1888,0.6097,0.4818],[0.1852,0.1888,0.6106,0.4818],[0.1833,0.1903,0.6074,0.4807],[0.1815,0.1888,0.6106,0.4818],[0.1852,0.184,0.6134,0.4866],[0.1889,0.181,0.6167,0.4896],[0.1921,0.1806,0.6157,0.49],[0.194,0.1858,0.6069,0.4833],[0.1917,0.194,0.5963,0.48],[0.187,0.1958,0.5968,0.4811],[0.1833,0.1977,0.5977,0.4811],[0.1833,0.2014,0.5931,0.4774],[0.1889,0.2051,0.5838,0.4703],[0.1921,0.207,0.5801,0.4662],[0.2028,0.2085,0.5694,0.4577],[0.2148,0.2107,0.5556,0.4488],[0.2204,0.214,0.5477,0.4403],[0.2269,0.2177,0.5384,0.4318],[0.2296,0.2188,0.5338,0.428],[0.2366,0.2218,0.525,0.4191],[0.2426,0.224,0.5157,0.4102],[0.2468,0.2281,0.5065,0.4039],[0.2505,0.2333,0.4954,0.3961],[0.2523,0.24,0.4847,0.3865],[0.2551,0.2441,0.4769,0.3798],[0.2556,0.2455,0.4731,0.3776],[0.2611,0.2496,0.462,0.3694],[0.2634,0.2511,0.4546,0.3646],[0.2671,0.2511,0.4468,0.3605],[0.2722,0.2582,0.438,0.3494],[0.275,0.2608,0.4343,0.3442],[0.2819,0.2622,0.4241,0.3383],[0.2861,0.2645,0.4162,0.3305],[0.2907,0.2667,0.4093,0.3257],[0.2954,0.2678,0.4009,0.3197],[0.3005,0.2708,0.3921,0.3108],[0.3028,0.2734,0.3866,0.3053],[0.3065,0.2737,0.3819,0.303],[0.3097,0.2763,0.375,0.2964],[0.3111,0.2778,0.3699,0.2919],[0.3153,0.2797,0.363,0.2878]];
  var polaroidFrames = [];
  var polaroidRAF = null;
  var confirmPhotoImg = null;

  // Preload + decode the hand + template art so the confirm preview never pops in.
  (function() {
    ['assets/hand-back.webp', 'assets/hand-front.webp', 'assets/template-artworks.webp'].forEach(function(src) {
      var im = new Image();
      im.src = src;
      if (im.decode) im.decode().catch(function() {});
    });
  })();

  // ===== Retro microcopy: playful vintage-photobooth lines that rotate through
  // the flow. Default font is the LOL app font (Nunito); set RETRO_ALT_FONT to
  // true to use the dedicated retro typeface (Bungee) on the .retro-line spots.
  var RETRO_ALT_FONT = false;
  var RETRO = {
    camera:  ["SAY CHEESE!", "STRIKE A POSE!", "LOOK ALIVE!", "WORK IT, BABY!", "BIG SMILES!", "GIVE US A WINK!"],
    preview: ["LOOKIN' GOOD!", "HOT STUFF!", "ONE MORE TIME!", "YOU NAILED IT!", "TOO CUTE!"],
    process: ["DEVELOPING...", "COOKING UP MAGIC...", "SHAKE IT, POLAROID!", "PRINTING MEMORIES...", "HANG TIGHT, SUGAR..."],
    thanks:  ["THANKS FOR THE MEMORIES!", "STAY GROOVY!", "SEE YA, GORGEOUS!", "SNAP YA LATER!", "DON'T BE A STRANGER!"]
  };
  var retroTimer = null;
  function stopRetro() { if (retroTimer) { clearInterval(retroTimer); retroTimer = null; } }
  function startRetro(elId, key, interval) {
    stopRetro();
    var el = document.getElementById(elId), lines = RETRO[key];
    if (!el || !lines) return;
    if (el.classList.contains('retro-line')) el.classList.toggle('alt-font', RETRO_ALT_FONT);
    var i = Math.floor(Math.random() * lines.length);
    function flip() { el.textContent = lines[i % lines.length]; el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap'); i++; }
    flip();
    retroTimer = setInterval(flip, interval || 2200);
  }
  function updateRetro(n) {
    if (n === 1) { startRetro('cam-retro', 'camera', 2200); playDoodles('s1', false); }
    else if (n === '1b') startRetro('confirm-retro', 'preview', 2300); // doodles entrance handled in goToConfirm (synced with the template)
    else if (n === 2) { startRetro('status-text', 'process', 1500); playDoodles('s2', false); }
    else if (n === 7) { startRetro('thanks-retro', 'thanks', 2600); playDoodles('s7', false); }
    else stopRetro();
  }

  // ===== Retro doodle layer: hand-drawn photobooth marks scattered round the
  // edges of the preview / processing / download screens. All motion is steps()
  // based (see CSS) so it boils frame-by-frame like stop-motion, never smooth. =====
  function dsvg(k) {
    var m = {
      spark: '<svg viewBox="0 0 24 24"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="#fff"/></svg>',
      star:  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><path d="M12 2 l2.9 6.3 6.9 .6 -5.2 4.5 1.6 6.8 L12 17 l-6.2 3.7 1.6 -6.8 -5.2 -4.5 6.9 -.6 z"/></svg>',
      cam:   '<svg viewBox="0 0 48 40" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h7l3-5h12l3 5h6a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V14a3 3 0 0 1 3-3z"/><circle cx="22" cy="23" r="7"/></svg>',
      film:  '<svg viewBox="0 0 44 26" fill="none" stroke="#fff" stroke-width="1.6"><rect x="1" y="4" width="42" height="18" rx="2"/><g fill="#fff" stroke="none"><rect x="4" y="1.5" width="3" height="2.5"/><rect x="11" y="1.5" width="3" height="2.5"/><rect x="18" y="1.5" width="3" height="2.5"/><rect x="25" y="1.5" width="3" height="2.5"/><rect x="32" y="1.5" width="3" height="2.5"/><rect x="4" y="22" width="3" height="2.5"/><rect x="11" y="22" width="3" height="2.5"/><rect x="18" y="22" width="3" height="2.5"/><rect x="25" y="22" width="3" height="2.5"/><rect x="32" y="22" width="3" height="2.5"/></g></svg>',
      lens:  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 3 L12 12 L20 8 M21 13 L12 12 L15 21 M3 11 L12 12 L8 3"/></svg>',
      heart: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/></svg>',
      bolt:  '<svg viewBox="0 0 24 24"><path d="M13 1 L4 14 h6 l-1 9 9-13 h-6 z" fill="#fff"/></svg>',
      squig: '<svg viewBox="0 0 44 12" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"><path d="M2 7 q5 -7 10 0 t10 0 t10 0 t8 0"/></svg>',
      diamond: '<svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5"><path d="M8 1 L15 8 L8 15 L1 8 Z"/></svg>',
      cross: '<svg viewBox="0 0 12 12" stroke="#fff" stroke-width="1.7" stroke-linecap="round"><path d="M2 2 L10 10 M10 2 L2 10"/></svg>',
      spiral: '<svg viewBox="0 0 40 40" fill="none" stroke="#fff" stroke-width="1.5"><path d="M20 17 a3 3 0 1 1 -3 3 a6 6 0 1 1 6 -6 a9 9 0 1 1 -9 9 a12 12 0 1 1 12 -12 a15 15 0 1 1 -15 15"/></svg>'
    };
    return m[k] || '';
  }
  // Camera screen: a FEW subtle marks in the top + bottom margins only (clear of
  // the centred viewfinder, header badge and shutter row). Dimmed via .subtle.
  var CAMERA_DOODLES = [
    { pos: 'top:11%;left:8%', word: 'SMILE' },
    { pos: 'top:12%;right:8%', size: 20, k: 'star', anim: 'twinkle1' },
    { pos: 'top:20%;right:30%', size: 14, k: 'spark', anim: 'twinkle2' },
    { pos: 'bottom:19%;left:8%', word: 'SAY CHEESE' },
    { pos: 'bottom:19%;right:9%', size: 20, k: 'heart' },
    { pos: 'bottom:28%;left:31%', size: 14, k: 'diamond' }
  ];
  var PREVIEW_DOODLES = [
    { pos: 'top:8%;left:6%', word: 'SMILE' },
    { pos: 'top:7%;left:47%', word: 'CLICK' },
    { pos: 'top:9%;right:7%', size: 38, k: 'cam' },
    { pos: 'top:16%;left:30%', size: 16, k: 'spark', anim: 'twinkle1' },
    { pos: 'top:5%;right:30%', size: 18, k: 'bolt' },
    { pos: 'top:24%;left:6%', size: 24, k: 'lens' },
    { pos: 'top:34%;left:9%', size: 30, k: 'squig' },
    { pos: 'top:47%;left:5%', word: 'FLASH' },
    { pos: 'top:30%;right:6%', word: 'SNAP' },
    { pos: 'top:43%;right:8%', size: 22, k: 'heart' },
    { pos: 'top:56%;right:5%', size: 38, k: 'film' },
    { pos: 'top:67%;right:7%', word: 'POSE' },
    { pos: 'bottom:16%;left:7%', word: 'SAY CHEESE' },
    { pos: 'bottom:8%;left:6%', size: 36, k: 'film' },
    { pos: 'bottom:7%;left:47%', word: 'PHOTO' },
    { pos: 'bottom:16%;right:6%', word: 'MEMORIES' },
    { pos: 'bottom:9%;right:18%', size: 18, k: 'star', anim: 'twinkle3' },
    { pos: 'top:58%;left:7%', size: 14, k: 'spark', anim: 'twinkle1' },
    { pos: 'bottom:30%;right:24%', size: 14, k: 'diamond' }
  ];
  var PROCESS_DOODLES = [
    { pos: 'top:9%;left:7%', word: 'DEVELOPING' },
    { pos: 'top:8%;right:8%', size: 30, k: 'spiral' },
    { pos: 'top:18%;left:34%', size: 16, k: 'spark', anim: 'twinkle2' },
    { pos: 'top:22%;left:6%', size: 34, k: 'film' },
    { pos: 'top:40%;left:6%', word: 'MAGIC' },
    { pos: 'top:30%;right:6%', size: 24, k: 'lens' },
    { pos: 'top:46%;right:7%', word: 'HANG ON' },
    { pos: 'top:58%;left:8%', size: 30, k: 'squig' },
    { pos: 'top:60%;right:6%', size: 18, k: 'star', anim: 'twinkle1' },
    { pos: 'bottom:18%;left:7%', word: 'ALMOST' },
    { pos: 'bottom:9%;left:30%', size: 28, k: 'spiral' },
    { pos: 'bottom:10%;right:8%', word: 'COOKING' },
    { pos: 'bottom:26%;right:24%', size: 14, k: 'diamond' },
    { pos: 'top:14%;right:30%', size: 14, k: 'cross', anim: 'twinkle3' },
    { pos: 'bottom:30%;left:24%', size: 16, k: 'spark', anim: 'twinkle2' }
  ];
  // Download screen: keep WORDS out of the top centre (the "Thank you!" header +
  // subtitle live there). Words sit in the bottom band; icons in the corners and
  // thin side margins beside the carousel.
  var DOWNLOAD_DOODLES = [
    { pos: 'top:4%;left:6%', size: 18, k: 'star', anim: 'twinkle1' },
    { pos: 'top:4%;right:7%', size: 20, k: 'heart' },
    { pos: 'top:40%;left:3%', size: 24, k: 'cam' },
    { pos: 'top:58%;left:3%', size: 26, k: 'squig' },
    { pos: 'top:40%;right:4%', size: 18, k: 'star', anim: 'twinkle2' },
    { pos: 'top:58%;right:4%', size: 20, k: 'heart' },
    { pos: 'bottom:15%;left:6%', word: 'THANK YOU' },
    { pos: 'bottom:15%;right:7%', word: 'LOVE' },
    { pos: 'bottom:24%;left:30%', size: 14, k: 'diamond' },
    { pos: 'bottom:24%;right:30%', size: 16, k: 'spark', anim: 'twinkle3' },
    { pos: 'bottom:8%;left:33%', size: 16, k: 'bolt' }
  ];
  function buildDoodles(set) {
    return set.map(function(d, i) {
      var anim = d.anim || ('boil' + (1 + (i % 3)));
      if (d.word) return '<div class="dood word" style="' + d.pos + '"><span class="dood-in ' + anim + '">' + d.word + '</span></div>';
      return '<div class="dood" style="' + d.pos + '"><span class="dood-in ' + anim + '" style="width:' + (d.size || 24) + 'px;height:' + (d.size || 24) + 'px">' + dsvg(d.k) + '</span></div>';
    }).join('');
  }
  function injectDoodles() {
    var map = { s1: CAMERA_DOODLES, s1b: PREVIEW_DOODLES, s2: PROCESS_DOODLES, s7: DOWNLOAD_DOODLES };
    Object.keys(map).forEach(function(id) {
      var s = document.getElementById(id);
      if (s && !s.querySelector('.retro-doodles')) {
        var ov = document.createElement('div');
        ov.className = 'retro-doodles' + (id === 's1' ? ' subtle' : '');
        ov.innerHTML = buildDoodles(map[id]);
        s.insertBefore(ov, s.firstChild);
      }
    });
  }
  // stop-motion entrance (reverse=false) or exit (reverse=true) for a screen's
  // doodles, staggered so they pop in one after another, frame-by-frame.
  function playDoodles(screenId, reverse) {
    var s = document.getElementById(screenId);
    if (!s) return;
    var ov = s.querySelector('.retro-doodles');
    if (!ov) return;
    ov.querySelectorAll('.dood').forEach(function(d, i) {
      var delay = (reverse ? i * 0.012 : i * 0.03).toFixed(3);
      d.style.animation = 'none';
      void d.offsetWidth;
      d.style.animation = (reverse ? 'doodOut 0.3s steps(2)' : 'doodIn 0.5s steps(4)') + ' ' + delay + 's both';
    });
  }

  function show(n) {
    currentState = n;
    document.querySelectorAll('.state').forEach(function(s) {
      s.style.display = 'none';
      s.classList.remove('active');
    });
    var el = document.getElementById('s' + n);
    if (el) {
      el.style.display = 'flex';
      el.classList.add('active');
    }
    updateRetro(n);
  }

  function goToCamera() {
    photoCount = 0;
    photos = [];
    lastCaptured = null;
    document.getElementById('photo-badge').textContent = '1 of ' + totalPhotos;
    document.getElementById('cam-perm').classList.add('hidden');
    document.getElementById('cam-denied').classList.remove('show');
    document.getElementById('cam-ph').style.display = 'flex';
    // Play the wipe IMMEDIATELY on tap (no waiting for the camera) and warm the
    // camera up in parallel, so there's zero pause between click and transition.
    var s1r = document.getElementById('s1'); if (s1r) { s1r.style.transition = 'none'; s1r.style.opacity = '1'; }
    playCircleWipe();
    startCamera();
  }

  // Circle reveal: the camera (s1) grows from a centre circle ON TOP of the
  // current page, which stays fully visible until the circle covers it — no dark
  // field, no blank. clip-path on s1 keeps the page behind in view through the
  // wipe, then show(1) hides it once the camera fills the screen.
  function playCircleWipe() {
    var s1 = document.getElementById('s1');
    if (!s1) return;
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    currentState = 1; // heading to the camera (keeps the startCamera error path happy)
    s1.style.display = 'flex';
    s1.style.opacity = '1';
    s1.style.zIndex = '50';            // on top of the page we came from
    s1.style.pointerEvents = 'none';   // taps fall through to nothing mid-wipe
    s1.style.willChange = 'clip-path';
    s1.style.transition = 'none';
    var c0 = 'circle(0px at 50% 50%)';
    s1.style.webkitClipPath = c0; s1.style.clipPath = c0;
    void s1.offsetWidth;
    var maxR = Math.ceil(Math.hypot(window.innerWidth, window.innerHeight)) + 40;
    var cMax = 'circle(' + maxR + 'px at 50% 50%)';
    var ease = 'cubic-bezier(0.5, 0, 0.25, 1)';
    s1.style.transition = '-webkit-clip-path 1.05s ' + ease + ', clip-path 1.05s ' + ease;
    s1.style.webkitClipPath = cMax; s1.style.clipPath = cMax;

    var finished = false;
    function done(e) {
      if (e && e.propertyName && e.propertyName.indexOf('clip') < 0) return;
      if (finished) return;
      finished = true;
      if (introTimer) { clearTimeout(introTimer); introTimer = null; }
      s1.removeEventListener('transitionend', done);
      s1.style.transition = 'none';
      s1.style.clipPath = 'none'; s1.style.webkitClipPath = 'none';
      s1.style.zIndex = ''; s1.style.pointerEvents = ''; s1.style.willChange = '';
      show(1); // now hide the page behind + run the camera retro/doodles
    }
    s1.addEventListener('transitionend', done);
    introTimer = setTimeout(done, 1500); // fallback if transitionend never fires
  }

  // Cancel a circle reveal in flight + clear the temp clip styles off s1.
  function hideIntroOverlay() {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    var s1 = document.getElementById('s1');
    if (s1) {
      s1.style.transition = 'none';
      s1.style.clipPath = 'none'; s1.style.webkitClipPath = 'none';
      s1.style.zIndex = ''; s1.style.pointerEvents = ''; s1.style.willChange = '';
    }
  }

  function requestCamera() {
    document.getElementById('cam-perm').classList.add('hidden');
    document.getElementById('cam-denied').classList.remove('show');
    document.getElementById('cam-ph').style.display = 'flex';
    startCamera();
  }

  function attachStream(stream) {
    var v = document.getElementById('cam-video');
    if (!v) return;
    v.srcObject = stream;
    v.play().catch(function() {});
    v.classList.toggle('mirror', facingMode === 'user');
  }

  function startCamera(onReady) {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function(t) { t.stop(); });
      cameraStream = null;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    }).then(function(stream) {
      cameraStream = stream;
      attachStream(stream);
      document.getElementById('cam-ph').style.display = 'none';
      document.getElementById('cam-perm').classList.add('hidden');
      document.getElementById('cam-denied').classList.remove('show');
      if (typeof onReady === 'function') onReady();
    }).catch(function(err) {
      // make sure the camera screen is visible to show the message (we may still be on the landing)
      if (currentState !== 1) show(1);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        document.getElementById('cam-ph').style.display = 'none';
        document.getElementById('cam-perm').classList.add('hidden');
        document.getElementById('cam-denied').classList.add('show');
      } else {
        document.getElementById('cam-ph').querySelector('span').textContent = 'Camera not available';
      }
    });
  }

  function flipCamera() {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    if (cameraStream) startCamera();
  }

  function capturePhoto() {
    var video = document.getElementById('cam-video');
    if (!video.srcObject) return;

    // capture a centred 3:2 landscape crop (wider than the visible 1:1 — the
    // curtains hid the sides). The template holes are 3:2.
    var ASPECT = 1055 / 700;
    var vw = video.videoWidth, vh = video.videoHeight;
    var cw = vw, ch = vw / ASPECT;
    if (ch > vh) { ch = vh; cw = vh * ASPECT; }
    var sx = (vw - cw) / 2, sy = (vh - ch) / 2;

    var canvas = document.getElementById('cam-canvas');
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    var ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    lastCaptured = canvas.toDataURL('image/jpeg', 0.9);

    var flash = document.getElementById('flash');
    flash.classList.remove('flash');
    void flash.offsetWidth;
    flash.classList.add('flash');

    setTimeout(function() {
      stopCamera();
      goToConfirm();
    }, 400);
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(function(t) { t.stop(); });
      cameraStream = null;
    }
    var v = document.getElementById('cam-video');
    if (v) v.srcObject = null;
  }

  // ---- Confirm preview: the captured photo lands inside the real template,
  // held in a hand (3 layers). Frame N starts matched to where the live view
  // sat, then the whole card zooms out into the hand (GPU transform). ----

  // Paint the template holes around the current preview frame: already-confirmed
  // frames show their photo; not-yet-shot frames show a spinner. `skipIdx` is the
  // frame the caller fades in itself (pass -1 to paint every frame).
  function paintHoles(skipIdx) {
    for (var i = 0; i < totalPhotos; i++) {
      if (i === skipIdx) continue;
      var img = document.getElementById('hole-photo-' + (i + 1));
      var load = document.getElementById('hole-load-' + (i + 1));
      if (!img) continue;
      if (i < photoCount) {
        img.src = photos[i]; img.classList.add('show');
        if (load) load.classList.remove('show');
      } else {
        img.classList.remove('show'); img.removeAttribute('src');
        if (load) load.classList.add('show');
      }
    }
  }

  // Transform (origin 0 0) mapping element `el` onto a target screen rect,
  // measured with the stage un-transformed. Uniform scale keeps the aspect.
  function rectTransform(el, target) {
    var stage = document.getElementById('hand-stage');
    if (!stage || !el || !target) return { t: 'none', tx: 0, ty: 0, s: 1 };
    stage.style.transition = 'none';
    var keep = stage.style.transform;
    stage.style.transform = 'none';
    var sr = stage.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    stage.style.transform = keep;
    var s = target.width / er.width;
    var tx = target.left - sr.left - s * (er.left - sr.left);
    var ty = target.top - sr.top - s * (er.top - sr.top);
    return { t: 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')', tx: tx, ty: ty, s: s };
  }

  // The settled "card in hand" view: zoom in on the template so the photos read
  // clearly and the hand isn't dominant (forearm runs off-screen, fingers stay).
  function restTransform() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cardW = Math.min(vw * 0.58, 290);
    return rectTransform(document.querySelector('.tpl-slot'), { left: (vw - cardW) / 2, top: vh * 0.24, width: cardW });
  }

  // Slot (template) centre in the hand-stage's own un-transformed pixels — the
  // pivot so a "slight rotate" tilts the card in place instead of swinging it.
  function slotCenterLocal() {
    var stage = document.getElementById('hand-stage');
    stage.style.transition = 'none';
    var keep = stage.style.transform;
    stage.style.transform = 'none';
    var sr = stage.getBoundingClientRect();
    var sl = document.querySelector('.tpl-slot').getBoundingClientRect();
    stage.style.transform = keep;
    return { x: (sl.left - sr.left) + sl.width / 2, y: (sl.top - sr.top) + sl.height / 2 };
  }

  // Choppy stop-motion move of the hand-stage between two {tx,ty,s} states (same
  // scale), with a slight decaying rotate around the card centre. ease-out by
  // default; easeIn for exits. fade=true fades it away as it leaves.
  function stopMotion(from, to, opts, onDone) {
    opts = opts || {};
    var stage = document.getElementById('hand-stage');
    var steps = opts.steps || 9, rot = opts.rotate || 4, fade = opts.fade, easeIn = opts.easeIn;
    var O = slotCenterLocal(), k = 1 - from.s; // compensate so the slot centre is the pivot
    stage.style.transformOrigin = O.x + 'px ' + O.y + 'px';
    stage.style.transition = 'none';
    stage.style.opacity = '1';
    function frame(p, rr, op) {
      var tx = from.tx + (to.tx - from.tx) * p - k * O.x;
      var ty = from.ty + (to.ty - from.ty) * p - k * O.y;
      stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + from.s + ') rotate(' + rr + 'deg)';
      if (fade) stage.style.opacity = String(op);
    }
    frame(0, 0, 1);
    void stage.offsetWidth;
    var i = 0;
    var iv = setInterval(function() {
      i++;
      var p = Math.min(1, i / steps);
      var ep = easeIn ? p * p : 1 - (1 - p) * (1 - p);
      var rr = (i % 2 ? 1 : -1) * (1 - p) * rot;          // decaying wobble
      var op = fade ? Math.max(0, 1 - p * 1.2) : 1;       // fade out a touch early
      frame(ep, rr, op);
      if (i >= steps) { clearInterval(iv); frame(1, 0, fade ? 0 : 1); if (onDone) onDone(); }
    }, opts.interval || 70);
    return iv;
  }

  // Swap to the camera (sesi foto) with a quick fade so the choppy exit resolves
  // smoothly into the live view.
  function showCameraSmooth() {
    show(1);
    var s1 = document.getElementById('s1');
    if (!s1) return;
    s1.style.transition = 'none'; s1.style.opacity = '0';
    void s1.offsetWidth;
    s1.style.transition = 'opacity 0.4s ease'; s1.style.opacity = '1';
  }

  function resetHandStage() {
    var stage = document.getElementById('hand-stage');
    if (stage) { stage.style.transition = 'none'; stage.style.transform = 'none'; stage.style.opacity = '1'; }
  }

  function revealConfirmButtons() {
    document.getElementById('confirm-btns').querySelectorAll('button').forEach(function(b, i) {
      b.style.transition = 'opacity 0.4s ease ' + (i * 0.1) + 's'; b.style.opacity = '1';
    });
  }
  function hideConfirmButtons() {
    document.getElementById('confirm-btns').querySelectorAll('button').forEach(function(b) {
      b.style.transition = 'opacity 0.2s'; b.style.opacity = '0';
    });
  }

  function goToConfirm() {
    var idx = photoCount;
    var isLast = (photoCount + 1 >= totalPhotos);
    document.getElementById('confirm-badge').textContent = (photoCount + 1) + ' of ' + totalPhotos;
    document.getElementById('confirm-next-label').textContent = isLast ? 'Confirm' : 'Continue';

    paintHoles(idx);
    hideConfirmButtons();
    var stage = document.getElementById('hand-stage');
    var img = document.getElementById('hole-photo-' + (idx + 1));
    var load = document.getElementById('hole-load-' + (idx + 1));
    if (img) { img.classList.remove('show'); img.src = lastCaptured; } // rendered at opacity 0 -> fades in
    if (load) load.classList.remove('show'); // hide THIS frame's "UP NEXT" so the captured photo shows

    // Reset the retro layer + park the card off-screen below BEFORE s1b paints,
    // so swapping in never flashes a stale retro/card frame (the "glitch").
    var ovb = document.getElementById('s1b').querySelector('.retro-doodles');
    if (ovb) ovb.querySelectorAll('.dood').forEach(function(d) { d.style.animation = 'none'; });
    var below = window.innerHeight * 0.9;
    stage.style.transition = 'none'; stage.style.transformOrigin = '0 0'; stage.style.opacity = '0';
    show('1b');
    var r0 = restTransform();
    stage.style.transform = 'translate(' + r0.tx + 'px,' + (r0.ty + below) + 'px) scale(' + r0.s + ')';
    stage.style.opacity = '1';
    if (img) img.classList.add('show'); // captured photo fades in as the card rises

    // RISE: the preview springs up from below in choppy stop-motion steps + a
    // slight rotate, then settles. Doodles boil in alongside.
    requestAnimationFrame(function() {
      playDoodles('s1b', false);
      var r = restTransform();
      stopMotion(
        { tx: r.tx, ty: r.ty + below, s: r.s },
        { tx: r.tx, ty: r.ty, s: r.s },
        { rotate: 4, steps: 9, interval: 70 },
        revealConfirmButtons
      );
    });
  }

  function retakePhoto() {
    hideConfirmButtons();
    playDoodles('s1b', true); // doodles reverse out as the card leaves
    var r = restTransform();
    stopMotion(
      { tx: r.tx, ty: r.ty, s: r.s },
      { tx: r.tx, ty: r.ty + window.innerHeight * 1.1, s: r.s }, // reverse back DOWN, off-screen
      { rotate: 4, steps: 8, interval: 70, fade: true, easeIn: true },
      function() {
        lastCaptured = null;
        document.getElementById('photo-badge').textContent = (photoCount + 1) + ' of ' + totalPhotos;
        showCameraSmooth();
        requestCamera();
        resetHandStage();
      }
    );
  }

  function confirmPhoto() {
    hideConfirmButtons();
    playDoodles('s1b', true); // doodles reverse out as the card leaves
    var isLast = (photoCount + 1 >= totalPhotos);
    if (isLast) {
      // last shot ALSO exits to the RIGHT in choppy stop-motion (like Continue),
      // then straight to processing.
      var rl = restTransform();
      stopMotion(
        { tx: rl.tx, ty: rl.ty, s: rl.s },
        { tx: rl.tx + window.innerWidth * 1.15, ty: rl.ty, s: rl.s },
        { rotate: 4, steps: 8, interval: 70, fade: true, easeIn: true },
        function() {
          photos.push(lastCaptured); photoCount++; lastCaptured = null;
          resetHandStage();
          goToProcessing();
        }
      );
    } else {
      // commit this shot, then the card exits to the RIGHT (choppy + rotate) and
      // the camera fades back in for the next session.
      photos.push(lastCaptured); photoCount++; lastCaptured = null;
      paintHoles(-1);
      document.getElementById('photo-badge').textContent = (photoCount + 1) + ' of ' + totalPhotos;
      var r = restTransform();
      stopMotion(
        { tx: r.tx, ty: r.ty, s: r.s },
        { tx: r.tx + window.innerWidth * 1.15, ty: r.ty, s: r.s }, // exit to the right
        { rotate: 4, steps: 8, interval: 70, fade: true, easeIn: true },
        function() {
          showCameraSmooth();
          requestCamera();
          resetHandStage();
        }
      );
    }
  }

  function resetProcessing() {
    var ids = ['tpl-frame','status-text','dot-loader','circle-prog'];
    ids.forEach(function(id) {
      var e = document.getElementById(id);
      if (e) { e.style.transition = ''; e.style.opacity = '0'; }
    });
    document.getElementById('tpl-frame').style.transform = 'scale(0.4)';
    var icon = document.getElementById('proc-icon');
    if (icon) { icon.style.transition = ''; icon.style.opacity = '0.3'; }
    document.getElementById('prog-c').style.strokeDashoffset = '150.8';
    document.getElementById('prog-num').textContent = '0%';
    document.getElementById('status-text').textContent = 'Processing Photo...';
  }

  function resetDone() {
    var frame = document.getElementById('done-frame');
    if (frame) { frame.style.transition = ''; frame.style.transform = 'scale(0.9)'; frame.style.opacity = '0'; }
    document.getElementById('done-title').style.opacity = '0';
    document.getElementById('done-title').style.transition = '';
    document.getElementById('done-sub').style.opacity = '0';
    document.getElementById('done-sub').style.transition = '';
    document.getElementById('done-btns').querySelectorAll('.btn-outline,.btn-solid').forEach(function(b) {
      b.style.opacity = '0';
      b.style.transition = '';
    });
  }

  function goToProcessing() {
    resetProcessing();
    resetDone();
    show(2);
    startProcessing();
  }

  function injectPhotos() {
    var df1 = document.getElementById('done-pf1');
    var df2 = document.getElementById('done-pf2');

    if (photos.length >= 1) {
      df1.style.backgroundImage = 'url(' + photos[0] + ')';
      df1.style.backgroundSize = 'cover';
      df1.style.backgroundPosition = 'center';
      var svg1 = df1.querySelector('svg');
      if (svg1) svg1.style.display = 'none';
    }
    if (photos.length >= 2) {
      df2.style.backgroundImage = 'url(' + photos[1] + ')';
      df2.style.backgroundSize = 'cover';
      df2.style.backgroundPosition = 'center';
      var svg2 = df2.querySelector('svg');
      if (svg2) svg2.style.display = 'none';
    }
  }

  function startProcessing() {
    if (procInterval) clearInterval(procInterval);

    injectPhotos();


    var st = document.getElementById('status-text');
    var dl = document.getElementById('dot-loader');
    var tf = document.getElementById('tpl-frame');
    var cp = document.getElementById('circle-prog');
    var icon = document.getElementById('proc-icon');
    var pc = document.getElementById('prog-c');
    var pn = document.getElementById('prog-num');

    setTimeout(function() {
      st.style.transition = 'opacity 0.5s';
      st.style.opacity = '1';
      dl.style.transition = 'opacity 0.4s 0.2s';
      dl.style.opacity = '1';
    }, 100);

    setTimeout(function() {
      // loading template grows in from the centre, smooth
      tf.style.transition = 'opacity 0.45s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
      tf.style.opacity = '1';
      tf.style.transform = 'scale(1)';
      cp.style.transition = 'opacity 0.4s';
      cp.style.opacity = '1';
    }, 350);

    var p = 0;
    procInterval = setInterval(function() {
      p += 1;
      if (p > 100) { clearInterval(procInterval); return; }

      var offset = 150.8 - (150.8 * p / 100);
      pc.style.strokeDashoffset = offset.toFixed(1);
      pn.textContent = p + '%';

      if (p === 100) {
        stopRetro(); // stop the rotating retro copy before the final status
        st.textContent = 'All done!';
        dl.style.transition = 'opacity 0.3s';
        dl.style.opacity = '0';
        setTimeout(function() { goToDelivery(); }, 500); // Photo Ready page removed: straight to download
      }
    }, 20);
  }

  function goToDone() {
    resetDone();
    show(3);

    var frame = document.getElementById('done-frame');
    var dt = document.getElementById('done-title');
    var ds = document.getElementById('done-sub');
    var db = document.getElementById('done-btns');

    // framed photo eases in
    setTimeout(function() {
      frame.style.transition = 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.34, 1.4, 0.5, 1)';
      frame.style.opacity = '1';
      frame.style.transform = 'scale(1)';
    }, 120);

    // title
    setTimeout(function() {
      dt.style.transition = 'opacity 0.4s';
      dt.style.opacity = '1';
      ds.style.transition = 'opacity 0.4s 0.1s';
      ds.style.opacity = '1';
    }, 650);

    // buttons
    setTimeout(function() {
      db.querySelectorAll('.btn-outline,.btn-solid').forEach(function(b, i) {
        b.style.transition = 'opacity 0.4s ease ' + (i * 0.12) + 's';
        b.style.opacity = '1';
      });
    }, 950);
  }

  function retakeAll() {
    if (procInterval) clearInterval(procInterval);
    stopCamera();
    photoCount = 0;
    photos = [];
    lastCaptured = null;
    resetProcessing();
    resetDone();
    resetDonePhotos();
    hideIntroOverlay();
    document.getElementById('photo-badge').textContent = '1 of ' + totalPhotos;
    show(1);
    requestCamera();
  }

  function resetDonePhotos() {
    ['done-pf1','done-pf2'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.backgroundImage = '';
        var svg = el.querySelector('svg');
        if (svg) svg.style.display = '';
      }
    });
  }

  function restart() {
    if (procInterval) clearInterval(procInterval);
    stopCamera();
    photoCount = 0;
    photos = [];
    lastCaptured = null;
    resetProcessing();
    resetDone();
    resetDonePhotos();
    hideIntroOverlay();

    document.getElementById('cam-perm').classList.add('hidden');
    document.getElementById('cam-denied').classList.remove('show');
    document.getElementById('cam-ph').style.display = 'none';

    show(0);
  }

  // Start Over (download page): restart from session 1 with the circle wipe.
  function startOver() {
    if (procInterval) clearInterval(procInterval);
    resetHandStage();
    hideIntroOverlay();
    goToCamera(); // resets counters, requests camera, plays the circle wipe into session 1
  }

  function pickFromGallery() {
    document.getElementById('gallery-input').click();
  }

  function handleGalleryPick(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      lastCaptured = ev.target.result;
      stopCamera();
      goToConfirm();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  /* ========== Delivery screens ========== */
  function goToDelivery() {
    setupDeliveryPreviews();
    show(7); // final download design = Design 4 (carousel)
  }

  function setupDeliveryPreviews() {
    var p0 = photos[0] || '';
    var p1 = photos[1] || '';
    var bg0 = p0 ? 'url(' + p0 + ')' : '';
    var bg1 = p1 ? 'url(' + p1 + ')' : '';

    document.querySelectorAll('.mini-frame .mini-photo.m1').forEach(function(el) {
      el.style.backgroundImage = bg0;
    });
    document.querySelectorAll('.mini-frame .mini-photo.m2').forEach(function(el) {
      el.style.backgroundImage = bg1;
    });

    var m3 = document.getElementById('mini-3');
    if (m3) {
      var m3p1 = m3.querySelector('.mini-photo.m1');
      var m3p2 = m3.querySelector('.mini-photo.m2');
      if (m3p1) m3p1.style.backgroundImage = bg0;
      if (m3p2) m3p2.style.backgroundImage = bg1;
    }

    var t1 = document.getElementById('del-thumb1-1');
    var t2 = document.getElementById('del-thumb2-1');
    if (t1) t1.style.backgroundImage = bg0;
    if (t2) t2.style.backgroundImage = bg1;

    var car1 = document.getElementById('car-raw1');
    var car2 = document.getElementById('car-raw2');
    if (car1) car1.style.backgroundImage = bg0;
    if (car2) car2.style.backgroundImage = bg1;
  }

  function nextDesign(n) {
    var next = n === 4 ? 1 : n + 1;
    show(3 + next);
  }
  function prevDesign(n) {
    var prev = n === 1 ? 4 : n - 1;
    show(3 + prev);
  }

  function downloadFramed() {
    var src = photos[0] || lastCaptured;
    if (!src) return;
    triggerDownload(src, 'lolphotobooth-framed.jpg');
  }
  function downloadRaw(i) {
    var src = photos[i];
    if (!src) return;
    triggerDownload(src, 'lolphotobooth-photo-' + (i + 1) + '.jpg');
  }
  function triggerDownload(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function shareLink() {
    if (navigator.share) {
      navigator.share({ title: 'My LOL Photobooth photo', text: 'Check out my photos!', url: window.location.href }).catch(function(){});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  show(0);
  injectDoodles();
