import './index.css'
import React, { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { format, isToday, isYesterday, isThisWeek, isThisYear, differenceInMinutes, parse } from 'date-fns';
import {
    Folder,
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
    MoreHorizontal,
    X
} from 'lucide-react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import StarterKit from '@tiptap/starter-kit';
import { Settings } from './components/Settings';

import { Backlink } from './editor/extensions/Backlink';
import { CollapsibleListItem } from './editor/extensions/CollapsibleListItem';
import { EmojiExtension, EmojiSuggestionOptions } from './editor/extensions/EmojiExtension';
import { SlashCommandExtension, SlashCommandOptions } from './editor/extensions/SlashCommandExtension';
import { AutoCloseExtension } from './editor/extensions/AutoCloseExtension';

import { DailyNotesCalendar } from './components/DailyNotesCalendar';
import Image from '@tiptap/extension-image';
import { SmoothCursor } from './components/SmoothCursor';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ImageNodeView } from './components/ImageNodeView';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { SearchModal } from './components/SearchModal';
import { searchItems, type SearchableItem } from './utils/searchIndex';
import { Virtuoso } from 'react-virtuoso';
import origamiDucklings from './assets/origami-ducklings.webp';
import origamiDucklingsDark from './assets/origami-ducklings-dark.webp';
import { useTheme } from './context/ThemeContext';
import { BrowserNotSupported } from './components/BrowserNotSupported';


import { FileSystemProvider, useFileSystem, FileSystemContext, type FileNode } from './context/FileSystemContext';
import { BacklinkNode } from './components/BacklinkNode';
import { UpdatePopup } from './components/UpdatePopup';
import { APP_VERSION } from './version';

// Editor Component starts here

// JSON-based Tiptap Editor Component
function Editor({ fileHandle, onSave, onEditorReady }: { fileHandle: FileSystemFileHandle; onSave: (content: string) => void; onEditorReady?: (editor: any) => void }) {
    const [isLoading, setIsLoading] = useState(true);
    const [initialContent, setInitialContent] = useState<any>(null);
    const saveTimeoutRef = useRef<any>(null);
    const editorRef = useRef<any>(null);
    const { files, selectFile, createNewNote } = useFileSystem();

    // Load JSON from file
    useEffect(() => {
        let mounted = true;
        const loadFile = async () => {
            try {
                setIsLoading(true);
                const file = await fileHandle.getFile();
                const text = await file.text();

                if (mounted) {
                    if (text.trim()) {
                        try {
                            const json = JSON.parse(text);

                            // Process JSON to convert [[text]] to backlink nodes
                            const processContent = (nodes: any[]): any[] => {
                                return nodes.map(node => {
                                    if (node.type === 'text' && node.text) {
                                        // Regex to find [[text]]
                                        const regex = /\[\[([^\]]+)\]\]/g;
                                        const parts = [];
                                        let lastIndex = 0;
                                        let match;

                                        while ((match = regex.exec(node.text)) !== null) {
                                            // Add preceding text
                                            if (match.index > lastIndex) {
                                                parts.push({
                                                    type: 'text',
                                                    text: node.text.substring(lastIndex, match.index)
                                                });
                                            }

                                            // Add backlink node
                                            parts.push({
                                                type: 'backlink',
                                                attrs: {
                                                    label: match[1],
                                                    pageId: match[1],
                                                    type: 'page'
                                                }
                                            });

                                            lastIndex = regex.lastIndex;
                                        }

                                        // Add remaining text
                                        if (lastIndex < node.text.length) {
                                            parts.push({
                                                type: 'text',
                                                text: node.text.substring(lastIndex)
                                            });
                                        }

                                        return parts.length > 0 ? parts : [node];
                                    }

                                    if (node.content) {
                                        return { ...node, content: processContent(node.content) };
                                    }

                                    return node;
                                }).flat();
                            };

                            if (json.content) {
                                json.content = processContent(json.content);
                            }

                            setInitialContent(json);
                        } catch (e) {
                            console.error('[Editor] Invalid JSON, starting fresh');
                            setInitialContent({
                                type: 'doc',
                                content: [{
                                    type: 'bulletList',
                                    content: [{
                                        type: 'listItem',
                                        content: [{ type: 'paragraph' }]
                                    }]
                                }]
                            });
                        }
                    } else {
                        setInitialContent({
                            type: 'doc',
                            content: [{
                                type: 'bulletList',
                                content: [{
                                    type: 'listItem',
                                    content: [{ type: 'paragraph' }]
                                }]
                            }]
                        });
                    }
                }
            } catch (err) {
                console.error('[Editor] Error loading:', err);
                if (mounted) {
                    setInitialContent({
                        type: 'doc',
                        content: [{
                            type: 'bulletList',
                            content: [{
                                type: 'listItem',
                                content: [{ type: 'paragraph' }]
                            }]
                        }]
                    });
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        loadFile();

        return () => {
            mounted = false;
        };
    }, [fileHandle]);

    // Initialize Tiptap editor - bullets only
    const editor = useEditor({
        extensions: [
            Document.extend({
                content: 'bulletList',
            }),
            StarterKit.configure({
                document: false,
                heading: false,
                blockquote: false,
                codeBlock: false,
                horizontalRule: false,
                listItem: false,
                bulletList: {
                    HTMLAttributes: {
                        class: 'block-bullet-list',
                    },
                },
            }),
            CollapsibleListItem,
            EmojiExtension.configure({
                suggestion: EmojiSuggestionOptions,
            }),
            SlashCommandExtension.configure({
                suggestion: SlashCommandOptions,
            }),
            Backlink.extend({
                addNodeView() {
                    return ReactNodeViewRenderer(BacklinkNode);
                },
            }).configure({
                HTMLAttributes: {
                    class: 'backlink',
                },
                renderLabel({ node }) {
                    return `[[${node.attrs.label || ''}]]`;
                },
                onNavigate: async (pageId: string) => {
                    const targetFile = files.find(f => f.name === `${pageId}.json` || f.name === pageId);

                    if (targetFile) {
                        selectFile(targetFile);
                    } else {
                        // Lazy creation: Create file if it doesn't exist
                        console.log(`[Backlink] Lazy creating note: ${pageId}`);
                        await createNewNote(pageId);
                        // createNewNote automatically sets the current file if successful
                    }
                },
                suggestion: {
                    char: '[',
                    allowSpaces: true,
                    command: async ({ editor, range, props }: { editor: any, range: any, props: any }) => {
                        const item = props as SearchableItem;

                        // Immediate creation for both phantom and create-new
                        if (item.type === 'phantom' && item.pageId) {
                            await createNewNote(item.pageId, false);
                        } else if (item.type === 'create-new' && item.query) {
                            await createNewNote(item.query, false);
                        }

                        const label = item.type === 'create-new' ? item.query : (item.type === 'phantom' ? item.pageId : item.title);
                        const pageId = item.type === 'create-new' ? item.query : item.pageId;

                        // Check for trailing ']' or ']]' after the range
                        // The range covers the trigger '[' and the query
                        let to = range.to;
                        const doc = editor.state.doc;
                        const nextChar = doc.textBetween(to, Math.min(to + 1, doc.content.size));
                        if (nextChar === ']') {
                            to += 1;
                            const nextNextChar = doc.textBetween(to, Math.min(to + 1, doc.content.size));
                            if (nextNextChar === ']') {
                                to += 1;
                            }
                        }

                        editor
                            .chain()
                            .focus()
                            .insertContentAt({ from: range.from, to: to }, [
                                {
                                    type: 'backlink',
                                    attrs: {
                                        id: item.type === 'block' ? item.id : undefined,
                                        label: label,
                                        type: item.type === 'block' ? 'block' : 'page',
                                        pageId: pageId,
                                    },
                                },
                                {
                                    type: 'text',
                                    text: ' ',
                                },
                            ])
                            .run();
                    },
                    items: ({ query }: { query: string }) => {
                        if (query.startsWith('[')) {
                            // Close if query contains a closing bracket (end of backlink)
                            if (query.includes(']')) {
                                return [];
                            }

                            const realQuery = query.substring(1);
                            const results = searchItems(realQuery);

                            // 1. If query is empty, return empty array (don't show recent files to avoid trapping Enter)
                            if (!realQuery.trim()) {
                                return [];
                            }

                            // 2. Check if exact match exists
                            const exactMatch = results.find(r => r.title.toLowerCase() === realQuery.toLowerCase() && r.type === 'page');

                            if (exactMatch) {
                                return results;
                            } else {
                                // 3. Prepend "Create new" option if query is valid
                                return [
                                    {
                                        type: 'create-new',
                                        id: `create-${realQuery}`,
                                        title: realQuery,
                                        pageName: '',
                                        lastModified: Date.now(),
                                        query: realQuery
                                    } as any,
                                    ...results
                                ];
                            }
                        }
                        return [];
                    },
                    render: () => {
                        let component: any;
                        let popup: any;
                        return {
                            onStart: async (props: any) => {
                                const { ReactRenderer } = await import('@tiptap/react');
                                const { BacklinkSuggestions } = await import('./components/BacklinkSuggestions');
                                const tippy = (await import('tippy.js')).default;
                                component = new ReactRenderer(BacklinkSuggestions, { props, editor: props.editor });
                                if (!props.clientRect) return;
                                popup = tippy('body', {
                                    getReferenceClientRect: props.clientRect,
                                    appendTo: () => document.body,
                                    content: component.element,
                                    showOnCreate: true,
                                    interactive: true,
                                    trigger: 'manual',
                                    placement: 'bottom-start',
                                });
                            },
                            onUpdate(props: any) {
                                component.updateProps(props);
                                if (!props.clientRect) return;

                                // Force hide if query contains closing bracket
                                if (props.query.includes(']')) {
                                    popup[0].hide();
                                    return;
                                }

                                popup[0].setProps({ getReferenceClientRect: props.clientRect });
                            },
                            onKeyDown(props: any) {
                                if (props.event.key === 'Escape') {
                                    popup[0].hide();
                                    return true;
                                }
                                return component.ref?.onKeyDown(props) ?? false;
                            },
                            onExit() {
                                popup[0].destroy();
                                component.destroy();
                            },
                        };
                    },
                },
            }),
            Image.configure({
                allowBase64: true,
                inline: true,
            }).extend({
                addNodeView() {
                    return ReactNodeViewRenderer(ImageNodeView)
                },
            }),
            AutoCloseExtension,
        ],
        content: initialContent,
        editorProps: {
            scrollThreshold: 40,
            scrollMargin: 40,
            attributes: {
                class: 'tiptap block-outliner',
            },
            handlePaste: (_view, event, _slice) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.indexOf('image') === 0);

                if (imageItem) {
                    event.preventDefault();
                    const file = imageItem.getAsFile();
                    if (!file) return false;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result;
                        if (typeof result === 'string' && editorRef.current) {
                            const editor = editorRef.current;
                            const { state } = editor;
                            const { selection } = state;
                            const { $from } = selection;

                            // Check if the current list item is empty
                            const isEmpty = $from.parent.content.size === 0;

                            // 1. Prepare space if needed
                            if (!isEmpty) {
                                editor.chain().splitListItem('listItem').run();
                            }

                            // 2. Insert image
                            editor.chain().insertContent({
                                type: 'image',
                                attrs: { src: result }
                            }).run();

                            // 3. Create new bullet after image (delayed for stability)
                            setTimeout(() => {
                                if (editor && !editor.isDestroyed) {
                                    editor.chain()
                                        .focus()
                                        .splitListItem('listItem')
                                        .run();
                                }
                            }, 50);
                        }
                    };
                    reader.readAsDataURL(file);
                    return true;
                }
                return false;
            },
            handleTextInput: (view) => {
                const { state } = view;
                const { selection } = state;
                const { $from } = selection;

                // Check if the current parent node has any image children
                let hasImage = false;
                $from.parent.forEach((node) => {
                    if (node.type.name === 'image') {
                        hasImage = true;
                    }
                });

                if (hasImage) {
                    return true; // Block input
                }
                return false; // Allow input
            },
        },
        onCreate: ({ editor }) => {
            editorRef.current = editor;
            if (onEditorReady) {
                onEditorReady(editor);
            }
        },
        onUpdate: ({ editor }) => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                try {
                    const json = editor.getJSON();
                    onSave(JSON.stringify(json, null, 2));
                } catch (err) {
                    console.error('[Editor] Error saving:', err);
                }
            }, 500);
        },
    }, [initialContent]);

    // Update editor content when file changes
    useEffect(() => {
        if (editor && !isLoading && initialContent) {
            editor.commands.setContent(initialContent);
            requestAnimationFrame(() => {
                if (!editor.isDestroyed) {
                    editor.commands.focus('end');
                }
            });
        }
    }, [editor, initialContent, isLoading]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            editor?.destroy();
        };
    }, [editor]);

    // Keyboard shortcuts for New Note
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Ctrl/Cmd + N
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isN = e.key.toLowerCase() === 'n';

            if (isCtrlOrCmd && isN) {
                // Handle Shift+Ctrl+N (New Window/Tab)
                if (e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();

                    const newNoteName = getNextQuackNoteName(files);

                    // Create note WITHOUT switching to it
                    createNewNote(newNoteName, false);

                    // Open in new window using defined format
                    openNoteInPopup(newNoteName);
                    return;
                }

                // Handle Ctrl+N (Current Window)
                // Critical: Stop browser from opening new window
                e.preventDefault();
                e.stopPropagation();

                const newNoteName = getNextQuackNoteName(files);
                createNewNote(newNoteName);
            }
        };

        // Attach to window with capture: true to intercept before browser
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [files, createNewNote]);

    if (isLoading) {
        return <div style={{ padding: '20px' }}>Loading...</div>;
    }

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <EditorContent editor={editor} />
        </div>
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



// Helper to get next Quack note name
function getNextQuackNoteName(files: any[]) {
    const baseName = 'Quack note';
    const baseExists = files.some(f => f.name === `${baseName}.json`);

    if (!baseExists) return baseName;

    const existingNumbers = files
        .map(f => {
            const match = f.name.match(/^Quack note (\d+)\.json$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .filter(n => n > 0);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${baseName} ${nextNumber}`;
}

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
    const nameWithoutExt = filename.replace('.json', '');
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
                                    {file.name.replace('.json', '')}
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
function Sidebar({ isOpen, onSettingsClick }: { isOpen: boolean; onSettingsClick: () => void }) {
    const { folderName, files, currentFile, rootHandle, openDirectory, selectFile, createNewNote, openDailyNoteManually, renameFile, deleteFile } = useFileSystem();
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const [editingFileId, setEditingFileId] = useState<string | null>(null);
    const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
    const [showCloseFolderConfirm, setShowCloseFolderConfirm] = useState(false);
    const [editValue, setEditValue] = useState('');

    const startEditing = (file: FileNode) => {
        setEditingFileId(file.name);
        setEditValue(file.name.replace('.json', ''));
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
        const newFileName = cleanName.endsWith('.json') ? cleanName : `${cleanName}.json`;

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
            <div className="sidebar-header" style={{ cursor: 'default', position: 'relative' }}>
                <Folder className="w-[18px] h-[18px]" style={{ width: '18px', height: '18px' }} />
                <span style={{ fontWeight: 500 }}>{folderName || 'No Folder'}</span>
                {rootHandle && (
                    <>
                        <button
                            onClick={() => setIsFolderMenuOpen(!isFolderMenuOpen)}
                            className="icon-btn"
                            style={{
                                marginLeft: 'auto',
                                padding: '4px',
                            }}
                            title="Folder options"
                        >
                            <MoreVertical className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        </button>
                        {isFolderMenuOpen && (
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
                                    onClick={() => setIsFolderMenuOpen(false)}
                                />
                                <div className="dropdown-menu" style={{ top: '100%', right: '8px', left: 'auto' }}>
                                    <div
                                        onClick={() => {
                                            openDirectory();
                                            setIsFolderMenuOpen(false);
                                        }}
                                        className="dropdown-item"
                                    >
                                        <Folder className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                        <span>Switch Folder</span>
                                    </div>
                                    <div
                                        onClick={() => {
                                            setShowCloseFolderConfirm(true);
                                            setIsFolderMenuOpen(false);
                                        }}
                                        className="dropdown-item"
                                        style={{ color: 'var(--danger-color, #ff4d4f)' }}
                                    >
                                        <X className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                        <span>Close Folder</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>



            {rootHandle && (
                <div style={{ padding: '8px' }}>
                    {/* Daily Notes Section */}
                    <div
                        onClick={openDailyNoteManually}
                        className={`sidebar-action-item ${isViewingDailyNote ? 'active' : ''}`}
                    >
                        <CalendarIcon className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                        <span>Daily Notes</span>
                    </div>
                    {/* New Note Button */}
                    <div
                        onClick={() => {
                            // Find next available note number
                            // Quack note logic: "Quack note", then "Quack note 1", "Quack note 2"...
                            const baseName = 'Quack note';

                            // Check if base exists
                            const baseExists = files.some(f => f.name === `${baseName}.json`);

                            if (!baseExists) {
                                createNewNote(baseName);
                            } else {
                                const existingNumbers = files
                                    .map(f => {
                                        const match = f.name.match(/^Quack note (\d+)\.json$/);
                                        return match ? parseInt(match[1], 10) : 0;
                                    })
                                    .filter(n => n > 0);

                                const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
                                createNewNote(`${baseName} ${nextNumber}`);
                            }
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
                            context={{ currentFile, selectFile, editingFileId, editValue, startEditing, submitRename, cancelRename, checkDelete }}
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
                fileName={deleteCandidate?.replace('.json', '') || ''}
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


function MainContent({ isSidebarOpen, toggleSidebar, showSidebarToggle = true, onSearchClick }: { isSidebarOpen: boolean; toggleSidebar: () => void; showSidebarToggle?: boolean; onSearchClick: () => void }) {
    const { currentFile, saveFile, files, openDateNote, deleteFile, renameFile, openDirectory } = useFileSystem();
    const { theme } = useTheme();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [currentEditor, setCurrentEditor] = useState<any>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Existing Note Dates for Calendar
    const existingNoteDates = files
        .map(f => {
            const name = f.name.replace('.json', '');
            if (/^\d{4}-\d{2}-\d{2}$/.test(name)) return name;

            // Try parsing "October 20th, 2025"
            try {
                if (/^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(name)) {
                    const parsedDate = parse(name, 'MMMM do, yyyy', new Date());
                    if (!isNaN(parsedDate.getTime())) {
                        return format(parsedDate, 'yyyy-MM-dd');
                    }
                }
            } catch (e) {
                // invalid date
            }
            return null;
        })
        .filter(Boolean) as string[];

    useEffect(() => {
        if (currentFile) {
            setEditedTitle(currentFile.name.replace('.json', ''));
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
                await saveFile(currentFile.handle, JSON.parse(content));
            } catch (e) {
                console.error("Error saving parsing JSON", e);
            }
        }
    }, [currentFile, saveFile]);


    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (currentFile && editedTitle.trim() && editedTitle !== currentFile.name.replace('.json', '')) {
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
                    /^\d{4}-\d{2}-\d{2}$/.test(currentFile.name.replace('.json', ''))
                ) && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowCalendar(!showCalendar)}
                                className="icon-btn"
                                title="Daily notes calendar"
                            >
                                <CalendarDaysIcon className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
                            </button>

                            {showCalendar && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '8px',
                                        zIndex: 1000,
                                    }}
                                >
                                    <DailyNotesCalendar
                                        onDateSelect={openDateNote}
                                        existingNoteDates={new Set(existingNoteDates)}
                                        onClose={() => setShowCalendar(false)}
                                    />
                                </div>
                            )}
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

            {/* Note Content */}
            <div className="editor-wrapper">
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
                                {currentFile.name.replace('.json', '')}
                            </h1>
                        )}
                    </div>

                    <div className="editor-content-area">
                        <Editor
                            key={currentFile.name}
                            fileHandle={currentFile.handle}
                            onSave={handleSave}
                            onEditorReady={setCurrentEditor}
                        />

                        <SmoothCursor editor={currentEditor} />
                    </div>
                </div>
            </div>


            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={!!deleteCandidate}
                fileName={deleteCandidate?.replace('.json', '') || ''}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />
        </div>
    );
}



export default function App() {
    // Check for browser support
    const isSupported = 'showDirectoryPicker' in window;

    if (!isSupported) {
        return <BrowserNotSupported />;
    }

    const isPopup = new URLSearchParams(window.location.search).get('mode') === 'popup';

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

    return (
        <FileSystemProvider>
            <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                {!isPopup && <Sidebar isOpen={isSidebarOpen} onSettingsClick={openSettings} />}
                <MainContent isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} showSidebarToggle={!isPopup} onSearchClick={() => setIsSearchOpen(true)} />
            </div>
            {!isPopup && <Settings isOpen={isSettingsOpen} onClose={closeSettings} />}
            {!isPopup && <UpdatePopup isOpen={showUpdatePopup} onClose={closeUpdatePopup} />}
            <FileSystemContext.Consumer>
                {(context) => (
                    <SearchModal
                        isOpen={isSearchOpen}
                        onClose={() => setIsSearchOpen(false)}
                        search={context?.search ?? (async () => [])}
                        onNavigate={(pageId, _blockId) => {
                            const file = context?.files.find(f => f.name === `${pageId}.json` || f.name === pageId);
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
