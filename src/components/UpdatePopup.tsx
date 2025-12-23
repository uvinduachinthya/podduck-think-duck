import { X, PartyPopper } from 'lucide-react';
import { APP_VERSION, RELEASE_DATE, RELEASE_NOTES } from '../version';

interface UpdatePopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UpdatePopup({ isOpen, onClose }: UpdatePopupProps) {
    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }} />
            <div
                className="settings-modal"
                style={{
                    zIndex: 2001,
                    maxWidth: '450px',
                    height: 'auto',
                    minHeight: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0',
                    overflow: 'hidden'
                }}
            >
                {/* Header with gradient background */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-dark, var(--primary-color)) 100%)',
                    padding: '24px',
                    color: 'white',
                    position: 'relative',
                    textAlign: 'center'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            background: 'rgba(255,255,255,0.2)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'white'
                        }}
                    >
                        <X size={16} />
                    </button>

                    <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <PartyPopper size={24} />
                    </div>

                    <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 600 }}>What's New</h2>
                    <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>Version {APP_VERSION}</p>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <div style={{
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        marginBottom: '16px',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: '0.05em'
                    }}>
                        Released just now • {RELEASE_DATE}
                    </div>

                    <ul style={{
                        margin: 0,
                        padding: '0 0 0 20px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.6
                    }}>
                        {RELEASE_NOTES.map((note, index) => (
                            <li key={index} style={{ marginBottom: '8px' }}>
                                {note}
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={onClose}
                        style={{
                            marginTop: '24px',
                            width: '100%',
                            padding: '10px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Awesome!
                    </button>
                </div>
            </div>
        </>
    );
}
