/* Dashboard: friendly CRUD for menu.json
   - Requires login: checks localStorage 'mugo-admin-auth'
   - Provides UI to add/edit/delete tabs/groups/items
   - Keeps an in-memory `menu` object and syncs to raw JSON/preview
*/

(function () {
  // Require login to access dashboard. Redirect to `admin.html` if not logged.
  if (localStorage.getItem('mugo-admin-auth') !== '1') {
    location.href = 'admin.html';
    return;
  }

  const crudRoot = document.getElementById('crud-root');
  const addTabBtn = document.getElementById('add-tab-btn');
  const saveBtn = document.getElementById('save-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const saveStatus = document.getElementById('save-status');

  let menu = { tabs: [] };
  let originalMenu = null; // last saved snapshot
  let selectedTab = 0;
  let dirtyTabs = {}; // map tabIdx -> true when modified

  async function loadMenu() {
    try {
      const res = await fetch('menu.json');
      menu = await res.json();
    } catch (err) {
      console.error('Could not load menu.json', err);
      menu = { tabs: [] };
    }
    originalMenu = JSON.parse(JSON.stringify(menu));
    renderAll();
  }

  function renderAll() {
    renderTabs();
    renderCrud();
  }

  // render tabs strip for categories
  function renderTabs() {
    const tabsRoot = document.getElementById('category-tabs');
    if (!tabsRoot) return;
    tabsRoot.innerHTML = '';
    menu.tabs = menu.tabs || [];
    menu.tabs.forEach((t, idx) => {
      const b = document.createElement('button');
      b.className = 'menu-tab' + (idx === selectedTab ? ' active' : '');
      b.textContent = t.label || t.id || `Categoria ${idx+1}`;
      if (dirtyTabs[idx]) b.textContent += ' *';
      b.addEventListener('click', () => {
        selectedTab = idx;
        renderAll();
      });
      tabsRoot.appendChild(b);
    });
  }

  function markDirty(tabIdx) {
    dirtyTabs[tabIdx] = true;
    renderTabs();
  }

  async function saveTab(tabIdx) {
    // conceptually save current tab by saving full menu to server
    saveStatus.textContent = `Salvataggio categoria ${menu.tabs[tabIdx] && (menu.tabs[tabIdx].label || tabIdx)}...`;
    saveBtn.disabled = true;
    try {
      await saveToServer();
    } finally {
      saveBtn.disabled = false;
    }
  }

  function revertTab(tabIdx) {
    if (!originalMenu) return;
    if (!originalMenu.tabs || !originalMenu.tabs[tabIdx]) return;
    menu.tabs[tabIdx] = JSON.parse(JSON.stringify(originalMenu.tabs[tabIdx]));
    delete dirtyTabs[tabIdx];
    renderAll();
  }

  async function saveToServer() {
    const token = localStorage.getItem('mugo-admin-token');
    const isLoggedFlag = localStorage.getItem('mugo-admin-auth') === '1';
    // Always attempt the request — this allows static-host fallback (download) when no server.
    // Build headers only if token exists.
    saveBtn.disabled = true;
    saveStatus.textContent = 'Salvataggio in corso...';
    // Try sending to server; if server not available (static host), fallback to download
    try {
      let res;
      try {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Basic ' + token;
        res = await fetch('/save-menu', {
          method: 'POST',
          headers,
          body: JSON.stringify(menu)
        });
      } catch (netErr) {
        // network error (no server) — fallback to download
        console.warn('Network error when saving to server, falling back to download', netErr);
        downloadMenu();
        saveStatus.textContent = 'Server non disponibile — menu scaricato localmente.';
        showToast('Server non disponibile — menu scaricato.', 'success');
        originalMenu = JSON.parse(JSON.stringify(menu));
        dirtyTabs = {};
        renderTabs();
        saveBtn.disabled = false;
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          // If the client already believes it's logged, show a re-login banner instead of prompting
          if (isLoggedFlag) {
            showReauthBanner();
            throw new Error('Autenticazione richiesta');
          }
          const saved = await showAuthModal();
          if (saved) return saveToServer();
          throw new Error('Autenticazione richiesta');
        }

        // If endpoint missing (404) treat as static host — fallback to download
        if (res.status === 404) {
          downloadMenu();
          saveStatus.textContent = 'Hosting statico rilevato — menu scaricato.';
          showToast('Hosting statico — menu scaricato.', 'success');
          originalMenu = JSON.parse(JSON.stringify(menu));
          dirtyTabs = {};
          renderTabs();
          saveBtn.disabled = false;
          return;
        }

        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText || 'Errore salvataggio');
      }

      // success
      saveStatus.textContent = 'Salvataggio completato.';
      originalMenu = JSON.parse(JSON.stringify(menu));
      dirtyTabs = {};
      renderTabs();
      showToast('Salvataggio completato.', 'success');
      setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 1500);
    } catch (err) {
      console.error('Save failed', err);
      const msg = err && err.message ? err.message : 'Errore salvataggio';
      showToast('Salvataggio fallito: ' + msg, 'error');
      saveStatus.textContent = 'Salvataggio fallito: ' + msg;
      setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 3000);
    } finally {
      saveBtn.disabled = false;
    }
  }

  // Download menu.json locally (fallback for static hosting)
  function downloadMenu() {
    try {
      const data = JSON.stringify(menu, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('File `menu.json` scaricato.', 'success');
    } catch (e) {
      console.error('Download failed', e);
      showToast('Download fallito.', 'error');
    }
  }

  function createTextInput(value, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.style.width = '100%';
    input.style.marginBottom = '6px';
    input.style.padding = '8px';
    input.style.background = 'rgba(0,0,0,0.6)';
    input.style.color = 'var(--text-main)';
    input.style.border = '1px solid rgba(255,255,255,0.06)';
    return input;
  }

  // Inline auth modal shown when saving without credentials or when server returns 401.
  function showAuthModal() {
    return new Promise((resolve) => {
      // avoid duplicate modals
      if (document.getElementById('auth-modal')) return resolve(false);

      const overlay = document.createElement('div');
      overlay.id = 'auth-modal';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,0.6)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = 9999;

      const box = document.createElement('div');
      box.style.background = 'var(--bg-card)';
      box.style.padding = '18px';
      box.style.borderRadius = '10px';
      box.style.width = '320px';
      box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';

      const title = document.createElement('div');
      title.textContent = 'Autenticazione richiesta';
      title.style.marginBottom = '8px';
      title.style.fontWeight = '700';

      const u = document.createElement('input');
      u.type = 'text';
      u.placeholder = 'Username';
      u.style.width = '100%';
      u.style.marginBottom = '8px';
      u.style.padding = '8px';

      const p = document.createElement('input');
      p.type = 'password';
      p.placeholder = 'Password';
      p.style.width = '100%';
      p.style.marginBottom = '12px';
      p.style.padding = '8px';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.justifyContent = 'flex-end';

      const cancel = document.createElement('button');
      cancel.className = 'menu-tab';
      cancel.textContent = 'Annulla';
      cancel.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });

      const submit = document.createElement('button');
      submit.className = 'menu-tab primary';
      submit.textContent = 'Login';
      submit.addEventListener('click', () => {
        const user = u.value.trim();
        const pass = p.value;
        if (!user || !pass) return alert('Inserisci username e password');
        try {
          const token = btoa(user + ':' + pass);
          localStorage.setItem('mugo-admin-auth', '1');
          localStorage.setItem('mugo-admin-token', token);
          document.body.removeChild(overlay);
          resolve(true);
        } catch (e) {
          alert('Impossibile memorizzare le credenziali');
          resolve(false);
        }
      });

      actions.appendChild(cancel);
      actions.appendChild(submit);

      box.appendChild(title);
      box.appendChild(u);
      box.appendChild(p);
      box.appendChild(actions);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      u.focus();
    });
  }

  // Show a small non-blocking banner to ask user to re-login on the admin page
  function showReauthBanner() {
    // avoid duplicates
    if (document.getElementById('reauth-banner')) return;
    const b = document.createElement('div');
    b.id = 'reauth-banner';
    b.style.position = 'fixed';
    b.style.left = '12px';
    b.style.right = '12px';
    b.style.bottom = '24px';
    b.style.zIndex = 9999;
    b.style.display = 'flex';
    b.style.justifyContent = 'space-between';
    b.style.alignItems = 'center';
    b.style.gap = '12px';
    b.style.padding = '12px 14px';
    b.style.background = 'linear-gradient(90deg, rgba(207,161,90,0.12), rgba(0,0,0,0.12))';
    b.style.border = '1px solid rgba(255,255,255,0.06)';
    b.style.borderRadius = '8px';

    const msg = document.createElement('div');
    msg.textContent = 'Sessione scaduta o token non valido. Ricollegati per salvare le modifiche.';
    msg.style.flex = '1';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const go = document.createElement('button');
    go.className = 'menu-tab primary';
    go.textContent = 'Riconnettiti';
    go.addEventListener('click', () => {
      location.href = 'admin.html';
    });

    const close = document.createElement('button');
    close.className = 'menu-tab';
    close.textContent = 'Chiudi';
    close.addEventListener('click', () => {
      const el = document.getElementById('reauth-banner');
      if (el) el.remove();
    });

    actions.appendChild(go);
    actions.appendChild(close);
    b.appendChild(msg);
    b.appendChild(actions);
    document.body.appendChild(b);
  }

  // Simple toast notifications (bottom-right)
  function showToast(message, type = 'success', timeout = 2000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.position = 'fixed';
      container.style.right = '18px';
      container.style.top = '18px';
      container.style.zIndex = 10000;
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '10px';
      document.body.appendChild(container);
    }

    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-success');
    t.textContent = message;
    container.appendChild(t);

    // trigger animation by adding visible class
    requestAnimationFrame(() => t.classList.add('toast-visible'));

    const remover = () => {
      t.classList.remove('toast-visible');
      setTimeout(() => { try { t.remove(); } catch(e){} }, 260);
    };

    const timer = setTimeout(remover, timeout);
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('click', remover);
  }

  // GitHub save modal: asks for owner/repo/branch/path and token
  function showGithubModal() {
    return new Promise((resolve) => {
      if (document.getElementById('github-modal')) return resolve(null);
      const overlay = document.createElement('div');
      overlay.id = 'github-modal';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,0.6)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = 9999;

      const box = document.createElement('div');
      box.style.background = 'var(--bg-card)';
      box.style.padding = '18px';
      box.style.borderRadius = '10px';
      box.style.width = '420px';
      box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.6)';

      const title = document.createElement('div');
      title.textContent = 'Salva su GitHub (opzione per Pages)';
      title.style.marginBottom = '10px';
      title.style.fontWeight = '700';

      const owner = document.createElement('input'); owner.placeholder = 'Proprietario (owner)'; owner.style.width='100%'; owner.style.marginBottom='8px'; owner.value = '';
      const repo = document.createElement('input'); repo.placeholder = 'Repository (es: user/repo)'; repo.style.width='100%'; repo.style.marginBottom='8px'; repo.value = '';
      const branch = document.createElement('input'); branch.placeholder = 'Branch (default: main)'; branch.style.width='100%'; branch.style.marginBottom='8px'; branch.value = 'main';
      const pathInput = document.createElement('input'); pathInput.placeholder = 'Percorso file (default: menu.json)'; pathInput.style.width='100%'; pathInput.style.marginBottom='8px'; pathInput.value = 'menu.json';
      const token = document.createElement('input'); token.placeholder = 'Token GitHub (personal access token)'; token.type = 'password'; token.style.width='100%'; token.style.marginBottom='8px'; token.value = '';
      const rememberLabel = document.createElement('label'); rememberLabel.style.display='flex'; rememberLabel.style.alignItems='center'; rememberLabel.style.gap='8px';
      const remember = document.createElement('input'); remember.type = 'checkbox'; remember.checked = false;
      rememberLabel.appendChild(remember); rememberLabel.appendChild(document.createTextNode('Ricorda token (solo su questo dispositivo)'));

      const hint = document.createElement('div'); hint.textContent = 'Nota: il token richiede scope `repo` per commit. Non memorizzare token su computer pubblico.'; hint.style.fontSize='12px'; hint.style.color='var(--text-muted)'; hint.style.marginBottom='8px';

      const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='8px'; actions.style.justifyContent='flex-end';
      const cancel = document.createElement('button'); cancel.className='menu-tab'; cancel.textContent='Annulla';
      cancel.addEventListener('click', ()=>{ overlay.remove(); resolve(null); });
      const submit = document.createElement('button'); submit.className='menu-tab primary'; submit.textContent='Salva su GitHub';
      submit.addEventListener('click', ()=>{
        const ownerVal = owner.value.trim();
        const repoVal = repo.value.trim();
        const branchVal = branch.value.trim() || 'main';
        const pathVal = pathInput.value.trim() || 'menu.json';
        const tokenVal = token.value.trim();
        if (!ownerVal || !repoVal || !tokenVal) return alert('Inserisci owner, repo e token');
        if (remember.checked) localStorage.setItem('mugo-github-token', tokenVal);
        overlay.remove();
        resolve({ owner: ownerVal, repo: repoVal, branch: branchVal, path: pathVal, token: tokenVal });
      });

      actions.appendChild(cancel); actions.appendChild(submit);
      box.appendChild(title);
      box.appendChild(owner); box.appendChild(repo); box.appendChild(branch); box.appendChild(pathInput); box.appendChild(token); box.appendChild(rememberLabel); box.appendChild(hint); box.appendChild(actions);
      overlay.appendChild(box); document.body.appendChild(overlay);
      // prefill token if stored
      const stored = localStorage.getItem('mugo-github-token'); if (stored) token.value = stored;
    });
  }

  // Commit menu.json to GitHub using REST API
  async function saveToGitHub({ owner, repo, branch, path, token }) {
    try {
      showToast('Invio a GitHub...', 'success');
      const apiBase = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/' + encodeURIComponent(path);
      // get existing file to read sha
      const getUrl = apiBase + '?ref=' + encodeURIComponent(branch);
      const headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };
      let sha;
      let getRes = await fetch(getUrl, { headers });
      if (getRes.ok) {
        const js = await getRes.json(); sha = js.sha;
      } else if (getRes.status === 404) {
        sha = undefined;
      } else {
        const txt = await getRes.text().catch(()=>getRes.statusText);
        throw new Error('Impossibile controllare file: ' + (txt || getRes.status));
      }

      const content = JSON.stringify(menu, null, 2);
      // base64 encode unicode-safe
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const body = { message: 'Aggiorna menu.json via dashboard', content: b64, branch };
      if (sha) body.sha = sha;

      const putRes = await fetch(apiBase, { method: 'PUT', headers: Object.assign({'Content-Type':'application/json'}, headers), body: JSON.stringify(body) });
      if (!putRes.ok) {
        const err = await putRes.json().catch(()=>({message: putRes.statusText}));
        throw new Error(err && err.message ? err.message : 'Commit fallito');
      }

      showToast('Commit su GitHub eseguito con successo', 'success');
      originalMenu = JSON.parse(JSON.stringify(menu));
      dirtyTabs = {};
      renderTabs();
    } catch (err) {
      console.error('GitHub save failed', err);
      showToast('GitHub commit fallito: ' + (err.message || err), 'error');
    }
  }

  function renderCrud() {
    crudRoot.innerHTML = '';
    menu.tabs = menu.tabs || [];

    if (!menu.tabs.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Nessuna categoria. Aggiungi una categoria per iniziare.';
      crudRoot.appendChild(empty);
      return;
    }

    const tab = menu.tabs[selectedTab] || menu.tabs[0];
    const tabIdx = selectedTab;
    const tabCard = document.createElement('div');
    tabCard.className = 'tab-card';

    const headerRow = document.createElement('div');
    headerRow.className = 'tab-header';

    const titleInput = createTextInput(tab.label || tab.id || '', 'Nome categoria');
    titleInput.addEventListener('input', () => {
      tab.label = titleInput.value;
      markDirty(tabIdx);
    });

    const idInput = createTextInput(tab.id || `tab-${Date.now()}`, 'Id categoria');
    idInput.style.width = '180px';
    idInput.addEventListener('input', () => {
      tab.id = idInput.value;
      markDirty(tabIdx);
    });

    const delTabBtn = document.createElement('button');
    delTabBtn.className = 'menu-tab danger';
    delTabBtn.textContent = 'Elimina categoria';
    delTabBtn.addEventListener('click', () => {
      if (!confirm('Eliminare questa categoria?')) return;
      menu.tabs.splice(tabIdx, 1);
      if (selectedTab >= menu.tabs.length) selectedTab = Math.max(0, menu.tabs.length - 1);
      renderAll();
    });

    const saveTabBtn = document.createElement('button');
    saveTabBtn.className = 'menu-tab';
    saveTabBtn.textContent = 'Salva categoria';
    saveTabBtn.addEventListener('click', () => saveTab(tabIdx));

    const revertBtn = document.createElement('button');
    revertBtn.className = 'menu-tab';
    revertBtn.textContent = 'Annulla';
    revertBtn.addEventListener('click', () => { if (confirm('Annullare le modifiche non salvate in questa categoria?')) revertTab(tabIdx); });

    headerRow.appendChild(titleInput);
    headerRow.appendChild(idInput);
    headerRow.appendChild(saveTabBtn);
    headerRow.appendChild(revertBtn);
    headerRow.appendChild(delTabBtn);
    tabCard.appendChild(headerRow);

    // groups
    const groupsRoot = document.createElement('div');
    groupsRoot.className = 'groups-root';

    (tab.groups || []).forEach((group, groupIdx) => {
      const gDiv = document.createElement('div');
      gDiv.className = 'group-card';

      const gRow = document.createElement('div');
      gRow.className = 'group-row';

      // toggle button to open/close section (open by default) — use icon
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'menu-tab group-toggle icon-btn';
      const isOpen = group._open !== false; // default true
      toggleBtn.innerHTML = isOpen ? '▾' : '▸';
      toggleBtn.title = isOpen ? 'Chiudi sezione' : 'Apri sezione';
      toggleBtn.addEventListener('click', () => {
        group._open = !(group._open !== false);
        renderAll();
      });

      const gLabel = createTextInput(group.label || '', 'Nome sezione');
      gLabel.addEventListener('input', () => {
        group.label = gLabel.value;
        markDirty(tabIdx);
      });

      const delGroup = document.createElement('button');
      delGroup.className = 'menu-tab danger icon-btn';
      delGroup.innerHTML = '🗑';
      delGroup.title = 'Elimina sezione';
      delGroup.addEventListener('click', () => {
        if (!confirm('Eliminare questa sezione?')) return;
        tab.groups.splice(groupIdx, 1);
        renderAll();
      });

      gRow.appendChild(gLabel);
      gRow.appendChild(toggleBtn);
      gRow.appendChild(delGroup);
      gDiv.appendChild(gRow);

      // items
      const itemsRoot = document.createElement('div');
      itemsRoot.className = 'items-root';
      if (group._open === false) {
        gDiv.classList.add('group-collapsed');
        itemsRoot.style.display = 'none';
      } else {
        gDiv.classList.remove('group-collapsed');
        itemsRoot.style.display = '';
      }
      (group.items || []).forEach((item, itemIdx) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'item-row';

        const nameInput = createTextInput(item.name || '', 'Nome');
        nameInput.addEventListener('input', () => { item.name = nameInput.value; markDirty(tabIdx); });
        const descInput = createTextInput(item.desc || '', 'Descrizione');
        descInput.addEventListener('input', () => { item.desc = descInput.value; markDirty(tabIdx); });
        const priceInput = createTextInput(item.price || '', 'Prezzo');
        priceInput.style.maxWidth = '120px';
        priceInput.addEventListener('input', () => { item.price = priceInput.value; markDirty(tabIdx); });

        const itemDel = document.createElement('button');
        itemDel.className = 'menu-tab danger icon-btn';
        itemDel.innerHTML = '🗑';
        itemDel.title = 'Elimina voce';
        itemDel.addEventListener('click', () => {
          if (!confirm('Eliminare questa voce?')) return;
          group.items.splice(itemIdx, 1);
          renderAll();
        });

        const leftCol = document.createElement('div');
        leftCol.className = 'item-left';
        leftCol.appendChild(nameInput);
        leftCol.appendChild(descInput);

        const rightCol = document.createElement('div');
        rightCol.className = 'item-right';
        rightCol.appendChild(priceInput);
        rightCol.appendChild(itemDel);

        itemRow.appendChild(leftCol);
        itemRow.appendChild(rightCol);
        itemsRoot.appendChild(itemRow);
      });

      const addItemBtn = document.createElement('button');
      addItemBtn.className = 'menu-tab';
      addItemBtn.textContent = 'Aggiungi voce';
      addItemBtn.addEventListener('click', () => {
        group.items = group.items || [];
        group.items.push({ name: 'Nuova voce', desc: '', price: '' });
        renderAll();
      });
      // hide add button when section is collapsed
      if (group._open === false) addItemBtn.style.display = 'none';

      gDiv.appendChild(itemsRoot);
      gDiv.appendChild(addItemBtn);
      groupsRoot.appendChild(gDiv);
    });

    const addGroupBtn = document.createElement('button');
    addGroupBtn.className = 'menu-tab';
    addGroupBtn.textContent = 'Aggiungi sezione';
    addGroupBtn.addEventListener('click', () => {
      tab.groups = tab.groups || [];
      tab.groups.push({ label: 'Nuova sezione', items: [] });
      renderAll();
    });

    tabCard.appendChild(groupsRoot);
    tabCard.appendChild(addGroupBtn);

    crudRoot.appendChild(tabCard);

    const footer = document.createElement('div');
    footer.style.marginTop = '10px';
    crudRoot.appendChild(footer);
  }

  addTabBtn.addEventListener('click', () => {
    menu.tabs.push({ id: `tab-${Date.now()}`, label: 'Nuova Categoria', groups: [] });
    selectedTab = menu.tabs.length - 1;
    renderAll();
  });

  saveBtn.addEventListener('click', () => {
    saveToServer();
  });

  // Save to GitHub button handler
  const saveGithubBtn = document.getElementById('save-github-btn');
  if (saveGithubBtn) saveGithubBtn.addEventListener('click', () => {
    showGithubModal().then(params => {
      if (!params) return;
      saveToGitHub(params);
    });
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('mugo-admin-auth');
    localStorage.removeItem('mugo-admin-token');
    location.href = 'admin.html';
  });

  // initial load
  loadMenu();

})();
