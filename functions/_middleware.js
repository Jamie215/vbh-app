export async function onRequest(context) {
  const response = await context.next();
  
  // Only process HTML responses
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }
  
  // Get the HTML content
  const htmlText = await response.text();
  
  // Inject environment variables as a script before closing </head>.
  // JSON.stringify handles quotes/newlines; escaping "<" stops a value
  // from closing the <script> tag early.
  const env = {
    SUPABASE_URL: context.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: context.env.SUPABASE_ANON_KEY || ''
  };
  const envJson = JSON.stringify(env).replace(/</g, '\\u003c');
  const envScript = `
    <script>
      window.ENV = ${envJson};
    </script>
  `;
  
  // Insert the script before </head> (function replacer so "$" in a value
  // isn't treated as a replacement pattern)
  const modifiedHtml = htmlText.replace('</head>', () => `${envScript}</head>`);
  
  // Return the modified response
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}