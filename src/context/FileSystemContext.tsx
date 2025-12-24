import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useSearchWorker, type SearchResult } from '../hooks/useSearchWorker';
import { buildSearchIndex, updateIndexForFile, removePageFromIndex } from '../utils/searchIndex';

// File Types
export interface FileNode {
    name: string;
    handle: FileSystemFileHandle;
    lastModified: number;
}

// FileSystem Context
export interface FileSystemContextType {
    folderName: string | null;
    files: FileNode[];
    currentFile: FileNode | null;
    rootHandle: FileSystemDirectoryHandle | null;
    openDirectory: () => Promise<void>;
    selectFile: (file: FileNode) => void;
    saveFile: (file: FileSystemFileHandle, content: any) => Promise<void>;
    createNewNote: (filename: string, shouldSwitch?: boolean) => Promise<void>;
    renameFile: (oldName: string, newName: string) => Promise<void>;
    deleteFile: (filename: string) => Promise<void>;
    restoreFile: (filename: string) => void;
    openDailyNoteManually: () => Promise<void>;
    openDateNote: (dateString: string) => Promise<void>;
    search: (query: string) => Promise<SearchResult[]>;
}

export const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

// Helper to save file content
// Note: App.tsx used 'saveFile' which took only content string in the context definition
// BUT in the implementation in App.tsx (which I need to check), it likely used the current file handle.
// Let's copy the implementation from App.tsx carefully.

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
    const [folderName, setFolderName] = useState<string | null>(null);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [currentFile, setCurrentFile] = useState<FileNode | null>(null);
    const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const syncChannel = useRef<BroadcastChannel | null>(null);
    const { buildIndex, updateFile, removeFile, searchAsync } = useSearchWorker();

    const refreshFiles = useCallback(async (handle: FileSystemDirectoryHandle) => {
        const filePromises: Promise<FileNode>[] = [];
        for await (const entry of (handle as any).values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.json')) {
                filePromises.push(entry.getFile().then((file: File) => ({
                    name: entry.name,
                    handle: entry,
                    lastModified: file.lastModified
                })));
            }
        }
        const fileList = await Promise.all(filePromises);
        const sorted = fileList.sort((a, b) => b.lastModified - a.lastModified);
        setFiles(sorted);

        // Rebuild index (Worker) - Worker handles its own performance, usually fine
        buildIndex(handle);

        // REMOVED: Rebuild index (Main Thread)
        // buildSearchIndex(handle).catch(err => console.error("Failed to build main thread search index:", err));

        return sorted;
    }, [buildIndex]);

    // Initialize BroadcastChannel
    useEffect(() => {
        syncChannel.current = new BroadcastChannel('think-duck-sync');

        syncChannel.current.onmessage = (event) => {
            const { type, filename } = event.data;
            console.log('[Sync] Received:', type, filename);

            if (rootHandle) {
                if (type === 'DELETE_FILE' || type === 'RESTORE_FILE') {
                    refreshFiles(rootHandle);
                    // TODO: Sync search index too if needed across tabs
                }
            }
        };

        return () => {
            syncChannel.current?.close();
        };
    }, [rootHandle, refreshFiles]);


    const openDailyNote = useCallback(async (handle: FileSystemDirectoryHandle) => {
        const today = new Date();
        const dailyNoteName = `${format(today, 'MMMM do, yyyy')}.json`;

        try {
            const fileHandle = await handle.getFileHandle(dailyNoteName, { create: true });
            const file = await fileHandle.getFile();
            if (file.size === 0) {
                const writable = await fileHandle.createWritable();
                await writable.write('');
                await writable.close();
            }
            await refreshFiles(handle);
            setCurrentFile({ name: dailyNoteName, handle: fileHandle, lastModified: Date.now() });

            // Update search index for daily note
            updateIndexForFile(handle, dailyNoteName);

            console.log('[Auto] Opened daily note:', dailyNoteName);
        } catch (err) {
            console.error('[Auto] Error with daily note:', err);
        }
    }, [refreshFiles]);

    const openDirectory = useCallback(async () => {
        try {
            const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            setRootHandle(handle);
            setFolderName(handle.name);

            // Save to IndexedDB for persistence
            const db = await window.indexedDB.open('ThinkDuckDB', 1);
            db.onupgradeneeded = (ev: any) => {
                ev.target.result.createObjectStore('folders');
            };
            db.onsuccess = (ev: any) => {
                const db = ev.target.result;
                const tx = db.transaction('folders', 'readwrite');
                tx.objectStore('folders').put(handle, 'root');
            };

            await refreshFiles(handle);

            // Build search index initially
            buildSearchIndex(handle).catch(console.error);

            await openDailyNote(handle);

        } catch (err) {
            console.error('Error opening directory:', err);
        }
    }, [refreshFiles, openDailyNote]);

    // IndexedDB Restore
    useEffect(() => {
        const restore = async () => {
            const request = window.indexedDB.open('ThinkDuckDB', 1);
            request.onupgradeneeded = (ev: any) => {
                ev.target.result.createObjectStore('folders');
            };
            request.onsuccess = async (ev: any) => {
                const db = ev.target.result;
                const tx = db.transaction('folders', 'readonly');
                const store = tx.objectStore('folders');
                const getReq = store.get('root');

                getReq.onsuccess = async () => {
                    const handle = getReq.result;
                    if (handle) {
                        // Verify permission
                        const opts = { mode: 'readwrite' };
                        if (await handle.queryPermission(opts) === 'granted') {
                            setRootHandle(handle);
                            setFolderName(handle.name);
                            await refreshFiles(handle);
                            // Build search index initially
                            buildSearchIndex(handle).catch(console.error);
                            await openDailyNote(handle);
                        } else {
                            // Permission check often fails if not triggered by user, 
                            // but for stored handles sometimes we need to re-request? 
                            // Actually browsers block requestPermission unless user action.
                            // We might just load it if we can.
                            // For now, simpler logic:
                            // If indexedDB has handle, we try to use it.
                            setRootHandle(handle);
                            setFolderName(handle.name);
                            try {
                                await refreshFiles(handle);
                                // Build search index initially
                                buildSearchIndex(handle).catch(console.error);
                                await openDailyNote(handle);
                            } catch (e) {
                                console.warn("Could not restore handle without permission", e);
                            }
                        }
                    }
                };
            };
        };
        restore();
    }, [refreshFiles, openDailyNote]);


    const selectFile = useCallback((file: FileNode) => {
        setCurrentFile(file);
    }, []);

    const saveFile = useCallback(async (fileHandle: FileSystemFileHandle, content: any) => {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(content, null, 2));
            await writable.close();

            // Update search index (Worker)
            updateFile(fileHandle.name);

            // Update search index (Main Thread)
            if (rootHandle) {
                updateIndexForFile(rootHandle, fileHandle.name).catch(console.error);
            }

        } catch (err) {
            console.error('Error saving file:', err);
            throw err;
        }
    }, [updateFile, rootHandle]);

    const createNewNote = useCallback(async (filename: string, shouldSwitch = true) => {
        if (!rootHandle) return;
        try {
            // Ensure filename ends with .json
            const name = filename.endsWith('.json') ? filename : `${filename}.json`;
            const fileHandle = await rootHandle.getFileHandle(name, { create: true });

            // Check if empty
            const file = await fileHandle.getFile();
            if (file.size === 0) {
                const writable = await fileHandle.createWritable();
                // Default content
                await writable.write(JSON.stringify({
                    type: 'doc',
                    content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }]
                }));
                await writable.close();
            }

            const newFiles = await refreshFiles(rootHandle);
            const newFile = newFiles.find(f => f.name === name);
            if (newFile && shouldSwitch) {
                setCurrentFile(newFile);
            }

            // Update search index for new note
            updateIndexForFile(rootHandle, name);

        } catch (err) {
            console.error('Error creating note:', err);
            throw err;
        }
    }, [rootHandle, refreshFiles]);

    const renameFile = useCallback(async (oldName: string, newNameStr: string) => {
        if (!rootHandle) return;

        // Ensure new name ends with .json
        const newName = newNameStr.endsWith('.json') ? newNameStr : `${newNameStr}.json`;
        // Native rename not fully supported in all File System Access API implementations directly on handle?
        // Actually, typically requires move() or copying.
        // Assuming we implement copy + delete for now or if 'move' is available.
        // Chrome 111+ supports move().
        try {
            const oldHandle = await rootHandle.getFileHandle(oldName);
            // Try move first, fallback to copy/delete
            let moved = false;
            try {
                if ((oldHandle as any).move) {
                    await (oldHandle as any).move(newName);
                    moved = true;
                }
            } catch (err) {
                console.warn("Native move failed/not supported, falling back to copy/delete", err);
            }

            if (!moved) {
                // Copy content
                const oldFile = await oldHandle.getFile();
                const text = await oldFile.text();

                const newHandle = await rootHandle.getFileHandle(newName, { create: true });
                const writable = await newHandle.createWritable();
                await writable.write(text);
                await writable.close();

                await rootHandle.removeEntry(oldName);
            }

            removeFile(oldName);
            const newFiles = await refreshFiles(rootHandle);

            // If current file was renamed, update it
            if (currentFile?.name === oldName) {
                const newFile = newFiles.find(f => f.name === newName);
                if (newFile) setCurrentFile(newFile);
            }

            // Update search index: Remove old, add new
            removePageFromIndex(oldName.replace('.json', ''));
            updateIndexForFile(rootHandle, newName);

        } catch (err) {
            console.error('Error renaming:', err);
            throw err;
        }
    }, [rootHandle, refreshFiles, removeFile, currentFile]);


    const deleteFile = useCallback(async (filename: string) => {
        if (!rootHandle) return;
        try {
            await rootHandle.removeEntry(filename);
            removeFile(filename);
            await refreshFiles(rootHandle);
            if (currentFile?.name === filename) {
                setCurrentFile(null);
            }

            // Remove from search index
            removePageFromIndex(filename.replace('.json', ''));

            syncChannel.current?.postMessage({ type: 'DELETE_FILE', filename });
        } catch (err) {
            console.error('[deleteFile] Error:', err);
            alert('Error deleting file: ' + (err as Error).message);
        }
    }, [rootHandle, refreshFiles, currentFile, removeFile]);

    const restoreFile = useCallback((filename: string) => {
        syncChannel.current?.postMessage({ type: 'RESTORE_FILE', filename });
        if (rootHandle) refreshFiles(rootHandle);
    }, [rootHandle, refreshFiles]);

    const openDailyNoteManually = useCallback(async () => {
        if (!rootHandle) {
            alert('Please open a folder first');
            return;
        }
        await openDailyNote(rootHandle);
    }, [rootHandle, openDailyNote]);

    const openDateNote = useCallback(async (dateString: string) => {
        if (!rootHandle) {
            alert('Please open a folder first');
            return;
        }
        try {
            // dateString is YYYY-MM-DD from calendar
            const date = new Date(dateString);
            const dailyNoteName = `${format(date, 'MMMM do, yyyy')}.json`;
            const fileHandle = await rootHandle.getFileHandle(dailyNoteName, { create: true });
            const file = await fileHandle.getFile();
            if (file.size === 0) {
                const writable = await fileHandle.createWritable();
                await writable.write('');
                await writable.close();
            }
            await refreshFiles(rootHandle);
            setCurrentFile({ name: dailyNoteName, handle: fileHandle, lastModified: Date.now() });
            console.log('[openDateNote] Opened:', dailyNoteName);
        } catch (err) {
            console.error('[openDateNote] Error:', err);
        }
    }, [rootHandle, refreshFiles]);

    return (
        <FileSystemContext.Provider value={{ folderName, files, currentFile, rootHandle, openDirectory, selectFile, saveFile, createNewNote, renameFile, deleteFile, restoreFile, openDailyNoteManually, openDateNote, search: searchAsync }}>
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (!context) throw new Error('useFileSystem must be used within FileSystemProvider');
    return context;
}
