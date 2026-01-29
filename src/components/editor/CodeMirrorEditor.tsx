import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, Decoration, type DecorationSet, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { Range, Prec, Facet, StateField } from '@codemirror/state';
import { syntaxTree, indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { useFileSystem } from '../../context/FileSystemContext';
import { CodeMirrorSmoothCursor } from './CodeMirrorSmoothCursor';
import { suggestionExtension, type SuggestionEventDetail } from './extensions/SuggestionExtension';
import { SlashCommandsList, type SlashCommandItem, type SlashCommandsListHandle } from '../SlashCommandsList';
import { EmojiSuggestions, type EmojiSuggestionsHandle } from '../EmojiSuggestions';
import { BacklinkSuggestions, type BacklinkSuggestionsHandle } from '../BacklinkSuggestions';
import { wikiLinkPlugin } from './extensions/WikiLinkPlugin';
import blockIdPlugin, { blockIdKeymap } from "./extensions/BlockIdPlugin";
import { bulletListPlugin } from './extensions/BulletListPlugin';
import { listGuidesPlugin } from './extensions/ListGuidesPlugin';
import { searchEmojis, type EmojiItem } from '../../utils/emojiData';
import { searchItems } from '../../utils/searchIndex';
import { List, CheckSquare, Heading1, Heading2, Quote } from 'lucide-react';

// --- Theme ---
const editorTheme = EditorView.theme({
    "&": {
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        height: "100%",
        fontSize: "var(--editor-font-size)",
    },
    "&.cm-focused": {
        outline: "none",
    },
    ".cm-scroller": {
        padding: "0",
    },
    ".cm-content": {
        fontFamily: "var(--font-family)",
        padding: "0",
        maxWidth: "900px", 
        margin: "0 auto",
    },
    ".cm-line": {
        padding: "0",
    },
    // Styles moved to src/index.css for easier global overriding
});

// --- Image Handling Helpers ---

const imageResolver = Facet.define<(path: string) => Promise<string | null>, (path: string) => Promise<string | null>>({
    combine: values => values[0]
});

class ImageBlockWidget extends WidgetType {
    private src: string;
    private resolver: (path: string) => Promise<string | null>;

    constructor(src: string, resolver: (path: string) => Promise<string | null>) { 
        super(); 
        this.src = src;
        this.resolver = resolver;
    }

    eq(other: ImageBlockWidget) { return other.src === this.src }

    toDOM(view: EditorView) {
        const div = document.createElement("div");
        div.className = "cm-image-container";
        // Prevent cursor placement inside
        div.contentEditable = "false";
        
        const img = document.createElement("img");
        img.className = "cm-image-widget";
        img.style.display = "none";
        img.style.maxWidth = "100%";
        // img.style.maxHeight = "400px"; // Optional constraint

        this.resolver(this.src).then(url => {
            if (url) {
                img.src = url;
                img.style.display = "block";
                img.onload = () => view.requestMeasure();
            }
        });
        
        div.appendChild(img);
        return div;
    }
}

class ImageInlineWidget extends WidgetType {
    private src: string;
    private resolver: (path: string) => Promise<string | null>;
    private alt: string;

    constructor(src: string, resolver: (path: string) => Promise<string | null>, alt: string) { 
        super();
        this.src = src;
        this.resolver = resolver;
        this.alt = alt;
    }

    eq(other: ImageInlineWidget) { return other.src === this.src && other.alt === this.alt }

    toDOM(view: EditorView) {
        const img = document.createElement("img");
        img.className = "cm-image-inline-widget";
        img.alt = this.alt;
        img.style.display = "none";
        
        this.resolver(this.src).then(url => {
            if (url) {
                img.src = url;
                img.style.display = "inline-block";
                 // Limit inline height to line height roughly or a bit more?
                img.style.height = "1.5em"; 
                img.onload = () => view.requestMeasure();
            }
        });
        return img;
    }
}


// --- Live Preview Plugins ---

const imageDecorationsField = StateField.define<DecorationSet>({
    create(state) {
        return getImageDecorations(state);
    },
    update(decorations, tr) {
        if (tr.docChanged || tr.selection) {
            return getImageDecorations(tr.state);
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

function getImageDecorations(state: EditorState) {
    const decorations: Range<Decoration>[] = [];
    const selectionInfo = state.selection.main;

    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.name === "Image") {
                const text = state.sliceDoc(node.from, node.to);
                const match = text.match(/!\[(.*?)\]\((.*?)\)/);
                if (match) {
                    const alt = match[1];
                    const src = match[2];
                    const line = state.doc.lineAt(node.from);
                    const lineText = line.text;
                    const isStandalone = lineText.trim() === text;
                    const resolver = state.facet(imageResolver);

                    // Check if cursor is on this line
                    const isCursorOnLine = selectionInfo.head >= line.from && selectionInfo.head <= line.to;

                    if (isStandalone) {
                        // 1. Hide text if cursor is NOT on this line (Order matters: from < to)
                        if (!isCursorOnLine) {
                            decorations.push(Decoration.replace({}).range(node.from, node.to));
                        }

                        // 2. Block Image (at node.to)
                        decorations.push(Decoration.widget({
                            widget: new ImageBlockWidget(src, resolver),
                            block: true,
                            side: 1
                        }).range(node.to));
                    } else {
                        // Inline Image
                        if (!isCursorOnLine) {
                             decorations.push(Decoration.replace({
                                widget: new ImageInlineWidget(src, resolver, alt)
                             }).range(node.from, node.to));
                        }
                    }
                }
            }
        }
    });
    return Decoration.set(decorations, true);
}

const markdownDecorationsPlugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
        this.decorations = this.getDecorations(view);
    }
    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.getDecorations(update.view);
        }
    }
    getDecorations(view: EditorView) {
        const decorations: Range<Decoration>[] = [];
        const { state } = view;
        const selectionInfo = state.selection.ranges[0];

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from, to,
                enter: (node) => {
                    const nodeType = node.name;
                    const isFocused = (selectionInfo.from >= node.from && selectionInfo.to <= node.to) ||
                                      (selectionInfo.from <= node.to && selectionInfo.to >= node.from);

                    // 1. Headings
                    if (nodeType.startsWith("ATXHeading")) {
                        const level = parseInt(nodeType.replace("ATXHeading", ""));
                        const line = state.doc.lineAt(node.from);
                        
                        // Apply sizing class to the whole line
                        if (!isNaN(level)) {
                            decorations.push(Decoration.line({ class: `cm-header-${level}` }).range(line.from));
                        }

                        const isLineFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;
                        if (!isLineFocused) {
                           const text = state.sliceDoc(node.from, node.to);
                           const match = text.match(/^#+\s/);
                           if (match) {
                               decorations.push(Decoration.replace({}).range(node.from, node.from + match[0].length));
                           }
                        }
                    } 
                    
                    // 2. Bold
                    else if (nodeType === "StrongEmphasis") {
                         if (!isFocused) {
                             const text = state.sliceDoc(node.from, node.to);
                             const startMatch = text.match(/^([*_]{2})/);
                             const endMatch = text.match(/([*_]{2})$/);
                             
                             if (startMatch && endMatch) {
                                 decorations.push(Decoration.mark({ class: "cm-bold" }).range(node.from, node.to));
                                 decorations.push(Decoration.replace({}).range(node.from, node.from + 2));
                                 decorations.push(Decoration.replace({}).range(node.to - 2, node.to));
                             }
                         }
                    }
                    
                    // 3. Italic
                    else if (nodeType === "Emphasis") {
                        if (!isFocused) {
                            const text = state.sliceDoc(node.from, node.to);
                            const startMatch = text.match(/^([*_]{1})/);
                            const endMatch = text.match(/([*_]{1})$/);
                             if (startMatch && endMatch) {
                                 decorations.push(Decoration.mark({ class: "cm-italic" }).range(node.from, node.to));
                                 decorations.push(Decoration.replace({}).range(node.from, node.from + 1));
                                 decorations.push(Decoration.replace({}).range(node.to - 1, node.to));
                             }
                        }
                    }
                    
                    // 4. Strikethrough
                    else if (nodeType === "Strikethrough") {
                        if (!isFocused) {
                             decorations.push(Decoration.mark({ class: "cm-strike" }).range(node.from, node.to));
                             decorations.push(Decoration.replace({}).range(node.from, node.from + 2));
                             decorations.push(Decoration.replace({}).range(node.to - 2, node.to));
                        }
                    }
                    
                    // 5. Inline Code
                    else if (nodeType === "InlineCode") {
                        if (!isFocused) {
                             const text = state.sliceDoc(node.from, node.to);
                             const match = text.match(/^(`+)([^`]+)(`+)$/);
                             if (match) {
                                 const startLen = match[1].length;
                                 const endLen = match[3].length;
                                 decorations.push(Decoration.mark({ class: "cm-code" }).range(node.from, node.to));
                                 decorations.push(Decoration.replace({}).range(node.from, node.from + startLen));
                                 decorations.push(Decoration.replace({}).range(node.to - endLen, node.to));
                             }
                        }
                    }

                    // 6. Horizontal Rule
                    else if (nodeType === "HorizontalRule") {
                         const line = state.doc.lineAt(node.from);
                         const isLineFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;
                         if (!isLineFocused) {
                             decorations.push(Decoration.replace({
                                 widget: new class extends WidgetType {
                                     toDOM() { 
                                         const hr = document.createElement("hr"); 
                                         hr.className = "cm-hr";
                                         return hr;
                                     } 
                                 }
                             }).range(node.from, node.to));
                         }
                    }
                    
                    // 7. Images logic MOVED to imageDecorationsField
                    
                    // 8. Blockquote
                    else if (nodeType === "Blockquote") {
                        const startLine = state.doc.lineAt(node.from).number;
                        const endLine = state.doc.lineAt(node.to).number;
                        for (let i = startLine; i <= endLine; i++) {
                            const line = state.doc.line(i);
                             decorations.push(Decoration.line({ class: "cm-blockquote" }).range(line.from));
                        }
                    }

                    // 9. QuoteMark
                    else if (nodeType === "QuoteMark") {
                        const line = state.doc.lineAt(node.from);
                        const isLineFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;
                        if (!isLineFocused) {
                            decorations.push(Decoration.replace({}).range(node.from, node.to));
                             const nextChar = state.sliceDoc(node.to, node.to + 1);
                             if (nextChar === ' ') decorations.push(Decoration.replace({}).range(node.to, node.to + 1));
                        }
                    }
                    
                    // 10. Links and URLs
                    else if (nodeType === "Link") {
                         decorations.push(Decoration.mark({ class: "cm-md-link" }).range(node.from, node.to));
                         const line = state.doc.lineAt(node.from);
                         const isLineFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;

                         if (!isLineFocused) {
                             const cursor = node.node.cursor();
                             if (cursor.firstChild()) {
                                 do {
                                     const type = cursor.name;
                                     if (type === "LinkMark" || type === "URL") {
                                         decorations.push(Decoration.replace({}).range(cursor.from, cursor.to));
                                     }
                                 } while (cursor.nextSibling());
                             }
                         }
                    }
                    else if (nodeType === "URL") {
                         decorations.push(Decoration.mark({ class: "cm-md-link" }).range(node.from, node.to));
                    }
                }
            });
        }
        return Decoration.set(decorations, true);
    }
}, {
    decorations: v => v.decorations
});


interface CodeMirrorEditorProps {
    content: string;
    fileName: string;
    onChange: (value: string) => void;
    onEditorReady?: (view: EditorView) => void;
    onNavigate?: (target: string) => void;
    scrollToId?: string | null;
    addBlockIdToFile?: (filename: string, blockText: string) => Promise<string | null>;
}

export function CodeMirrorEditor({ content, fileName, onChange, onEditorReady, onNavigate, scrollToId, addBlockIdToFile }: CodeMirrorEditorProps) {
    const { saveAsset, getAssetUrl } = useFileSystem();
    
    // Auto-save wrapper
    const handleChange = useCallback((val: string) => {
        onChange(val);
    }, [onChange]);

    const extensions = useMemo(() => [
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'on' }),
        indentUnit.of("    "), // 4 spaces for indentation match standard assumption
        EditorState.tabSize.of(4),
        editorTheme,
        EditorView.updateListener.of((update) => {
             if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                 // Dispatch event for React component to pick up
                 update.view.dom.dispatchEvent(new Event('cm-update'));
             }
        }),
        imageResolver.of(getAssetUrl),
        EditorView.domEventHandlers({
            paste: (event, view) => {
                 const items = event.clipboardData?.items;
                 if (items) {
                     for (let i = 0; i < items.length; i++) {
                         if (items[i].type.indexOf('image') !== -1) {
                             event.preventDefault();
                             const file = items[i].getAsFile();
                             if (file) {
                                 saveAsset(file).then(path => {
                                     const { from, to } = view.state.selection.main;
                                     const insertText = `![](${path})`;
                                     view.dispatch({
                                         changes: { from, to, insert: insertText },
                                         selection: { anchor: from + insertText.length }
                                     });
                                 });
                             }
                         }
                     }
                 }
            },
            mousedown: (event) => {
                 const target = event.target as HTMLElement;
                 // Check if clicked element is a link or has parent
                 const link = target.closest('.cm-link') || target.closest('.cm-md-link');
                 // Check if it's a left click (button 0)
                 if (link && event.button === 0) {
                     // Check if user wants to EDIT (e.g. holding Alt)
                     // If Alt is held, allow default behavior (cursor placement)
                     if (event.altKey) return;

                     event.preventDefault(); // Prevent cursor move/focus
                     event.stopPropagation();
                     
                     const linkText = (link as HTMLElement).innerText; 
                     const linkTarget = link.getAttribute('data-link-target');

                     // 0. Check for data attribute (added by WikiLinkPlugin for both raw and widgets)
                     if (linkTarget) {
                         if (onNavigate) onNavigate(linkTarget);
                         return;
                     }
                     
                     // 1. WikiLink [[Target]] (Fallback for raw text without attribute if any)
                     if (linkText.startsWith('[[') && linkText.endsWith(']]')) {
                         const cleanTarget = linkText.replace(/^\[\[/, '').replace(/\]\]$/, '');
                         if (onNavigate) onNavigate(cleanTarget);
                         return;
                     }

                     // 2. Standard Markdown Link [Title](URL)
                     // The .cm-link decoration covers the [Title](URL) part usually? 
                     // Or just the URL part if it's .cm-url?
                     // Actually, usually [Title](URL) is rendered differently defined by decorations.
                     // But if we clicked .cm-link, let's try to extract URL.
                     // If it's a URL-like string:
                     if (linkText.startsWith('http://') || linkText.startsWith('https://')) {
                         window.open(linkText, '_blank');
                         return;
                     }
                     
                     // If it's the [Title](URL) pattern in raw markdown:
                     const match = linkText.match(/\]\((.*?)\)/);
                     if (match && match[1]) {
                         window.open(match[1], '_blank');
                         return;
                    }
                 }
            }
        }),
        markdownDecorationsPlugin,
        imageDecorationsField,
        wikiLinkPlugin,
        blockIdPlugin,
        Prec.highest(blockIdKeymap),
        bulletListPlugin,
        listGuidesPlugin,
        suggestionExtension, 
    ], [onNavigate, getAssetUrl, saveAsset]);

    const [view, setView] = useState<EditorView | null>(null);

    // Suggestion State
    const [suggestionState, setSuggestionState] = useState<SuggestionEventDetail>({
        isActive: false, trigger: null, query: '', coords: null, from: 0, to: 0
    });
    
    // Suggestion Items
    const [emojiItems, setEmojiItems] = useState<EmojiItem[]>([]);

    const slashListRef = useRef<SlashCommandsListHandle>(null);
    const emojiListRef = useRef<EmojiSuggestionsHandle>(null);
    const backlinkListRef = useRef<BacklinkSuggestionsHandle>(null);


    // Listen for suggestion events
    useEffect(() => {
        if (!view) return;

        const handleSuggestionUpdate = (e: Event) => {
            const customEvent = e as CustomEvent;
            const detail = customEvent.detail as SuggestionEventDetail;
            setSuggestionState(detail);
        };

        view.dom.addEventListener('suggestion-update', handleSuggestionUpdate);
        return () => view.dom.removeEventListener('suggestion-update', handleSuggestionUpdate);
    }, [view]);

    // Scroll to block ID effect
    useEffect(() => {
        if (view && scrollToId) {
            // Find the block ID in the document: "^blockId"
            // Or if it's a heading, "# Heading" -> but usually we search for exact ^ID first
            
            const docString = view.state.doc.toString();
            // Try explicit block ID first: " ^id" or "^id " or just "^id" at end of line?
            // Standard: " ^id"
            let index = docString.indexOf(` ^${scrollToId}`);
            if (index === -1) {
                // Try searching for heading text? 
                // Maybe the ID passed is actually a heading text (if fallback used)
                // Try finding "# scrollToId"
                index = docString.indexOf(`# ${scrollToId}`);
                if (index === -1) {
                     // Try just the text? risky
                     // Try exact match of block ID including caret
                     index = docString.indexOf(`^${scrollToId}`);
                }
            }

            if (index !== -1) {
                const line = view.state.doc.lineAt(index);
                // Scroll to line
                view.dispatch({
                    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
                    selection: { anchor: line.from }
                });
                
                // Highlight the line briefly
                // const highlightDecoration = Decoration.line({ 
                //    attributes: { style: "background-color: var(--primary-faded); transition: background-color 1s ease-out;" } 
                // });
                // Note: To implement real highlighting, we'd need a StateField. 
                // Relying on selection is fine for now.
            } else {
                console.warn(`[CodeMirror] Scroll target ^${scrollToId} not found`);
            }
        }
    }, [view, scrollToId]);

    // Derived Slash Items (Memoized instead of Effect)
    const slashItems = useMemo(() => {
        if (suggestionState.trigger !== '/') return [];
        
        const query = suggestionState.query.toLowerCase();
        const allItems: SlashCommandItem[] = [
            {
                title: 'Heading 1',
                description: 'Big section heading',
                icon: Heading1,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '# ' },
                        selection: { anchor: range.from + 2 }
                    });
                }
            },
            {
                title: 'Heading 2',
                description: 'Medium section heading',
                icon: Heading2,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '## ' },
                        selection: { anchor: range.from + 3 }
                    });
                }
            },
            {
                title: 'Bullet List',
                description: 'Create a simple bullet list',
                icon: List,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '- ' },
                        selection: { anchor: range.from + 2 }
                    });
                }
            },
            {
                title: 'Todo List',
                description: 'Track tasks with a todo list',
                icon: CheckSquare,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '- [ ] ' },
                        selection: { anchor: range.from + 6 }
                    });
                }
            },
                {
                title: 'Quote',
                description: 'Capture a quote',
                icon: Quote,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '> ' },
                        selection: { anchor: range.from + 2 }
                    });
                }
            },
        ];
        
        return allItems.filter(item => 
            item.title.toLowerCase().includes(query) || 
            item.description.toLowerCase().includes(query)
        );
    }, [suggestionState.trigger, suggestionState.query]);

    // Handle Emoji Filtering
    useEffect(() => {
        if (suggestionState.trigger === ':') {
           const query = suggestionState.query;
           searchEmojis(query).then(results => {
               setEmojiItems(results);
           });
        }
    }, [suggestionState.trigger, suggestionState.query]);


    // Handle Backlink Filtering
    // Derived Backlink Items (Memoized)
    const backlinkItems = useMemo(() => {
        if (suggestionState.trigger === '[[') {
            const query = suggestionState.query;
            return searchItems(query);
        }
        return [];
    }, [suggestionState.trigger, suggestionState.query]);

    // Keyboard Navigation Interception

    useEffect(() => {
        if (!view) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!suggestionState.isActive) return;

            // Pass key events to the active list reference
            if (suggestionState.trigger === '/' && slashListRef.current) {
                if (slashListRef.current.onKeyDown({ event: e })) {
                    e.preventDefault();
                    e.stopPropagation();
                    return; // Handled
                }
            }
             if (suggestionState.trigger === ':' && emojiListRef.current) {
                if (emojiListRef.current.onKeyDown({ event: e })) {
                    e.preventDefault();
                    e.stopPropagation();
                    return; // Handled
                }
            }
            if (suggestionState.trigger === '[[' && backlinkListRef.current) {
                if (backlinkListRef.current.onKeyDown({ event: e })) {
                    e.preventDefault();
                    e.stopPropagation();
                    return; // Handled
                }
            }
            
            // Close on escape
            if (e.key === 'Escape') {
                 setSuggestionState({ ...suggestionState, isActive: false });
            }
        };

        // Use capture phase to intercept before CodeMirror
        view.dom.addEventListener('keydown', handleKeyDown, true);
        return () => view.dom.removeEventListener('keydown', handleKeyDown, true);
    }, [view, suggestionState, slashItems, emojiItems, backlinkItems]);



    const renderSuggestions = () => {
        if (!suggestionState.isActive || !suggestionState.coords) return null;
        
        const style = {
            position: 'fixed' as const,
            top: suggestionState.coords.bottom + 5,
            left: suggestionState.coords.left,
            zIndex: 1000
        };

        if (suggestionState.trigger === '/') {
             return (
                <div style={style}>
                    <SlashCommandsList 
                        ref={slashListRef}
                        items={slashItems}
                        command={(item) => {
                            // Execute command
                            // range has from and to (which encompasses the trigger and query)
                             if (view) {
                                 item.command({ 
                                     editor: view, 
                                     range: { from: suggestionState.from, to: suggestionState.to } 
                                 });
                                 // Close menu (handled by update loop naturally, but nice to be explicit)
                             }
                        }}
                    />
                </div>
             );
        }

        if (suggestionState.trigger === ':') {
             return (
                <div style={style}>
                    <EmojiSuggestions
                        ref={emojiListRef}
                        items={emojiItems}
                        command={(item) => {
                             if (view) {
                                  view.dispatch({
                                      changes: { 
                                          from: suggestionState.from, 
                                          to: suggestionState.to, 
                                          insert: item.char 
                                      },
                                      selection: { anchor: suggestionState.from + item.char.length }
                                  });
                             }
                        }}
                    />
                </div>
             );
        }

        if (suggestionState.trigger === '[[') {
            return (
               <div style={style}>
                   <BacklinkSuggestions
                       ref={backlinkListRef}
                       items={backlinkItems}
                       command={(item) => {
                            if (view) {
                                let insertText = `[[${item.title}]]`;
                                
                                // Handle Block Links
                                if (item.type === 'block') {
                                    // If we are linking to a block in CURRENT file
                                    if (item.pageId === fileName.replace('.md', '')) { // fileName passed as prop
                                         // Check if it has a stable ID
                                         const hasStableId = !item.id.startsWith('block-');
                                         if (hasStableId) {
                                             insertText = `[[${item.pageName}#^${item.id}|${item.fullContent}]]`;
                                         } else {
                                             // Generate new stable ID
                                             const newId = Math.random().toString(36).substr(2, 6);
                                             // We need to find the block's content in the editor to append ID
                                             // item.fullContent is the text.
                                             // We can search for it?
                                             // Or since searchIndex is somewhat fresh?
                                             // Use ID to find line index if available!
                                             // ID format: block-PageID-LineIndex
                                             const parts = item.id.split('-');
                                             if (parts.length >= 3 && !isNaN(parseInt(parts[ parts.length - 1 ]))) {
                                                 const lineIndex = parseInt(parts[ parts.length - 1 ]);
                                                 // Check if line exists
                                                 if (lineIndex < view.state.doc.lines) {
                                                     const line = view.state.doc.line(lineIndex + 1); // 1-indexed
                                                     // Verify rough match to be safe
                                                     if (line.text.includes(item.fullContent?.slice(0, 10) || '')) {
                                                         view.dispatch({
                                                             changes: { from: line.to, insert: ` ^${newId}` }
                                                         });
                                                         insertText = `[[${item.pageName}#^${newId}]]`;
                                                     }
                                                 }
                                             } else {
                                                 // Fallback to text search
                                                 const docString = view.state.doc.toString();
                                                 const index = docString.indexOf(item.fullContent || '');
                                                 if (index !== -1) {
                                                     const line = view.state.doc.lineAt(index);
                                                      view.dispatch({
                                                          changes: { from: line.to, insert: ` ^${newId}` }
                                                      });
                                                      insertText = `[[${item.pageName}#^${newId}]]`;
                                                 }
                                             }
                                         }
                                    } else {
                                        // External file block
                                        // If stable ID exists, use it
                                         const hasStableId = !item.id.startsWith('block-');
                                         if (hasStableId) {
                                             insertText = `[[${item.pageName}#^${item.id}]]`;
                                         } else if (addBlockIdToFile) {
                                             // No stable ID, try to generate one in external file
                                             
                                             addBlockIdToFile(item.pageId + '.md', item.fullContent || '').then((newId) => {
                                                 if (newId && view) {
                                                       // We need to re-calculate positions? 
                                                    // The editor state might have changed? 
                                                    // Usually safe enough for milliseconds later if user is typing.
                                                    // Ideally we use a transaction with spec.
                                                    // But for now, let's just insert

                                                    view.dispatch({
                                                        changes: { 
                                                            from: suggestionState.from, 
                                                            to: suggestionState.to, 
                                                            insert: `[[${item.pageName}#^${newId}]]` 
                                                        },
                                                        selection: { anchor: suggestionState.from + `[[${item.pageName}#^${newId}]]`.length }
                                                    });
                                                 } else if (view) {
                                                     // Failed to add ID, fallback to page link
                                                     view.dispatch({
                                                         changes: { 
                                                             from: suggestionState.from, 
                                                             to: suggestionState.to, 
                                                             insert: `[[${item.pageName}]]` 
                                                         },
                                                         selection: { anchor: suggestionState.from + `[[${item.pageName}]]`.length }
                                                     });
                                                 }
                                             });
                                             return; // Async dispatch handles insertion
                                         } else {
                                             // Fallback: Link to block title? Obsidian supports `[[Page#Block Text]]`?
                                             // Or just Page link
                                             insertText = `[[${item.pageName}]]`; 
                                         }
                                    }
                                }
                                
                                 // Check for trailing ]]
                                 const nextChars = view.state.sliceDoc(suggestionState.to, suggestionState.to + 2);
                                 let insertEnd = suggestionState.to;
                                 if (nextChars === ']]') {
                                     insertEnd += 2;
                                 }

                                 view.dispatch({
                                     changes: { 
                                         from: suggestionState.from, 
                                         to: insertEnd, 
                                         insert: insertText 
                                     },
                                     selection: { anchor: suggestionState.from + insertText.length }
                                 });
                            }
                       }}
                   />
               </div>
            );
       }

        return null;
    };

    return (
        <div className="cm-wrapper" style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
            <CodeMirror
                value={content}
                height="100%"
                extensions={extensions}
                onChange={handleChange}
                onCreateEditor={(v) => {
                    setView(v);
                    if (onEditorReady) onEditorReady(v);
                }}
                theme="none"
                basicSetup={{
                    lineNumbers: false,
                    foldGutter: false,
                    highlightActiveLine: false,
                }}
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="on"
            />
            {renderSuggestions()}
            <CodeMirrorSmoothCursor view={view} />
        </div>
    );
}
