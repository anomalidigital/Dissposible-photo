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
  var lastViewRect = null; // where the live view sat on screen, so a frame can start matched to it

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
  }

  function goToCamera() {
    photoCount = 0;
    photos = [];
    lastCaptured = null;
    document.getElementById('photo-badge').textContent = '1 of ' + totalPhotos;
    document.getElementById('cam-perm').classList.add('hidden');
    document.getElementById('cam-denied').classList.remove('show');
    document.getElementById('cam-ph').style.display = 'flex';
    // Ask for the camera FIRST. The circle wipe only plays once the stream is
    // live, so: a first-time permission prompt happens BEFORE the animation (not
    // during it), the camera is already showing when the circle opens, and a
    // returning (already-granted) user goes straight into the wipe.
    startCamera(playCircleWipe);
  }

  // Circle wipe: a dark overlay irises OPEN from the centre to reveal the live
  // camera (s1) behind it. The hole grows via width/height (sharp + smooth on
  // phones). The landing -> camera page swap happens while the dark fully covers
  // the screen (~180ms), so the switch is invisible.
  function playCircleWipe() {
    var overlay = document.getElementById('wipe-overlay');
    var iris = document.getElementById('wipe-iris');
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    overlay.style.display = 'block';
    overlay.classList.remove('run');
    iris.style.animation = 'none';
    void iris.offsetWidth; // restart the keyframe animation if replayed
    iris.style.animation = '';
    overlay.classList.add('run');

    // swap to the live camera while the dark covers everything
    setTimeout(function() { if (currentState !== 1) show(1); }, 180);

    var finished = false;
    function done(e) {
      if (e && e.animationName !== 'irisWipe') return;
      if (finished) return;
      finished = true;
      if (introTimer) { clearTimeout(introTimer); introTimer = null; }
      iris.removeEventListener('animationend', done);
      overlay.classList.remove('run');
      overlay.style.display = 'none';
      if (currentState !== 1) show(1);
    }
    iris.addEventListener('animationend', done);
    introTimer = setTimeout(done, 1500); // fallback if animationend never fires
  }

  function hideIntroOverlay() {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    var overlay = document.getElementById('wipe-overlay');
    if (overlay) { overlay.classList.remove('run'); overlay.style.display = 'none'; }
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

    // remember the live-view rectangle so the frame can start matched to it
    var vf = document.getElementById('viewfinder');
    if (vf) { var r = vf.getBoundingClientRect(); lastViewRect = { left: r.left, top: r.top, width: r.width, height: r.height }; }

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

  // Fill the template holes: frame `previewIdx` shows previewSrc; earlier frames
  // show their confirmed photos; later (not-yet-shot) frames show a spinner.
  function setHoles(previewIdx, previewSrc) {
    for (var i = 0; i < totalPhotos; i++) {
      var img = document.getElementById('hole-photo-' + (i + 1));
      var load = document.getElementById('hole-load-' + (i + 1));
      if (!img) continue;
      var src = (i === previewIdx) ? previewSrc : (i < photoCount ? photos[i] : null);
      if (src) {
        img.src = src; img.classList.add('show');
        if (load) load.classList.remove('show');
      } else {
        img.classList.remove('show'); img.removeAttribute('src');
        if (load) load.classList.add('show');
      }
    }
  }

  // Transform that maps frame `idx` exactly onto the stored live-view rect.
  function frameToViewTransform(idx) {
    var stage = document.getElementById('hand-stage');
    var hole = document.querySelector('.frame-hole.hole-' + (idx + 1));
    if (!stage || !hole || !lastViewRect) return 'none';
    stage.style.transition = 'none';
    var keep = stage.style.transform;
    stage.style.transform = 'none';
    var sr = stage.getBoundingClientRect();
    var hr = hole.getBoundingClientRect();
    stage.style.transform = keep;
    var S = lastViewRect.width / hr.width;
    var tx = lastViewRect.left - sr.left - S * (hr.left - sr.left);
    var ty = lastViewRect.top - sr.top - S * (hr.top - sr.top);
    return 'translate(' + tx + 'px,' + ty + 'px) scale(' + S + ')';
  }

  // toRest=true  -> start zoomed on frame idx, settle to the card-in-hand.
  // toRest=false -> start at rest, zoom into frame idx.
  function zoomFrame(idx, toRest, dur, onDone) {
    var stage = document.getElementById('hand-stage');
    var t = frameToViewTransform(idx);
    stage.style.transformOrigin = '0 0';
    stage.style.transition = 'none';
    stage.style.opacity = '1';
    stage.style.transform = toRest ? t : 'none';
    void stage.offsetWidth;
    stage.style.transition = 'transform ' + dur + 's cubic-bezier(0.22, 1, 0.36, 1)';
    stage.style.transform = toRest ? 'none' : t;
    var done = false;
    function fin(e) {
      if (e && e.propertyName && e.propertyName !== 'transform') return;
      if (done) return; done = true;
      stage.removeEventListener('transitionend', fin);
      if (onDone) onDone();
    }
    stage.addEventListener('transitionend', fin);
    setTimeout(fin, dur * 1000 + 280);
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

    setHoles(idx, lastCaptured);
    hideConfirmButtons();
    var stage = document.getElementById('hand-stage');
    stage.style.transition = 'none'; stage.style.transform = 'none'; stage.style.opacity = '0';
    show('1b');

    var img = document.getElementById('hole-photo-' + (idx + 1));
    var started = false;
    function start() {
      if (started) return; started = true;
      requestAnimationFrame(function() { requestAnimationFrame(function() {
        zoomFrame(idx, true, 0.85, revealConfirmButtons);
      }); });
    }
    if (img && img.complete && img.naturalWidth) start();
    else if (img) { img.onload = start; img.onerror = start; setTimeout(start, 450); }
    else start();
  }

  function retakePhoto() {
    hideConfirmButtons();
    var idx = photoCount; // redo the current frame
    zoomFrame(idx, false, 0.7, function() {
      lastCaptured = null;
      document.getElementById('photo-badge').textContent = (photoCount + 1) + ' of ' + totalPhotos;
      show(1);
      requestCamera();
      resetHandStage();
    });
  }

  function confirmPhoto() {
    hideConfirmButtons();
    var isLast = (photoCount + 1 >= totalPhotos);
    if (isLast) {
      // last shot confirmed: slide the card out to the right, then process.
      var stage = document.getElementById('hand-stage');
      stage.style.transition = 'transform 0.5s cubic-bezier(0.5, 0, 0.7, 0.2), opacity 0.5s ease';
      stage.style.transform = 'translateX(130%)';
      stage.style.opacity = '0';
      setTimeout(function() {
        photos.push(lastCaptured); photoCount++; lastCaptured = null;
        resetHandStage();
        goToProcessing();
      }, 520);
    } else {
      // commit this shot, then zoom into the NEXT (empty) frame and reopen camera.
      photos.push(lastCaptured); photoCount++; lastCaptured = null;
      setHoles(-1, null);
      document.getElementById('photo-badge').textContent = (photoCount + 1) + ' of ' + totalPhotos;
      zoomFrame(photoCount, false, 0.75, function() {
        show(1);
        requestCamera();
        resetHandStage();
      });
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
