const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);

exports.handler = async (event, context) => {
  try {
    // Fetch sitemap.xml from the same domain
    const protocol = event.headers.host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${event.headers.host}`;
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Failed to fetch sitemap',
          status: response.status
        })
      };
    }
    
    const sitemapContent = await response.text();
    
    // Parse the original sitemap
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const parsedXml = parser.parse(sitemapContent);
    
    // Extract URLs from the original sitemap
    const urlset = parsedXml.urlset;
    const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
    
    // Group URLs by category
    const categories = {
      main: [],
      blog: [],
      utilities: []
    };
    
    urls.forEach(url => {
      const loc = url.loc;
      if (loc.includes('/blog/')) {
        categories.blog.push(url);
      } else if (loc.includes('/utilities/')) {
        categories.utilities.push(url);
      } else {
        categories.main.push(url);
      }
    });
    
    // Get the latest lastmod from each category
    const getLatestMod = (urlList) => {
      if (!urlList.length) return new Date().toISOString().split('T')[0];
      const dates = urlList.map(u => u.lastmod).filter(Boolean);
      return dates.length ? dates.sort().reverse()[0] : new Date().toISOString().split('T')[0];
    };
    
    // Build sitemap index structure
    const sitemapIndex = {
      '?xml': {
        '@_version': '1.0',
        '@_encoding': 'UTF-8'
      },
      sitemapindex: {
        '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
        sitemap: []
      }
    };
    
    // Add sitemaps for each category that has URLs
    if (categories.main.length > 0) {
      sitemapIndex.sitemapindex.sitemap.push({
        loc: `${baseUrl}/sitemap-main.xml`,
        lastmod: getLatestMod(categories.main)
      });
    }
    
    if (categories.blog.length > 0) {
      sitemapIndex.sitemapindex.sitemap.push({
        loc: `${baseUrl}/sitemap-blog.xml`,
        lastmod: getLatestMod(categories.blog)
      });
    }
    
    if (categories.utilities.length > 0) {
      sitemapIndex.sitemapindex.sitemap.push({
        loc: `${baseUrl}/sitemap-utilities.xml`,
        lastmod: getLatestMod(categories.utilities)
      });
    }
    
    // Build the XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    });
    
    const xmlOutput = builder.build(sitemapIndex);
    
    // Check if client accepts gzip encoding
    const acceptEncoding = event.headers['accept-encoding'] || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    
    const headers = {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    };
    
    let body = xmlOutput;
    
    // Compress with gzip if supported
    if (supportsGzip) {
      const compressed = await gzip(xmlOutput);
      headers['Content-Encoding'] = 'gzip';
      body = compressed.toString('base64');
      headers['isBase64Encoded'] = true;
      
      return {
        statusCode: 200,
        headers,
        body,
        isBase64Encoded: true
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};
