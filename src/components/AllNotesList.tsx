import { useMemo } from 'react';
import { useFileSystem, type FileNode } from '../context/FileSystemContext';
import { format } from 'date-fns';
import { FileText, Clock } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

export function AllNotesList({ onSelect, hideHeader = false }: { onSelect: (file: FileNode) => void; hideHeader?: boolean }) {
    const { files } = useFileSystem();

    // Sort all notes by last modified date (newest first)
    const sortedNotes = useMemo(() => {
        return [...files].sort((a, b) => {
            const aTime = a.lastModified || 0;
            const bTime = b.lastModified || 0;
            return bTime - aTime; // Newest first
        });
    }, [files]);

    const formatDate = (timestamp: number | undefined) => {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return format(date, 'MMM d, yyyy');
    };

    const formatTime = (timestamp: number | undefined) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return format(date, 'h:mm a');
    };

    const NoteCard = ({ file }: { file: FileNode }) => {
        return (
            <div
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
                        margin: '0 0 4px 0', 
                        fontSize: '16px', 
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {file.name.replace('.md', '')}
                    </h3>
                    <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--text-secondary)', 
                        display: 'flex', 
                        gap: '12px',
                        alignItems: 'center'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock className="w-3 h-3" />
                            {formatDate(file.lastModified)}
                        </span>
                        {file.lastModified && (
                            <span style={{ opacity: 0.7 }}>
                                {formatTime(file.lastModified)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!hideHeader && (
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText className="w-6 h-6" />
                    All Notes
                </h1>
            )}

            {sortedNotes.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No notes found. Create your first note!
                </div>
            ) : (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <Virtuoso
                        style={{ height: '100%' }}
                        data={sortedNotes}
                        itemContent={(index, file) => (
                            <div style={{ marginBottom: index < sortedNotes.length - 1 ? '12px' : 0 }}>
                                <NoteCard file={file} />
                            </div>
                        )}
                    />
                </div>
            )}
        </div>
    );
}
