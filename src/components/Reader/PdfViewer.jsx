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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflowY: 'auto' }}>
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
                    width={Math.min(window.innerWidth * 0.8, 600)} // Responsive width constraint
                />
            </Document>

            {numPages && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button
                        className="btn-secondary"
                        disabled={pageNumber <= 1}
                        onClick={() => onPageChange(pageNumber - 1)}
                    >
                        Previous
                    </button>
                    <span style={{ color: 'var(--text-secondary)' }}>
                        Page {pageNumber} of {numPages}
                    </span>
                    <button
                        className="btn-secondary"
                        disabled={pageNumber >= numPages}
                        onClick={() => onPageChange(pageNumber + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
