
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

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

    const defaultMessage = `Are you sure you want to delete <strong style="color: var(--text-primary)">${fileName}</strong>? This action cannot be undone.`;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <Dialog.Portal>
                <Dialog.Overlay 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        backdropFilter: 'blur(1px)'
                    }} 
                />
                <Dialog.Content 
                    aria-describedby="delete-desc"
                    style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'var(--bg-primary)',
                        padding: '24px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                        width: '100%',
                        maxWidth: '400px',
                        border: '1px solid var(--sidebar-border)',
                        color: 'var(--text-primary)',
                        zIndex: 100000,
                        outline: 'none'
                    }}
                >
                    <Dialog.Title style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>{title}</Dialog.Title>
                    <div 
                        id="delete-desc"
                        style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}
                        dangerouslySetInnerHTML={{ __html: message || defaultMessage }}
                    />

                    {showDontAskAgain && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                            <Checkbox.Root
                                className="checkbox-root"
                                id="dontAsk"
                                checked={dontAsk}
                                onCheckedChange={(checked) => setDontAsk(checked === true)}
                                style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-color)',
                                    marginRight: '8px',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                <Checkbox.Indicator className="checkbox-indicator">
                                    <Check className="w-3 h-3" style={{ width: '14px', height: '14px', color: 'var(--primary-color)' }} />
                                </Checkbox.Indicator>
                            </Checkbox.Root>
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
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
