/* Dynamic menu loader and JSON editor
   - Loads menu from localStorage (if present) or from `menu.json`
   - Renders tabs and menu cards dynamically
   - Provides an in-browser JSON editor (apply, save to localStorage, download)
*/

async function loadMenuSource() {
  const local = localStorage.getItem("mugo-menu-json");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (err) {
      console.warn("Invalid JSON in localStorage, falling back to file.", err);
    }
  }

  try {
    // Append a cache-busting query and request no-store to avoid stale GitHub Pages caching
    const url = `menu.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error("Failed to fetch menu.json");
    return await res.json();
  } catch (err) {
    console.error("Could not load menu.json:", err);
    return { tabs: [] };
  }
}

function renderMenu(data) {
  const tabsContainer = document.getElementById("menu-tabs");
  const root = document.getElementById("menu-root");
  tabsContainer.innerHTML = "";
  root.innerHTML = "";

  if (!data || !Array.isArray(data.tabs)) return;

  data.tabs.forEach((tab, idx) => {
    const btn = document.createElement("button");
    btn.className = "menu-tab" + (idx === 0 ? " active" : "");
    btn.setAttribute("data-target", tab.id);
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", idx === 0 ? "true" : "false");
    btn.textContent = tab.label || tab.id;
    tabsContainer.appendChild(btn);

    const section = document.createElement("section");
    section.id = tab.id;
    section.className = "menu-card" + (idx === 0 ? " active" : "");
    section.setAttribute("role", "tabpanel");

    const header = document.createElement("header");
    header.className = "menu-card-header";
    const h1 = document.createElement("h1");
    h1.className = "menu-card-title-main";
    h1.textContent = tab.title || "";
    header.appendChild(h1);
    section.appendChild(header);

    (tab.groups || []).forEach((group) => {
      const groupDiv = document.createElement("div");
      groupDiv.className = "menu-group";
      const pLabel = document.createElement("p");
      pLabel.className = "menu-group-label";
      pLabel.textContent = group.label || "";
      groupDiv.appendChild(pLabel);

      (group.items || []).forEach((item) => {
        const art = document.createElement("article");
        art.className = "menu-item";

        const mainDiv = document.createElement("div");
        mainDiv.className = "menu-item-main";
        const name = document.createElement("h2");
        name.className = "menu-item-name";
        name.textContent = item.name || "";
        const desc = document.createElement("p");
        desc.className = "menu-item-desc";
        desc.textContent = item.desc || "";
        mainDiv.appendChild(name);
        mainDiv.appendChild(desc);

        const price = document.createElement("div");
        price.className = "menu-item-price";
        price.textContent = item.price || "";

        art.appendChild(mainDiv);
        art.appendChild(price);
        groupDiv.appendChild(art);
      });

      section.appendChild(groupDiv);
    });

    root.appendChild(section);
  });

  // attach tab behavior
  const tabs = Array.from(document.querySelectorAll(".menu-tab"));
  const cards = Array.from(document.querySelectorAll(".menu-card"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");
      if (!targetId) return;

      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      cards.forEach((card) => {
        if (card.id === targetId) {
          card.classList.add("active");
        } else {
          card.classList.remove("active");
        }
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function setupEditor(initialData) {
  const editBtn = document.getElementById("edit-menu-btn");
  const editorWrap = document.getElementById("menu-editor");
  const editor = document.getElementById("menu-json-editor");
  const loadBtn = document.getElementById("load-json-btn");
  const saveLocalBtn = document.getElementById("save-local-btn");
  const downloadBtn = document.getElementById("download-json-btn");
  const closeBtn = document.getElementById("close-editor-btn");

  function openEditor() {
    editorWrap.hidden = false;
    editor.value = JSON.stringify(initialData, null, 2);
    editor.focus();
  }

  function closeEditor() {
    editorWrap.hidden = true;
  }

  editBtn.addEventListener("click", () => {
    if (editorWrap.hidden) openEditor(); else closeEditor();
  });

  loadBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(editor.value);
      initialData = parsed;
      renderMenu(parsed);
      alert("Menu applied from JSON.");
    } catch (err) {
      alert("Invalid JSON: " + err.message);
    }
  });

  saveLocalBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(editor.value);
      localStorage.setItem("mugo-menu-json", JSON.stringify(parsed));
      alert("Saved menu to localStorage.");
    } catch (err) {
      alert("Invalid JSON: " + err.message);
    }
  });

  downloadBtn.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(editor.value);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "menu.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Invalid JSON: " + err.message);
    }
  });

  closeBtn.addEventListener("click", closeEditor);
}

(async function init() {
  const data = await loadMenuSource();
  renderMenu(data);
  setupEditor(data);
})();

