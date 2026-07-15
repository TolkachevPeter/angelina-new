/*!
 * Belokon — progressive-enhancement runtime.
 * The page is fully readable without JS; this only layers on interaction,
 * scroll-reveal, hover accents and the decorative 3D hero object.
 */
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------- mobile menu ---- */
  function initMenu() {
    var toggle = document.querySelector('[data-menu-toggle]');
    var panel = document.querySelector('[data-mobile-panel]');
    if (!toggle || !panel) return;
    var open = false;
    function set(next) {
      open = next;
      panel.style.display = open ? 'flex' : 'none';
      toggle.textContent = open ? 'Close' : 'Menu';
      toggle.setAttribute('aria-expanded', String(open));
    }
    toggle.setAttribute('aria-controls', 'mobile-nav');
    panel.id = panel.id || 'mobile-nav';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function () {
      set(!open);
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) set(false);
    });
  }

  /* ------------------------------------------------ hover accents ---- */
  // Re-implements the design's `data-style-hover` inline hover styles.
  function initHover() {
    var nodes = document.querySelectorAll('[data-style-hover]');
    Array.prototype.forEach.call(nodes, function (el) {
      var hoverCss = el.getAttribute('data-style-hover');
      if (!hoverCss) return;
      var base = el.getAttribute('style') || '';
      el.addEventListener('mouseenter', function () {
        el.setAttribute('style', base + ';' + hoverCss);
      });
      el.addEventListener('mouseleave', function () {
        el.setAttribute('style', base);
      });
      el.addEventListener('focus', function () {
        el.setAttribute('style', base + ';' + hoverCss);
      });
      el.addEventListener('blur', function () {
        el.setAttribute('style', base);
      });
    });
  }

  /* ---------------------------------------------- scroll progress ---- */
  function initProgress() {
    var bar = document.querySelector('[data-scroll-progress]');
    if (!bar) return;
    function update() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      bar.style.transform = 'scaleX(' + Math.min(1, window.scrollY / max) + ')';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ------------------------------------------------ scroll reveal ---- */
  function initReveal() {
    var root = document.getElementById('top');
    if (!root || reduceMotion || !('IntersectionObserver' in window)) return;

    function reveal(el) {
      var name = el.hasAttribute('data-reveal-line') ? 'data-reveal-line' : 'data-reveal';
      el.setAttribute(name, 'in');
    }
    function revealAll() {
      root
        .querySelectorAll('[data-reveal]:not([data-reveal="in"]), [data-reveal-line]:not([data-reveal-line="in"])')
        .forEach(reveal);
    }

    root.setAttribute('data-reveal-ready', '');
    var observerWorks = false;
    var obs = new IntersectionObserver(
      function (entries) {
        observerWorks = true; // a callback fired -> the observer is functioning
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          reveal(e.target);
          obs.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    root.querySelectorAll('[data-reveal], [data-reveal-line]').forEach(function (el) {
      obs.observe(el);
    });

    // Safety net: content must never stay hidden. Only force everything visible
    // if the observer never fired at all (odd viewport, embedded context,
    // disabled) — otherwise leave reveal-on-scroll working for the rest of the page.
    window.setTimeout(function () {
      if (observerWorks) return;
      obs.disconnect();
      revealAll();
    }, 3500);
  }

  /* -------------------------------------------------- lead form ---- */
  function initForm() {
    var form = document.querySelector('[data-lead-form]');
    var confirm = document.querySelector('[data-lead-confirm]');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.elements && form.elements.email ? form.elements.email.value : '';
      // Forward the honeypot field so the server can drop bot submissions.
      var website = form.elements && form.elements.website ? form.elements.website.value : '';
      var btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
      }
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Checklist request',
          email: email,
          details: '15-point Brand Visual Audit Checklist',
          language: document.documentElement.lang || 'en',
          website: website,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          return r.json();
        })
        .then(function () {
          if (confirm) {
            form.style.display = 'none';
            confirm.style.display = 'block';
          }
        })
        .catch(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Try again';
          }
        });
    });
  }

  /* ---------------------------------------------- 3D hero object ---- */
  // Lazy: only on capable, wide, motion-friendly viewports, after idle,
  // and only once the mount scrolls near view. Never blocks content/LCP.
  function initObject() {
    var mount = document.querySelector('[data-object-mount]');
    if (!mount || reduceMotion) return;
    // Skip the heavy 3D on genuinely small screens (where it is dimmed anyway).
    if (window.innerWidth > 0 && window.innerWidth < 921) return;
    var deviceMem = navigator.deviceMemory || 4;
    if (deviceMem < 4) return; // spare low-end devices the heavy 3D
    var started = false;
    var inView = true; // render loop pauses when the hero scrolls out of view
    var resumeTick = null;

    function loadThree() {
      return new Promise(function (resolve, reject) {
        if (window.THREE) return resolve(window.THREE);
        var s = document.createElement('script');
        s.src = '/assets/vendor/three.min.js';
        s.onload = function () {
          resolve(window.THREE);
        };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    function build(THREE) {
      try {
        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        var el = renderer.domElement;
        el.style.position = 'absolute';
        el.style.inset = '0';
        el.style.width = '100%';
        el.style.height = '100%';
        mount.appendChild(el);
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
        camera.position.set(0, 0, 6.4);

        var env = document.createElement('canvas');
        env.width = 64;
        env.height = 32;
        var ectx = env.getContext('2d');
        var grad = ectx.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.42, '#f4ead8');
        grad.addColorStop(0.6, '#8a7a5f');
        grad.addColorStop(1, '#2e2a22');
        ectx.fillStyle = grad;
        ectx.fillRect(0, 0, 64, 32);
        ectx.fillStyle = 'rgba(255,255,255,0.92)';
        ectx.fillRect(0, 8, 64, 3);
        var envTex = new THREE.CanvasTexture(env);
        envTex.mapping = THREE.EquirectangularReflectionMapping;
        if (THREE.SRGBColorSpace) envTex.colorSpace = THREE.SRGBColorSpace;
        scene.environment = envTex;

        var gold = new THREE.MeshPhysicalMaterial({
          color: 0xd4af6a,
          metalness: 1,
          roughness: 0.22,
          clearcoat: 0.4,
          clearcoatRoughness: 0.25,
        });
        var platinum = new THREE.MeshPhysicalMaterial({
          color: 0xe9e6df,
          metalness: 1,
          roughness: 0.3,
        });
        var group = new THREE.Group();
        var ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.085, 72, 220), gold);
        var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.062, 72, 220), platinum);
        ring1.rotation.set(0.9, 0.3, 0);
        ring2.rotation.set(0.5, -0.6, 0.3);
        ring2.position.set(0.55, -0.25, 0.15);
        group.add(ring1);
        group.add(ring2);
        group.position.set(0.45, 0.1, 0);
        scene.add(group);
        var key = new THREE.DirectionalLight(0xffffff, 1.3);
        key.position.set(3, 5, 4);
        scene.add(key);
        scene.add(new THREE.AmbientLight(0xfff6e8, 0.4));

        function size() {
          var w = mount.clientWidth;
          var h = mount.clientHeight;
          renderer.setSize(w, h, false);
          camera.aspect = w / Math.max(1, h);
          camera.updateProjectionMatrix();
          renderer.render(scene, camera);
        }
        size();
        if (window.ResizeObserver) new ResizeObserver(size).observe(mount);

        var tx = 0,
          ty = 0,
          cx = 0,
          cy = 0;
        window.addEventListener(
          'pointermove',
          function (e) {
            tx = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 0.12;
            ty = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 0.22;
          },
          { passive: true }
        );
        var running = true;
        function tick(t) {
          if (!inView) {
            running = false;
            return; // idle while off-screen; resumeTick() restarts on re-entry
          }
          var s = t * 0.001;
          cx += (tx - cx) * 0.03;
          cy += (ty - cy) * 0.03;
          group.rotation.y = s * 0.14 + cy;
          group.rotation.x = Math.sin(s * 0.3) * 0.08 + cx;
          group.position.y = 0.1 + Math.sin(s * 0.55) * 0.05;
          ring2.rotation.z = 0.3 + s * 0.05;
          renderer.render(scene, camera);
          requestAnimationFrame(tick);
        }
        resumeTick = function () {
          if (!running) {
            running = true;
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      } catch (err) {
        /* WebGL unavailable — hero stays on paper background */
      }
    }

    function start() {
      if (started) return;
      // Only render once the mount actually has layout size, so we never spin a
      // renderer on a 0×0 canvas.
      if (!mount.clientWidth || !mount.clientHeight) return;
      started = true;
      loadThree().then(build).catch(function () {});
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) {
          if (!started) (window.requestIdleCallback || window.setTimeout)(start, 1);
          else if (resumeTick) resumeTick();
        }
      });
      io.observe(mount);
    } else {
      start();
    }
  }

  /* -------------------------------------------------------- boot ---- */
  function boot() {
    initMenu();
    initHover();
    initProgress();
    initReveal();
    initForm();
    initObject();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
