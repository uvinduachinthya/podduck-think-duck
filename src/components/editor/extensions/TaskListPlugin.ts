import { Decoration, type DecorationSet, ViewPlugin, ViewUpdate, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

class CheckboxWidget extends WidgetType {
    checked: boolean;
    pos: number;

    constructor(checked: boolean, pos: number) {
        super();
        this.checked = checked;
        this.pos = pos;
    }

    eq(other: CheckboxWidget) {
        return other.checked === this.checked && other.pos === this.pos;
    }

    toDOM(view: EditorView) {
        const wrap = document.createElement('span');
        wrap.className = 'cm-task-checkbox-wrap';
        wrap.contentEditable = 'false';

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = this.checked;
        box.className = 'cm-task-checkbox';

        box.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const from = this.pos;
            const to = from + 3; // '[ ]' or '[x]'

            // Toggle value
            const newText = this.checked ? '[ ]' : '[x]';
            
            view.dispatch({
                changes: { from, to, insert: newText },
            });
        });

        box.addEventListener('click', (e) => {
             e.preventDefault(); 
             e.stopPropagation();
        });

        wrap.appendChild(box);
        return wrap;
    }
    
    ignoreEvent() { return true; }
}

export const taskListPlugin = ViewPlugin.fromClass(class {
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
                    // console.log("Node:", node.name, node.from, node.to);
                    if (node.name === 'TaskMarker') {
                        const markText = state.sliceDoc(node.from, node.to);
                        const isChecked = markText.toLowerCase() === '[x]';
                        
                        decorations.push({
                            from: node.from,
                            to: node.to,
                            value: Decoration.replace({
                                widget: new CheckboxWidget(isChecked, node.from)
                            })
                        });
                    }
                }
            });
        }
        
        decorations.sort((a, b) => a.from - b.from || a.to - b.to);
        
        for (const dec of decorations) {
            builder.add(dec.from, dec.to, dec.value);
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});
