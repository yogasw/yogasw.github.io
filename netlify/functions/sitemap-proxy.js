const { XMLParser, XMLBuilder } = require('fast-xml-parser');

exports.handler = async (event, context) => {
  try {
    // Fetch sitemap.xml from the same domain
    const sitemapUrl = `${event.headers.host.includes('localhost') ? 'http' : 'https'}://${event.headers.host}/sitemap.xml`;
    
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
    
    // Configure XML parser
    const parserOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    };
    
    const parser = new XMLParser(parserOptions);
    const parsedXml = parser.parse(sitemapContent);
    
    // Configure XML builder for pretty output
    const builderOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true
    };
    
    const builder = new XMLBuilder(builderOptions);
    const formattedXml = builder.build(parsedXml);
    
    // Add XML declaration if not present
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
    const finalXml = formattedXml.startsWith('<?xml') 
      ? formattedXml 
      : `${xmlDeclaration}\n${formattedXml}`;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: finalXml
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};
