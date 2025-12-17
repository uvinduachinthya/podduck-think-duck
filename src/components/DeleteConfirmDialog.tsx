import { useState } from 'react';

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    fileName: string;
    onConfirm: (dontAskAgain: boolean) => void;
    onCancel: () => void;
    title?: string;
    message?: string;
    confirmButtonText?: string;
    showDontAskAgain?: boolean;
}

export function DeleteConfirmDialog({
    isOpen,
    fileName,
    onConfirm,
    onCancel,
    title = 'Confirm Deletion',
    message,
    confirmButtonText = 'Delete',
    showDontAskAgain = true
}: DeleteConfirmDialogProps) {
    const [dontAsk, setDontAsk] = useState(false);

    if (!isOpen) return null;

    const defaultMessage = `Are you sure you want to delete <strong style="color: var(--text-primary)">${fileName}</strong>? This action cannot be undone.`;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999, // Ensure it's on top of everything
        }}>
            <div style={{
                backgroundColor: 'var(--bg-primary)',
                padding: '24px',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                width: '100%',
                maxWidth: '400px',
                border: '1px solid var(--sidebar-border)',
                color: 'var(--text-primary)',
            }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>{title}</h3>
                <p
                    style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}
                    dangerouslySetInnerHTML={{ __html: message || defaultMessage }}
                />

                {showDontAskAgain && (
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                        <input
                            type="checkbox"
                            id="dontAsk"
                            checked={dontAsk}
                            onChange={(e) => setDontAsk(e.target.checked)}
                            style={{ marginRight: '8px', cursor: 'pointer' }}
                        />
                        <label htmlFor="dontAsk" style={{ fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                            Don't ask me again
                        </label>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onCancel}
                        className="btn btn-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(dontAsk)}
                        className="btn btn-danger"
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}
