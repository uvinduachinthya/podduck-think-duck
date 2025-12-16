
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

    return {
        searchResults,
        isIndexing,
        buildIndex,
        search,
        searchAsync,
        updateFile,
        removeFile
    };
}
