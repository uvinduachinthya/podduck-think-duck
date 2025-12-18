// This middleware has been removed.
// MIME type configuration is now handled by the _headers file in the dist folder.
// See: dist/_headers
//
// The _headers file is the proper way to configure response headers for Cloudflare Pages.
// This approach avoids edge function overhead and ensures correct MIME types are set
// during the build process rather than at runtime.

export async function onRequest(context) {
    // Pass through all requests without modification
    return await context.next();
}
