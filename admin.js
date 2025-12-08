// Simple client-side admin for editing the menu JSON
// WARNING: This is client-side protection only. Do not use for sensitive deployments.

(function () {
  // Change these credentials if you want — they're embedded in the JS
  const CREDENTIALS = { username: 'admin', password: 'mugo1234' };

  const loginBox = document.getElementById('login-box');
  const adminPanel = document.getElementById('admin-panel');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const editor = document.getElementById('menu-json-editor');
  const applyBtn = document.getElementById('apply-btn');
  const saveBtn = document.getElementById('save-btn');
  const downloadBtn = document.getElementById('download-btn');
  const previewRoot = document.getElementById('menu-preview');

  function showAdmin() {
    loginBox.hidden = true;
    adminPanel.hidden = false;
    editor.focus();
  }

  function showLogin() {
    loginBox.hidden = false;
    adminPanel.hidden = true;
  }

  function checkAuth(u, p) {
    return u === CREDENTIALS.username && p === CREDENTIALS.password;
  }

  async function loadMenu() {
    const local = localStorage.getItem('mugo-menu-json');
    if (local) {
      editor.value = JSON.stringify(JSON.parse(local), null, 2);
      renderPreview(JSON.parse(local));
      return;
    }

    try {
      const res = await fetch('menu.json');
      const data = await res.json();
      editor.value = JSON.stringify(data, null, 2);
      renderPreview(data);
    } catch (err) {
      editor.value = '{\n  "tabs": []\n}';
      previewRoot.innerHTML = '<p style="color:var(--text-muted)">Could not load menu.json</p>';
    }
  }

  function renderPreview(data) {
    // reuse render logic similar to the site but render inside previewRoot
    previewRoot.innerHTML = '';
    if (!data || !Array.isArray(data.tabs)) return;

    data.tabs.forEach((tab, idx) => {
      const card = document.createElement('section');
      card.className = 'menu-card active';
      const h = document.createElement('h3');
      h.className = 'menu-card-title-main';
      h.textContent = tab.title || tab.label || tab.id;
      card.appendChild(h);

      (tab.groups || []).forEach(group => {
        const g = document.createElement('div');
        g.className = 'menu-group';
        const gl = document.createElement('p');
        gl.className = 'menu-group-label';
        gl.textContent = group.label || '';
        g.appendChild(gl);

        (group.items || []).forEach(item => {
          const art = document.createElement('article');
          art.className = 'menu-item';
          const m = document.createElement('div');
          m.className = 'menu-item-main';
          const name = document.createElement('h4');
          name.className = 'menu-item-name';
          name.textContent = item.name || '';
          const desc = document.createElement('p');
          desc.className = 'menu-item-desc';
          desc.textContent = item.desc || '';
          m.appendChild(name);
          m.appendChild(desc);
          const price = document.createElement('div');
          price.className = 'menu-item-price';
          price.textContent = item.price || '';
          art.appendChild(m);
          art.appendChild(price);
          g.appendChild(art);
        });

        card.appendChild(g);
      });

      previewRoot.appendChild(card);
    });
  }

  loginBtn.addEventListener('click', (e) => {
    const u = usernameInput.value.trim();
    const p = passwordInput.value;
    if (checkAuth(u, p)) {
      showAdmin();
      loadMenu();
    } else {
      alert('Invalid credentials');
    }
  });

  logoutBtn.addEventListener('click', () => {
    showLogin();
    usernameInput.value = '';
    passwordInput.value = '';
  });

  applyBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(editor.value);
      renderPreview(parsed);
      alert('Menu applied');
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  });

  saveBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(editor.value);
      localStorage.setItem('mugo-menu-json', JSON.stringify(parsed));
      alert('Saved to localStorage');
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  });

  downloadBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(editor.value);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  });

})();
