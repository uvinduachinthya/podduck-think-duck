import { AlertTriangle } from 'lucide-react';

export function BrowserNotSupported() {
    return (
        <div style={{
            height: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            padding: '20px',
            textAlign: 'center'
        }}>
            <div style={{
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'rgba(255, 77, 79, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger-color, #ff4d4f)' }} />
            </div>

            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>Browser Not Supported</h1>

            <p style={{ maxWidth: '500px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                This application requires advanced file system access capabilities that are currently only available in Chromium-based browsers.
            </p>

            <div style={{ textAlign: 'left', backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <p style={{ listStyle: 'none', margin: 0, fontWeight: 600, marginBottom: '12px' }}>Please use one of the following browsers:</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#4285F4' }}>●</span> Google Chrome
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#0078D7' }}>●</span> Microsoft Edge
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#FF1B2D' }}>●</span> Opera
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#FF5722' }}>●</span> Brave
                    </li>
                </ul>
            </div>
        </div>
    );
}
