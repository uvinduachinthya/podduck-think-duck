import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

class BulletWidget extends WidgetType {
    constructor() {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.className = 'bullet-point';
        const dot = document.createElement('span');
        dot.className = 'bullet-dot';
        span.appendChild(dot);
        return span;
    }
}

export const bulletListPlugin = ViewPlugin.fromClass(class {
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

        const decorations: { from: number; to: number; value: Decoration }[] = [];

        for (const { from, to } of view.visibleRanges) {
            syntaxTree(state).iterate({
                from, to,
                enter: (node) => {
                    if (node.name === 'ListMark') {
                        const markText = state.sliceDoc(node.from, node.to);
                        if (/^[-*+]\s?$/.test(markText)) {
                             const line = state.doc.lineAt(node.from);
                             const lineText = line.text;
                             // Calculate indentation (spaces before mark)
                             // node.from is start of mark. line.from is start of line.
                             // indent length = node.from - line.from
                             const indentLength = node.from - line.from;
                             
                             // 1. Hide the leading spaces (if any)
                             if (indentLength > 0) {
                                 decorations.push({
                                     from: line.from,
                                     to: node.from,
                                     value: Decoration.replace({})
                                 });
                             }
                        
                             // Check for space after the mark
                             const charAfterMark = state.sliceDoc(node.to, node.to + 1);
                             if (charAfterMark !== ' ') return; // Only decorate if followed by space

                             // 2. Add replacement widget for the bullet
                             const replacementTo = node.to + 1; // Include the space

                             // Check if this is a task list item using text pattern
                             // Robust check: Line starts with - [ ] or - [x]
                             const isTask = /^\s*[-*+]\s+\[[ xX]\]/.test(lineText);

                             if (isTask) {
                                 // For task lists, hide the bullet point (ListMark) completely
                                 // allow the TaskListPlugin to render the checkbox
                                 decorations.push({
                                     from: node.from,
                                     to: replacementTo, // Hide '- '
                                     value: Decoration.replace({}) // Replace with nothing
                                 });
                             } else {
                                 // Standard bullet point
                                 decorations.push({
                                     from: node.from,
                                     to: replacementTo,
                                     value: Decoration.replace({
                                         widget: new BulletWidget()
                                     })
                                 });
                             }
                             
                            // Check for nested list (Parent Item)
                            let isParent = false;
                            const listItem = node.node.parent;
                            if (listItem && (listItem.name === 'ListItem' || listItem.name === 'TaskListItem')) {
                                let child = listItem.firstChild;
                                while(child) {
                                    if (child.name === 'BulletList' || child.name === 'OrderedList') {
                                        isParent = true;
                                        break;
                                    }
                                    child = child.nextSibling;
                                }
                            }

                             // 3. Add line class
                             decorations.push({
                                 from: line.from,
                                 to: line.from,
                                 value: Decoration.line({ 
                                     class: `cm-list-line${isParent ? ' cm-list-parent' : ''}`,
                                     attributes: { style: `--indent: ${indentLength}` }
                                 })
                             });
                        }
                    }
                }
            });
        }
        
        // Sort decorations by 'from' position
        decorations.sort((a, b) => a.from - b.from || a.to - b.to); 
        
        for (const dec of decorations) {
            builder.add(dec.from, dec.to, dec.value);
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
