import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { GFM, Subscript, Superscript, Strikethrough } from '@lezer/markdown';
import { EditorView, Decoration, type DecorationSet, WidgetType, drawSelection } from '@codemirror/view';
import { Range, Prec, Facet, StateField } from '@codemirror/state';
import { syntaxTree, indentUnit } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useFileSystem } from '../../context/FileSystemContext';
import { CodeMirrorSmoothCursor } from './CodeMirrorSmoothCursor';
import { suggestionExtension, type SuggestionEventDetail } from './extensions/SuggestionExtension';
import { SlashCommandsList, type SlashCommandItem, type SlashCommandsListHandle } from '../SlashCommandsList';
import { EmojiSuggestions, type EmojiSuggestionsHandle } from '../EmojiSuggestions';
import { BacklinkSuggestions, type BacklinkSuggestionsHandle } from '../BacklinkSuggestions';
import { wikiLinkPlugin } from './extensions/WikiLinkPlugin';
import blockIdPlugin, { blockIdKeymap } from "./extensions/BlockIdPlugin";
import { bulletListPlugin } from './extensions/BulletListPlugin';
import { taskListPlugin } from './extensions/TaskListPlugin';
import { taskInputRulePugin } from './extensions/TaskInputRule';

import { markdownKeymap } from './extensions/markdownCommands';
import { searchEmojis, type EmojiItem } from '../../utils/emojiData';
import { searchItems } from '../../utils/searchIndex';
import { List, CheckSquare, Heading1, Heading2, Quote, Image, Loader } from 'lucide-react';
import { autocompletion } from "@codemirror/autocomplete";
import { tagCompletion } from "./extensions/tagCompletion";
// --- Widget Definitions ---

class LatexWidget extends WidgetType {
    source: string;
    displayMode: boolean;
    
    constructor(source: string, displayMode: boolean) { 
        super();
        this.source = source;
        this.displayMode = displayMode;
    }

    eq(other: LatexWidget) { return other.source === this.source && other.displayMode === this.displayMode; }

    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-latex-widget";
        span.style.cursor = "default";
        span.contentEditable = "false";
        
        try {
            katex.render(this.source, span, {
                displayMode: this.displayMode,
                throwOnError: false
            });
        } catch (e) {
            span.textContent = this.source; // Fallback
        }
        return span;
    }
    
    ignoreEvent() { return true; }
}

// --- Theme ---
const editorTheme = EditorView.theme({
    "&": {
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontSize: "var(--editor-font-size)",
    },
    "&.cm-focused": {
        outline: "none",
    },
    ".cm-scroller": {
        padding: "0",
        overflow: "visible", 
    },
    ".cm-content": {
        fontFamily: "var(--font-family)",
        padding: "0",
        maxWidth: "900px", 
        margin: "0 auto",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
    },
    ".cm-line": {
        padding: "0",
    },
    // Explicitly target selection background to ensure override
    ".cm-selectionBackground": {
        backgroundColor: "var(--selection-bg, rgba(0, 0, 0, 0.1)) !important"
    },
    // Hide native selection to avoid double-rendering
    ".cm-content ::selection": {
        backgroundColor: "transparent !important"
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--selection-bg, rgba(0, 0, 0, 0.1)) !important"
    }
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

class LoadingWidget extends WidgetType {
    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-loading-widget";
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.gap = "6px";
        span.style.color = "var(--text-secondary)";
        span.style.fontSize = "0.9em";
        span.style.backgroundColor = "var(--bg-secondary)";
        span.style.padding = "2px 6px";
        span.style.borderRadius = "4px";
        
        // Simple spinner using SVG string
        span.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-animation"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Uploading...`;
        
        // Add spin animation style if not present
        if (!document.getElementById('spin-style')) {
            const style = document.createElement('style');
            style.id = 'spin-style';
            style.textContent = `
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin-animation { animation: spin 1s linear infinite; }
            `;
            document.head.appendChild(style);
        }

        return span;
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

const loadingDecorationsField = StateField.define<DecorationSet>({
    create(state) {
        return getLoadingDecorations(state);
    },
    update(decorations, tr) {
        if (tr.docChanged || tr.selection) {
            return getLoadingDecorations(tr.state);
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

function getLoadingDecorations(state: EditorState) {
    const decorations: Range<Decoration>[] = [];
    const text = state.doc.toString();
    // Use a simpler regex or exact match loop for stability
    const regex = /!\[Uploading\.\.\.\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        decorations.push(Decoration.replace({
            widget: new LoadingWidget()
        }).range(match.index, match.index + match[0].length));
    }
    return Decoration.set(decorations, true);
}

const markdownDecorationsField = StateField.define<DecorationSet>({
    create(state) {
        return getMarkdownDecorations(state);
    },
    update(decorations, tr) {
        if (tr.docChanged || tr.selection) {
            return getMarkdownDecorations(tr.state);
        }
        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

function getMarkdownDecorations(state: EditorState) {
    const decorations: Range<Decoration>[] = [];
    const selectionInfo = state.selection.main;
    
    // Iterate entire tree (ok for typical note sizes)
    syntaxTree(state).iterate({
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
                    
                    // 3. Italic (*) and Underline (_)
                    else if (nodeType === "Emphasis") {
                        if (!isFocused) {
                            const text = state.sliceDoc(node.from, node.to);
                            const startMatch = text.match(/^([*_]{1})/);
                            const endMatch = text.match(/([*_]{1})$/);
                             if (startMatch && endMatch) {
                                 const delimiter = startMatch[1];
                                 const className = delimiter === '_' ? "cm-underline" : "cm-italic";
                                 
                                 decorations.push(Decoration.mark({ class: className }).range(node.from, node.to));
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

                    // Superscript ^...^ (Actually ^{...}^ with extension)
                    // The standard Superscript extension usually uses ^...^ or ~...~ depending on config, but standard is ^
                    // ... (Sup/Sub logic remains) ...
                    else if (nodeType === "Superscript") {
                        if (!isFocused) {
                            decorations.push(Decoration.mark({ class: "cm-sup" }).range(node.from, node.to));
                            // Hide the '^' delimiters
                            decorations.push(Decoration.replace({}).range(node.from, node.from + 1));
                            decorations.push(Decoration.replace({}).range(node.to - 1, node.to));
                        }
                    }
                    else if (nodeType === "Subscript") {
                         if (!isFocused) {
                            decorations.push(Decoration.mark({ class: "cm-sub" }).range(node.from, node.to));
                            // Hide the '~' delimiters
                            decorations.push(Decoration.replace({}).range(node.from, node.from + 1));
                            decorations.push(Decoration.replace({}).range(node.to - 1, node.to));
                        }
                    }

                    // Highlight (Custom Regex since no standard parser yet)
                    // We check purely text nodes or paragraphs?
                    // Actually, let's just use broad text content matching for now within the visible range, but exclude if inside code?
                    // The current iteration is by node.
                    // If we find "==...==" in text.
                    // NOTE: This simple regex approach inside iteration is slightly hacky if not precise with node boundaries.
                    // But for "Paragraph", the text variable contains the whole paragraph text.
                    // We must find matches.
                    // Limitation: This might match inside code blocks if we iterate them?
                    // But we can check nodeType.
                    
                    // Simple approach: Check text for == patterns IF we are in a Paragraph or similar.
                    if (nodeType === "Paragraph" || nodeType === "ATXHeading1" || nodeType === "ATXHeading2" || nodeType === "ATXHeading3" || nodeType === "ATXHeading4" || nodeType === "ATXHeading5" || nodeType === "ATXHeading6") {
                        const text = state.sliceDoc(node.from, node.to);
                        const regex = /==([^=]+)==/g;
                        let match;
                        while ((match = regex.exec(text)) !== null) {
                            const start = node.from + match.index;
                            const end = start + match[0].length;
                            
                            // Check if this range overlaps with focused selection
                            const isRangeFocused = (selectionInfo.from >= start && selectionInfo.from <= end) || 
                                                 (selectionInfo.to >= start && selectionInfo.to <= end);

                            if (!isRangeFocused) {
                                decorations.push(Decoration.mark({ class: "cm-highlight" }).range(start, end));
                                // Hide delimiters
                                decorations.push(Decoration.replace({}).range(start, start + 2));
                                decorations.push(Decoration.replace({}).range(end - 2, end));
                            }
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

                    // 9. LaTeX (Regex-based to ensure reliability)
                    if (nodeType === "Paragraph" || nodeType === "ATXHeading1" || nodeType === "ATXHeading2" || nodeType === "ATXHeading3" || nodeType === "ATXHeading4" || nodeType === "ATXHeading5" || nodeType === "ATXHeading6") {
                         const text = state.sliceDoc(node.from, node.to);
                         
                         // Block Math $$...$$
                         // Match $$ followed by anything lazily until $$
                         const blockRegex = /\$\$([\s\S]+?)\$\$/g;
                         let blockMatch;
                         while ((blockMatch = blockRegex.exec(text)) !== null) {
                             const start = node.from + blockMatch.index;
                             const end = start + blockMatch[0].length;
                             const source = blockMatch[1];

                             const isRangeFocused = (selectionInfo.from >= start && selectionInfo.from <= end) || 
                                                  (selectionInfo.to >= start && selectionInfo.to <= end);
                             
                             if (!isRangeFocused) {
                                 decorations.push(Decoration.replace({
                                     widget: new LatexWidget(source, true)
                                     // block: true removed to avoid RangeError. KaTeX displayMode handles visual block.
                                 }).range(start, end));
                             } else {
                                 decorations.push(Decoration.mark({ class: "cm-code" }).range(start, end));
                             }
                         }

                         // Inline Math $...$
                         // Negative lookbehind not supported everywhere, but we can verify match index
                         // Simple regex: $ followed by non-space, then non-$ chars, ending with $
                         const inlineRegex = /\$([^\s$](?:[^$]*?[^\s$])?)\$/g;
                         let inlineMatch;
                         while ((inlineMatch = inlineRegex.exec(text)) !== null) {
                             const start = node.from + inlineMatch.index;
                             const end = start + inlineMatch[0].length;
                             const source = inlineMatch[1];

                             // Avoid matching inside $$ block if it overlaps (Regex loop handles sequential, but nested?)
                             // Block math check above handles $$...$$, but we need to ensure we don't double match.
                             // Actually, since we iterate independently, we might double match.
                             // Better strategy: Use one loop or check overlaps.
                             // However, since $$ is parsed first, we can just ensure we don't match $$ as $
                             // The inline regex `[^\s$]` enforces that it doesn't verify if it starts with space.
                             // But it doesn't handle `$$`.
                             // Quick fix: verify it's not part of a $$ block range?
                             // Complex. simple hack: check if match[0] starts with $$ is handled by block regex above?
                             // Actually, if I type $$foo$$, inlineRegex might match $foo$ inside?
                             // Let's refine inline Regex to explicitly NOT match if double start/end?
                             // Or mainly, reliance on `$$` handling first is tricky if we don't consume text.
                             
                             // Let's rely on checking overlaps with existing decorations? 
                             // We are building `decorations` array.
                             // Optimization: Just check if start/end starts with $$?
                             if (text.startsWith('$$', inlineMatch.index)) continue; 

                             const isRangeFocused = (selectionInfo.from >= start && selectionInfo.from <= end) || 
                                                  (selectionInfo.to >= start && selectionInfo.to <= end);

                             if (!isRangeFocused) {
                                 decorations.push(Decoration.replace({
                                     widget: new LatexWidget(source, false)
                                 }).range(start, end));
                             } else {
                                 decorations.push(Decoration.mark({ class: "cm-code" }).range(start, end));
                             }
                         }

                         // Hashtags #tag
                         const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_\-/]+)/g;
                         let tagMatch;
                         while ((tagMatch = tagRegex.exec(text)) !== null) {
                             // Adjust start index if space was matched
                             const matchText = tagMatch[0];
                             const tagText = tagMatch[1];
                             const offset = matchText.indexOf(tagText); // 0 or 1 usually
                             const start = node.from + tagMatch.index + offset;
                             const end = start + tagText.length;
                             
                             // Check overlap with code or math (basic check: inside $$?)
                             // Current simple regex doesn't check contexts, but we depend on nodeType mostly.
                             // Overlap with existing decorations (highlight, math) is possible but rare if syntax is clean.

                             // Always decorate, maybe change style when focused? 
                             // Usually tags look like tags always.
                             decorations.push(Decoration.mark({ class: "cm-hashtag" }).range(start, end));
                         }
                     }
                    
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
    return Decoration.set(decorations, true);
}


interface CodeMirrorEditorProps {
    content: string;
    fileName: string;
    onChange: (value: string) => void;
    onEditorReady?: (view: EditorView) => void;
    onNavigate?: (target: string) => void;
    scrollToId?: string | null;
    addBlockIdToFile?: (filename: string, blockText: string) => Promise<string | null>;
}

export function CodeMirrorEditor({ content, fileName, onChange, onEditorReady, onNavigate, addBlockIdToFile }: CodeMirrorEditorProps) {
    const { saveAsset, getAssetUrl } = useFileSystem();
    
    // 1. Definition of State and Refs
    const [view, setView] = useState<EditorView | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Naming State
    const [namingState, setNamingState] = useState<{ file: File, from: number, to: number } | null>(null);
    const [customName, setCustomName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const namingInputRef = useRef<HTMLInputElement>(null);

    // Suggestion State
    const [suggestionState, setSuggestionState] = useState<SuggestionEventDetail>({
        isActive: false, trigger: null, query: '', coords: null, from: 0, to: 0
    });
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

    // Auto-save wrapper
    const handleChange = useCallback((val: string) => {
        onChange(val);
    }, [onChange]);

    // 2. Helper Functions (Image Naming Flow)
    const cancelNaming = useCallback(() => {
        if (!namingState || !view) return;
        // Remove the placeholder
        view.dispatch({
            changes: { from: namingState.from, to: namingState.to, insert: '' }
        });
        setNamingState(null);
        setIsSaving(false);
        setCustomName('');
        view.focus();
    }, [namingState, view]);

    const handleNameSubmit = useCallback(async () => {
        if (!namingState || !view) return;
        setIsSaving(true);
        try {
            const finalName = customName.trim() || `image-${Date.now()}`;
            const path = await saveAsset(namingState.file, finalName);
            
            const insertText = `![](${path})`;
            view.dispatch({
                changes: { from: namingState.from, to: namingState.to, insert: insertText },
                selection: { anchor: namingState.from + insertText.length } 
            });
            
            setNamingState(null);
            setIsSaving(false);
            setCustomName('');
            view.focus();
        } catch (e) {
            console.error("Failed to save asset", e);
            cancelNaming();
        }
    }, [namingState, view, customName, saveAsset, cancelNaming]);

    // Shared handler for paste/upload to init flow
    const initImageUpload = useCallback((file: File) => {
        if (!view) return;
        const { from } = view.state.selection.main;
        const placeholder = `![Uploading...]`;
        
        // Insert placeholder
        view.dispatch({
            changes: { from, insert: placeholder },
            selection: { anchor: from + placeholder.length } 
        });

        // Set state to trigger popover
        setNamingState({
            file,
            from: from,
            to: from + placeholder.length
        });
    }, [view]);

     const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            initImageUpload(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Focus input when naming starts
    useEffect(() => {
        if (namingState && namingInputRef.current) {
            setTimeout(() => {
                namingInputRef.current?.focus();
                // const ext = namingState.file.name.split('.').pop() || 'png';
                const defaultName = `image-${Date.now()}`; 
                setCustomName(defaultName);
                namingInputRef.current?.select();
            }, 50);
        }
    }, [namingState]);

    // 3. Extensions Definition (Now can see initImageUpload)
    const extensions = useMemo(() => [
        drawSelection(),
        markdown({ 
            base: markdownLanguage, 
            codeLanguages: languages,
            extensions: [...GFM, Subscript, Superscript, Strikethrough]
        }),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'on' }),
        indentUnit.of("    "), 
        EditorState.tabSize.of(4),
        editorTheme,
        EditorView.updateListener.of((update) => {
             if (update.docChanged || update.selectionSet || update.viewportChanged || update.focusChanged) {
                 update.view.dom.dispatchEvent(new Event('cm-update'));
             }
        }),
        autocompletion({ override: [tagCompletion] }),
        imageResolver.of(getAssetUrl),
        EditorView.domEventHandlers({
            paste: (event, _view) => { // Use underscore to avoid shadowing, but actually the view argument is correct
                 const items = event.clipboardData?.items;
                 if (items) {
                     for (let i = 0; i < items.length; i++) {
                         if (items[i].type.indexOf('image') !== -1) {
                             event.preventDefault();
                             const file = items[i].getAsFile();
                             if (file) {
                                 initImageUpload(file);
                             }
                         }
                     }
                 }
            },
            mousedown: (event) => {
                 const target = event.target as HTMLElement;
                 const link = target.closest('.cm-link') || target.closest('.cm-md-link');
                 if (link && event.button === 0) {
                     if (event.altKey) return;

                     event.preventDefault(); 
                     event.stopPropagation();
                     
                     const linkText = (link as HTMLElement).innerText; 
                     const linkTarget = link.getAttribute('data-link-target');

                     if (linkTarget) {
                         if (onNavigate) onNavigate(linkTarget);
                         return;
                     }
                     if (linkText.startsWith('[[') && linkText.endsWith(']]')) {
                         const cleanTarget = linkText.replace(/^\[\[/, '').replace(/\]\]$/, '');
                         if (onNavigate) onNavigate(cleanTarget);
                         return;
                     }
                     if (linkText.startsWith('http://') || linkText.startsWith('https://')) {
                         window.open(linkText, '_blank');
                         return;
                     }
                     const match = linkText.match(/\]\((.*?)\)/);
                     if (match && match[1]) {
                         window.open(match[1], '_blank');
                         return;
                     }
                 }
            }
        }),
        markdownDecorationsField,
        imageDecorationsField,
        loadingDecorationsField,
        wikiLinkPlugin,
        blockIdPlugin,
        Prec.highest(blockIdKeymap),
        bulletListPlugin,
        taskListPlugin,
        taskInputRulePugin,
        Prec.highest(markdownKeymap),
        suggestionExtension, 
    ], [onNavigate, getAssetUrl, saveAsset, initImageUpload]); // Added initImageUpload dependency

    // Derived Slash Items
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
            {
                title: 'Upload Image',
                description: 'Upload an image from your device',
                icon: Image,
                command: ({ editor, range }) => {
                    editor.dispatch({
                        changes: { from: range.from, to: range.to, insert: '' }
                    });
                    fileInputRef.current?.click();
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
        // Use capture phase to intercept before CodeMirror
        view.dom.addEventListener('keydown', handleKeyDown, true);
        return () => view.dom.removeEventListener('keydown', handleKeyDown, true);
    }, [view, suggestionState, slashItems, emojiItems, backlinkItems]);


    // Render Naming Popover
    const renderNamingPopover = () => {
        if (!namingState || !view) return null;

        // Calculate position
        const coords = view.coordsAtPos(namingState.from);
        if (!coords) return null;

        return (
            <div style={{
                position: 'fixed',
                top: coords.bottom + 10,
                left: coords.left,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '250px'
            }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Name this image
                </div>
                <input
                    ref={namingInputRef}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNameSubmit();
                        if (e.key === 'Escape') cancelNaming();
                    }}
                    placeholder="e.g. login-flow"
                    style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        width: '100%',
                        fontSize: '13px'
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button 
                        onClick={cancelNaming}
                        style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleNameSubmit}
                        disabled={isSaving}
                        style={{
                            padding: '4px 12px',
                            borderRadius: '4px',
                            background: 'var(--primary-color)',
                            border: 'none',
                            color: 'white',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {isSaving && <Loader className="w-3 h-3 spin-animation" />}
                        Add
                    </button>
                </div>
            </div>
        );
    };



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
        <div className="cm-wrapper" style={{ height: 'auto', width: '100%', overflow: 'visible' }}>
            <CodeMirror
                value={content}
                height="auto"
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
                    highlightSelectionMatches: false,
                    allowMultipleSelections: false,
                    bracketMatching: false,
                    rectangularSelection: false,
                    highlightSpecialChars: false,
                    searchKeymap: false,
                }}
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="on"
            />
            {renderSuggestions()}
            {renderNamingPopover()}
            <CodeMirrorSmoothCursor view={view} />
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*" 
                onChange={handleFileUpload} 
            />
        </div>
    );
}
