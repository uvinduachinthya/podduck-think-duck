import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, Decoration, type DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree, indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { CodeMirrorSmoothCursor } from './CodeMirrorSmoothCursor';
import { suggestionExtension, type SuggestionEventDetail } from './extensions/SuggestionExtension';
import { SlashCommandsList, type SlashCommandItem, type SlashCommandsListHandle } from '../SlashCommandsList';
import { EmojiSuggestions, type EmojiSuggestionsHandle } from '../EmojiSuggestions';
import { BacklinkSuggestions, type BacklinkSuggestionsHandle } from '../BacklinkSuggestions';
import { wikiLinkPlugin } from './extensions/WikiLinkPlugin';
import { bulletListPlugin } from './extensions/BulletListPlugin';
import { listGuidesPlugin } from './extensions/ListGuidesPlugin';
import { searchEmojis, type EmojiItem } from '../../utils/emojiData';
import { searchItems, type SearchableItem } from '../../utils/searchIndex';
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
    ".cm-content": {
        fontFamily: "var(--font-family)",
        padding: "0",
        maxWidth: "900px", 
        margin: "0 auto",
    },
    ".cm-line": {
        padding: "0.2em 0",
        lineHeight: "1.6",
    },
    ".cm-cursor, .cm-dropCursor": {
        display: "none !important", // Hide native cursor in favor of smooth cursor
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "var(--primary-faded) !important",
    },
    ".cm-activeLine": {
        backgroundColor: "transparent",
    },
    ".cm-gutters": {
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-muted)",
        border: "none",
    },
    // Markdown Specifics
    ".cm-header": {
        fontWeight: "bold",
        color: "var(--text-primary)",
    },
    ".cm-header-1": { fontSize: "2.0em", lineHeight: "1.2", marginBottom: "0.5em" },
    ".cm-header-2": { fontSize: "1.6em", lineHeight: "1.3", marginBottom: "0.5em" },
    ".cm-header-3": { fontSize: "1.4em", marginBottom: "0.5em" },
    ".cm-quote": {
        borderLeft: "4px solid var(--border-color)",
        paddingLeft: "1em",
        color: "var(--text-secondary)",
        fontStyle: "italic"
    },
    ".cm-link, .cm-link *": {
        color: "var(--primary-color) !important",
        textDecoration: "underline",
        cursor: "pointer",
        fontWeight: "500"
    },
    ".cm-url": {
        color: "var(--text-tertiary)",
    },
    // Bullet Points
    ".bullet-point": {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.5em",
        height: "1.5em",
        verticalAlign: "middle",
        cursor: "pointer",
        color: "var(--primary-color)",
        marginRight: "4px",
        borderRadius: "50%",
        transition: "background-color 0.2s, color 0.2s",
    },
    ".bullet-point:hover": {
         backgroundColor: "rgba(0, 0, 0, 0.05)",
         color: "var(--primary-hover)",
    },
    ".bullet-dot": {
        width: "6px",
        height: "6px",
        backgroundColor: "currentColor",
        borderRadius: "50%",
        pointerEvents: "none",
    },
    // Indentation Guides
    ".cm-indent-guide": {
         display: "inline-block",
         position: "relative",
         width: "1.5em", // Match bullet width to align perfectly
         textAlign: "center", // Center the content (spaces are invisible anyway but for safety)
         verticalAlign: "middle", // Align with line
    },
    ".cm-indent-guide::before": {
         content: '""',
         position: "absolute",
         top: "-0.3em", // Match line-height 1.6 (0.3 + 1 + 0.3 = 1.6)
         bottom: "-0.3em",
         left: "50%",
         borderLeft: "1px solid var(--border-color)",
         opacity: "0.5",
         pointerEvents: "none",
         transform: "translateX(-50%)"
    }
});

// --- Live Preview Plugins ---

const headerPlugin = ViewPlugin.fromClass(class {
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
        const builder = new RangeSetBuilder<Decoration>();
        const { state } = view;
        const selectionInfo = state.selection.ranges[0]; // Simple selection check

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from, to,
                enter: (node) => {
                    if (node.name.startsWith("ATXHeading")) {
                        // Check if cursor is on this line
                        const line = state.doc.lineAt(node.from);
                        const isFocused = selectionInfo.from >= line.from && selectionInfo.to <= line.to;

                        if (!isFocused) {
                           // Find the hashmarks
                           const text = state.sliceDoc(node.from, node.to);
                           const match = text.match(/^#+\s/);
                           if (match) {
                               // Hide the hashmarks
                               builder.add(node.from, node.from + match[0].length, Decoration.replace({}));
                           }
                        }
                    }
                }
            });
        }
        return builder.finish();
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
}

export function CodeMirrorEditor({ content, fileName, onChange, onEditorReady, onNavigate }: CodeMirrorEditorProps) {
    
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
        EditorView.domEventHandlers({
            mousedown: (event, view) => {
                 const target = event.target as HTMLElement;
                 // Check if clicked element is a link or has parent
                 const link = target.closest('.cm-link');
                 // Check if it's a left click (button 0)
                 if (link && event.button === 0) {
                     // Check if user wants to EDIT (e.g. holding Alt)
                     // If Alt is held, allow default behavior (cursor placement)
                     if (event.altKey) return;

                     event.preventDefault(); // Prevent cursor move/focus
                     event.stopPropagation();
                     
                     const linkText = (link as HTMLElement).innerText; // text is "[[Target]]"
                     // Strip [[ ]]
                     const cleanTarget = linkText.replace(/^\[\[/, '').replace(/\]\]$/, '');
                     if (onNavigate) onNavigate(cleanTarget);
                     return;
                 }
            }
        }),
        headerPlugin,
        wikiLinkPlugin,
        bulletListPlugin,
        listGuidesPlugin,
        suggestionExtension, 
    ], [onNavigate]);

    const [view, setView] = useState<EditorView | null>(null);

    // Suggestion State
    const [suggestionState, setSuggestionState] = useState<SuggestionEventDetail>({
        isActive: false, trigger: null, query: '', coords: null, from: 0, to: 0
    });
    
    // Suggestion Items
    const [emojiItems, setEmojiItems] = useState<EmojiItem[]>([]);
    const [backlinkItems, setBacklinkItems] = useState<SearchableItem[]>([]);

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
    useEffect(() => {
        if (suggestionState.trigger === '[[') {
            const query = suggestionState.query;
            const results = searchItems(query);
            setBacklinkItems(results);
        }
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
                                             insertText = `[[${item.pageName}#^${item.id}]]`;
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
        <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
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
