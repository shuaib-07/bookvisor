<div align="center">
  <img src="public/bookmarked.png" alt="BookVisor Logo" width="120" style="border-radius: 24px">
  <h1>BookVisor</h1>
  <h3>High-performance local-first AI bookmark manager, multi-browser 2-way sync bridge, and self-healing link vault for Windows.</h3>
  <p>
    <img src="https://img.shields.io/badge/WINDOWS-10%20%2F%2011-2ecc71?style=flat&logo=windows&logoColor=white" alt="Windows 10/11">
    <img src="https://img.shields.io/badge/TAURI_V2-0078d7?style=flat&logo=tauri&logoColor=white" alt="Tauri v2">
    <img src="https://img.shields.io/badge/RUST-00a4e4?style=flat&logo=rust&logoColor=white" alt="Rust">
    <img src="https://img.shields.io/badge/MICA_DESIGN-a5d8ea?style=flat&logo=windows11&logoColor=black" alt="Mica Design">
    <br>
    <img src="https://img.shields.io/badge/REACT_19-5a7d18?style=flat&logo=react&logoColor=white" alt="React 19">
    <img src="https://img.shields.io/badge/TYPESCRIPT-b08800?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
    <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE-MIT-ffea00?style=flat&logoColor=black" alt="MIT License"></a>
    <a href="https://github.com/shuaib-07/bookvisor/releases"><img src="https://img.shields.io/github/downloads/shuaib-07/bookvisor/total?style=flat&color=005d68" alt="Downloads"></a>
    <br>
    <a href="https://github.com/shuaib-07/bookvisor/releases"><img src="https://img.shields.io/github/v/release/shuaib-07/bookvisor?style=flat&color=6a0080&logo=github&logoColor=white" alt="Release"></a>
    <a href="https://github.com/shuaib-07/bookvisor/stargazers"><img src="https://img.shields.io/github/stars/shuaib-07/bookvisor?style=flat&color=9c27b0&logo=github&logoColor=white" alt="Stars"></a>
  </p>
</div>

BookVisor is an open-source, local-first bookmark intelligence cockpit and multi-browser sync engine crafted natively for Windows. It unifies bookmarks across all your browsers (Zen Browser, Mozilla Firefox, Google Chrome, and Microsoft Edge) into a single, GPU-accelerated Windows 11 True Mica desktop experience.

All bookmarks, folders, tags, and AI vector embeddings are stored locally on your device in high-speed SQLite (WAL mode) with zero telemetry, zero cloud lock-in, and full offline resilience.

- Repository: [https://github.com/shuaib-07/bookvisor](https://github.com/shuaib-07/bookvisor)
- Releases: [https://github.com/shuaib-07/bookvisor/releases](https://github.com/shuaib-07/bookvisor/releases)
- Issues: [https://github.com/shuaib-07/bookvisor/issues](https://github.com/shuaib-07/bookvisor/issues)
- License: [LICENSE](LICENSE)

## Download BookVisor

Open the [latest release page](https://github.com/shuaib-07/bookvisor/releases/latest), then download the package that matches your system:

| Platform | Package | Note |
| :-- | :-- | :-- |
| **Windows 10/11 (x64 Installer)** | `BookVisor_0.1.1_x64-setup.exe` | Guided NSIS installer with desktop and Start Menu shortcuts |
| **Windows 10/11 (x64 MSI)** | `BookVisor_0.1.1_x64_en-US.msi` | Windows Installer package for enterprise deployment |

*Unsigned binary — if Windows SmartScreen displays a warning on first launch, click **More info** then **Run anyway**.*

## Screenshots

<!-- Screenshots will be added here -->
<p align="center">
  <!-- Place release screenshots in /screenshots folder and reference them here -->
</p>

## Why BookVisor

- **Eliminate browser silos**: Power users, researchers, and developers constantly switch between browsers (e.g. Zen for focused work, Chrome for testing, Edge for enterprise, Firefox for privacy). BookVisor acts as the unified source of truth, synchronizing bookmarks bidirectionally in real-time over local WebSockets without database locking.
- **Modern Windows 11 Mica design & fluid animations**: Native OS-composited DWM Mica dark material, rounded-corner container hierarchy, zero artificial glow, and physics-based Framer Motion spring interactions.
- **Embedded AI assistant & semantic search**: Search your library by intent, meaning, and topics rather than exact keywords. Ask questions directly in interactive multi-turn chats with full conversation history retention.
- **Self-healing link hygiene**: Background scrapers detect dead and broken 404 links, extract rich OpenGraph previews, and offer 1-click historical restoration via the Internet Archive Wayback Machine.
- **Granular privacy & folder concealment**: Hide sensitive bookmarks and entire cascading folder trees. Hidden items are greyed out when revealed, and strictly excluded from search, AI indexing, and background scraper queues.
- **100% Local-first and private**: Your data never leaves your machine. No mandatory accounts, no third-party trackers, and no telemetry.

## Features

- **Universal 2-Way Browser Sync Bridge**: Real-time bidirectional synchronization with Zen Browser, Mozilla Firefox, Google Chrome, and Microsoft Edge. Creating, editing, moving, or deleting bookmarks in BookVisor reflects immediately in your browser, and vice versa.
- **AI Semantic Search & Interactive Multi-Chat**: Fast semantic vector similarity search and multi-turn conversational intelligence. Ask questions about your saved links, summarize research, and maintain multiple persistent chat sessions with renaming and history retention.
- **Smart AI Auto-Categorizer**: Intelligently analyze unorganized inbox links and generate clean folder hierarchies with customizable approval plans.
- **Self-Healing Wayback Machine Recovery**: Automated HTTP status checking identifies dead or broken links and automatically queries the Internet Archive Wayback Machine for cached snapshots.
- **Automated URL Hygiene & Tracking Stripper**: Automatically strips tracking bloat (`utm_*`, `fbclid`, `gclid`, `ref`, etc.) upon saving or importing to keep URLs clean and private.
- **Cascading Privacy & Hidden Folders**: Hide private bookmarks and folders. Hiding a folder automatically cascades concealment to all subfolders and bookmarks inside, ensuring they never appear in global search, AI queries, or background scrapers.
- **Multi-Account & Browser Profile Isolation**: Organize bookmarks across isolated accounts (Personal, Work, Client profiles) with dedicated vault tabs and drag-and-drop assignment.
- **One-Click In-App Update Downloader**: Check for GitHub releases in-app with live download speed meters, progress bars, and hands-free passive installation with automatic restart.
- **Netscape HTML & Direct Browser Import**: Import existing libraries directly from detected browser profiles or standard Netscape bookmark HTML files. Export cleaned libraries with optional Wayback Machine fallback URLs baked in.

## Architecture & Technology Stack

| Layer | Technologies |
| :-- | :-- |
| **Desktop Runtime** | [Tauri v2](https://tauri.app/) (Rust backend with low memory footprint and high security) |
| **UI Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) |
| **Styling & Styling Engine** | [Tailwind CSS v4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) |
| **Desktop Composition** | Windows 11 DWM True Mica backdrop composition via `window-vibrancy` |
| **Local Storage** | [rusqlite](https://crates.io/crates/rusqlite) (SQLite with Write-Ahead Logging for high concurrent throughput) |
| **Browser Extension Bridge** | Local WebSocket server (`tokio-tungstenite`) supporting Gecko MV2 and Chromium MV3 |
| **Link Scraping & Metadata** | [reqwest](https://crates.io/crates/reqwest) + [scraper](https://crates.io/crates/scraper) with OpenGraph and HTML parser |

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher) and `npm`
- [Rust](https://rustup.rs/) (stable toolchain)
- Visual Studio C++ Build Tools (for Windows compilation)

### Development Workflow

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shuaib-07/bookvisor.git
   cd bookvisor
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Run in development mode (with Hot Module Replacement):**
   ```bash
   npm run tauri dev
   ```

4. **Package browser extensions:**
   ```bash
   npm run package:extensions
   ```

5. **Build production installer:**
   ```bash
   npm run tauri build
   ```
   The compiled `.exe` and `.msi` installers will be located in `src-tauri/target/release/bundle/nsis/` and `msi/`.

## Browser Extension Setup

To enable real-time 2-way syncing with your browsers:

1. In BookVisor, open **Settings (`Ctrl+,`) > Sync & Storage** (or click the Browser Setup button).
2. For **Zen Browser / Mozilla Firefox**:
   - Open `about:debugging#/runtime/this-firefox` in your browser.
   - Click **Load Temporary Add-on...** and select `extension/zen/manifest.json` (or `extension/manifest.json`).
3. For **Google Chrome / Microsoft Edge / Brave**:
   - Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
   - Click **Load unpacked** and select the `extension/chrome` folder.

## Author

**Muhammed Shuaib**
- GitHub: [@shuaib-07](https://github.com/shuaib-07)
- LinkedIn: [Muhammed Shuaib](https://www.linkedin.com/in/muhammed-shuaib-6430881b5)
- Instagram: [@shuaib07_](https://instagram.com/shuaib07_)
- Email: mdshuaib2005@gmail.com

## License

This project is open-source under the [MIT License](LICENSE).
