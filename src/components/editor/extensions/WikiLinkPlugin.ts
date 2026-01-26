import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { getBlockContent } from '../../../utils/searchIndex';

// Regex for [[Link]] or [[Link|Label]] or [[Link#^block]]
// Captures full brackets [[...]]
const wikiLinkRegex = /\[\[(.*?)\]\]/g;

class WikiLinkWidget extends WidgetType {
    readonly displayText: string;
    readonly originalTarget: string;

    constructor(displayText: string, originalTarget: string) {
        super();
        this.displayText = displayText;
        this.originalTarget = originalTarget;
    }

    toDOM() {
        const span = document.createElement("span");
        span.className = "cm-md-link"; // Re-use md link styling
        span.textContent = this.displayText;
        span.style.cursor = "pointer";
        // We can add data attribute to identify it?
        span.dataset.linkTarget = this.originalTarget;
        return span;
    }

    ignoreEvent() { return false; }
}

export const wikiLinkPlugin = ViewPlugin.fromClass(class {
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
        const { from, to } = view.viewport;
        const text = view.state.doc.sliceString(from, to);
        const ranges = view.state.selection.ranges;
        
        let match;
        while ((match = wikiLinkRegex.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            
            // Check if cursor is touching this link (selects it)
            let isSelected = false;
            for (const range of ranges) {
                if ((range.from >= start && range.from <= end) || 
                    (range.to >= start && range.to <= end) ||
                    (range.from < start && range.to > end)) {
                    isSelected = true; 
                    break;
                }
            }

            const content = match[1]; // "Link" or "Link|Alias"
            let target = content;
            let display = content; // Default display

            const pipeIndex = content.indexOf('|');
            if (pipeIndex !== -1) {
                // ALIAS CASE: Use defined alias
                target = content.slice(0, pipeIndex);
                display = content.slice(pipeIndex + 1).replace(/\s\^[a-zA-Z0-9-]+$/, '');
            } else {
                // NO ALIAS CASE: Check for block reference
                // Format: Page#^blockId
                const blockMatch = content.match(/^([^#]+)#\^([a-zA-Z0-9-]+)$/);
                if (blockMatch) {
                    const pageName = blockMatch[1];
                    const blockId = blockMatch[2];
                    
                    // Try to resolve content dynamically
                    const resolvedContent = getBlockContent(pageName, blockId);
                    if (resolvedContent) {
                        display = resolvedContent;
                    }
                }
            }

            if (isSelected) {
                // Show raw text with styling when selected
                builder.add(start, end, Decoration.mark({ 
                    class: 'cm-link', 
                    attributes: { 'data-link-target': target } 
                }));
            } else {
                // Live Preview: Replace with widget showing display text
                builder.add(start, end, Decoration.replace({
                    widget: new WikiLinkWidget(display, target)
                }));
            }
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
