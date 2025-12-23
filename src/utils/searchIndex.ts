// Search index for backlinking - in-memory storage for fast lookups

export interface SearchableItem {
    type: 'page' | 'block' | 'create-new' | 'phantom';
    id: string;
    title: string; // page name or block text
    fullContent?: string; // full block text (for blocks only)
    pageName?: string; // which page this belongs to
    pageId?: string; // page filename without extension
    blockPath?: string[]; // path to block within page (array of IDs)
    lastModified?: number; // for recency sorting
    query?: string; // for create-new
}

// Global in-memory index
let searchIndex: SearchableItem[] = [];

/**
 * Parse TipTap JSON structure to extract blocks and found backlinks
 * TipTap stores content as: doc > bulletList > listItem > paragraph
 */
function parseTipTapBlocks(
    tiptapDoc: any,
    pageName: string,
    pageId: string,
    lastModified: number,
    foundBacklinks: Set<string>
): SearchableItem[] {
    const items: SearchableItem[] = [];

    if (!tiptapDoc || !tiptapDoc.content) return items;

    // Recursive helper to traverse nodes and collect backlinks
    const scanForBacklinks = (nodes: any[]) => {
        for (const node of nodes) {
            if (node.type === 'backlink' && node.attrs && node.attrs.pageId) {
                foundBacklinks.add(node.attrs.pageId);
            }
            if (node.content) {
                scanForBacklinks(node.content);
            }
        }
    };

    // Initial scan for ALL backlinks in the doc, regardless of structure
    scanForBacklinks(tiptapDoc.content);

    // Find bulletList nodes for Block Indexing
    for (const node of tiptapDoc.content) {
        if (node.type === 'bulletList' && node.content) {
            // Process each listItem as a block
            for (const listItem of node.content) {
                if (listItem.type === 'listItem' && listItem.content) {
                    // Extract text from paragraph
                    let text = '';
                    for (const para of listItem.content) {
                        if (para.type === 'paragraph' && para.content) {
                            for (const textNode of para.content) {
                                if (textNode.type === 'text' && textNode.text) {
                                    text += textNode.text;
                                } else if (textNode.type === 'backlink' && textNode.attrs) {
                                    // Handle backlinks in text
                                    text += textNode.attrs.label || '';
                                }
                            }
                        }
                    }

                    // Index this block if it has text
                    if (text.trim().length > 0) {
                        const blockId = `block-${Math.random().toString(36).substr(2, 9)}`;
                        items.push({
                            type: 'block',
                            id: blockId,
                            title: text.trim(),
                            fullContent: text.trim(),
                            pageName,
                            pageId,
                            lastModified,
                        });
                    }
                }
            }
        }
    }

    return items;
}

/**
 * Build search index from all JSON files in directory handle
 */
export async function buildSearchIndex(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    const startTime = performance.now();
    searchIndex = [];

    const existingPages = new Set<string>();
    const foundBacklinks = new Set<string>();

    try {
        let totalPages = 0;
        let totalBlocks = 0;

        // Iterate over all files in directory
        for await (const entry of (directoryHandle as any).values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                try {
                    const fileHandle: FileSystemFileHandle = entry;
                    const file = await fileHandle.getFile();
                    const content = await file.text();
                    const data = JSON.parse(content);

                    const lastModified = file.lastModified;
                    const pageId = entry.name.replace('.json', '');
                    const pageName = pageId;

                    existingPages.add(pageId);

                    // Add page itself as searchable item
                    searchIndex.push({
                        type: 'page',
                        id: pageId,
                        title: pageName,
                        pageName,
                        pageId,
                        lastModified,
                    });
                    totalPages++;

                    // Index all blocks using TipTap parser
                    const blockItems = parseTipTapBlocks(data, pageName, pageId, lastModified, foundBacklinks);
                    searchIndex.push(...blockItems);
                    totalBlocks += blockItems.length;
                } catch (err) {
                    console.warn(`Failed to index ${entry.name}:`, err);
                }
            }
        }

        // Process collected backlinks to find phantoms
        for (const linkId of foundBacklinks) {
            if (!existingPages.has(linkId)) {
                // Determine if we already have this phantom (unlikely in fresh build, but safe check)
                // Actually searchIndex is strictly pages and blocks so far.
                searchIndex.push({
                    type: 'phantom',
                    id: `phantom-${linkId}`,
                    title: linkId,
                    pageId: linkId,
                    pageName: 'Phantom Note',
                    lastModified: Date.now() // Treat as fresh
                });
            }
        }

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        console.log(
            `✅ Search index built: ${totalPages} pages, ${totalBlocks} blocks in ${duration}ms`
        );
    } catch (err) {
        console.error('Failed to build search index:', err);
    }
}

/**
 * Update index for a specific file (incremental update)
 */
export async function updateIndexForFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string
): Promise<void> {
    const pageId = fileName.replace('.json', '');

    // Remove existing entries for this page (page and blocks)
    // Also remove any 'phantom' entry that matches this pageId (since it's becoming real)
    searchIndex = searchIndex.filter(item => {
        if (item.type === 'phantom' && item.pageId === pageId) return false;
        return item.pageId !== pageId;
    });

    try {
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();
        const data = JSON.parse(content);
        const lastModified = file.lastModified;

        const pageName = pageId;
        const foundBacklinks = new Set<string>();

        // Re-add page
        searchIndex.push({
            type: 'page',
            id: pageId,
            title: pageName,
            pageName,
            pageId,
            lastModified,
        });

        // Re-index blocks using TipTap parser
        const blockItems = parseTipTapBlocks(data, pageName, pageId, lastModified, foundBacklinks);
        searchIndex.push(...blockItems);

        // Process found backlinks to potentially add phantoms
        // Note: we don't have global visibility here, so we check against current searchIndex
        for (const linkId of foundBacklinks) {
            const exists = searchIndex.some(item =>
                (item.type === 'page' && item.pageId === linkId) ||
                (item.type === 'phantom' && item.pageId === linkId)
            );

            if (!exists) {
                // Double check if it's REALLY not a page (in case searchIndex lookup missed it?)
                // Assuming searchIndex is source of truth.
                searchIndex.push({
                    type: 'phantom',
                    id: `phantom-${linkId}`,
                    title: linkId,
                    pageId: linkId,
                    pageName: 'Phantom Note',
                    lastModified: Date.now()
                });
            }
        }

        console.log(`Updated index for ${fileName}`);
    } catch (err) {
        console.warn(`Failed to update index for ${fileName}:`, err);
    }
}

/**
 * Calculate match score for a query against a title
 */
function calculateMatchScore(query: string, title: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // Exact match
    if (lowerTitle === lowerQuery) return 100;

    // Starts with
    if (lowerTitle.startsWith(lowerQuery)) return 75;

    // Contains (word boundary preferred)
    if (lowerTitle.includes(` ${lowerQuery}`)) return 60;
    if (lowerTitle.includes(lowerQuery)) return 50;

    // Fuzzy match (simple implementation - check if all chars exist in order)
    let titleIndex = 0;
    let queryIndex = 0;
    while (titleIndex < lowerTitle.length && queryIndex < lowerQuery.length) {
        if (lowerTitle[titleIndex] === lowerQuery[queryIndex]) {
            queryIndex++;
        }
        titleIndex++;
    }
    if (queryIndex === lowerQuery.length) return 25;

    return 0;
}

/**
 * Search the index with a query
 */
export function searchItems(query: string): SearchableItem[] {
    if (!query || query.length === 0) {
        // Return all items sorted by recency
        return [...searchIndex]
            .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
            .slice(0, 50); // Limit to 50 results
    }

    // Score and filter items
    const matches = searchIndex
        .map(item => ({
            item,
            score: calculateMatchScore(query, item.title),
        }))
        .filter(m => m.score > 0);

    // Sort by score (desc), then by lastModified (desc)
    matches.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return (b.item.lastModified || 0) - (a.item.lastModified || 0);
    });

    // Return top 50 results
    return matches.slice(0, 50).map(m => m.item);
}

/**
 * Get the current index (for debugging)
 */
export function getIndex(): SearchableItem[] {
    return [...searchIndex];
}
