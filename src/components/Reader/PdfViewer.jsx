import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the worker for pdfjs to use the unpkg CDN (avoids Vite asset bundling 500 errors)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ file, pageNumber, onPageChange }) {
    const [numPages, setNumPages] = useState(null);

    function onDocumentLoadSuccess({ numPages }) {
        setNumPages(numPages);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', flex: 1, overflowY: 'auto' }}>
            <Document
                file={file}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                    <div style={{ color: 'var(--text-secondary)', padding: '2rem' }}>
                        Loading PDF...
                    </div>
                }
            >
                <Page
                    pageNumber={pageNumber}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    className="pdf-page"
                    width={Math.min(window.innerWidth - 64, 800)} // More dynamic width
                />
            </Document>

            {numPages && (
                <div style={{ margin: '1rem 0', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        className="btn-secondary"
                        disabled={pageNumber <= 1}
                        onClick={() => onPageChange(pageNumber - 1)}
                        style={{ minWidth: '100px' }}
                    >
                        Previous
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {pageNumber} / {numPages}
                    </span>
                    <button
                        className="btn-secondary"
                        disabled={pageNumber >= numPages}
                        onClick={() => onPageChange(pageNumber + 1)}
                        style={{ minWidth: '100px' }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
