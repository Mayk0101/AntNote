import React from 'react';
import { PDFViewer } from './PDFViewer';

interface MediaViewerProps {
    path: string;
    type: 'image' | 'video' | 'audio' | 'pdf';
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ path, type }) => {
    const normalizedPath = path.replace(/\\/g, '/');
    const encodedPath = encodeURI(normalizedPath).replace(/#/g, '%23');
    const fileUrl = `file:///${encodedPath}`;

    return (
        <div style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0a',
            overflow: 'auto'
        }}>
            {type === 'image' && (
                <img
                    src={fileUrl}
                    alt="Preview"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                    }}
                />
            )}
            {type === 'video' && (
                <video
                    src={fileUrl}
                    controls
                    autoPlay
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%'
                    }}
                />
            )}
            {type === 'audio' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎵</div>
                    <audio src={fileUrl} controls autoPlay />
                </div>
            )}
            {type === 'pdf' && (
                <PDFViewer file={fileUrl} />
            )}
        </div>
    );
};

export const getMediaType = (fileName: string): 'image' | 'video' | 'audio' | 'pdf' | 'code' => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    return 'code';
};
