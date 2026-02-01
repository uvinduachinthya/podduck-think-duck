import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';

// Input rule to convert "[ ] " at start of line to "- [ ] "
export const taskInputRulePugin = ViewPlugin.fromClass(class {
    constructor(view: EditorView) {}
    
    update(update: ViewUpdate) {
        if (update.docChanged) {
            update.transactions.forEach(tr => {
                if (tr.isUserEvent('input')) {
                     tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
                         const text = inserted.toString();
                         if (text === ' ') {
                             // Check text before the space
                             const line = update.state.doc.lineAt(fromB);
                             const lineText = line.text;
                             // We only care if we just typed space after "[ ]" or "[]"
                             // The cursor is at `toB` (which should be space index + 1)
                             // So we check line prefix
                             
                             // Check for "[ ] " pattern at start
                             const regexWithSpace = /^\s*\[ \]\s$/;
                             const regexNoSpace = /^\s*\[\]\s$/; // "[] " -> "- [ ] "
                             
                             // Check if we are at the position
                             // lineText should end with the space we just typed
                             // But we need to be careful not to trigger if we are editing middle of line
                             
                             // Let's assume input rule triggers when cursor is right after the pattern
                             const cursorPos = toB;
                             if (cursorPos > line.from) {
                                  const textBeforeCursor = lineText.slice(0, cursorPos - line.from);
                                  
                                  if (regexWithSpace.test(textBeforeCursor)) {
                                      // Replace "[ ] " with "- [ ] "
                                      // The text "[ ] " is length 4.
                                      // We want to replace it with "- [ ] " (length 6)
                                      
                                      // Calculate range of "[ ] "
                                      const match = textBeforeCursor.match(/^(\s*)\[ \]\s$/);
                                      if (match) {
                                          const indent = match[1];
                                          const start = line.from + indent.length;
                                          const end = cursorPos;
                                          
                                          // We replace "[ ] " with "- [ ] "
                                          // Actually, we can just insert "- " before "[ ] " ?
                                          // No, standard task is "- [ ]".
                                          // Current text is "[ ] ".
                                          // So replace "[ ] " with "- [ ] ".
                                          
                                          // But wait, the user might want a bullet?
                                          // Yes "- [ ]" is the GFM task syntax.
                                          
                                          setTimeout(() => {
                                              update.view.dispatch({
                                                  changes: { from: start, to: end, insert: "- [ ] " },
                                                  selection: { anchor: start + 6 } // Place cursor after
                                              });
                                          }, 0);
                                      }
                                  } else if (regexNoSpace.test(textBeforeCursor)) {
                                      // "[] " -> "- [ ] "
                                      const match = textBeforeCursor.match(/^(\s*)\[\]\s$/);
                                       if (match) {
                                          const indent = match[1];
                                          const start = line.from + indent.length;
                                          const end = cursorPos;
                                          
                                           setTimeout(() => {
                                              update.view.dispatch({
                                                  changes: { from: start, to: end, insert: "- [ ] " },
                                                  selection: { anchor: start + 6 }
                                              });
                                          }, 0);
                                       }
                                  }
                             }
                         }
                     });
                }
            });
        }
    }
});
