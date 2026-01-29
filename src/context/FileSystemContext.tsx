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
    closeDirectory: () => void;
    selectFile: (file: FileNode) => void;
    saveFile: (file: FileSystemFileHandle, content: any) => Promise<void>;
    createNewNote: (filename: string, shouldSwitch?: boolean) => Promise<void>;
    renameFile: (oldName: string, newName: string) => Promise<void>;
    deleteFile: (filename: string) => Promise<void>;
    restoreFile: (filename: string) => void;
    openDailyNoteManually: () => Promise<void>;
    openDateNote: (dateString: string) => Promise<void>;
    search: (query: string) => Promise<SearchResult[]>;
    addBlockIdToFile: (filename: string, blockText: string) => Promise<string | null>;
    saveAsset: (file: File, customName?: string) => Promise<string>;
    getAssetUrl: (path: string) => Promise<string | null>;
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
    const { buildIndex, updateFile, removeFile, searchAsync, exportIndex, importIndex, getAffectedFilesForRename, updateAsset } = useSearchWorker();

    // Debounced save index ref
    const saveIndexTimeoutRef = useRef<any | null>(null);

    const saveGlobalIndexCallback = useCallback(async (handle: FileSystemDirectoryHandle) => {
        try {
            // Get index data from worker
            const indexData = await exportIndex();
            if (!indexData) return;

            // Save to .podduck/index.json
            const podduckDir = await handle.getDirectoryHandle('.podduck', { create: true });
            const indexFile = await podduckDir.getFileHandle('index.json', { create: true });
            const writable = await indexFile.createWritable();
            await writable.write(JSON.stringify(indexData));
            await writable.close();
            // console.log("[FS] Global Index Saved");
        } catch (err) {
            console.error("[FS] Failed to save global index:", err);
        }
    }, [exportIndex]);

    const loadGlobalIndex = useCallback(async (handle: FileSystemDirectoryHandle) => {
         try {
             // Try to find .podduck/index.json
             const podduckDir = await handle.getDirectoryHandle('.podduck');
             const indexFile = await podduckDir.getFileHandle('index.json');
             const file = await indexFile.getFile();
             const text = await file.text();
             const data = JSON.parse(text);
             
             // Send to worker
             importIndex(data);
             // console.log("[FS] Global Index Loaded");
         } catch (e) {
             // It's okay if it doesn't exist yet
             // console.log("[FS] No global index found, will create new one.");
         }
    }, [importIndex]);


    const refreshFiles = useCallback(async (handle: FileSystemDirectoryHandle) => {
        const filePromises: Promise<FileNode>[] = [];
        for await (const entry of (handle as any).values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.md')) {
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

        // Load Index FIRST (if exists), then build/update
        await loadGlobalIndex(handle);

        // Rebuild index (Worker) - Worker handles its own performance (incremental check)
        buildIndex(handle);

        // REMOVED: Rebuild index (Main Thread)
        // buildSearchIndex(handle).catch(err => console.error("Failed to build main thread search index:", err));

        return sorted;
    }, [buildIndex, loadGlobalIndex]);

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
        const dailyNoteName = `${format(today, 'MMMM do, yyyy')}.md`;

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

    const closeDirectory = useCallback(() => {
        setRootHandle(null);
        setFolderName(null);
        setFiles([]);
        setCurrentFile(null);
        // Clear persistence if desired, or let it stick until explicit new open
        // For "Close", we probably want to clear the 'root' from IndexedDB to prevent auto-reopen
         const clearDb = async () => {
            const request = window.indexedDB.open('ThinkDuckDB', 1);
            request.onsuccess = (ev: any) => {
                const db = ev.target.result;
                const tx = db.transaction('folders', 'readwrite');
                tx.objectStore('folders').delete('root');
            };
        };
        clearDb();
    }, []);

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

    const saveFile = useCallback(async (fileHandle: FileSystemFileHandle, content: string) => {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            // Update search index (Worker)
            updateFile(fileHandle.name);

            // Update search index (Main Thread)
            if (rootHandle) {
                updateIndexForFile(rootHandle, fileHandle.name).catch(console.error);
                
                // TRIGGER INDEX SAVE (Debounced)
                if (saveIndexTimeoutRef.current) clearTimeout(saveIndexTimeoutRef.current);
                saveIndexTimeoutRef.current = setTimeout(() => {
                    saveGlobalIndexCallback(rootHandle).catch(console.error);
                }, 5000); // Save index 5 seconds after last edit
            }

        } catch (err) {
            console.error('Error saving file:', err);
            throw err;
        }
    }, [updateFile, rootHandle, saveGlobalIndexCallback]);

    const addBlockIdToFile = useCallback(async (filename: string, blockText: string): Promise<string | null> => {
        if (!rootHandle) return null;
        try {
            // Find the file
            const fileHandle = await rootHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const content = await file.text();
            
            // Find the line containing the exact block text
            // We search for lines that *contain* the text, but ideally it should match the block found by index
            const lines = content.split('\n');
            // We'll search for the line that includes the block text. 
            // Note: blockText coming from searchIndex might be trimmed/processed. 
            // We should try to find a unique match.
            
            // Generate ID
            const newId = Math.random().toString(36).substr(2, 6);
            let updatedContent = "";
            let found = false;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Check if this line roughly matches search text.
                // We use includes because blockText from index excludes list markers.
                if (!found && line.includes(blockText)) {
                    // Check if it already has an ID? Search Index said no stable ID, but maybe it was added just now?
                    // Regex for existing ID: \^[a-z0-9]{6}$
                    if (!/ \^[a-z0-9]{6}$/i.test(line)) {
                        updatedContent += line + ` ^${newId}\n`;
                        found = true;
                        continue;
                    } 
                    // If it has ID, we return null or the existing ID? 
                    // Ideally we shouldn't be here if it has ID.
                }
                updatedContent += line + '\n';
            }
            
            // Remove last newline if original didn't have one? 
            // split join adds one. It's fine for markdown.
            
            if (found) {
                // Remove trailing newline added by loop if processed last line
                updatedContent = updatedContent.slice(0, -1);
                
                await saveFile(fileHandle, updatedContent);
                return newId;
            }
            return null;

        } catch (err) {
            console.error("Error adding block ID:", err);
            return null;
        }
    }, [rootHandle, saveFile]);

    const createNewNote = useCallback(async (filename: string, shouldSwitch = true) => {
        if (!rootHandle) return;
        try {
            // Ensure filename ends with .md
            const name = filename.endsWith('.md') ? filename : `${filename}.md`;
            const fileHandle = await rootHandle.getFileHandle(name, { create: true });

            // Check if empty
            const file = await fileHandle.getFile();
            if (file.size === 0) {
                const writable = await fileHandle.createWritable();
                // Default content
                await writable.write('');
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

        // Ensure new name ends with .md
        const newName = newNameStr.endsWith('.md') ? newNameStr : `${newNameStr}.md`;
        
        // 1. Get affected files BEFORE renaming
        const oldPageId = oldName.replace('.md', '');
        const newPageId = newName.replace('.md', '');
        const affectedFiles = await getAffectedFilesForRename(oldPageId);
        
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
            removePageFromIndex(oldPageId); // Remove old ID
            updateIndexForFile(rootHandle, newName); // Add new file

            // 2. Update Backlinks in other files
            for (const filename of affectedFiles) {
                if (filename === oldPageId) continue; // Skip self (already renamed)
                
                try {
                    const targetFileHandle = await rootHandle.getFileHandle(filename + '.md');
                    const file = await targetFileHandle.getFile();
                    const content = await file.text();
                    
                    // Replace logic
                    // [[OldName]] -> [[NewName]]
                    // [[OldName|Alias]] -> [[NewName|Alias]]
                    // [[OldName#^block]] -> [[NewName#^block]]
                    
                    // Regex construction: match [[OldName followed by ] or | or #
                    const regex = new RegExp(`\\[\\[${oldPageId}(?=[\\|\\]#])`, 'g');
                    const newContent = content.replace(regex, `[[${newPageId}`);
                    
                    if (newContent !== content) {
                        const writable = await targetFileHandle.createWritable();
                        await writable.write(newContent);
                        await writable.close();
                        
                        updateFile(filename + '.md'); // Update validation
                        // console.log(`Updated backlinks in ${filename}`);
                    }
                } catch (e) {
                    console.warn(`Failed to update backlink in ${filename}:`, e);
                }
            }
            
            // Trigger save of index
            saveGlobalIndexCallback(rootHandle).catch(console.error);

        } catch (err) {
            console.error('Error renaming:', err);
            throw err;
        }
    }, [rootHandle, refreshFiles, removeFile, currentFile, getAffectedFilesForRename, updateFile, saveGlobalIndexCallback]);


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
            removePageFromIndex(filename.replace('.md', ''));

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
            const dailyNoteName = `${format(date, 'MMMM do, yyyy')}.md`;
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

    const saveAsset = useCallback(async (file: File, customName?: string) => {
        if (!rootHandle) throw new Error("No root directory open");
        try {
            const assetsDir = await rootHandle.getDirectoryHandle('assets', { create: true });
            
            // Generate unique name: image-TIMESTAMP-RANDOM.ext OR customName.ext
            const ext = file.name.split('.').pop() || 'png';
            let name;

            if (customName) {
                // Sanitize custom name: spaces to dashes, remove illegal chars
                const safeName = customName.trim().replace(/\s+/g, '-').replace(/[<>:"/\\|?*]/g, '');
                name = safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;
            } else {
                name = `image-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
            }
            
            // Check if file exists? If custom name, maybe overwrite or error? 
            // For now, let's just overwrite or append index if collision?
            // Simpler: Just try to write. (FileSystem API handles handle retrieval)
            
            const newFileHandle = await assetsDir.getFileHandle(name, { create: true });
            const writable = await newFileHandle.createWritable();
            await writable.write(file);
            await writable.close();

            // Update search index
            updateAsset(name);
            
            return `assets/${name}`;
        } catch (err) {
            console.error("Error saving asset:", err);
            throw err;
        }
    }, [rootHandle, updateAsset]);

    const getAssetUrl = useCallback(async (path: string) => {
        if (!rootHandle) return null;
        try {
            // Check if path starts with assets/
            const parts = path.split('/');
            if (parts.length > 1 && parts[0] === 'assets') {
                const assetsDir = await rootHandle.getDirectoryHandle('assets');
                const fileHandle = await assetsDir.getFileHandle(parts[1]);
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            }
            
            // Fallback: try root
            try {
                const fileHandle = await rootHandle.getFileHandle(path);
                const file = await fileHandle.getFile();
                return URL.createObjectURL(file);
            } catch (e) {
                 // Not in root either
                 return null;
            }
        } catch (err) {
            console.error("Error loading asset url for:", path, err);
            return null;
        }
    }, [rootHandle]);

    return (
        <FileSystemContext.Provider value={{ folderName, files, currentFile, rootHandle, openDirectory, closeDirectory, selectFile, saveFile, createNewNote, renameFile, deleteFile, restoreFile, openDailyNoteManually, openDateNote, search: searchAsync, addBlockIdToFile, saveAsset, getAssetUrl }}>
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (!context) throw new Error('useFileSystem must be used within FileSystemProvider');
    return context;
}
