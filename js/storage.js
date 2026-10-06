(function () {
  'use strict';

  var API = 'https://api.github.com';
  var ONBOARD_KEY = 'mexicouple.onboarding.seen';
  var TOKEN_KEY = 'mexicouple.token';
  var cache = { base: {} };

  function getToken() {
    var stored = null;
    try { stored = localStorage.getItem(TOKEN_KEY); } catch (e) {}
    if (stored) return stored;
    var c = window.CONFIG || {};
    return c.token || '';
  }

  function cfg() {
    var c = window.CONFIG || {};
    var owner = (c.owner && c.owner !== 'TU_USUARIO') ? c.owner : null;
    var repo = c.repo;

    if (!owner) {
      var m = location.host.match(/^([^.]+)\.github\.io$/);
      if (m) owner = m[1];
    }
    if (!repo) {
      var parts = location.pathname.split('/').filter(Boolean);
      repo = parts[0] || 'Mexicouple';
    }

    return {
      owner: owner,
      repo: repo,
      branch: c.branch || 'main',
      token: getToken(),
      people: c.people || ['Angel', 'Nat']
    };
  }

  function b64(s) {
    var bytes = new TextEncoder().encode(s);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromB64(s) {
    var bin = atob(s.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function headers() {
    return {
      'Authorization': 'token ' + cfg().token,
      'Accept': 'application/vnd.github+json'
    };
  }

  function handle(res) {
    if (!res.ok) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        var msg = (body && body.message) ? body.message : ('HTTP ' + res.status);
        throw new Error(msg);
      });
    }
    return res.json();
  }

  function loadNotesStatic() {
    return fetch('data/notes.json')
      .then(function (r) { return r.json(); })
      .then(function (j) { cache.base = j; return j; })
      .catch(function () { cache.base = {}; return {}; });
  }

  function loadNotes() {
    var c = cfg();
    if (c.token && c.owner) {
      var url = API + '/repos/' + c.owner + '/' + c.repo + '/contents/data/notes.json';
      return fetch(url, { headers: headers() })
        .then(handle)
        .then(function (f) {
          cache.base = JSON.parse(fromB64(f.content));
          return cache.base;
        })
        .catch(function () { return loadNotesStatic(); });
    }
    return loadNotesStatic();
  }

  function commit(ops, message) {
    var c = cfg();
    if (!c.token || !c.owner) {
      return Promise.reject(new Error('Falta el token: abre Ajustes y pégalo'));
    }
    var h = headers();
    var base = API + '/repos/' + c.owner + '/' + c.repo;
    var headSha = null;
    var treeSha = null;

    return fetch(base + '/git/ref/heads/' + c.branch, { headers: h })
      .then(handle)
      .then(function (ref) {
        headSha = ref.object.sha;
        return fetch(base + '/git/commits/' + headSha, { headers: h }).then(handle);
      })
      .then(function (cm) {
        treeSha = cm.tree.sha;
        var adds = ops.filter(function (o) { return !o.delete; });
        return Promise.all(adds.map(function (f) {
          return fetch(base + '/git/blobs', {
            method: 'POST',
            headers: h,
            body: JSON.stringify({ content: f.content, encoding: 'base64' })
          }).then(handle).then(function (b) {
            return { path: f.path, mode: '100644', type: 'blob', sha: b.sha };
          });
        }));
      })
      .then(function (items) {
        var dels = ops.filter(function (o) { return o.delete; })
          .map(function (o) { return { path: o.path, sha: null }; });
        return fetch(base + '/git/trees', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ base_tree: treeSha, tree: items.concat(dels) })
        }).then(handle);
      })
      .then(function (tree) {
        return fetch(base + '/git/commits', {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ message: message, tree: tree.sha, parents: [headSha] })
        }).then(handle);
      })
      .then(function (nc) {
        return fetch(base + '/git/refs/heads/' + c.branch, {
          method: 'PATCH',
          headers: h,
          body: JSON.stringify({ sha: nc.sha, force: false })
        }).then(handle);
      });
  }

  function persist(message, extraOps) {
    var ops = [{ path: 'data/notes.json', content: b64(JSON.stringify(cache.base, null, 2)) }];
    if (extraOps) ops = ops.concat(extraOps);
    return commit(ops, message);
  }

  function imageOp(dataUrl, id) {
    if (!dataUrl) return null;
    var m = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/);
    if (!m) return null;
    var ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    var path = 'assets/notes/note-' + id + '.' + ext;
    return { path: path, content: m[2] };
  }

  var Storage = {
    loadNotes: loadNotes,
    getNotes: function () { return cache.base; },
    getNotesFor: function (slug) { return cache.base[slug] || []; },
    persist: persist,
    imageOp: imageOp,
    people: function () { return cfg().people; },
    isConfigured: function () {
      var c = cfg();
      return !!(c.token && c.owner);
    },
    onboardingSeen: function () {
      return localStorage.getItem(ONBOARD_KEY) === '1';
    },
    markOnboardingSeen: function () {
      localStorage.setItem(ONBOARD_KEY, '1');
    }
  };

  window.Storage = Storage;
})();
