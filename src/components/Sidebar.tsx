import { Folder, FileText as NoteIcon } from 'lucide-react';
import { useFileSystem } from '../hooks/useFileSystem';

export function Sidebar() {
    const { folderName, files, currentFile, openDirectory, selectFile } = useFileSystem();

    return (
        <div style={{
            width: 'var(--sidebar-width)',
            backgroundColor: 'var(--sidebar-bg)',
            color: 'var(--sidebar-text)',
            borderRight: '1px solid var(--sidebar-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Folder Header */}
            <div
                onClick={openDirectory}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    backgroundColor: 'var(--sidebar-hover)',
                    transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-active)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'}
            >
                <Folder className="w-[18px] h-[18px]" style={{ width: '18px', height: '18px' }} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                    {folderName || 'Open Folder...'}
                </span>
            </div>

            {/* File List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
                {files.length > 0 && (
                    <div>
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--sidebar-text-muted)',
                            padding: '8px 8px 4px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            Notes ({files.length})
                        </div>
                        {files.map(file => (
                            <div
                                key={file.path}
                                onClick={() => selectFile(file)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 12px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    backgroundColor: currentFile?.path === file.path ? 'var(--sidebar-active)' : 'transparent',
                                    transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    if (currentFile?.path !== file.path) {
                                        e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                                    }
                                }}
                                onMouseOut={(e) => {
                                    if (currentFile?.path !== file.path) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <NoteIcon className="w-4 h-4" style={{ width: '16px', height: '16px', opacity: 0.7, flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.name.replace('.md', '')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {folderName && files.length === 0 && (
                    <div style={{
                        padding: '16px',
                        fontSize: '12px',
                        color: 'var(--sidebar-text-muted)',
                        fontStyle: 'italic'
                    }}>
                        No .md files found
                    </div>
                )}
            </div>
        </div>
    );
}
