(function () {
  'use strict';

  var CATEGORIES = {
    playa: { label: 'Playa', color: 'var(--mar)' },
    comida: { label: 'Comida', color: 'var(--rojo)' },
    cultural: { label: 'Cultural', color: 'var(--amarillo)' },
    aventura: { label: 'Aventura', color: 'var(--rosa)' },
    naturaleza: { label: 'Naturaleza', color: 'var(--selva)' },
    otro: { label: 'Otro', color: 'var(--texto2)' }
  };

  var WHO_KEY = 'mexicouple.whoami';
  var currentSlug = null;
  var currentName = '';
  var currentFilter = 'todas';
  var imageData = null;
  var editingId = null;

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid() {
    return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function whoAmI() {
    return localStorage.getItem(WHO_KEY) || Storage.people()[0];
  }

  function isUploaded(path) {
    return typeof path === 'string' && path.indexOf('assets/notes/note-') === 0;
  }

  function refreshAll() {
    renderNotes();
    if (typeof window.refreshTotal === 'function') window.refreshTotal();
    if (typeof window.refreshMapCounts === 'function') window.refreshMapCounts();
  }

  function showToast(msg, type) {
    var t = el('toast');
    t.textContent = msg;
    t.className = 'toast ' + (type || 'info');
    t.classList.remove('hidden');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.add('hidden'); }, 3200);
  }

  function mutateAndPersist(message, extraOps) {
    refreshAll();
    return Storage.persist(message, extraOps)
      .then(function () {
        showToast('Guardado en GitHub', 'ok');
      })
      .catch(function (err) {
        showToast('Error: ' + err.message, 'error');
        return Storage.loadNotes().then(function (notes) {
          refreshAll();
        });
      });
  }

  function showEmpty() {
    el('panel-empty').classList.remove('hidden');
    el('panel-state').classList.add('hidden');
  }

  function renderNotes() {
    if (!currentSlug) { showEmpty(); return; }
    el('panel-empty').classList.add('hidden');
    el('panel-state').classList.remove('hidden');
    el('panel-title').textContent = currentName;

    var list = el('note-list');
    list.innerHTML = '';
    var notes = Storage.getNotesFor(currentSlug);

    if (currentFilter !== 'todas') {
      notes = notes.filter(function (n) { return n.categoria === currentFilter; });
    }

    if (notes.length === 0) {
      list.innerHTML = '<li class="note-empty">Aún no hay lugares aquí.</li>';
      return;
    }

    notes.forEach(function (n) { list.appendChild(buildCard(n)); });
  }

  function buildCard(n) {
    var li = document.createElement('li');
    li.className = 'note';
    var cat = CATEGORIES[n.categoria] || CATEGORIES.otro;
    var favs = n.favoritos || [];
    var me = whoAmI();
    var mine = favs.indexOf(me) >= 0;

    var img = n.imagen ? '<img class="note-img" src="' + esc(n.imagen) + '" alt="">' : '';
    var desc = n.descripcion ? '<p class="note-desc">' + esc(n.descripcion) + '</p>' : '';
    var favLine = favs.length
      ? '<p class="note-favs">favoritos: ' + esc(favs.join(', ')) + '</p>'
      : '';

    li.innerHTML =
      '<div class="note-top">' +
        '<span class="badge" style="--badge:' + cat.color + '">' + esc(cat.label) + '</span>' +
        '<span class="note-actions">' +
          '<button class="note-action note-fav' + (mine ? ' is-fav' : '') + '" title="Marcar favorito">' + (mine ? '★' : '☆') + '</button>' +
          '<button class="note-action note-edit" title="Editar">✎</button>' +
          '<button class="note-action note-del" title="Eliminar">×</button>' +
        '</span>' +
      '</div>' +
      '<h4 class="note-title">' + esc(n.titulo) + '</h4>' +
      '<p class="note-editor">por ' + esc(n.editor) + '</p>' +
      favLine + desc + img;

    li.querySelector('.note-fav').addEventListener('click', function () { toggleFavorite(n); });
    li.querySelector('.note-edit').addEventListener('click', function () { openEdit(n); });
    li.querySelector('.note-del').addEventListener('click', function () { deleteNote(n); });
    return li;
  }

  function toggleFavorite(n) {
    n.favoritos = n.favoritos || [];
    var me = whoAmI();
    var i = n.favoritos.indexOf(me);
    if (i >= 0) n.favoritos.splice(i, 1);
    else n.favoritos.push(me);
    mutateAndPersist('Favorito: ' + n.titulo, []);
  }

  function deleteNote(n) {
    if (!window.confirm('¿Eliminar "' + n.titulo + '"?')) return;
    var notes = Storage.getNotes();
    notes[currentSlug] = notes[currentSlug].filter(function (x) { return x.id !== n.id; });
    var extraOps = [];
    if (isUploaded(n.imagen)) extraOps.push({ path: n.imagen, delete: true });
    mutateAndPersist('Eliminar lugar: ' + n.titulo, extraOps);
  }

  function openModal() {
    editingId = null;
    el('modal-title').textContent = 'Añadir lugar — ' + currentName;
    el('note-form').reset();
    el('f-editor').value = whoAmI();
    el('f-categoria').value = 'otro';
    imageData = null;
    el('f-preview').classList.add('hidden');
    el('f-preview').innerHTML = '';
    el('note-modal').classList.remove('hidden');
    el('f-titulo').focus();
  }

  function openEdit(n) {
    editingId = n.id;
    el('modal-title').textContent = 'Editar lugar — ' + currentName;
    el('f-titulo').value = n.titulo || '';
    el('f-desc').value = n.descripcion || '';
    el('f-categoria').value = n.categoria || 'otro';
    el('f-editor').value = n.editor || '';
    el('f-imagen').value = '';
    imageData = null;
    if (n.imagen) {
      el('f-preview').innerHTML = '<img src="' + esc(n.imagen) + '" alt="Imagen actual">';
      el('f-preview').classList.remove('hidden');
    } else {
      el('f-preview').classList.add('hidden');
      el('f-preview').innerHTML = '';
    }
    el('note-modal').classList.remove('hidden');
    el('f-titulo').focus();
  }

  function closeModal() {
    el('note-modal').classList.add('hidden');
    editingId = null;
  }

  function showPreview(src) {
    el('f-preview').innerHTML = '<img src="' + esc(src) + '" alt="Vista previa">';
    el('f-preview').classList.remove('hidden');
  }

  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1200;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function submitForm() {
    var titulo = el('f-titulo').value.trim();
    if (!titulo) return;

    var notes = Storage.getNotes();
    if (!notes[currentSlug]) notes[currentSlug] = [];

    var fields = {
      titulo: titulo,
      descripcion: el('f-desc').value.trim(),
      categoria: el('f-categoria').value,
      editor: el('f-editor').value.trim() || 'Anónimo'
    };

    if (editingId) {
      var idx = notes[currentSlug].findIndex(function (n) { return n.id === editingId; });
      if (idx === -1) return;
      var old = notes[currentSlug][idx];
      var updated = {
        id: old.id,
        titulo: fields.titulo,
        descripcion: fields.descripcion,
        categoria: fields.categoria,
        editor: fields.editor,
        imagen: old.imagen,
        favoritos: old.favoritos || []
      };
      var extraOps = [];
      if (imageData) {
        var op = Storage.imageOp(imageData, editingId + '-v' + Date.now().toString(36));
        if (op) {
          updated.imagen = op.path;
          extraOps.push(op);
          if (isUploaded(old.imagen) && old.imagen !== op.path) {
            extraOps.push({ path: old.imagen, delete: true });
          }
        }
      }
      notes[currentSlug][idx] = updated;
      closeModal();
      mutateAndPersist('Editar lugar: ' + updated.titulo, extraOps);
    } else {
      var note = {
        id: uid(),
        titulo: fields.titulo,
        descripcion: fields.descripcion,
        categoria: fields.categoria,
        editor: fields.editor,
        favoritos: []
      };
      var addOps = [];
      if (imageData) {
        var imgOp = Storage.imageOp(imageData, note.id);
        if (imgOp) {
          note.imagen = imgOp.path;
          addOps.push(imgOp);
        }
      }
      notes[currentSlug].push(note);
      closeModal();
      mutateAndPersist('Añadir lugar: ' + note.titulo, addOps);
    }
  }

  function renderFilters() {
    var cont = el('filters');
    cont.innerHTML = '';
    var opts = [{ key: 'todas', label: 'Todas' }].concat(
      Object.keys(CATEGORIES).map(function (k) { return { key: k, label: CATEGORIES[k].label }; })
    );
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'filter-chip' + (o.key === currentFilter ? ' active' : '');
      b.textContent = o.label;
      b.addEventListener('click', function () {
        currentFilter = o.key;
        renderFilters();
        renderNotes();
      });
      cont.appendChild(b);
    });
  }

  function initWhoami() {
    var sel = el('whoami');
    var dl = el('editors');
    sel.innerHTML = '';
    dl.innerHTML = '';
    Storage.people().forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);

      var d = document.createElement('option');
      d.value = name;
      dl.appendChild(d);
    });
    sel.value = whoAmI();
    sel.addEventListener('change', function () {
      localStorage.setItem(WHO_KEY, sel.value);
      renderNotes();
    });
  }

  function updateStatusText() {
    el('save-status').textContent = Storage.isConfigured()
      ? 'Los cambios se guardan en GitHub y se comparten.'
      : 'Pega tu token en Ajustes para poder guardar.';
  }

  function bindEvents() {
    el('btn-add-note').addEventListener('click', openModal);
    el('btn-close').addEventListener('click', function () { Notes.close(); });
    el('btn-close-modal').addEventListener('click', closeModal);
    el('btn-cancel').addEventListener('click', closeModal);

    el('note-modal').addEventListener('click', function (e) {
      if (e.target === el('note-modal')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    el('f-imagen').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      processImage(f).then(function (dataUrl) {
        imageData = dataUrl;
        showPreview(dataUrl);
      }).catch(function () {
        showToast('No se pudo leer la imagen', 'error');
      });
    });

    el('note-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitForm();
    });
  }

  var Notes = {
    render: function (slug, name) {
      currentSlug = slug;
      currentName = name;
      renderNotes();
    },
    close: function () {
      currentSlug = null;
      currentName = '';
      showEmpty();
      if (typeof window.clearSelection === 'function') window.clearSelection();
    },
    renderLegend: function () {
      var legend = el('legend');
      legend.innerHTML = '';
      Object.keys(CATEGORIES).forEach(function (k) {
        var c = CATEGORIES[k];
        legend.insertAdjacentHTML('beforeend',
          '<div class="legend-item"><span class="legend-swatch" style="background:' + c.color + '"></span>' +
          esc(c.label) + '</div>');
      });
    }
  };

  window.Notes = Notes;

  renderFilters();
  initWhoami();
  updateStatusText();
  bindEvents();
})();
