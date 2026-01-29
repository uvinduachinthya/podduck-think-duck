import './index.css'
import React, { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisYear, differenceInMinutes, parse } from 'date-fns';
import {

    FilePlus as AddIcon,
    Settings as SettingsIcon,
    Calendar as CalendarIcon,
    CalendarDays as CalendarDaysIcon,
    Search as SearchIcon,
    PanelLeftClose as SidebarLeftCloseIcon,
    PanelLeftOpen as SidebarLeftOpenIcon,
    Trash2 as DeleteIcon,
    Pencil as CopyIcon,
    ExternalLink as NewTabIcon,
    AppWindow as NewWindowIcon,
    MoreVertical,
    MoreHorizontal
} from 'lucide-react';
import { CodeMirrorEditor } from './components/editor/CodeMirrorEditor';
import { Settings } from './components/Settings';

import { SmoothCursor } from './components/SmoothCursor';
import { DailyNotesList } from './components/DailyNotesList';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { SearchModal } from './components/SearchModal';
import { Virtuoso } from 'react-virtuoso';
import origamiDucklings from './assets/origami-ducklings.webp';
import origamiDucklingsDark from './assets/origami-ducklings-dark.webp';
import { useTheme } from './context/ThemeContext';
import { BrowserNotSupported } from './components/BrowserNotSupported';

import { FileSystemProvider, useFileSystem, FileSystemContext, type FileNode } from './context/FileSystemContext';
import { UpdatePopup } from './components/UpdatePopup';
import { APP_VERSION } from './version';

// Editor Component starts here

// Editor Component starts here

function Editor({ fileHandle, onSave, onEditorReady, onNavigate, scrollToId, addBlockIdToFile }: { fileHandle: FileSystemFileHandle; onSave: (content: string) => void; onEditorReady?: (editor: any) => void; onNavigate: (target: string) => void; scrollToId?: string | null; addBlockIdToFile?: (filename: string, blockText: string) => Promise<string | null> }) {
    const [isLoading, setIsLoading] = useState(true);
    const [content, setContent] = useState('');
    const saveTimeoutRef = useRef<any>(null);

    // Load File
    useEffect(() => {
        let mounted = true;
        const loadFile = async () => {
            try {
                setIsLoading(true);
                const file = await fileHandle.getFile();
                const text = await file.text();
                if (mounted) {
                    setContent(text);
                }
            } catch (err) {
                console.error('[Editor] Error loading:', err);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        loadFile();
        return () => { mounted = false; };
    }, [fileHandle]);

    const handleChange = useCallback((val: string) => {
        setContent(val);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onSave(val);
        }, 500);
    }, [onSave]);

    if (isLoading) return <div style={{ padding: '20px' }}>Loading...</div>;

    return (
        <CodeMirrorEditor
            content={content}
            fileName={fileHandle.name}
            onChange={handleChange}
            onEditorReady={onEditorReady}
            onNavigate={onNavigate}
            scrollToId={scrollToId}
            addBlockIdToFile={addBlockIdToFile}
        />
    );
}

// Components

// Helper component for inline renaming
const InlineRenameInput = ({
    initialValue,
    onSubmit,
    onCancel
}: {
    initialValue: string;
    onSubmit: (value: string) => Promise<string | void>;
    onCancel: () => void;
}) => {
    const [value, setValue] = useState(initialValue);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus and select all on mount
    useEffect(() => {
        if (inputRef.current) {
            // Delay slightly to ensure focus sticks and selection works
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 10);
        }
    }, []);

    const handleSubmit = async () => {
        // Clear previous error
        setError(null);
        const err = await onSubmit(value);
        if (err) {
            setError(err);
            // Select text again to let user type immediately
            inputRef.current?.select();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            e.stopPropagation();
            e.preventDefault();
            onCancel();
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    if (error) setError(null); // Clear error on type
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                    // If blur happens, try to save. 
                    handleSubmit();
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: `1px solid ${error ? 'var(--danger-color, #ff4d4f)' : 'var(--primary-color)'}`,
                    borderRadius: '2px',
                    padding: '2px 4px',
                    fontSize: 'inherit',
                    width: '100%',
                    outline: 'none'
                }}
            />
            {error && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    marginTop: '4px',
                    backgroundColor: 'var(--danger-color, #ff4d4f)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    zIndex: 100,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}>
                    {error}
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        left: '10px',
                        width: '8px',
                        height: '8px',
                        backgroundColor: 'var(--danger-color, #ff4d4f)',
                        transform: 'rotate(45deg)'
                    }} />
                </div>
            )}
        </div>
    );
};





// Helper to open note in a centered popup window
function openNoteInPopup(filename: string) {
    const url = window.location.origin + window.location.pathname + '?mode=popup#' + encodeURIComponent(filename);
    const width = 640;
    const height = window.screen.height * 0.85;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
}

// Helper to extract text from Tiptap JSON
function getPreviewText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(getPreviewText).join(' ');
    }
    return '';
}



// Helper function to detect daily notes (YYYY-MM-DD pattern or "October 20th, 2025" pattern)
// Exported or just module-level to be shared between Sidebar and MainContent
function isDailyNote(filename: string): boolean {
    const nameWithoutExt = filename.replace('.md', '');
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(nameWithoutExt)) return true;
    // Match "October 20th, 2025"
    // Regex: [Word] [Digits][st|nd|rd|th], [Digits]
    return /^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(nameWithoutExt);
}

const SidebarItem = React.memo(({ file, context }: { file: FileNode; context: any }) => {
    const { currentFile, selectFile, editingFileId, editValue, startEditing, submitRename, cancelRename, checkDelete } = context;
    const [preview, setPreview] = useState<string>('');

    useEffect(() => {
        let active = true;
        const fetchPreview = async () => {
            try {
                // Optimization: Maybe read only first 1KB?
                const f = await file.handle.getFile();
                const text = await f.text();
                if (!active) return;

                try {
                    const json = JSON.parse(text);
                    const str = getPreviewText(json);
                    setPreview(str.slice(0, 200));
                } catch {
                    // If not JSON, maybe simple text?
                    setPreview(text.slice(0, 200));
                }
            } catch (e) {
                // ignore
            }
        };
        fetchPreview();
        return () => { active = false; };
    }, [file.handle, file.lastModified]);

    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

    // Auto-refresh timestamp for recent notes
    useEffect(() => {
        const diff = Date.now() - (file.lastModified || Date.now());
        if (diff < 3600000) { // If less than 1 hour old
            const interval = setInterval(forceUpdate, 60000); // Update every minute
            return () => clearInterval(interval);
        }
    }, [file.lastModified]);

    const dateStr = useMemo(() => {
        const now = Date.now();
        const modified = file.lastModified || now;
        const date = new Date(modified);
        const diffMins = differenceInMinutes(now, date);

        if (diffMins < 1) {
            return 'Just now';
        }
        if (diffMins < 60) {
            return `${diffMins}m ago`;
        }

        if (isToday(date)) {
            return format(date, 'h:mm a');
        }
        if (isYesterday(date)) {
            return 'Yesterday';
        }
        if (isThisWeek(date)) {
            return format(date, 'EEEE');
        }
        if (isThisYear(date)) {
            return format(date, 'd MMM');
        }
        return format(date, 'd MMM yyyy');
    }, [file.lastModified, ignored]);

    return (
        <ContextMenu.Root key={file.name}>
            <ContextMenu.Trigger>
                <div
                    onClick={() => selectFile(file)}
                    className={`sidebar-note-item ${currentFile?.name === file.name ? 'active' : ''}`}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                            {editingFileId === file.name ? (
                                <InlineRenameInput
                                    initialValue={editValue}
                                    onSubmit={submitRename}
                                    onCancel={cancelRename}
                                />
                            ) : (
                                <span className="sidebar-note-title">
                                    {file.name.replace('.md', '')}
                                </span>
                            )}
                        </div>

                        {/* Three-dot Menu */}
                        <div
                            className="sidebar-more-trigger"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center' }}
                        >
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button
                                        className="icon-btn"
                                        style={{
                                            padding: '2px',
                                            width: '24px',
                                            height: '24px',
                                            opacity: 0.6,
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            color: 'var(--sidebar-text)'
                                        }}
                                    >
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                        style={{
                                            minWidth: '160px',
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderRadius: '6px',
                                            padding: '4px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                            border: '1px solid var(--sidebar-border)',
                                            zIndex: 1000
                                        }}
                                        align="end"
                                    >
                                        <DropdownMenu.Item
                                            onClick={() => startEditing(file)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            className="context-menu-item"
                                        >
                                            <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Rename</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onClick={() => {
                                                const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(file.name);
                                                window.open(url, '_blank');
                                            }}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            className="context-menu-item"
                                        >
                                            <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Open in new tab</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onClick={() => openNoteInPopup(file.name)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                color: 'var(--text-primary)',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            className="context-menu-item"
                                        >
                                            <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Open in new window</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item
                                            onClick={() => checkDelete(file.name)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                borderRadius: '4px',
                                                color: 'var(--danger-color, #ff4d4f)',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                            className="context-menu-item"
                                        >
                                            <DeleteIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Delete</span>
                                        </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                        </div>
                    </div>

                    <div className="sidebar-note-preview line-clamp-2">
                        {preview || 'No additional text'}
                    </div>

                    <div className="sidebar-note-date">
                        {dateStr}
                    </div>
                </div>
            </ContextMenu.Trigger>
            <ContextMenu.Content style={{
                minWidth: '160px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
                padding: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                border: '1px solid var(--sidebar-border)',
                zIndex: 1000
            }}>
                <ContextMenu.Item
                    onClick={() => startEditing(file)}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    className="context-menu-item"
                >
                    <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Rename</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                    onClick={() => {
                        const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(file.name);
                        window.open(url, '_blank');
                    }}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    className="context-menu-item"
                >
                    <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Open in new tab</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                    onClick={() => openNoteInPopup(file.name)}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    className="context-menu-item"
                >
                    <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Open in new window</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                    onClick={() => checkDelete(file.name)}
                    style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--danger-color, #ff4d4f)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                    className="context-menu-item"
                >
                    <DeleteIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Delete</span>
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
});
function Sidebar({ isOpen, onSettingsClick, onViewModeChange }: { isOpen: boolean; onSettingsClick: () => void; onViewModeChange: (mode: 'editor' | 'daily-list') => void }) {
    const { folderName, files, currentFile, rootHandle, createNewNote, selectFile, openDailyNoteManually, renameFile, deleteFile } = useFileSystem();
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [showCloseFolderConfirm, setShowCloseFolderConfirm] = useState(false);
    const [editValue, setEditValue] = useState('');

    const startEditing = (file: FileNode) => {
        setEditingFileId(file.name);
        setEditValue(file.name.replace('.md', ''));
    };

    const cancelRename = () => {
        setEditingFileId(null);
        setEditValue('');
    };

    const submitRename = async (newValue: string): Promise<string | void> => {
        if (!editingFileId || !newValue.trim()) {
            cancelRename();
            return;
        }

        const cleanName = newValue.trim();
        const newFileName = cleanName.endsWith('.md') ? cleanName : `${cleanName}.md`;

        // Skip if name hasn't changed
        if (newFileName === editingFileId) {
            cancelRename();
            return;
        }

        // Check for duplicate
        const exists = files.some(f => f.name.toLowerCase() === newFileName.toLowerCase());
        if (exists) {
            return "This name already exists";
        }

        await renameFile(editingFileId, newFileName);
        cancelRename();
    };

    const checkDelete = (filename: string) => {
        const skipConfirm = localStorage.getItem('skipDeleteConfirm') === 'true';
        if (skipConfirm) {
            deleteFile(filename);
        } else {
            setDeleteCandidate(filename);
        }
    };

    const confirmDelete = (dontAsk: boolean) => {
        if (deleteCandidate) {
            if (dontAsk) {
                localStorage.setItem('skipDeleteConfirm', 'true');
            }
            deleteFile(deleteCandidate);
            setDeleteCandidate(null);
        }
    };

    const cancelDelete = () => {
        setDeleteCandidate(null);
    };

    // Filter out daily notes from the regular notes list
    const regularNotes = files.filter(file => !isDailyNote(file.name));

    // Check if current file is a daily note
    const isViewingDailyNote = currentFile ? isDailyNote(currentFile.name) : false;

    return (
        <div
            className="sidebar-container"
            style={{
                marginLeft: isOpen ? '0' : 'calc(-1 * var(--sidebar-width))'
            }}
        >




            {rootHandle && (
                <div style={{ padding: '8px' }}>
                    {/* Daily Notes Section */}
                    <div
                        onClick={() => {
                            openDailyNoteManually();
                            onViewModeChange('editor');
                        }}
                        className={`sidebar-action-item ${isViewingDailyNote ? 'active' : ''}`}
                    >
                        <CalendarIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Today</span>
                    </div>
                    <div
                        onClick={() => onViewModeChange('daily-list')}
                        className="sidebar-action-item"
                    >
                        <CalendarDaysIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>All daily notes</span>
                    </div>
                    {/* New Note Button */}
                    <div
                        onClick={() => {
                            // Find next available note number
                            // Quack note logic: "Quack note", then "Quack note 1", "Quack note 2"...
                            const baseName = 'Quack note';

                            // Check if base exists
                            const baseExists = files.some(f => f.name === `${baseName}.md`);

                            if (!baseExists) {
                                createNewNote(baseName);
                            } else {
                                const existingNumbers = files
                                    .map(f => {
                                        const match = f.name.match(/^Quack note (\d+)\.md$/);
                                        return match ? parseInt(match[1], 10) : 0;
                                    })
                                    .filter(n => n > 0);

                                const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
                                createNewNote(`${baseName} ${nextNumber}`);
                            }
                            onViewModeChange('editor');
                        }}
                        className="sidebar-action-item"
                    >
                        <AddIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>New Note</span>
                    </div>
                </div>
            )}

            {rootHandle && (

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 8px 0', overflow: 'hidden' }}>
                    {regularNotes.length > 0 && (
                        <div style={{ color: 'var(--sidebar-text-muted)', padding: '8px 8px 4px', fontWeight: 600, textTransform: 'uppercase', marginLeft: '5px', fontSize: '0.75em', flexShrink: 0 }}>
                            NOTES ({regularNotes.length})
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        <Virtuoso
                            className="no-scrollbar"
                            style={{ height: '100%' }}
                            data={regularNotes}
                            data={regularNotes}
                            context={{ 
                                currentFile, 
                                selectFile: (file) => {
                                    selectFile(file);
                                    onViewModeChange('editor');
                                },
                                editingFileId, 
                                editValue, 
                                startEditing, 
                                submitRename, 
                                cancelRename, 
                                checkDelete 
                            }}
                            itemContent={(_index, file, context) => <SidebarItem file={file} context={context} />}
                        />
                    </div>
                </div>
            )}

            {/* Spacer to push settings to bottom - only when no folder is open */}
            {!rootHandle && <div style={{ flex: 1 }} />}

            <div
                onClick={onSettingsClick}
                className="sidebar-settings-item"
            >
                <SettingsIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                <span>Settings</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6, border: '1px solid var(--sidebar-border)', padding: '2px 4px', borderRadius: '4px' }}>⌘ ,</span>
            </div>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={!!deleteCandidate}
                fileName={deleteCandidate?.replace('.md', '') || ''}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />

            {/* Close Folder Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={showCloseFolderConfirm}
                fileName={folderName || 'folder'}
                title="Close Folder"
                message={`Are you sure you want to close <strong style="color: var(--text-primary)">${folderName || 'this folder'}</strong>? Any unsaved changes will be lost.`}
                confirmButtonText="Close Folder"
                showDontAskAgain={false}
                onConfirm={async () => {
                    // Clear folder from IndexedDB
                    try {
                        const db = await window.indexedDB.open('ThinkDuckDB', 1);
                        db.onsuccess = () => {
                            const tx = db.result.transaction('folders', 'readwrite');
                            tx.objectStore('folders').delete('lastFolder');
                            tx.oncomplete = () => {
                                window.location.reload();
                            };
                        };
                    } catch (e) {
                        console.error('Error clearing folder:', e);
                        window.location.reload();
                    }
                    setShowCloseFolderConfirm(false);
                }}
                onCancel={() => setShowCloseFolderConfirm(false)}
            />
        </div>
    );
}


function MainContent({ isSidebarOpen, toggleSidebar, showSidebarToggle = true, onSearchClick, viewMode, setViewMode }: { isSidebarOpen: boolean; toggleSidebar: () => void; showSidebarToggle?: boolean; onSearchClick: () => void; viewMode: 'editor' | 'daily-list'; setViewMode: (mode: 'editor' | 'daily-list') => void }) {
    const { currentFile, saveFile, files, deleteFile, renameFile, openDirectory, selectFile, addBlockIdToFile } = useFileSystem();
    const { theme } = useTheme();

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [currentEditor, setCurrentEditor] = useState<any>(null);
    // showCalendar state lifted to App
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (currentFile) {
            setEditedTitle(currentFile.name.replace('.md', ''));
        }
    }, [currentFile]);

    const handleTitleClick = () => {
        setIsEditingTitle(true);
        setTimeout(() => {
            titleInputRef.current?.focus();
            titleInputRef.current?.select();
        }, 0);
    };

    const handleSave = useCallback(async (content: string) => {
        if (currentFile) {
            // content is stringified JSON from Editor? No, Editor passes string? 
            // Editor onSave typically passed the content.
            // Let's check Editor definition.
            // step 364: function Editor({ ... onSave: (content: string) => void ...
            // And inside Editor: onSave(JSON.stringify(json));
            // So content IS stringified JSON.
            // Context saveFile takes (handle, content: any).
            // Context.saveFile stringifies if needed?
            // FileSystemContext.tsx: await writable.write(JSON.stringify(content, null, 2));
            // So saveFile expects OBJECT.
            // Editor passes STRING.
            // So handleSave must PARSE string -> object.
            try {
                await saveFile(currentFile.handle, content);
            } catch (e) {
                console.error("Error saving file", e);
            }
        }
    }, [currentFile, saveFile]);


    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (currentFile && editedTitle.trim() && editedTitle !== currentFile.name.replace('.md', '')) {
            renameFile(currentFile.name, editedTitle.trim());
        }
    };

    const handleRename = () => {
        setIsEditingTitle(true);
        setIsMenuOpen(false);
    };

    const handleDelete = () => {
        if (currentFile) {
            setDeleteCandidate(currentFile.name);
            setIsMenuOpen(false);
        }
    };

    const confirmDelete = (dontAsk: boolean) => {
        if (deleteCandidate) {
            if (dontAsk) {
                localStorage.setItem('skipDeleteConfirm', 'true');
            }
            deleteFile(deleteCandidate);
            setDeleteCandidate(null);
        }
    };

    const cancelDelete = () => {
        setDeleteCandidate(null);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleBlur();
        }
    };

    if (!currentFile) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', position: 'relative' }}>
                {
                    showSidebarToggle && (
                        <div style={{ position: 'absolute', top: 16, left: 16 }}>
                            <button
                                onClick={toggleSidebar}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {isSidebarOpen ?
                                    <SidebarLeftCloseIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} /> :
                                    <SidebarLeftOpenIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                                }
                            </button>
                        </div>
                    )
                }
                <img
                    src={theme === 'dark' ? origamiDucklingsDark : origamiDucklings}
                    alt="Origami ducklings"
                    draggable={false}
                    style={{ height: '100px', marginBottom: '16px', pointerEvents: 'none', userSelect: 'none' }}
                />
                <p>Open a folder to get started</p>
                <button
                    onClick={openDirectory}
                    style={{
                        marginTop: '16px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Open Folder
                </button>
            </div >
        );
    }

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            position: 'relative'
        }}>
            {/* Top Bar */}
            <div className="top-bar">
                {showSidebarToggle && (
                    <button
                        onClick={toggleSidebar}
                        className="icon-btn"
                    >
                        {isSidebarOpen ?
                            <SidebarLeftCloseIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} /> :
                            <SidebarLeftOpenIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                        }
                    </button>
                )}

                <div style={{ flex: 1 }} />

                <button
                    onClick={onSearchClick}
                    className="icon-btn"
                    title="Search (Cmd+P)"
                >
                    <SearchIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                </button>

                {/* Calendar Button - Only show if current file is a daily note */}
                {currentFile && (
                    isDailyNote(currentFile.name) ||
                    /^\d{4}-\d{2}-\d{2}$/.test(currentFile.name.replace('.md', ''))
                ) && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setViewMode(viewMode === 'daily-list' ? 'editor' : 'daily-list')}
                                className="icon-btn"
                                title="All daily notes"
                            >
                                <CalendarDaysIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                            </button>

                            {/* showCalendar logic removed in favor of viewMode */}
                        </div>
                    )}

                {/* Options Menu */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="icon-btn"
                        title="Options"
                    >
                        <MoreVertical className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                    </button>

                    {isMenuOpen && (
                        <>
                            <div
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 999,
                                }}
                                onClick={() => setIsMenuOpen(false)}
                            />
                            <div className="dropdown-menu">
                                <div
                                    onClick={handleRename}
                                    className="dropdown-item"
                                >
                                    <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Rename</span>
                                </div>
                                <div
                                    onClick={() => {
                                        if (currentFile) {
                                            const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(currentFile.name);
                                            window.open(url, '_blank');
                                            setIsMenuOpen(false);
                                        }
                                    }}
                                    className="dropdown-item"
                                >
                                    <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Open in new tab</span>
                                </div>
                                <div
                                    onClick={() => {
                                        if (currentFile) {
                                            openNoteInPopup(currentFile.name);
                                            setIsMenuOpen(false);
                                        }
                                    }}
                                    className="dropdown-item"
                                >
                                    <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Open in new window</span>
                                </div>
                                <div
                                    onClick={handleDelete}
                                    className="dropdown-item danger"
                                >
                                    <DeleteIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Delete</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="editor-wrapper">
                {viewMode === 'daily-list' ? (
                     <div className="editor-container" style={{ width: '100%', maxWidth: '800px' }}>
                        <DailyNotesList onSelect={(file) => {
                            selectFile(file);
                            setViewMode('editor');
                        }} />
                    </div>
                ) : (
                <div className="editor-container">
                    <div style={{ padding: '0 40px' }}>
                        {isEditingTitle ? (
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                onKeyDown={handleTitleKeyDown}
                                autoFocus
                                className="note-title note-title-input"
                            />
                        ) : (
                            <h1
                                onClick={handleTitleClick}
                                className="note-title"
                                style={{ cursor: 'text' }}
                            >
                                {currentFile.name.replace('.md', '')}
                            </h1>
                        )}
                    </div>

                    <div 
                        className="editor-content-area"
                        onClick={(e) => {
                            if (!currentEditor) return;
                            
                            const target = e.target as HTMLElement;
                            // Check if click is on the background (editor container, wrapper, or scroller)
                            // But NOT on the content text itself (cm-content or its children)
                            const isContent = target.closest('.cm-content');
                            const isInteractive = target.closest('button, a, input, [role="button"]');
                            
                            if (!isContent && !isInteractive) {
                                e.preventDefault();
                                currentEditor.focus();
                                // Move cursor to end of document
                                const length = currentEditor.state.doc.length;
                                currentEditor.dispatch({ selection: { anchor: length } });
                            }
                        }}
                    >
                        <Editor
                            key={currentFile.name}
                            fileHandle={currentFile.handle}
                            onSave={handleSave}
                            onEditorReady={setCurrentEditor}
                            scrollToId={pendingScrollTarget} // Pass the target block ID
                            addBlockIdToFile={addBlockIdToFile}
                            onNavigate={(target) => {
                                // Target format: "PageName" or "PageName#^blockId" or "#^blockId" (internal)
                                const [pageName, blockId] = target.split('#');
                                
                                // Find the file
                                let targetFile;
                                if (!pageName) {
                                    targetFile = currentFile;
                                } else {
                                    targetFile = files.find(f => f.name === `${pageName}.md` || f.name === pageName);
                                }

                                if (targetFile) {
                                    setPendingScrollTarget(blockId ? blockId.replace('^', '') : null); // Store pending scroll
                                    selectFile(targetFile);
                                } else {
                                    console.warn("Target file not found:", pageName);
                                }
                            }}
                        />

                        <SmoothCursor editor={currentEditor} />
                    </div>
                </div>
                )}
            </div>


            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={!!deleteCandidate}
                fileName={deleteCandidate?.replace('.md', '') || ''}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />
        </div>
    );
}



export default function App() {
    // Check for browser support
    const isSupported = 'showDirectoryPicker' in window;

    const { theme, setTheme } = useTheme();

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Toggle Theme: Cmd/Ctrl + Shift + L
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                setTheme(theme === 'dark' ? 'default' : 'dark');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [theme, setTheme]);

    const isPopup = new URLSearchParams(window.location.search).get('mode') === 'popup';
    
    // Hooks must be called unconditionally
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
        if (isPopup) return false;
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        if (!isPopup) {
            localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
        }
    }, [isSidebarOpen, isPopup]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showUpdatePopup, setShowUpdatePopup] = useState(false);
    const [viewMode, setViewMode] = useState<'editor' | 'daily-list'>('editor');

    // Reset view mode when a file is selected via context
    // This requires us to know when currentFile changes, but we don't have direct access here 
    // unless we listen to it in MainContent or App.
    // However, MainContent consumes currentFile, so let's handle auto-switch there.

    // Check for updates
    useEffect(() => {
        if (isPopup) return;

        const lastSeenVersion = localStorage.getItem('lastSeenVersion');
        if (lastSeenVersion !== APP_VERSION) {
            // Delay slightly to let app load
            setTimeout(() => {
                setShowUpdatePopup(true);
            }, 1000);
        }
    }, [isPopup]);

    const closeUpdatePopup = () => {
        setShowUpdatePopup(false);
        localStorage.setItem('lastSeenVersion', APP_VERSION);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                setIsSettingsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);



    const toggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    const openSettings = () => {
        setIsSettingsOpen(true);
    };

    const closeSettings = () => {
        setIsSettingsOpen(false);
    };

    if (!isSupported) {
        return <BrowserNotSupported />;
    }

    return (
        <FileSystemProvider>
            <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                {!isPopup && <Sidebar isOpen={isSidebarOpen} onSettingsClick={openSettings} onViewModeChange={setViewMode} />}
                <MainContent 
                    isSidebarOpen={isSidebarOpen} 
                    toggleSidebar={toggleSidebar} 
                    showSidebarToggle={!isPopup} 
                    onSearchClick={() => setIsSearchOpen(true)}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
            </div>
            {!isPopup && <Settings isOpen={isSettingsOpen} onClose={closeSettings} />}
            {!isPopup && <UpdatePopup isOpen={showUpdatePopup} onClose={closeUpdatePopup} />}
            <FileSystemContext.Consumer>
                {(context) => (
                    <SearchModal
                        isOpen={isSearchOpen}
                        onClose={() => setIsSearchOpen(false)}
                        search={context?.search ?? (async () => [])}
                        onNavigate={(pageId) => {
                            // Check if it's an image
                            const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(pageId);
                            if (isImage) {
                                const markdown = `![](${pageId})`; // pageId is the full path/filename for images from search currently? 
                                // Search worker returns 'image-123.png' as ID, but let's verify.
                                // It sets id = entry.name. 
                                // So it's just 'image.png'.
                                // path should be `assets/image.png` if it's in assets folder?
                                // Context.saveAsset returns `assets/name`.
                                // Worker indexes `entry.name`.
                                // We should probably reconstruct `assets/${pageId}`.
                                const assetPath = `assets/${pageId}`;
                                const md = `![](${assetPath})`;
                                
                                navigator.clipboard.writeText(md).then(() => {
                                    // ideally show a toast
                                    alert(`Copied image markdown to clipboard: ${md}`);
                                });
                                setIsSearchOpen(false);
                                return;
                            }

                            const file = context?.files.find(f => f.name === `${pageId}.md` || f.name === pageId);
                            if (file) {
                                context?.selectFile(file);
                                // TODO: Handle block scroll (Requires stable block IDs in document)
                            }
                        }}
                    />
                )}
            </FileSystemContext.Consumer>
        </FileSystemProvider>
    );
}
