
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

export interface GraphIndexData {
    searchIndex: SearchableItem[];
    fileStats: Record<string, number>;
    forwardIndex: Record<string, string[]>;
    reverseIndex: Record<string, string[]>;
}

// Global state
let searchIndex: SearchableItem[] = [];
let fileStats: Record<string, number> = {}; // PageID -> LastModified
let forwardIndex: Record<string, string[]> = {}; // PageID -> [TargetIDs]
let reverseIndex: Record<string, string[]> = {}; // TargetID -> [PageIDs]

let directoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Parse Markdown to extract blocks and outgoing links
 */
function parseAndExtract(
    content: string,
    pageName: string,
    pageId: string,
    lastModified: number
): { items: SearchableItem[], links: string[] } {
    const items: SearchableItem[] = [];
    const links: Set<string> = new Set();
    
    if (!content) return { items, links: [] };

    // 1. Extract Links [[Target]] and [[Target|Alias]]
    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
        links.add(linkMatch[1]);
    }

    // 2. Parse Blocks
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Skip headers as blocks
        if (trimmed.startsWith('#')) return;

        // Clean list markers
        const cleanText = trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '');

        if (cleanText.length > 0) {
             // Check for Block ID ^abcdef
             const blockIdMatch = cleanText.match(/ \^([a-zA-Z0-9]{6})$/);
             let blockId = `block-${pageId}-${index}`; // Default unstable ID
             let contentToSave = cleanText;

             if (blockIdMatch) {
                 blockId = blockIdMatch[1];
                 contentToSave = cleanText.substring(0, blockIdMatch.index); 
             }

             items.push({
                 type: 'block',
                 id: blockId,
                 title: contentToSave.trim(),
                 fullContent: cleanText,
                 pageName,
                 pageId,
                 lastModified
             });
        }
    });

    return { items, links: Array.from(links) };
}

/**
 * Update the Graph (Forward/Reverse Index) for a page
 */
function updateGraph(pageId: string, newLinks: string[]) {
    // 1. Get old links
    const oldLinks = forwardIndex[pageId] || [];

    // 2. Diff
    const added = newLinks.filter(l => !oldLinks.includes(l));
    const removed = oldLinks.filter(l => !newLinks.includes(l));

    // 3. Update Forward Index
    forwardIndex[pageId] = newLinks;

    // 4. Update Reverse Index
    // Remove old connections
    removed.forEach(target => {
        if (reverseIndex[target]) {
            reverseIndex[target] = reverseIndex[target].filter(p => p !== pageId);
            if (reverseIndex[target].length === 0) {
                delete reverseIndex[target];
            }
        }
    });

    // Add new connections
    added.forEach(target => {
        if (!reverseIndex[target]) {
            reverseIndex[target] = [];
        }
        if (!reverseIndex[target].includes(pageId)) {
            reverseIndex[target].push(pageId);
        }
    });
}

/**
 * Remove a page from the index entirely
 */
function removePageFromIndex(pageId: string) {
    // Remove from Search Index
    searchIndex = searchIndex.filter(item => item.pageId !== pageId);
    
    // Update Graph (treat as if it now has 0 links)
    updateGraph(pageId, []);
    delete forwardIndex[pageId];
    
    // Remove from FileStats
    delete fileStats[pageId];
}

/**
 * Update index for a specific file
 */
async function updateIndexForFile(fileName: string, specificFileHandle?: FileSystemFileHandle): Promise<void> {
    const pageId = fileName.replace('.md', '');
    
    // Check handle
    let fileHandle = specificFileHandle;
    if (!fileHandle && directoryHandle) {
        try {
            fileHandle = await directoryHandle.getFileHandle(fileName);
        } catch (e) {
            // File likely deleted
            removePageFromIndex(pageId);
            return;
        }
    }

    if (!fileHandle) return;

    try {
        const file = await fileHandle.getFile();
        const content = await file.text();
        const lastModified = file.lastModified;
        const pageName = pageId;

        // 1. Remove existing search items for this page
        searchIndex = searchIndex.filter(item => item.pageId !== pageId);

        // 2. Re-add page item
        searchIndex.push({
            type: 'page',
            id: pageId,
            title: pageName,
            pageName,
            pageId,
            lastModified,
        });

        // 3. Parse content
        const { items: blockItems, links } = parseAndExtract(content, pageName, pageId, lastModified);
        
        // 4. Update Search Index
        searchIndex.push(...blockItems);

        // 5. Update Graph
        updateGraph(pageId, links);

        // 6. Update Stats
        fileStats[pageId] = lastModified;

        // console.log(`[Worker] Updated ${fileName}`);
        self.postMessage({ type: 'INDEX_UPDATED', fileName });

    } catch (err) {
        console.warn(`[Worker] Failed to update ${fileName}:`, err);
        removePageFromIndex(pageId);
    }
}

/**
 * Build search index from usage of incremental cache
 */
async function buildSearchIndex(handle: FileSystemDirectoryHandle): Promise<void> {
    const startTime = performance.now();
    directoryHandle = handle;

    let scannedCount = 0;
    let skippedCount = 0;
    const seenPages = new Set<string>();

    try {
        // @ts-ignore
        for await (const entry of handle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                const pageId = entry.name.replace('.md', '');
                seenPages.add(pageId);

                // Quick Stat
                const fileHandle = entry as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                
                // Incremental Check: If timestamp matches, assume index is valid
                if (fileStats[pageId] === file.lastModified) {
                    skippedCount++;
                    continue;
                }

                // Needs Update
                await updateIndexForFile(entry.name, fileHandle);
                scannedCount++;
            }
        }

        // Cleanup: Remove pages that no longer exist in FS
        const allIndexedPages = Object.keys(fileStats);
        for (const pId of allIndexedPages) {
            if (!seenPages.has(pId)) {
                removePageFromIndex(pId);
            }
        }

        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);

        console.log(
            `✅ [Worker] Index sync: ${scannedCount} updated, ${skippedCount} cached, ${searchIndex.length} total blocks in ${duration}ms`
        );

        self.postMessage({ type: 'INDEX_READY', stats: { duration, totalPages: seenPages.size } });

    } catch (err) {
        console.error('[Worker] Failed to build index:', err);
        self.postMessage({ type: 'ERROR', error: (err as Error).message });
    }
}

// --- Search Logic (Simplified) ---

function calculateMatchScore(query: string, title: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    if (lowerTitle === lowerQuery) return 100;
    if (lowerTitle.startsWith(lowerQuery)) return 75;
    if (lowerTitle.includes(lowerQuery)) return 50;
    return 0;
}

function search(query: string) {
    if (!query || query.length === 0) {
        const results = [...searchIndex]
            .sort((a, b) => b.lastModified - a.lastModified)
            .slice(0, 50);
        self.postMessage({ type: 'SEARCH_RESULTS', query, results });
        return;
    }

    const matches = searchIndex
        .map(item => ({ item, score: calculateMatchScore(query, item.title) }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score || b.item.lastModified - a.item.lastModified)
        .slice(0, 50)
        .map(m => m.item);

    self.postMessage({ type: 'SEARCH_RESULTS', query, results: matches });
}

// --- Message Handler ---

self.onmessage = async (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'BUILD_INDEX':
            await buildSearchIndex(payload);
            break;

        case 'UPDATE_FILE':
            await updateIndexForFile(payload);
            break;

        case 'REMOVE_FILE':
            removePageFromIndex(payload.replace('.md', ''));
            break;

        case 'SEARCH':
            search(payload);
            break;

        case 'GET_BACKLINKS':
            // payload is target ID (e.g. "PageName" or "PageName#^block")
            const backlinkPages = reverseIndex[payload] || [];
            self.postMessage({ type: 'BACKLINKS_RESULT', target: payload, results: backlinkPages });
            break;

        case 'EXPORT_INDEX':
            const exportData: GraphIndexData = {
                searchIndex,
                fileStats,
                forwardIndex,
                reverseIndex
            };
            self.postMessage({ type: 'INDEX_EXPORTED', data: exportData });
            break;

        case 'IMPORT_INDEX':
            const data = payload as GraphIndexData;
            if (data) {
                searchIndex = data.searchIndex || [];
                fileStats = data.fileStats || {};
                forwardIndex = data.forwardIndex || {};
                reverseIndex = data.reverseIndex || {};
                console.log(`[Worker] Imported index: ${Object.keys(fileStats).length} files`);
            }
            break;
    }
};
