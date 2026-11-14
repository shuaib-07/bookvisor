# BookVisor Bridge - Zen Browser WebExtension

This companion WebExtension enables **safe, real-time two-way synchronization** between **Zen Browser** on your PC and the **BookVisor** desktop app over a high-speed local WebSocket (`ws://127.0.0.1:49152`).

---

### How to Install into Zen Browser (30 Seconds)

1. Open **Zen Browser**.
2. In the URL bar, type:
   ```text
   about:debugging
   ```
   and press Enter.
3. Click on **This Zen** (or **This Firefox**) in the left sidebar.
4. Click the **Load Temporary Add-on...** button.
5. In the file picker, navigate to this directory:
   ```text
   C:\bookmanage\extension\manifest.json
   ```
   and select `manifest.json`.

---

### How It Works

1. **Zero Database Locks:** The extension interacts through the safe, asynchronous `browser.bookmarks` WebExtensions API. It never touches `places.sqlite` directly while Zen is running, eliminating any risk of profile or database corruption.
2. **Instant Capture:** Every time you press `Ctrl+D` or save a bookmark in Zen Browser, the extension automatically sends the bookmark to BookVisor for instant URL cleaning and metadata enrichment.
3. **IronFox Mobile Sync:** Because Zen Browser natively supports Firefox Sync, any folder mutations applied by BookVisor's AI organizer immediately mirror to your **IronFox Browser on Android** automatically!

