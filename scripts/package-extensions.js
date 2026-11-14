/**
 * BookVisor Extension Store Packager
 * Generates store-compliant submission packages:
 *  - dist-extensions/bookvisor-chrome-v1.1.0.zip (Chrome Web Store / Manifest V3)
 *  - dist-extensions/bookvisor-firefox-v1.1.0.zip (Mozilla Add-ons / Firefox / Zen)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const extDir = path.join(rootDir, "extension");
const distDir = path.join(rootDir, "dist-extensions");

const chromeBuildDir = path.join(distDir, "chrome-unpacked");
const firefoxBuildDir = path.join(distDir, "firefox-unpacked");

console.log("📦 Packaging BookVisor Browser Extensions...");

// Clean and create dist directories
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(chromeBuildDir, { recursive: true });
fs.mkdirSync(firefoxBuildDir, { recursive: true });

// Common extension files
const commonFiles = [
  "background.js",
  "popup.html",
  "popup.js",
  "icon-48.png",
  "icon-128.png",
];

// 1. Prepare Chrome Web Store package (Manifest V3)
for (const file of commonFiles) {
  const src = path.join(extDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(chromeBuildDir, file));
  }
}
fs.copyFileSync(path.join(extDir, "chrome", "manifest.json"), path.join(chromeBuildDir, "manifest.json"));

// 2. Prepare Firefox Add-ons (AMO) package (Manifest V2 with Gecko ID)
for (const file of commonFiles) {
  const src = path.join(extDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(firefoxBuildDir, file));
  }
}
fs.copyFileSync(path.join(extDir, "manifest.gecko.json"), path.join(firefoxBuildDir, "manifest.json"));

// 3. Create zip archives
const chromeZip = path.join(distDir, "bookvisor-chrome-v1.1.0.zip");
const firefoxZip = path.join(distDir, "bookvisor-firefox-v1.1.0.zip");

try {
  execSync(`tar -a -c -f "${chromeZip}" -C "${chromeBuildDir}" .`, { stdio: "inherit" });
  console.log(`✅ Chrome Web Store Package: ${chromeZip}`);

  execSync(`tar -a -c -f "${firefoxZip}" -C "${firefoxBuildDir}" .`, { stdio: "inherit" });
  console.log(`✅ Firefox Add-ons (AMO) Package: ${firefoxZip}`);

  console.log("\n🎉 Ready for store submission!");
  console.log("  • Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole/");
  console.log("  • Mozilla Add-on Developer Hub: https://addons.mozilla.org/developers/");
} catch (err) {
  console.error("❌ Failed to create zip files:", err);
  process.exit(1);
}

