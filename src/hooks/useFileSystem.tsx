import { createContext, useContext, useState, useCallback } from 'react';
import { scanDirectory, type FileNode } from '../utils/fileHelpers';

interface FileSystemContextType {
    rootHandle: FileSystemDirectoryHandle | null;
    folderName: string | null;
    files: FileNode[];
    currentFile: FileNode | null;
    openDirectory: () => Promise<void>;
    selectFile: (file: FileNode) => void;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
    const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [folderName, setFolderName] = useState<string | null>(null);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [currentFile, setCurrentFile] = useState<FileNode | null>(null);

    const openDirectory = useCallback(async () => {
        try {
            const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            setRootHandle(handle);
            setFolderName(handle.name);

            // Scan for .md files
            const fileList = await scanDirectory(handle);
            setFiles(fileList);
            console.log('Folder opened:', handle.name, 'Files found:', fileList.length);
        } catch (err) {
            if ((err as Error).name !== 'AbortError') {
                console.error('Error opening directory:', err);
            }
        }
    }, []);

    const selectFile = useCallback((file: FileNode) => {
        setCurrentFile(file);
    }, []);

    return (
        <FileSystemContext.Provider value={{
            rootHandle,
            folderName,
            files,
            currentFile,
            openDirectory,
            selectFile
        }}>
            {children}
        </FileSystemContext.Provider>
    );
}

export function useFileSystem() {
    const context = useContext(FileSystemContext);
    if (!context) {
        throw new Error('useFileSystem must be used within FileSystemProvider');
    }
    return context;
}
