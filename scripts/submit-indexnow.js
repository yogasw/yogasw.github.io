#!/usr/bin/env node

/**
 * IndexNow Submission Script
 * 
 * This script fetches the sitemap and submits all URLs to IndexNow API
 * to notify search engines about new/updated content.
 * 
 * Usage: node scripts/submit-indexnow.js
 * 
 * Environment Variables:
 * - INDEXNOW_API_KEY: API key for IndexNow (default: e02877ba98fe474c9372ac77868c4f6c)
 * - SITE_URL: Base URL of the site (default: https://yogasw.my.id)
 */

const https = require('https');
const { XMLParser } = require('fast-xml-parser');

// Configuration
const SITE_URL = process.env.SITE_URL || 'https://yogasw.my.id';
const INDEXNOW_API_KEY = process.env.INDEXNOW_API_KEY || 'e02877ba98fe474c9372ac77868c4f6c';
const SITEMAP_URL = `${SITE_URL}/new-sitemap.xml`;
const INDEXNOW_API_URL = 'api.indexnow.org';

/**
 * Fetch content from a URL using HTTPS
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: HTTP ${res.statusCode}`));
        return;
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Submit URLs to IndexNow API
 */
function submitToIndexNow(urls) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      host: SITE_URL.replace(/^https?:\/\//, ''),
      key: INDEXNOW_API_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_API_KEY}.txt`,
      urlList: urls
    });

    console.log("Post data to index Now", JSON.stringify(postData));

    const options = {
      hostname: INDEXNOW_API_URL,
      port: 443,
      path: '/indexnow',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 202) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        } else {
          reject(new Error(`IndexNow API returned HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Parse sitemap XML and extract URLs
 */
function parseSitemap(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true
  });

  const result = parser.parse(xmlContent);
  
  if (!result.urlset || !result.urlset.url) {
    throw new Error('Invalid sitemap format: missing urlset or url elements');
  }

  const urls = Array.isArray(result.urlset.url) 
    ? result.urlset.url 
    : [result.urlset.url];

  return urls.map(entry => entry.loc).filter(Boolean);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting IndexNow submission...');
  console.log(`📍 Site URL: ${SITE_URL}`);
  console.log(`🗺️  Sitemap URL: ${SITEMAP_URL}`);
  console.log('');

  try {
    // Step 1: Fetch sitemap
    console.log('📥 Fetching sitemap...');
    const sitemapXml = await fetchUrl(SITEMAP_URL);
    console.log('✅ Sitemap fetched successfully');
    console.log('');

    // Step 2: Parse sitemap and extract URLs
    console.log('🔍 Parsing sitemap...');
    const urls = parseSitemap(sitemapXml);
    console.log(`✅ Found ${urls.length} URLs in sitemap`);
    console.log('');

    // Step 3: Display URLs
    console.log('📋 URLs to submit:');
    urls.forEach((url, index) => {
      console.log(`   ${index + 1}. ${url}`);
    });
    console.log('');

    // Step 4: Submit to IndexNow
    console.log('📤 Submitting to IndexNow API...');
    const response = await submitToIndexNow(urls);
    console.log(`✅ Successfully submitted to IndexNow (HTTP ${response.statusCode})`);
    console.log('');

    // Success summary
    console.log('🎉 IndexNow submission completed successfully!');
    console.log(`   Total URLs submitted: ${urls.length}`);
    console.log('   Search engines notified: Bing, Yandex, Seznam.cz, Naver');
    console.log('');
    console.log('ℹ️  Note: It may take up to 24 hours for search engines to process the submission.');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Error during IndexNow submission:');
    console.error(`   ${error.message}`);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    
    // Exit with error code but don't fail the build
    // We use exit code 0 to prevent Netlify build from failing
    console.error('');
    console.error('⚠️  IndexNow submission failed, but continuing build...');
    process.exit(0);
  }
}

// Run the script
main();
