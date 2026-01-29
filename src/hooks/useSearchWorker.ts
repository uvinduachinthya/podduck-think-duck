
import { useEffect, useRef, useState, useCallback } from 'react';
import type { SearchableItem } from '../utils/searchIndex';

export interface SearchResult extends SearchableItem { }

export function useSearchWorker() {
    const workerRef = useRef<Worker | null>(null);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isIndexing, setIsIndexing] = useState(false);
    const pendingSearchRef = useRef<{ resolve: (results: SearchResult[]) => void } | null>(null);

    useEffect(() => {
        // Initialize worker
        const worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), {
            type: 'module' // Important for Vite
        });

        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { type, results, stats } = e.data;

            if (type === 'SEARCH_RESULTS') {
                setSearchResults(results);
                if (pendingSearchRef.current) {
                    pendingSearchRef.current.resolve(results);
                    pendingSearchRef.current = null;
                }
            } else if (type === 'INDEX_READY') {
                setIsIndexing(false);
                console.log('[useSearchWorker] Index ready:', stats);
            } else if (type === 'INDEX_UPDATED') {
                // Optional: trigger a refresh if needed
            }
        };

        return () => {
            worker.terminate();
        };
    }, []);

    const buildIndex = useCallback((handle: FileSystemDirectoryHandle) => {
        if (!workerRef.current) return;
        setIsIndexing(true);
        workerRef.current.postMessage({ type: 'BUILD_INDEX', payload: handle });
    }, []);

    const search = useCallback((query: string) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'SEARCH', payload: query });
    }, []);

    const searchAsync = useCallback((query: string): Promise<SearchResult[]> => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve([]);
                return;
            }
            pendingSearchRef.current = { resolve };
            workerRef.current.postMessage({ type: 'SEARCH', payload: query });
        });
    }, []);

    const updateFile = useCallback((filename: string) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'UPDATE_FILE', payload: filename });
    }, []);

    const removeFile = useCallback((filename: string) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'REMOVE_FILE', payload: filename });
    }, []);

    const getBacklinks = useCallback((target: string): Promise<string[]> => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve([]);
                return;
            }
            // Use temporary listener for result
            const handler = (e: MessageEvent) => {
                if (e.data.type === 'BACKLINKS_RESULT' && e.data.target === target) {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(e.data.results);
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ type: 'GET_BACKLINKS', payload: target });
        });
    }, []);

    const getAffectedFilesForRename = useCallback((oldName: string): Promise<string[]> => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve([]);
                return;
            }
            const handler = (e: MessageEvent) => {
                if (e.data.type === 'RENAME_AFFECTED_RESULT' && e.data.target === oldName) {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(e.data.results);
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ type: 'GET_AFFECTED_FILES_FOR_RENAME', payload: oldName });
        });
    }, []);

    const exportIndex = useCallback((): Promise<any> => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve(null);
                return;
            }
            const handler = (e: MessageEvent) => {
                if (e.data.type === 'INDEX_EXPORTED') {
                    workerRef.current?.removeEventListener('message', handler);
                    resolve(e.data.data);
                }
            };
            workerRef.current.addEventListener('message', handler);
            workerRef.current.postMessage({ type: 'EXPORT_INDEX' });
        });
    }, []);

    const importIndex = useCallback((data: any) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'IMPORT_INDEX', payload: data });
    }, []);

    const updateAsset = useCallback((filename: string) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: 'UPDATE_ASSET', payload: filename });
    }, []);

    return {
        searchResults,
        isIndexing,
        buildIndex,
        search,
        searchAsync,
        updateFile,
        updateAsset,
        removeFile,
        getBacklinks,
        getAffectedFilesForRename,
        exportIndex,
        importIndex
    };
}
