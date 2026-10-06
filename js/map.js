(function () {
  'use strict';

  var PALETTE = [
    '#3e8948', '#b86f50', '#d9a066', '#3ca0b8',
    '#5a4a7a', '#c05555', '#4a7c59', '#8a6f3e'
  ];

  var MIN_SCALE = 1;
  var MAX_SCALE = 10;

  var tooltip = null;
  var selectedPath = null;
  var svgEl = null;
  var viewport = null;

  var VW = 1000;
  var VH = 671;

  var view = { scale: 1, tx: 0, ty: 0 };

  var pointers = {};
  var lastPinchDist = 0;
  var lastPinchMid = null;
  var dragMoved = false;
  var dragStart = null;

  function el(id) { return document.getElementById(id); }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function applyView() {
    if (view.scale <= 1.0001) {
      view.scale = 1;
      view.tx = 0;
      view.ty = 0;
    } else {
      view.tx = clamp(view.tx, VW - VW * view.scale, 0);
      view.ty = clamp(view.ty, VH - VH * view.scale, 0);
    }
    if (viewport) {
      viewport.setAttribute('transform', 'translate(' + view.tx + ' ' + view.ty + ') scale(' + view.scale + ')');
    }
    updateZoomButtons();
  }

  function svgPoint(clientX, clientY) {
    if (!svgEl) return { x: 0, y: 0 };
    var pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function zoomAt(sx, sy, factor) {
    var s = view.scale;
    var ns = clamp(s * factor, MIN_SCALE, MAX_SCALE);
    if (ns === s) return;
    var k = ns / s;
    view.tx = sx - k * (sx - view.tx);
    view.ty = sy - k * (sy - view.ty);
    view.scale = ns;
    applyView();
  }

  function zoomCenter(factor) {
    zoomAt(VW / 2, VH / 2, factor);
  }

  function resetView() {
    view.scale = 1;
    view.tx = 0;
    view.ty = 0;
    applyView();
  }

  function updateZoomButtons() {
    var zin = el('btn-zoom-in');
    var zout = el('btn-zoom-out');
    var zreset = el('btn-zoom-reset');
    if (zin) zin.disabled = view.scale >= MAX_SCALE;
    if (zout) zout.disabled = view.scale <= MIN_SCALE;
    if (zreset) zreset.disabled = view.scale <= MIN_SCALE;
  }

  function initTooltip() {
    tooltip = el('tooltip');
    if (tooltip) tooltip.classList.add('hidden');
  }

  function showTip(e, path) {
    if (!tooltip) return;
    tooltip.textContent = path.getAttribute('data-name');
    tooltip.classList.remove('hidden');
    moveTip(e);
  }

  function moveTip(e) {
    if (!tooltip) return;
    var panel = el('map').parentElement;
    var rect = panel.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left) + 'px';
    tooltip.style.top = (e.clientY - rect.top) + 'px';
  }

  function hideTip() {
    if (tooltip) tooltip.classList.add('hidden');
  }

  function selectState(path) {
    if (selectedPath) selectedPath.classList.remove('selected');
    selectedPath = path;
    path.classList.add('selected');
    Notes.render(path.getAttribute('data-slug'), path.getAttribute('data-name'));
  }

  function clearSelection() {
    if (selectedPath) selectedPath.classList.remove('selected');
    selectedPath = null;
  }

  function loadMap() {
    return fetch('assets/map/mexico.svg')
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var holder = el('map');
        holder.innerHTML = txt;
        svgEl = holder.querySelector('svg');
        var vb = svgEl.viewBox.baseVal;
        if (vb && vb.width) VW = vb.width;
        if (vb && vb.height) VH = vb.height;

        viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        viewport.setAttribute('id', 'viewport');
        var children = Array.prototype.filter.call(svgEl.childNodes, function (n) {
          return n.nodeType === 1;
        });
        children.forEach(function (c) { viewport.appendChild(c); });
        svgEl.appendChild(viewport);

        var paths = viewport.querySelectorAll('.state');
        Array.prototype.forEach.call(paths, function (p, i) {
          p.style.setProperty('--state-fill', PALETTE[i % PALETTE.length]);
          p.addEventListener('mouseenter', function (e) { showTip(e, p); });
          p.addEventListener('mousemove', moveTip);
          p.addEventListener('mouseleave', hideTip);
          p.addEventListener('click', function (e) {
            if (dragMoved) { e.preventDefault(); return; }
            selectState(p);
          });
        });

        applyView();
      });
  }

  function refreshTotal() {
    var notes = Storage.getNotes();
    var total = 0;
    Object.keys(notes).forEach(function (k) { total += notes[k].length; });
    el('stat-total').textContent = total;
  }

  function refreshMapCounts() {
    if (!svgEl || !viewport) return;
    var g = viewport.querySelector('#counts');
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'counts');
      viewport.appendChild(g);
    }
    g.innerHTML = '';
    var notes = Storage.getNotes();
    var paths = viewport.querySelectorAll('.state');
    Array.prototype.forEach.call(paths, function (p) {
      var slug = p.getAttribute('data-slug');
      var count = (notes[slug] || []).length;
      if (!count) return;
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', p.getAttribute('data-cx'));
      t.setAttribute('y', p.getAttribute('data-cy'));
      t.setAttribute('class', 'count-label');
      t.textContent = count;
      g.appendChild(t);
    });
  }

  // ---- Zoom / pan ----
  function onPointerDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var count = Object.keys(pointers).length;
    if (count === 1) {
      dragMoved = false;
      dragStart = svgPoint(e.clientX, e.clientY);
    } else if (count === 2) {
      var ids = Object.keys(pointers);
      var p0 = pointers[ids[0]];
      var p1 = pointers[ids[1]];
      lastPinchDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      lastPinchMid = svgPoint((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    }
  }

  function onPointerMove(e) {
    if (!(e.pointerId in pointers)) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var count = Object.keys(pointers).length;
    if (count === 1) {
      var pt = svgPoint(e.clientX, e.clientY);
      var dx = pt.x - dragStart.x;
      var dy = pt.y - dragStart.y;
      if (Math.hypot(dx, dy) > 3) dragMoved = true;
      if (dragMoved && view.scale > 1) {
        view.tx += dx;
        view.ty += dy;
        dragStart = pt;
        applyView();
      }
    } else if (count === 2) {
      var ids = Object.keys(pointers);
      var p0 = pointers[ids[0]];
      var p1 = pointers[ids[1]];
      var dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      var mid = svgPoint((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      if (lastPinchDist > 0) {
        var s = view.scale;
        var ns = clamp(s * (dist / lastPinchDist), MIN_SCALE, MAX_SCALE);
        var k = ns / s;
        view.tx = mid.x - k * (mid.x - view.tx) + (mid.x - lastPinchMid.x);
        view.ty = mid.y - k * (mid.y - view.ty) + (mid.y - lastPinchMid.y);
        view.scale = ns;
        applyView();
      }
      lastPinchDist = dist;
      lastPinchMid = mid;
    }
  }

  function onPointerUp(e) {
    delete pointers[e.pointerId];
    var count = Object.keys(pointers).length;
    if (count === 1) {
      var id = Object.keys(pointers)[0];
      dragStart = svgPoint(pointers[id].x, pointers[id].y);
      dragMoved = false;
    } else if (count === 0) {
      lastPinchDist = 0;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    var pt = svgPoint(e.clientX, e.clientY);
    var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(pt.x, pt.y, factor);
  }

  function bindZoom() {
    var mapEl = el('map');
    mapEl.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
    mapEl.addEventListener('wheel', onWheel, { passive: false });
    mapEl.addEventListener('dblclick', function (e) {
      var pt = svgPoint(e.clientX, e.clientY);
      zoomAt(pt.x, pt.y, 1.6);
    });

    el('btn-zoom-in').addEventListener('click', function () { zoomCenter(1.5); });
    el('btn-zoom-out').addEventListener('click', function () { zoomCenter(1 / 1.5); });
    el('btn-zoom-reset').addEventListener('click', resetView);
  }

  window.refreshTotal = refreshTotal;
  window.refreshMapCounts = refreshMapCounts;
  window.clearSelection = clearSelection;

  function init() {
    initTooltip();
    Notes.renderLegend();
    bindZoom();
    Storage.loadNotes()
      .then(function () {
        refreshTotal();
        return loadMap();
      })
      .then(refreshMapCounts)
      .catch(function () {
        return loadMap().then(refreshMapCounts);
      });
  }

  init();
})();
