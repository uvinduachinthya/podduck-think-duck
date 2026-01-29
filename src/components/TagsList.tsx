import { useMemo, useState } from 'react';
import type { FileNode } from '../context/FileSystemContext';
import { Hash, FileText, ChevronRight } from 'lucide-react';
import { useTags } from '../hooks/useTags';

export function TagsList({ onSelect, hideHeader = false }: { onSelect: (file: FileNode) => void; hideHeader?: boolean }) {
    const { tagsMap } = useTags();
    const [selectedTag, setSelectedTag] = useState<string | null>(null);

    // Sort tags by count (most used first)
    const sortedTags = useMemo(() => {
        return Array.from(tagsMap.values()).sort((a, b) => b.count - a.count);
    }, [tagsMap]);

    const handleTagClick = (tag: string) => {
        setSelectedTag(selectedTag === tag ? null : tag);
    };

    const handleBackToList = () => {
        setSelectedTag(null);
    };

    // If a tag is selected, show notes with that tag
    if (selectedTag) {
        const tagInfo = tagsMap.get(selectedTag);
        if (!tagInfo) return null;

        return (
            <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <button
                        onClick={handleBackToList}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <ChevronRight style={{ transform: 'rotate(180deg)', width: '16px', height: '16px' }} />
                        Back to all tags
                    </button>
                </div>
                
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Hash className="w-6 h-6" />
                    {selectedTag}
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '14px' }}>
                    {tagInfo.count} {tagInfo.count === 1 ? 'note' : 'notes'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tagInfo.notes.map(file => (
                        <div
                            key={file.name}
                            onClick={() => onSelect(file)}
                            style={{
                                padding: '16px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'transform 0.1s, border-color 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                borderRadius: '8px', 
                                backgroundColor: 'var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--primary-color)',
                                flexShrink: 0
                            }}>
                                <FileText className="w-5 h-5" />
                            </div>
                            
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ 
                                    margin: 0, 
                                    fontSize: '16px', 
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {file.name.replace('.md', '')}
                                </h3>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Main tags list view
    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!hideHeader && (
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Hash className="w-6 h-6" />
                    Tags
                </h1>
            )}

            {sortedTags.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No tags found. Add tags to your notes using #tag syntax!
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {sortedTags.map(({ tag, count }) => (
                        <div
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            style={{
                                padding: '16px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'transform 0.1s, border-color 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary-color)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-color)';
                                e.currentTarget.style.transform = 'none';
                            }}
                        >
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flex: 1,
                                minWidth: 0
                            }}>
                                <Hash className="w-4 h-4" style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                                <span style={{ 
                                    fontSize: '15px', 
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {tag.slice(1)}
                                </span>
                            </div>
                            <div style={{ 
                                backgroundColor: 'var(--primary-color)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 600,
                                flexShrink: 0
                            }}>
                                {count}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
