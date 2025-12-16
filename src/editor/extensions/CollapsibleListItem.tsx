import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import ListItem from '@tiptap/extension-list-item';

export const CollapsibleListItem = ListItem.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            collapsed: {
                default: false,
                parseHTML: element => element.hasAttribute('data-collapsed'),
                renderHTML: attributes => {
                    if (attributes.collapsed) {
                        return { 'data-collapsed': '' }
                    }
                    return {}
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(CollapsibleListItemView);
    },
});

const CollapsibleListItemView = ({ node, updateAttributes, editor, getPos }: any) => {
    const isCollapsed = node.attrs.collapsed;

    // Check if the node has a nested list
    let hasChildren = false;
    if (node.content && node.content.size > 0) {
        node.content.forEach((child: any) => {
            if (child.type.name === 'bulletList' || child.type.name === 'orderedList') {
                hasChildren = true;
            }
        });
    }

    const handleCollapse = (e: React.MouseEvent) => {
        if (!hasChildren) return;

        // Prevent the editor from stealing focus or handling the click
        e.stopPropagation();
        e.preventDefault();
        console.log('[Collapsible] Clicked! Current state:', isCollapsed);

        // If we're collapsing (not expanding), check cursor position and move it
        if (!isCollapsed && editor && getPos) {
            try {
                const pos = getPos();
                const nodeSize = node.nodeSize;
                const { from } = editor.state.selection;

                // Check if cursor is inside this list item (including nested content)
                if (from >= pos && from < pos + nodeSize) {
                    // Find the end of the paragraph content (before any nested lists)
                    let endOfParagraph = pos + 1; // Start after the list item opening

                    // Traverse the node content to find where the paragraph ends
                    node.content.forEach((child: any, offset: number) => {
                        if (child.type.name === 'paragraph') {
                            endOfParagraph = pos + 1 + offset + child.nodeSize;
                        }
                    });

                    // Move cursor to the end of the paragraph content
                    const tr = editor.state.tr.setSelection(
                        editor.state.selection.constructor.near(
                            editor.state.doc.resolve(endOfParagraph - 1)
                        )
                    );
                    editor.view.dispatch(tr);
                }
            } catch (err) {
                console.warn('[Collapsible] Failed to reposition cursor:', err);
            }
        }

        updateAttributes({ collapsed: !isCollapsed });
    };

    return (
        <NodeViewWrapper className={`block-list-item ${isCollapsed ? 'is-collapsed' : ''} ${hasChildren ? 'has-children' : 'is-leaf'}`}>
            <span
                className="bullet-point"
                onClick={handleCollapse}
                contentEditable={false}
                title={hasChildren ? (isCollapsed ? "Expand" : "Collapse") : ""}
                style={{ cursor: hasChildren ? 'pointer' : 'default' }}
            >
                <div className="bullet-dot" />
            </span>
            <NodeViewContent className="content" />
        </NodeViewWrapper>
    );
};
