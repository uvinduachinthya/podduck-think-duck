// Cloudflare Pages Function to fix MIME types
// This runs on Cloudflare's edge and sets correct headers for all responses

export async function onRequest(context) {
    // Get the original response
    const response = await context.next();

    // Clone the response so we can modify headers
    const newResponse = new Response(response.body, response);

    // Get the request URL
    const url = new URL(context.request.url);
    const pathname = url.pathname;

    // Set correct MIME type based on file extension
    if (pathname.endsWith('.js')) {
        newResponse.headers.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (pathname.endsWith('.css')) {
        newResponse.headers.set('Content-Type', 'text/css; charset=utf-8');
    } else if (pathname.endsWith('.html') || pathname === '/') {
        newResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
    }

    // Add security headers
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return newResponse;
}
