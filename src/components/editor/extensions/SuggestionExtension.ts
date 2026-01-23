import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';

export interface SuggestionEventDetail {
    isActive: boolean;
    trigger: string | null;
    query: string;
    coords: { top: number; left: number; bottom: number } | null;
    from: number;
    to: number;
}

export const suggestionExtension = ViewPlugin.fromClass(class {
    view: EditorView;
    constructor(view: EditorView) {
        this.view = view;
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet) {
            this.checkTrigger(update.view, update.docChanged);
        }
    }

    checkTrigger(view: EditorView, docChanged: boolean = false) {
        const { state } = view;
        const selection = state.selection.main;
        if (selection.empty) {
            const { head } = selection;
            const line = state.doc.lineAt(head);
            const lineText = line.text;
            const lineOffset = head - line.from;

            // Look specifically for our triggers
            // 1. Slash Command: "/" at start of line (allowing spaces)
            // 2. Emoji: ":" anywhere (preceded by space or start of line)
            // 3. Backlink: "[[" anywhere (preceded by space or start of line)
            
            // Check for Slash Command
            // Regex: ^\s*\/(\w*)$  -> Matches /word at start of line, allowing indentation
            const slashMatch = lineText.slice(0, lineOffset).match(/^\s*\/([\w\s]*)$/);
            
            // Check for Emoji
            // Regex: (?:^|\s):(\w*)$ -> Matches :word at start or after space
            const textBeforeCursor = lineText.slice(0, lineOffset);
            const emojiMatch = textBeforeCursor.match(/(?:^|\s)(:[\w]*)$/);

            // Check for Backlink
            // Regex: (?:^|\s)\[\[([^\[\]]*)$  -> Matches [[query, barring nested brackets
            const backlinkMatch = textBeforeCursor.match(/(?:^|\s)\[\[([^\[\]]*)$/);

            let trigger = null;
            let query = '';
            let from = head;
            
            if (slashMatch) {
                trigger = '/';
                query = slashMatch[1]; // The text after /
                // Find where the slash is to set 'from' correctly
                const slashIndex = slashMatch[0].indexOf('/');
                from = line.from + slashIndex; 
            } else if (emojiMatch) {
                trigger = ':';
                // emojiMatch[1] is ":query". We want just query.
                // emojiMatch[1] is the full capturing group e.g. ":smile"
                // The full match might have a leading space which we ignored in group 1
                const fullMatch = emojiMatch[1]; 
                query = fullMatch.slice(1); // remove :
                from = head - fullMatch.length;
            } else if (backlinkMatch) {
                // Check if we are inside a closed link [[query]]
                // ALLOW if docChanged (user just typed it, potentially auto-closed)
                // PREVENT if !docChanged (user clicked navigation)
                const nextChars = view.state.sliceDoc(head, head + 2);
                if (docChanged || nextChars !== ']]') { 
                    trigger = '[[';
                    const fullMatch = backlinkMatch[1]; // The query inside [[
                    // Backtrack to find [[
                    const matchString = backlinkMatch[0]; // e.g. " [[query"
                    const triggerIndex = matchString.indexOf('[[');
                    from = head - (matchString.length - triggerIndex);
                    query = fullMatch;
                }
            }

            if (trigger) {
                // Fix: Defer layout read to avoid "Reading the editor layout isn't allowed during an update"
                requestAnimationFrame(() => {
                    const coords = view.coordsAtPos(head);
                    if (coords) {
                        this.dispatch({
                            isActive: true,
                            trigger,
                            query,
                            coords: { top: coords.top, left: coords.left, bottom: coords.bottom },
                            from,
                            to: head
                        });
                    }
                });
                return;
            }
        }

        // If no match found
        this.dispatch({
            isActive: false,
            trigger: null,
            query: '',
            coords: null,
            from: 0,
            to: 0
        });
    }

    dispatch(detail: SuggestionEventDetail) {
        const event = new CustomEvent('suggestion-update', { 
            detail,
            bubbles: true,
            composed: true 
        });
        this.view.dom.dispatchEvent(event);
    }
});
