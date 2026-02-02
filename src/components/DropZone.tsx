import React from 'react';
import { X } from 'lucide-react';

interface DropZoneProps {
    isVisible: boolean;
    onCancel: () => void;
    onDrop: (e: React.DragEvent) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ isVisible, onCancel, onDrop }) => {
    if (!isVisible) return null;

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 50,
                background: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto',
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            onDrop={(e) => {
                onDrop(e);
            }}
        >
            {/* Main Drop Area - Solte para abrir */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '4px dashed var(--accent-color)',
                    margin: '20px',
                    borderRadius: '16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--accent-color)',
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                }}
            >
                Solte para abrir
            </div>

            {/* Cancel Area - Drop on X */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'auto',
                    cursor: 'pointer'
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.style.transform = 'translateX(-50%) scale(1.1)';
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel();
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                }}
            >
                <div
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        marginBottom: '8px'
                    }}
                >
                    <X size={32} color="white" />
                </div>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Solte aqui para cancelar</span>
            </div>
        </div>
    );
};
