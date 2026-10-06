(function () {
  'use strict';

  var KEY = 'mexicouple.token';

  function el(id) { return document.getElementById(id); }

  function open() {
    el('s-token').value = localStorage.getItem(KEY) || '';
    el('settings-modal').classList.remove('hidden');
    el('s-token').focus();
  }

  function close() {
    el('settings-modal').classList.add('hidden');
  }

  function save() {
    var t = el('s-token').value.trim();
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
    close();
    location.reload();
  }

  el('btn-settings').addEventListener('click', open);
  el('btn-settings-close').addEventListener('click', close);
  el('btn-settings-cancel').addEventListener('click', close);
  el('settings-modal').addEventListener('click', function (e) {
    if (e.target === el('settings-modal')) close();
  });
  el('settings-form').addEventListener('submit', function (e) {
    e.preventDefault();
    save();
  });
})();
