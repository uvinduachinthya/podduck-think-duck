import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { Copy, Trash2 as Trash } from 'lucide-react';
import { useState } from 'react';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

export const ImageNodeView = (props: NodeViewProps) => {
    const { node, deleteNode, selected } = props;
    const { src, alt } = node.attrs;
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Select image on right click to ensure context is correct
    const handleContextMenu = (_e: React.MouseEvent) => {
        if (!selected) {
            const pos = props.getPos();
            if (typeof pos === 'number') {
                props.editor.commands.setNodeSelection(pos);
            }
        }
    };

    const handleCopy = async () => {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob,
                }),
            ]);
            // Optional: Show toast
        } catch (err) {
            console.error('Failed to copy image:', err);
            alert('Failed to copy image to clipboard');
        }
    };



    const handleDeleteClick = () => {
        const skipConfirm = localStorage.getItem('skipImageDeleteConfirm') === 'true';
        if (skipConfirm) {
            deleteNode();
        } else {
            setIsDeleteDialogOpen(true);
        }
    };

    const handleConfirmDelete = (dontAskAgain: boolean) => {
        if (dontAskAgain) {
            localStorage.setItem('skipImageDeleteConfirm', 'true');
        }
        deleteNode();
        setIsDeleteDialogOpen(false);
    };

    return (
        <NodeViewWrapper className="image-node-view" style={{ display: 'inline-block', lineHeight: 0 }}>
            <ContextMenu.Root>
                <ContextMenu.Trigger onContextMenu={handleContextMenu}>
                    <img
                        src={src}
                        alt={alt}
                        style={{
                            maxWidth: '100%',
                            borderRadius: '4px',
                            border: selected ? '2px solid var(--primary-color)' : '2px solid transparent',
                            cursor: 'default',
                            display: 'block',
                        }}
                    />
                </ContextMenu.Trigger>

                <ContextMenu.Portal>
                    <ContextMenu.Content
                        className="context-menu-content"
                        style={{
                            minWidth: '220px',
                            backgroundColor: 'var(--bg-primary)',
                            borderRadius: '6px',
                            padding: '5px',
                            boxShadow: '0px 10px 38px -10px rgba(22, 23, 24, 0.35), 0px 10px 20px -15px rgba(22, 23, 24, 0.2)',
                            border: '1px solid var(--sidebar-border)',
                            zIndex: 10000,
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                        }}
                    >
                        <ContextMenu.Item
                            className="context-menu-item"
                            onClick={handleCopy}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '25px',
                                padding: '0 10px',
                                position: 'relative',
                                userSelect: 'none',
                                borderRadius: '3px',
                                outline: 'none',
                                cursor: 'pointer',
                                gap: '8px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Copy className="w-4 h-4" />
                            Copy Image
                        </ContextMenu.Item>


                        <ContextMenu.Separator style={{ height: '1px', backgroundColor: 'var(--sidebar-border)', margin: '5px' }} />

                        <ContextMenu.Item
                            className="context-menu-item"
                            onClick={handleDeleteClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '25px',
                                padding: '0 10px',
                                position: 'relative',
                                userSelect: 'none',
                                borderRadius: '3px',
                                outline: 'none',
                                cursor: 'pointer',
                                gap: '8px',
                                color: 'var(--danger-color, #ff4d4f)'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--danger-color, #ff4d4f)';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--danger-color, #ff4d4f)';
                            }}
                        >
                            <Trash className="w-4 h-4" />
                            Delete
                        </ContextMenu.Item>
                    </ContextMenu.Content>
                </ContextMenu.Portal>
            </ContextMenu.Root>

            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                fileName="this image"
                onConfirm={handleConfirmDelete}
                onCancel={() => setIsDeleteDialogOpen(false)}
            />
        </NodeViewWrapper>
    );
};
