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
