import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useFileSystem } from '../context/FileSystemContext';
import { useMemo } from 'react';

export const BacklinkNode = (props: NodeViewProps) => {
    const { node } = props;
    const { files, selectFile, createNewNote } = useFileSystem();

    const pageId = node.attrs.pageId;
    const label = node.attrs.label;

    const type = node.attrs.type || 'page';

    const exists = useMemo(() => {
        // Block links (type='block') always "exist" if the page exists, or we treat them as existing for now.
        // Actually, for blocks we might want simple styling.
        // But for 'page' links we check existence.
        if (type === 'block') return true;
        return files.some((f: any) => f.name === `${pageId}.json` || f.name === pageId);
    }, [files, pageId, type]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (exists) {
            const file = files.find((f: any) => f.name === `${pageId}.json` || f.name === pageId);
            if (file) {
                // If allow block navigation?
                // BacklinkNode doesn't have onNavigate prop?
                // The click handler in Backlink.ts (plugin) might handle this better, 
                // BUT ReactNodeViewRenderer often swallows events or needs specific handling.
                // The cached file view uses 'selectFile'.
                // If it's a block link, we just go to the page? 
                // Tiptap's standard click handler might effectively be blocked by this React handler?
                // Actually, let's keep it simple: go to page.
                selectFile(file);
            }
        } else {
            // Lazy create
            console.log(`[BacklinkNode] Lazy creating: ${pageId}`);
            await createNewNote(pageId);
        }
    };

    return (
        <NodeViewWrapper as="span" className={`backlink-wrapper ${!exists ? 'is-empty' : ''}`}>
            <span
                className="backlink"
                data-type={type}
                onClick={handleClick}
                style={{
                    color: !exists ? 'var(--primary-faded)' : undefined,
                    cursor: 'pointer',
                    opacity: !exists ? 0.7 : 1,
                    textDecoration: !exists ? 'dashed underline' : undefined // Optional visual cue
                }}
            >
                {type === 'page' ? `[[${label}]]` : label}
            </span>
        </NodeViewWrapper>
    );
};
