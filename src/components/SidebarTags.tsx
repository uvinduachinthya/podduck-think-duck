import { useMemo } from 'react';
import { Hash } from 'lucide-react';
import { useTags } from '../hooks/useTags';

export function SidebarTags({ onTagClick }: { onTagClick: (tagName: string) => void }) {
    const { tagsMap } = useTags();

    // Sort tags by count (most used first)
    const sortedTags = useMemo(() => {
        return Array.from(tagsMap.values()).sort((a, b) => b.count - a.count);
    }, [tagsMap]);

    return (
        <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
            {sortedTags.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--sidebar-text-muted)', fontSize: '0.8em' }}>
                    No tags found
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {sortedTags.map(({ tag, count }) => (
                         <div
                             key={tag}
                             onClick={() => onTagClick(tag)}
                            className="sidebar-item"
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.9em'
                            }}
                         >
                            <Hash className="w-3 h-3" style={{ opacity: 0.7 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tag.slice(1)}
                            </span>
                            <span style={{ 
                                fontSize: '0.8em', 
                                opacity: 0.5,
                                backgroundColor: 'var(--bg-secondary)',
                                padding: '1px 6px',
                                borderRadius: '8px'
                            }}>
                                {count}
                            </span>
                         </div>
                     ))}
                </div>
            )}
        </div>
    );
}
