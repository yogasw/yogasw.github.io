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
    
    let sitemapContent = await response.text();
    
    // Ensure XML is properly formatted (not minified to single line)
    // Remove all existing whitespace between tags first
    sitemapContent = sitemapContent.replace(/>\s+</g, '><');
    
    // Add proper formatting with line breaks and indentation
    sitemapContent = sitemapContent
      // XML declaration on its own line
      .replace(/(<\?xml[^>]+\?>)/, '$1\n')
      // urlset opening tag
      .replace(/(<urlset[^>]*>)/, '$1\n')
      // Each url element on new line with 2-space indent
      .replace(/<url>/g, '  <url>\n')
      .replace(/<\/url>/g, '  </url>\n')
      // Inner elements with 4-space indent
      .replace(/<loc>/g, '    <loc>')
      .replace(/<\/loc>/g, '</loc>\n')
      .replace(/<lastmod>/g, '    <lastmod>')
      .replace(/<\/lastmod>/g, '</lastmod>\n')
      .replace(/<changefreq>/g, '    <changefreq>')
      .replace(/<\/changefreq>/g, '</changefreq>\n')
      .replace(/<priority>/g, '    <priority>')
      .replace(/<\/priority>/g, '</priority>\n')
      // Closing urlset tag
      .replace(/<\/urlset>/, '</urlset>\n')
      // Clean up any extra blank lines
      .replace(/\n{3,}/g, '\n')
      .trim();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
      body: sitemapContent
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
