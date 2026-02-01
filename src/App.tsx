import './index.css'
import React, { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisYear, differenceInMinutes } from 'date-fns';
import {
    Settings as SettingsIcon,
    Calendar as CalendarIcon,
    Search as SearchIcon,
    DiamondPlus,
    PanelLeftClose as SidebarLeftCloseIcon,
    PanelLeftOpen as SidebarLeftOpenIcon,
    Trash2 as DeleteIcon,
    Pencil as CopyIcon,
    ExternalLink as NewTabIcon,
    AppWindow as NewWindowIcon,
    MoreHorizontal,
    FileText,
    Network,
    Pencil as EditIcon
} from 'lucide-react';
import { CodeMirrorEditor } from './components/editor/CodeMirrorEditor';
import { Settings } from './components/Settings';
import { SmoothCursor } from './components/SmoothCursor';
import { SidebarTags } from './components/SidebarTags';
import { GraphView } from './components/GraphView';
import { LibraryView } from './components/LibraryView';
import { useTags } from './hooks/useTags';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { SearchModal } from './components/SearchModal';
import { Virtuoso } from 'react-virtuoso';
import origamiDucklings from './assets/origami-ducklings.webp';
import origamiDucklingsDark from './assets/origami-ducklings-dark.webp';
import { useTheme } from './context/ThemeContext';
import { BrowserNotSupported } from './components/BrowserNotSupported';
import { FileSystemProvider, useFileSystem, type FileNode } from './context/FileSystemContext';
import { UpdatePopup } from './components/UpdatePopup';
import { APP_VERSION } from './version';
import { DailyNotesCalendar } from './components/DailyNotesCalendar';
import { SmoothInputCursor } from './components/SmoothInputCursor';

// Editor Component
function Editor({ fileHandle, onSave, onEditorReady, onNavigate, scrollToId, addBlockIdToFile }: { fileHandle: FileSystemFileHandle; onSave: (content: string) => void; onEditorReady?: (editor: any) => void; onNavigate: (target: string) => void; scrollToId?: string | null; addBlockIdToFile?: (filename: string, blockText: string) => Promise<string | null> }) {
    const [isLoading, setIsLoading] = useState(true);
    const [content, setContent] = useState('');
    const saveTimeoutRef = useRef<any>(null);

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

// Inline Rename Input
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

    useEffect(() => {
        if (inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 10);
        }
    }, []);

    const handleSubmit = async () => {
        setError(null);
        const err = await onSubmit(value);
        if (err) {
            setError(err);
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
                    if (error) setError(null);
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => handleSubmit()}
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
                </div>
            )}
        </div>
    );
};

// Helpers
function openNoteInPopup(filename: string) {
    const url = window.location.origin + window.location.pathname + '?mode=popup#' + encodeURIComponent(filename);
    const width = 640;
    const height = window.screen.height * 0.85;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(url, '_blank', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
}

function getPreviewText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
        return node.content.map(getPreviewText).join(' ');
    }
    return '';
}

function isDailyNote(filename: string): boolean {
    const nameWithoutExt = filename.replace('.md', '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(nameWithoutExt)) return true;
    return /^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(nameWithoutExt);
}

// Sidebar Item
const SidebarItem = React.memo(({ file, context }: { file: FileNode; context: any }) => {
    const { currentFile, selectFile, editingFileId, editValue, startEditing, submitRename, cancelRename, checkDelete } = context;
    const [preview, setPreview] = useState<string>('');
    const [ignored, forceUpdate] = useReducer(x => x + 1, 0);

    useEffect(() => {
        let active = true;
        const fetchPreview = async () => {
            try {
                const f = await file.handle.getFile();
                const text = await f.text();
                if (!active) return;
                try {
                    const json = JSON.parse(text);
                    const str = getPreviewText(json);
                    setPreview(str.slice(0, 200));
                } catch {
                    setPreview(text.slice(0, 200));
                }
            } catch (e) {
                // ignore
            }
        };
        fetchPreview();
        return () => { active = false; };
    }, [file.handle, file.lastModified]);

    useEffect(() => {
        const diff = Date.now() - (file.lastModified || Date.now());
        if (diff < 3600000) {
            const interval = setInterval(forceUpdate, 60000);
            return () => clearInterval(interval);
        }
    }, [file.lastModified]);

    const dateStr = useMemo(() => {
        const now = Date.now();
        const modified = file.lastModified || now;
        const date = new Date(modified);
        const diffMins = differenceInMinutes(now, date);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (isToday(date)) return format(date, 'h:mm a');
        if (isYesterday(date)) return 'Yesterday';
        if (isThisWeek(date)) return format(date, 'EEEE');
        if (isThisYear(date)) return format(date, 'd MMM');
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
                        <div className="sidebar-more-trigger" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button className="icon-btn" style={{ padding: '2px', width: '24px', height: '24px', opacity: 0.6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--sidebar-text)' }}>
                                        <MoreHorizontal className="w-4 h-4" />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content style={{ minWidth: '160px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid var(--sidebar-border)', zIndex: 1000 }} align="end">
                                        <DropdownMenu.Item onClick={() => startEditing(file)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                                            <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Rename</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item onClick={() => { const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(file.name); window.open(url, '_blank'); }} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                                            <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Open in new tab</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item onClick={() => openNoteInPopup(file.name)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                                            <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                            <span>Open in new window</span>
                                        </DropdownMenu.Item>
                                        <DropdownMenu.Item onClick={() => checkDelete(file)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--danger-color, #ff4d4f)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
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
            <ContextMenu.Content style={{ minWidth: '160px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', border: '1px solid var(--sidebar-border)', zIndex: 1000 }}>
                <ContextMenu.Item onClick={() => startEditing(file)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                    <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Rename</span>
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => { const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(file.name); window.open(url, '_blank'); }} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                    <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Open in new tab</span>
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => openNoteInPopup(file.name)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                    <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Open in new window</span>
                </ContextMenu.Item>
                <ContextMenu.Item onClick={() => checkDelete(file)} style={{ padding: '6px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', color: 'var(--danger-color, #ff4d4f)', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} className="context-menu-item">
                    <DeleteIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Delete</span>
                </ContextMenu.Item>
            </ContextMenu.Content>
        </ContextMenu.Root>
    );
});

// Sidebar
function Sidebar({ isOpen, onViewModeChange, viewMode, onSettingsClick, onSearchClick }: { isOpen: boolean; onViewModeChange: (mode: 'editor' | 'library' | 'graph', initialLibraryTab?: 'notes' | 'daily' | 'tags' | 'links') => void; viewMode: 'editor' | 'library' | 'graph'; onSettingsClick: () => void; onSearchClick: () => void }) {
    const { folderName, files, currentFile, rootHandle, createNewNote, selectFile, openDailyNoteManually, renameFile, deleteFile } = useFileSystem();
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [showCloseFolderConfirm, setShowCloseFolderConfirm] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [activeTab, setActiveTab] = useState<'notes' | 'tags'>('notes');
    const { tagsMap } = useTags();

    const isTodayActive = useMemo(() => {
        if (viewMode !== 'editor' || !currentFile) return false;
        const todayStr = format(new Date(), 'MMMM do, yyyy') + '.md';
        return currentFile.name === todayStr;
    }, [currentFile, viewMode]);

    const regularNotes = useMemo(() => files.filter(file => !isDailyNote(file.name)), [files]);
    const notesCount = regularNotes.length;
    const tagsCount = tagsMap.size;

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
        if (newFileName === editingFileId) {
            cancelRename();
            return;
        }
        const exists = files.some(f => f.name.toLowerCase() === newFileName.toLowerCase());
        if (exists) return "This name already exists";
        await renameFile(editingFileId, newFileName);
        cancelRename();
        return;
    };

    const checkDelete = (file: FileNode) => {
        const skipConfirm = localStorage.getItem('skipDeleteConfirm') === 'true';
        if (skipConfirm) {
            deleteFile(file.name);
        } else {
            setDeleteCandidate(file.name);
        }
    };

    const confirmDelete = (dontAsk: boolean) => {
        if (deleteCandidate) {
            if (dontAsk) localStorage.setItem('skipDeleteConfirm', 'true');
            deleteFile(deleteCandidate);
            setDeleteCandidate(null);
        }
    };

    const cancelDelete = () => setDeleteCandidate(null);

    return (
        <div className={`sidebar-container ${isOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-content">
                <div className="sidebar-actions">
                    <div onClick={() => {
                        const baseName = 'Quack note';
                        const baseExists = files.some(f => f.name === `${baseName}.md`);
                        if (!baseExists) {
                            createNewNote(baseName);
                        } else {
                             const existingNumbers = files.map(f => {
                                const match = f.name.match(/^Quack note (\d+)\.md$/);
                                return match ? parseInt(match[1], 10) : 0;
                            }).filter(n => n > 0);
                            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
                            createNewNote(`${baseName} ${nextNumber}`);
                        }
                        onViewModeChange('editor');
                    }} className="sidebar-action-item" style={{ color: 'var(--primary-color)' }}>
                        <DiamondPlus className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span style={{ fontWeight: 600 }}>Add new note</span>
                    </div>
                    <div onClick={onSearchClick} className="sidebar-action-item">
                        <SearchIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Search</span>
                    </div>
                    <div onClick={() => { openDailyNoteManually(); onViewModeChange('editor'); }} className={`sidebar-action-item ${isTodayActive ? 'active' : ''}`}>
                        <CalendarIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Today</span>
                    </div>
                    <div onClick={() => onViewModeChange('library', 'notes')} className={`sidebar-action-item ${viewMode === 'library' ? 'active' : ''}`}>
                         <FileText className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Library</span>
                    </div>
                     <div onClick={() => onViewModeChange('graph')} className={`sidebar-action-item ${viewMode === 'graph' ? 'active' : ''}`}>
                        <Network className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Graph View</span>
                    </div>
                </div>

                {rootHandle && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', padding: '0 8px', marginBottom: '8px' }}>
                            <div onClick={() => setActiveTab('notes')} style={{ padding: '8px 12px', fontSize: '0.75em', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', color: activeTab === 'notes' ? 'var(--primary-color)' : 'var(--sidebar-text-muted)', transition: 'all 0.2s' }}>
                                NOTES ({notesCount})
                            </div>
                            <div onClick={() => setActiveTab('tags')} style={{ padding: '8px 12px', fontSize: '0.75em', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', color: activeTab === 'tags' ? 'var(--primary-color)' : 'var(--sidebar-text-muted)', transition: 'all 0.2s' }}>
                                TAGS ({tagsCount})
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            {activeTab === 'notes' ? (
                                <Virtuoso
                                    className="no-scrollbar"
                                    style={{ height: '100%' }}
                                    data={regularNotes}
                                    context={{ currentFile, selectFile, editingFileId, editValue, startEditing, submitRename, cancelRename, checkDelete }}
                                    itemContent={(_index, file, context) => <SidebarItem file={file} context={context} />}
                                />
                            ) : (
                                <SidebarTags onTagClick={() => onViewModeChange('library', 'tags')} />
                            )}
                        </div>
                    </div>
                )}
                 {!rootHandle && <div style={{ flex: 1 }} />}
                 <div onClick={onSettingsClick} className="sidebar-settings-item">
                    <SettingsIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    <span>Settings</span>
                    <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.6, border: '1px solid var(--sidebar-border)', padding: '2px 4px', borderRadius: '4px' }}>⌘ ,</span>
                </div>
                <DeleteConfirmDialog isOpen={!!deleteCandidate} fileName={deleteCandidate?.replace('.md', '') || ''} onConfirm={confirmDelete} onCancel={cancelDelete} />
                <DeleteConfirmDialog isOpen={showCloseFolderConfirm} fileName={folderName || 'folder'} title="Close Folder" message={`Are you sure you want to close <strong style="color: var(--text-primary)">${folderName || 'this folder'}</strong>? Any unsaved changes will be lost.`} confirmButtonText="Close Folder" showDontAskAgain={false} onConfirm={async () => {
                    try {
                        const db = await window.indexedDB.open('ThinkDuckDB', 1);
                        db.onsuccess = () => {
                            const tx = db.result.transaction('folders', 'readwrite');
                            tx.objectStore('folders').delete('lastFolder');
                            tx.oncomplete = () => window.location.reload();
                        };
                    } catch (e) {
                         window.location.reload();
                    }
                    setShowCloseFolderConfirm(false);
                }} onCancel={() => setShowCloseFolderConfirm(false)} />
            </div>
        </div>
    );
}

// Main Content
function MainContent({ isSidebarOpen, toggleSidebar, showSidebarToggle = true, viewMode, setViewMode, libraryTab }: { isSidebarOpen: boolean; toggleSidebar: () => void; showSidebarToggle?: boolean; viewMode: 'editor' | 'library' | 'graph'; setViewMode: (mode: 'editor' | 'library' | 'graph') => void; libraryTab: 'notes' | 'daily' | 'tags' | 'links' }) {
    const { currentFile, saveFile, selectFile, files, openDirectory, addBlockIdToFile, renameFile, deleteFile, openDateNote } = useFileSystem();
    const { theme } = useTheme();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [currentEditor, setCurrentEditor] = useState<any>(null);
    const [hideUnconnectedGraphNodes, setHideUnconnectedGraphNodes] = useState(false);
    const [isGraphMenuOpen, setIsGraphMenuOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const existingNoteDates = useMemo(() => {
        const dates = new Set<string>();
        files.forEach(f => {
            if (isDailyNote(f.name)) {
                // Parse date from file
                // Try helper from DailyNotesList first, but we don't have it exported.
                // Re-implement simplified parsing logic for now:
                const name = f.name.replace('.md', '');
                let dateStr = null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
                    dateStr = name; // Already YYYY-MM-DD
                } else if (/^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(name)) { // MMMM do, yyyy
                    try {
                        // Better use date-fns parse if we can reuse the pattern
                        // Actually let's just use what date-fns format gives us for "MMMM do, yyyy"
                        // Or rely on the Date constructor if standard enough.
                        // Safe approach: import parse from date-fns
                        // For simplicity in this diff, let's try assuming standard Date parser works on "Month Day, Year" if we strip 'st','nd'...
                        const cleanDate = name.replace(/(\d+)(st|nd|rd|th),/, '$1,');
                        const d = new Date(cleanDate);
                        if (!isNaN(d.getTime())) {
                             dateStr = format(d, 'yyyy-MM-dd');
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                
                if (dateStr) {
                    dates.add(dateStr);
                }
            }
        });
        return dates;
    }, [files]);

    useEffect(() => {
        if (currentFile) {
            setEditedTitle(currentFile.name.replace('.md', ''));
        }
    }, [currentFile]);

    const handleTitleClick = () => {
        setIsEditingTitle(true);
        setTimeout(() => {
            titleInputRef.current?.focus();
            // Move cursor to end
            const length = titleInputRef.current?.value.length || 0;
            titleInputRef.current?.setSelectionRange(length, length);
        }, 0);
    };

    const handleSave = useCallback(async (content: string) => {
        if (currentFile) {
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
            if (dontAsk) localStorage.setItem('skipDeleteConfirm', 'true');
            deleteFile(deleteCandidate);
            setDeleteCandidate(null);
        }
    };

    const cancelDelete = () => setDeleteCandidate(null);
    const handleTitleKeyDown = (e: React.KeyboardEvent) => { 
        if (e.key === 'Enter') {
            handleTitleBlur();
            // Try to focus back to editor
            if (currentEditor && !currentEditor.isDestroyed) {
                currentEditor.focus();
            }
        }
    };

    if (!currentFile) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', position: 'relative' }}>
                {showSidebarToggle && (
                    <div style={{ position: 'absolute', top: 16, left: 16 }}>
                        <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                            {isSidebarOpen ? <SidebarLeftCloseIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} /> : <SidebarLeftOpenIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />}
                        </button>
                    </div>
                )}
                <img src={theme === 'dark' ? origamiDucklingsDark : origamiDucklings} alt="Origami ducklings" draggable={false} style={{ height: '100px', marginBottom: '16px', pointerEvents: 'none', userSelect: 'none' }} />
                <p>Open a folder to get started</p>
                <button onClick={openDirectory} style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Open Folder</button>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', position: 'relative' }}>
            <div className="top-bar">
                {showSidebarToggle && (
                    <button onClick={toggleSidebar} className="icon-btn">
                        {isSidebarOpen ? <SidebarLeftCloseIcon className="w-5 h-5" style={{ width: '18px', height: '18px' }} /> : <SidebarLeftOpenIcon className="w-5 h-5" style={{ width: '18px', height: '18px' }} />}
                    </button>
                )}
                <div style={{ flex: 1 }} />
                {currentFile && isDailyNote(currentFile.name) && (
                    <DropdownMenu.Root open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <DropdownMenu.Trigger asChild>
                            <button className="icon-btn" title="Calendar">
                                <CalendarIcon className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
                            </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content align="end" sideOffset={5} style={{ zIndex: 1000 }}>
                                <DailyNotesCalendar 
                                    onDateSelect={(dateStr) => {
                                        openDateNote(dateStr);
                                        setIsCalendarOpen(false);
                                    }}
                                    existingNoteDates={existingNoteDates}
                                    onClose={() => setIsCalendarOpen(false)}
                                />
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}
                {viewMode === 'graph' && (
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setIsGraphMenuOpen(!isGraphMenuOpen)} className={`icon-btn ${isGraphMenuOpen ? 'active' : ''}`} title="Graph Settings">
                            <EditIcon className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
                        </button>
                        {isGraphMenuOpen && (
                            <>
                                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setIsGraphMenuOpen(false)} />
                                <div className="dropdown-menu">
                                    <div onClick={() => setHideUnconnectedGraphNodes(!hideUnconnectedGraphNodes)} className="dropdown-item" style={{ justifyContent: 'space-between' }}>
                                        <span>Hide unconnected nodes</span>
                                        <div className={`checkbox ${hideUnconnectedGraphNodes ? 'checked' : ''}`} style={{ width: '16px', height: '16px', border: '1px solid var(--text-secondary)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hideUnconnectedGraphNodes ? 'var(--primary-color)' : 'transparent', borderColor: hideUnconnectedGraphNodes ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                                            {hideUnconnectedGraphNodes && <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '1px' }} />}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
                <div style={{ position: 'relative' }}>
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="icon-btn" title="Options">
                        <MoreHorizontal className="w-5 h-5" style={{ width: '18px', height: '18px' }} />
                    </button>
                    {isMenuOpen && (
                        <>
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setIsMenuOpen(false)} />
                            <div className="dropdown-menu">
                                <div onClick={handleRename} className="dropdown-item">
                                    <CopyIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Rename</span>
                                </div>
                                <div onClick={() => { if (currentFile) { const url = window.location.origin + window.location.pathname + '#' + encodeURIComponent(currentFile.name); window.open(url, '_blank'); setIsMenuOpen(false); } }} className="dropdown-item">
                                    <NewTabIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Open in new tab</span>
                                </div>
                                <div onClick={() => { if (currentFile) { openNoteInPopup(currentFile.name); setIsMenuOpen(false); } }} className="dropdown-item">
                                    <NewWindowIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Open in new window</span>
                                </div>
                                <div onClick={handleDelete} className="dropdown-item danger">
                                    <DeleteIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                    <span>Delete</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="editor-wrapper">
                {viewMode === 'library' ? (
                <div className="editor-container" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                    <LibraryView 
                        initialTab={libraryTab}
                        onSelectFile={(file) => {
                             selectFile(file);
                             setViewMode('editor');
                        }}
                    />
                </div>
            ) : viewMode === 'graph' ? (
                     <div className="editor-container" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                        <GraphView 
                            onNodeClick={(nodeId) => {
                                const fileName = `${nodeId}.md`;
                                const file = files.find(f => f.name === fileName);
                                if (file) {
                                    selectFile(file);
                                    setViewMode('editor');
                                }
                            }} 
                            hideUnconnected={hideUnconnectedGraphNodes}
                        />
                    </div>
                ) : (
                <div className="editor-container">
                    <div style={{ padding: '0 40px' }}>
                        {isEditingTitle ? (
                            <>
                                <input ref={titleInputRef} type="text" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} onBlur={handleTitleBlur} onKeyDown={handleTitleKeyDown} autoFocus className="note-title note-title-input" />
                                <SmoothInputCursor inputRef={titleInputRef} />
                            </>
                        ) : (
                            <h1 onClick={handleTitleClick} className="note-title" style={{ cursor: 'text' }}>{currentFile.name.replace('.md', '')}</h1>
                        )}
                    </div>
                    <div className="editor-content-area" onClick={(e) => {
                        if (!currentEditor) return;
                        const target = e.target as HTMLElement;
                        const isContent = target.closest('.cm-content');
                        const isInteractive = target.closest('button, a, input, [role="button"]');
                        if (!isContent && !isInteractive) {
                            e.preventDefault();
                            currentEditor.focus();
                            const length = currentEditor.state.doc.length;
                            currentEditor.dispatch({ selection: { anchor: length } });
                        }
                    }}>
                        <Editor key={currentFile.name} fileHandle={currentFile.handle} onSave={handleSave} onEditorReady={setCurrentEditor} scrollToId={pendingScrollTarget} addBlockIdToFile={addBlockIdToFile} onNavigate={(target) => {
                            const [pageName, blockId] = target.split('#');
                            const targetFile = !pageName ? currentFile : files.find(f => f.name === `${pageName}.md` || f.name === pageName);
                            if (targetFile) {
                                setPendingScrollTarget(blockId ? blockId.replace('^', '') : null);
                                selectFile(targetFile);
                            } else {
                                console.warn("Target file not found:", pageName);
                            }
                        }} />
                        <SmoothCursor editor={currentEditor} />
                    </div>
                </div>
                )}
            </div>
            <DeleteConfirmDialog isOpen={!!deleteCandidate} fileName={deleteCandidate?.replace('.md', '') || ''} onConfirm={confirmDelete} onCancel={cancelDelete} />
        </div>
    );
}

// App Content
function AppContent({ isPopup, showUpdatePopup, closeUpdatePopup }: { isPopup: boolean; showUpdatePopup: boolean; closeUpdatePopup: () => void }) {
    // Hooks
    const { files, selectFile, search } = useFileSystem();
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
        if (isPopup) return false;
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'editor' | 'library' | 'graph'>('editor');
    const [libraryTab, setLibraryTab] = useState<'notes' | 'daily' | 'tags' | 'links'>('notes');

    useEffect(() => {
        if (!isPopup) localStorage.setItem('sidebarOpen', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen, isPopup]);

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

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const openSettings = () => setIsSettingsOpen(true);
    const closeSettings = () => setIsSettingsOpen(false);

    return (
        <>
            <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                {!isPopup && (
                    <Sidebar 
                        isOpen={isSidebarOpen} 
                        onSettingsClick={openSettings}
                        onViewModeChange={(mode, tab) => {
                            setViewMode(mode);
                            if (tab) setLibraryTab(tab);
                        }} 
                        viewMode={viewMode}
                        onSearchClick={() => setIsSearchOpen(true)}
                    />
                )}
                <MainContent 
                    isSidebarOpen={isSidebarOpen} 
                    toggleSidebar={toggleSidebar} 
                    showSidebarToggle={!isPopup} 
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    libraryTab={libraryTab}
                />
            </div>
            {!isPopup && <Settings isOpen={isSettingsOpen} onClose={closeSettings} />}
            {!isPopup && <UpdatePopup isOpen={showUpdatePopup} onClose={closeUpdatePopup} />}
            
            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                search={search ?? (async () => [])}
                onNavigate={(pageId) => {
                     const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(pageId);
                    if (isImage) {
                        const assetPath = `assets/${pageId}`;
                        const md = `![](${assetPath})`;
                        navigator.clipboard.writeText(md).then(() => {
                            alert(`Copied image markdown to clipboard: ${md}`);
                        });
                        setIsSearchOpen(false);
                        return;
                    }
                    const file = files.find(f => f.name === `${pageId}.md` || f.name === pageId);
                    if (file) {
                        selectFile(file);
                    }
                }}
            />
        </>
    );
}

export default function App() {
    const isSupported = 'showDirectoryPicker' in window;
    const { theme, setTheme } = useTheme();
    const isPopup = new URLSearchParams(window.location.search).get('mode') === 'popup';
    const [showUpdatePopup, setShowUpdatePopup] = useState(false);

    useEffect(() => {
        if (isPopup) return;
        const lastSeenVersion = localStorage.getItem('lastSeenVersion');
        if (lastSeenVersion !== APP_VERSION) {
            setTimeout(() => {
                setShowUpdatePopup(true);
            }, 1000);
        }
    }, [isPopup]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                setTheme(theme === 'dark' ? 'default' : 'dark');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [theme, setTheme]);

    const closeUpdatePopup = () => {
        setShowUpdatePopup(false);
        localStorage.setItem('lastSeenVersion', APP_VERSION);
    };

    if (!isSupported) return <BrowserNotSupported />;

    return (
        <FileSystemProvider>
             <AppContent isPopup={isPopup} showUpdatePopup={showUpdatePopup} closeUpdatePopup={closeUpdatePopup} />
        </FileSystemProvider>
    );
}
