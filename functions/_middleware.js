export async function onRequest(context) {
  const response = await context.next();
  
  // Only process HTML responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }
  
  // Get the HTML content
  const htmlText = await response.text();
  
  // Inject environment variables as a script before closing </head>
  const envScript = `
    <script>
      window.ENV = {
        SUPABASE_URL: '${context.env.SUPABASE_URL || ''}',
        SUPABASE_ANON_KEY: '${context.env.SUPABASE_ANON_KEY || ''}'
      };
    </script>
  `;
  
  // Insert the script before </head>
  const modifiedHtml = htmlText.replace('</head>', `${envScript}</head>`);
  
  // Return the modified response
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}