import { useFileSystem } from '../hooks/useFileSystem';

export function MainContent() {
    const { currentFile } = useFileSystem();

    return (
        <div style={{
            flex: 1,
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: '40px',
            height: '100%',
            overflow: 'auto'
        }}>
            {currentFile ? (
                <div>
                    <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>
                        {currentFile.name.replace('.md', '')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        File selected ✓ (Next: Editor)
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '18px', marginBottom: '8px' }}>No note selected</p>
                        <p style={{ fontSize: '14px' }}>Open a folder and select a file from the sidebar</p>
                    </div>
                </div>
            )}
        </div>
    );
}
