/**
 * Type declarations for File System Access API
 * These extend the built-in types to include permission-related methods
 * that are part of the File System Access API but not yet in TypeScript's lib.dom.d.ts
 */

interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

// Explicitly extend FileSystemDirectoryHandle to ensure it inherits these methods
interface FileSystemDirectoryHandle extends FileSystemHandle {
    // Inherits queryPermission and requestPermission from FileSystemHandle
}

// Also extend FileSystemFileHandle for consistency
interface FileSystemFileHandle extends FileSystemHandle {
    // Inherits queryPermission and requestPermission from FileSystemHandle
}
