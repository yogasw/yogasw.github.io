const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_SRC = path.join(__dirname, '../utilities');
const TOOLS_DIST = path.join(TOOLS_SRC, 'dist');
const STATIC_DIR = path.join(__dirname, '../static');
const STATIC_TOOLS_DIR = path.join(STATIC_DIR, 'utilities');
const HUGO_PUBLIC_DIR = path.join(__dirname, '../public'); // Temp output for header

// Ensure directories exist
if (!fs.existsSync(STATIC_TOOLS_DIR)) {
    fs.mkdirSync(STATIC_TOOLS_DIR, { recursive: true });
}

console.log('--- Starting Tools Integration Build ---');

try {
    // 1. Generate Header HTML using Hugo
    // We build a single page to public/header_export/index.html
    console.log('Step 1: Generating Hugo Header...');
    execSync('hugo --quiet', { stdio: 'inherit' }); 
    
    const headerPath = path.join(HUGO_PUBLIC_DIR, 'header_export/index.html');
    if (!fs.existsSync(headerPath)) {
        throw new Error('Header export failed. File not found: ' + headerPath);
    }
    
    let headerHtml = fs.readFileSync(headerPath, 'utf-8');
    // Clean up local dev connection scripts if any (optional, usually handled by prod build)
    
    // 2. Inject Header into SvelteKit App Shell
    console.log('Step 2: Injecting Header into SvelteKit...');
    const appHtmlPath = path.join(TOOLS_SRC, 'src/app.html');
    const originalAppHtml = fs.readFileSync(appHtmlPath, 'utf-8');
    
    // Replace placeholder or body content? 
    // We'll insert it at the beginning of the body if placeholder doesn't exist.
    let newAppHtml = originalAppHtml;
    if (newAppHtml.includes('<!-- HUGO_HEADER -->')) {
        newAppHtml = newAppHtml.replace('<!-- HUGO_HEADER -->', headerHtml);
    } else {
        // Fallback: Prepend to %sveltekit.body% or inside body
        // newAppHtml = newAppHtml.replace('<div style="display: contents">%sveltekit.body%</div>', 
        //     `<div id="hugo-header-container">${headerHtml}</div><div style="display: contents">%sveltekit.body%</div>`);
    }
    
    // Write temporary app.html
    const tempAppHtmlPath = path.join(TOOLS_SRC, 'src/app.html.temp');
    // Backup original
    fs.renameSync(appHtmlPath, path.join(TOOLS_SRC, 'src/app.html.bak'));
    fs.writeFileSync(appHtmlPath, newAppHtml);

    try {
        // 3. Build SvelteKit
        console.log('Step 3: Building SvelteKit...');
        execSync('npm install', { cwd: TOOLS_SRC, stdio: 'inherit' });
        execSync('npm run build', { cwd: TOOLS_SRC, stdio: 'inherit' });
        
        // 4. Copy Output
        console.log('Step 4: Copying Static Files...');
        // Clean destination first
        execSync(`rm -rf ${STATIC_TOOLS_DIR}/*`);
        execSync(`cp -R ${TOOLS_DIST}/. ${STATIC_TOOLS_DIR}/`);
        
        // 5. Post-process: Rename .html to extensionless files for clean URLs (no trailing slash)
        console.log('Step 5: Removing .html extensions for clean URLs...');
        const files = fs.readdirSync(STATIC_TOOLS_DIR);
        files.forEach(file => {
            if (file.endsWith('.html') && file !== 'index.html' && file !== '404.html') {
                const name = file.replace('.html', '');
                // Rename json-to-curl.html -> json-to-curl
                fs.renameSync(path.join(STATIC_TOOLS_DIR, file), path.join(STATIC_TOOLS_DIR, name));
                console.log(`Renamed ${file} to ${name}`);
            }
        });
        /* 
           Formerly moved to dir/index.html, but that forces redirect /foo -> /foo/
           We want /foo to be 200 OK directly.
        */
        
    } finally {
        // Restore original app.html
        fs.renameSync(path.join(TOOLS_SRC, 'src/app.html.bak'), appHtmlPath);
    }
    
    console.log('--- Tools Integration Complete ---');

} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}
