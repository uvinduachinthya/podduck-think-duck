export interface FileNode {
    name: string;
    path: string;
    kind: 'file' | 'directory';
    handle: FileSystemHandle;
}

export async function scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileNode[]> {
    const files: FileNode[] = [];

    try {
        for await (const entry of (dirHandle as any).values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                files.push({
                    name: entry.name,
                    path: entry.name,
                    kind: 'file',
                    handle: entry
                });
            }
        }
    } catch (err) {
        console.error('Error scanning directory:', err);
    }

    return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readFileText(fileHandle: FileSystemFileHandle): Promise<string> {
    const file = await fileHandle.getFile();
    return await file.text();
}

export async function writeFileText(fileHandle: FileSystemFileHandle, content: string): Promise<void> {
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

export async function createNote(dirHandle: FileSystemDirectoryHandle, filename: string, content: string = ''): Promise<void> {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    await writeFileText(fileHandle, content);
}
