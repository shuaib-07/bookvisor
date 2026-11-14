const api = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", async () => {
  const pill = document.getElementById("status-pill");
  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  const syncBtn = document.getElementById("sync-btn");
  const browserLabel = document.getElementById("browser-label");

  const updateStatus = async () => {
    try {
      const data = await api.storage.local.get(["connected", "browserName"]);
      if (data && data.connected) {
        pill.className = "pill pill-connected";
        dot.className = "dot dot-connected";
        text.textContent = "Live Connected";
        if (browserLabel && data.browserName) {
          browserLabel.textContent = data.browserName;
        }
      } else {
        pill.className = "pill pill-disconnected";
        dot.className = "dot dot-disconnected";
        text.textContent = "Disconnected";
      }
    } catch (_) { }
  };

  await updateStatus();
  setInterval(updateStatus, 1500);

  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      syncBtn.textContent = "Syncing Tree...";
      try {
        const tree = await api.bookmarks.getTree();
        const ws = new WebSocket("ws://127.0.0.1:49152");
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: "BROWSER_TREE",
            payload: tree,
          }));
          setTimeout(() => {
            ws.close();
            syncBtn.textContent = "✓ Synced with Desktop!";
            setTimeout(() => (syncBtn.textContent = "Force Sync Bookmarks"), 2000);
          }, 500);
        };
        ws.onerror = () => {
          syncBtn.textContent = "BookVisor App not running!";
          setTimeout(() => (syncBtn.textContent = "Force Sync Bookmarks"), 2500);
        };
      } catch (e) {
        syncBtn.textContent = "Sync Failed";
        setTimeout(() => (syncBtn.textContent = "Force Sync Bookmarks"), 2000);
      }
    });
  }
});
