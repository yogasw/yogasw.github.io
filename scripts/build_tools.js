const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOOLS_SRC = path.join(__dirname, "../utilities");
const TOOLS_DIST = path.join(TOOLS_SRC, "dist");
const STATIC_DIR = path.join(__dirname, "../static");
const STATIC_TOOLS_DIR = path.join(STATIC_DIR, "utilities");
const HUGO_PUBLIC_DIR = path.join(__dirname, "../public"); // Temp output for header

// Ensure directories exist
if (!fs.existsSync(STATIC_TOOLS_DIR)) {
  fs.mkdirSync(STATIC_TOOLS_DIR, { recursive: true });
}

console.log("--- Starting Tools Integration Build ---");

try {
  // 0. Sync Git Branch (Only in CI/Netlify)
  if (
    process.env.NETLIFY ||
    process.env.GITHUB_ACTIONS ||
    process.env.CI === "true"
  ) {
    console.log("Step 0: Syncing Git Branch (master)...");
    execSync("git checkout master", { stdio: "inherit" });
    execSync("git pull origin master", { stdio: "inherit" });

    // 0.1. Sync Utilities Submodule
    console.log("Step 0.1: Syncing Utilities Submodule (main)...");
    execSync("git submodule update --init --recursive", { stdio: "inherit" });
    execSync("git checkout main", { cwd: TOOLS_SRC, stdio: "inherit" });
    execSync("git pull origin main", { cwd: TOOLS_SRC, stdio: "inherit" });
  } else {
    console.log(
      "Step 0: Skipping Git Sync (Local/Non-CI Environment detected)"
    );
  }
} catch (e) {
  console.error("Git sync failed:", e);
  // Proceed or exit? User asked to sync BEFORE build.
  process.exit(1);
}

try {
  // 1. Generate Header HTML using Hugo
  // We build a single page to public/header_export/index.html
  console.log("Step 1: Generating Hugo Header...");
  execSync("hugo --quiet", { stdio: "inherit" });

  const headerPath = path.join(HUGO_PUBLIC_DIR, "header_export/index.html");
  if (!fs.existsSync(headerPath)) {
    throw new Error("Header export failed. File not found: " + headerPath);
  }

  let headerHtml = fs.readFileSync(headerPath, "utf-8");
  // Clean up local dev connection scripts if any (optional, usually handled by prod build)

  // 2. Inject Header into SvelteKit App Shell
  console.log("Step 2: Injecting Header into SvelteKit...");
  const appHtmlPath = path.join(TOOLS_SRC, "src/app.html");
  const originalAppHtml = fs.readFileSync(appHtmlPath, "utf-8");

  // Replace placeholder or body content?
  // We'll insert it at the beginning of the body if placeholder doesn't exist.
  let newAppHtml = originalAppHtml;
  if (newAppHtml.includes("<!-- HUGO_HEADER -->")) {
    newAppHtml = newAppHtml.replace("<!-- HUGO_HEADER -->", headerHtml);
  } else {
    // Fallback: Prepend to %sveltekit.body% or inside body
    // newAppHtml = newAppHtml.replace('<div style="display: contents">%sveltekit.body%</div>',
    //     `<div id="hugo-header-container">${headerHtml}</div><div style="display: contents">%sveltekit.body%</div>`);
  }

  // Write temporary app.html
  const tempAppHtmlPath = path.join(TOOLS_SRC, "src/app.html.temp");
  // Backup original
  fs.renameSync(appHtmlPath, path.join(TOOLS_SRC, "src/app.html.bak"));
  fs.writeFileSync(appHtmlPath, newAppHtml);

  try {
    // 3. Build SvelteKit
    console.log("Step 3: Building SvelteKit...");
    execSync("npm install", { cwd: TOOLS_SRC, stdio: "inherit" });
    execSync("npm run build", { cwd: TOOLS_SRC, stdio: "inherit" });

    // 4. Copy Output
    console.log("Step 4: Copying Static Files...");
    // Clean destination first
    execSync(`rm -rf ${STATIC_TOOLS_DIR}/*`);
    execSync(`cp -R ${TOOLS_DIST}/. ${STATIC_TOOLS_DIR}/`);

    // 5. Post-process: Rename .html to extensionless files for clean URLs (no trailing slash)
    console.log("Step 5: Removing .html extensions and updating headers...");

    const headersPath = path.join(STATIC_DIR, "_headers");
    let headersContent = fs.existsSync(headersPath)
      ? fs.readFileSync(headersPath, "utf-8")
      : "";
    let headersUpdated = false;

    const files = fs.readdirSync(STATIC_TOOLS_DIR);
    files.forEach((file) => {
      if (
        file.endsWith(".html") &&
        file !== "index.html" &&
        file !== "404.html"
      ) {
        const name = file.replace(".html", "");
        // Rename json-to-curl.html -> json-to-curl
        const oldPath = path.join(STATIC_TOOLS_DIR, file);
        const newPath = path.join(STATIC_TOOLS_DIR, name);

        // Check if target exists (idempotency for repeated runs)
        if (fs.existsSync(newPath)) {
          // If new file exists, maybe we already renamed it? or it's a conflict
          // We'll update mtime or assume it's fine.
          // But if old file exists, we must move it.
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(newPath); // Remove stale new file to overwrite
            fs.renameSync(oldPath, newPath);
            console.log(`Renamed ${file} to ${name}`);
          }
        } else if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
          console.log(`Renamed ${file} to ${name}`);
        }

        // Append to _headers if missing
        const rule = `/utilities/${name}`;
        if (!headersContent.includes(rule)) {
          headersContent += `\n${rule}\n  Content-Type: text/html\n`;
          headersUpdated = true;
          console.log(`Added headers rule for ${name}`);
        }
      }
    });

    if (
      process.env.NETLIFY ||
      process.env.GITHUB_ACTIONS ||
      process.env.CI === "true"
    ) {
      if (headersUpdated) {
        fs.writeFileSync(headersPath, headersContent);
        console.log("Updated static/_headers");
      }
    }

    /* 
           Formerly moved to dir/index.html, but that forces redirect /foo -> /foo/
           Renaming to extensionless file enables 200 OK on both Local and Prod.
           Updating _headers ensures Prod serves as text/html (Netlify defaults to plain text for extensionless).
        */
  } finally {
    // Restore original app.html
    fs.renameSync(path.join(TOOLS_SRC, "src/app.html.bak"), appHtmlPath);
  }

  console.log("--- Tools Integration Complete ---");
} catch (e) {
  console.error("Build failed:", e);
  process.exit(1);
}
