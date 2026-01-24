
import { ViewPlugin, Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Regex for block ID at end of line: whitespace + ^ + alphanumeric/dash
const blockIdRegex = /\s\^[a-zA-Z0-9-]+$/;


class BlockIdWidget extends WidgetType {
    constructor(readonly text: string, readonly isVisible: boolean) {
        super();
    }

    toDOM() {
        // Outer container - standard layout to normalize cursor
        const outer = document.createElement("span");
        outer.className = "cm-block-id-outer";
        
        // Inner element - applies visual styling (superscript, etc)
        const inner = document.createElement("span");
        if (this.isVisible) {
            inner.textContent = this.text;
            inner.className = "cm-block-id";
        } else {
            inner.className = "cm-block-id-hidden";
        }
        
        outer.appendChild(inner);
        return outer;
    }

    eq(other: BlockIdWidget) {
        return other.text === this.text && other.isVisible === this.isVisible;
    }
}

const blockIdPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.getDecorations(view);
        }

        update(update: any) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = this.getDecorations(update.view);
            }
        }

        getDecorations(view: EditorView) {
            const builder = new RangeSetBuilder<Decoration>();
            const { from, to } = view.viewport;
            const cursorHead = view.state.selection.main.head;

            // Iterate over lines in viewport
            for (let pos = from; pos <= to;) {
                const line = view.state.doc.lineAt(pos);
                // Check if line ends with block ID
                const match = line.text.match(blockIdRegex);
                
                if (match && match.index !== undefined) {
                    const start = line.from + match.index;
                    const end = line.from + line.text.length; // End of line

                    const isCursorOnLine = cursorHead >= line.from && cursorHead <= line.to;
                    
                    builder.add(start, end, Decoration.replace({
                        widget: new BlockIdWidget(match[0], isCursorOnLine),
                        inclusive: false // Typing at start inserts before widget
                    }));
                }
                pos = line.to + 1;
            }

            return builder.finish();
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);

import { keymap } from "@codemirror/view";

export const blockIdKeymap = keymap.of([
    {
        key: "Enter",
        run: (view) => {
            const state = view.state;
            const { from, to } = state.selection.main;
            if (from !== to) return false; // Only handle cursor, not ranges

            const line = state.doc.lineAt(from);
            const match = line.text.match(blockIdRegex);

            if (match && match.index !== undefined) {
                const idStart = line.from + match.index;
                // If cursor is at the start of the hidden ID (visual end of line)
                if (from === idStart) {
                    // Move cursor to AFTER the ID, then insert newline
                    // This ensures the ID stays with the current block
                    view.dispatch({
                        changes: { from: line.to, insert: "\n" },
                        selection: { anchor: line.to + 1 },
                        scrollIntoView: true
                    });
                    return true;
                }
            }
            return false;
        }
    }
]);

export default blockIdPlugin;
