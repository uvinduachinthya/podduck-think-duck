
// Search worker for offloading indexing and searching

export interface SearchableItem {
    type: 'page' | 'block';
    id: string;
    title: string; // page name or block text
    fullContent?: string; // full block text (for blocks only)
    pageName: string; // which page this belongs to
    pageId: string; // page filename without extension
    blockPath?: string[]; // path to block within page (array of IDs)
    lastModified: number; // for recency sorting
}

// Global in-memory index within the worker
let searchIndex: SearchableItem[] = [];
let directoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Parse TipTap JSON structure to extract blocks
 */
function parseTipTapBlocks(tiptapDoc: any, pageName: string, pageId: string, lastModified: number): SearchableItem[] {
    const items: SearchableItem[] = [];

    if (!tiptapDoc || !tiptapDoc.content) return items;

    // Find bulletList nodes
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
async function buildSearchIndex(handle: FileSystemDirectoryHandle): Promise<void> {
    const startTime = performance.now();
    searchIndex = [];
    directoryHandle = handle;

    try {
        let totalPages = 0;
        let totalBlocks = 0;

        // Iterate over all files in directory
        // @ts-ignore - FileSystemDirectoryHandle is iterable
        for await (const entry of handle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                try {
                    const fileHandle: FileSystemFileHandle = entry;
                    const file = await fileHandle.getFile();
                    const content = await file.text();

                    if (!content.trim()) continue;

                    const data = JSON.parse(content);
                    const lastModified = file.lastModified;
                    const pageId = entry.name.replace('.json', '');
                    const pageName = pageId;

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
                    const blockItems = parseTipTapBlocks(data, pageName, pageId, lastModified);
                    searchIndex.push(...blockItems);
                    totalBlocks += blockItems.length;
                } catch (err) {
                    console.warn(`[Worker] Failed to index ${entry.name}:`, err);
                }
            }
        }

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        console.log(
            `✅ [Worker] Search index built: ${totalPages} pages, ${totalBlocks} blocks in ${duration}ms`
        );

        self.postMessage({ type: 'INDEX_READY', stats: { totalPages, totalBlocks, duration } });

    } catch (err) {
        console.error('[Worker] Failed to build search index:', err);
        self.postMessage({ type: 'ERROR', error: (err as Error).message });
    }
}

/**
 * Update index for a specific file
 */
async function updateIndexForFile(fileName: string): Promise<void> {
    if (!directoryHandle) return;

    const pageId = fileName.replace('.json', '');

    // Remove existing entries for this page
    searchIndex = searchIndex.filter(item => item.pageId !== pageId);

    try {
        const fileHandle = await directoryHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();

        if (!content.trim()) return;

        const data = JSON.parse(content);
        const lastModified = file.lastModified;
        const pageName = pageId;

        // Re-add page
        searchIndex.push({
            type: 'page',
            id: pageId,
            title: pageName,
            pageName,
            pageId,
            lastModified,
        });

        // Re-index blocks
        const blockItems = parseTipTapBlocks(data, pageName, pageId, lastModified);
        searchIndex.push(...blockItems);

        console.log(`[Worker] Updated index for ${fileName}`);
        self.postMessage({ type: 'INDEX_UPDATED', fileName });

    } catch (err) {
        // If file was deleted or cannot be read, we just leave it removed from index
        console.warn(`[Worker] Failed to update index for ${fileName} (might be deleted):`, err);
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

    // Contains
    if (lowerTitle.includes(lowerQuery)) return 50;

    // Fuzzy match (simplified)
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
function search(query: string) {
    if (!query || query.length === 0) {
        // Return recent items
        const results = [...searchIndex]
            .sort((a, b) => b.lastModified - a.lastModified)
            .slice(0, 50);

        self.postMessage({ type: 'SEARCH_RESULTS', query, results });
        return;
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
        return b.item.lastModified - a.item.lastModified;
    });

    const results = matches.slice(0, 50).map(m => m.item);
    self.postMessage({ type: 'SEARCH_RESULTS', query, results });
}

// Message handler
self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'BUILD_INDEX':
            if (payload instanceof FileSystemDirectoryHandle) { // Check if it's a handle
                await buildSearchIndex(payload);
            } else {
                console.error('[Worker] Invalid handle received for BUILD_INDEX');
            }
            break;

        case 'UPDATE_FILE':
            if (typeof payload === 'string') {
                await updateIndexForFile(payload);
            }
            break;

        case 'SEARCH':
            if (typeof payload === 'string') {
                search(payload);
            }
            break;

        case 'REMOVE_FILE':
            const pageId = payload.replace('.json', '');
            searchIndex = searchIndex.filter(item => item.pageId !== pageId);
            break;
    }
};
