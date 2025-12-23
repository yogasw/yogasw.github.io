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
    
    // Parse and rebuild XML for proper formatting
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const parsedXml = parser.parse(sitemapContent);
    
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    });
    
    const xmlOutput = builder.build(parsedXml);
    
    // Always compress with gzip
    const compressed = await gzip(xmlOutput);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Encoding': 'gzip',
        'Cache-Control': 'public, max-age=3600',
      },
      body: compressed.toString('base64'),
      isBase64Encoded: true
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
