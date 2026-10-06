(function () {
  'use strict';

  var PALETTE = [
    '#3e8948', '#b86f50', '#d9a066', '#3ca0b8',
    '#5a4a7a', '#c05555', '#4a7c59', '#8a6f3e'
  ];

  var tooltip = null;
  var selectedPath = null;

  function el(id) { return document.getElementById(id); }

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
        var paths = holder.querySelectorAll('.state');
        Array.prototype.forEach.call(paths, function (p, i) {
          p.style.setProperty('--state-fill', PALETTE[i % PALETTE.length]);
          p.addEventListener('mouseenter', function (e) { showTip(e, p); });
          p.addEventListener('mousemove', moveTip);
          p.addEventListener('mouseleave', hideTip);
          p.addEventListener('click', function () { selectState(p); });
        });
      });
  }

  function refreshTotal() {
    var notes = Storage.getNotes();
    var total = 0;
    Object.keys(notes).forEach(function (k) { total += notes[k].length; });
    el('stat-total').textContent = total;
  }

  function refreshMapCounts() {
    var svg = el('map').querySelector('svg');
    if (!svg) return;
    var g = svg.querySelector('#counts');
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', 'counts');
      svg.appendChild(g);
    }
    g.innerHTML = '';
    var notes = Storage.getNotes();
    var paths = svg.querySelectorAll('.state');
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

  window.refreshTotal = refreshTotal;
  window.refreshMapCounts = refreshMapCounts;
  window.clearSelection = clearSelection;

  function init() {
    initTooltip();
    Notes.renderLegend();
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
