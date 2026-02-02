import React, { useState } from 'react';
import { Document, Page } from 'react-pdf';

interface PDFViewerProps {
    file: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ file }) => {
    const [numPages, setNumPages] = useState<number | null>(null);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    return (
        <div className="pdf-viewer" style={{ overflow: 'auto', height: '100%', display: 'flex', justifyContent: 'center', background: '#525659' }}>
            <Document file={file} onLoadSuccess={onDocumentLoadSuccess} loading="Carregando PDF...">
                {Array.from(new Array(numPages), (_, index) => (
                    <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="pdf-page"
                        width={600}
                    />
                ))}
            </Document>
        </div>
    );
}
