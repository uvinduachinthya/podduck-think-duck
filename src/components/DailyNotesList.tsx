import { useMemo } from 'react';
import { useFileSystem, type FileNode } from '../context/FileSystemContext';
import { format, parse, compareDesc } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';

function isDailyNote(filename: string): boolean {
    const nameWithoutExt = filename.replace('.md', '');
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(nameWithoutExt)) return true;
    // Match "October 20th, 2025"
    return /^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(nameWithoutExt);
}

function parseDailyNoteDate(filename: string): Date | null {
    const name = filename.replace('.md', '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
        return parse(name, 'yyyy-MM-dd', new Date());
    }
    try {
        if (/^[A-Za-z]+ \d{1,2}(?:st|nd|rd|th), \d{4}$/.test(name)) {
            return parse(name, 'MMMM do, yyyy', new Date());
        }
    } catch (e) {
        return null;
    }
    return null;
}

export function DailyNotesList({ onSelect, hideHeader = false }: { onSelect: (file: FileNode) => void; hideHeader?: boolean }) {
    const { files } = useFileSystem();

    const dailyNotes = useMemo(() => {
        return files
            .filter(f => isDailyNote(f.name))
            .map(f => ({
                file: f,
                date: parseDailyNoteDate(f.name)
            }))
            .filter(item => item.date !== null)
            .sort((a, b) => compareDesc(a.date!, b.date!)); // Newest first
    }, [files]);

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            {!hideHeader && (
                <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar className="w-6 h-6" />
                    Daily Notes
                </h1>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dailyNotes.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        No daily notes found. Start by clicking "Today" in the sidebar!
                    </div>
                ) : (
                    dailyNotes.map(({ file, date }) => (
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
                                color: 'var(--primary-color)'
                            }}>
                                <Calendar className="w-5 h-5" />
                            </div>
                            
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 500 }}>
                                    {format(date!, 'MMMM do, yyyy')}
                                </h3>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock className="w-3 h-3" />
                                        {format(date!, 'EEEE')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
