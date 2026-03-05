import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import './ProcessingNotice.css';

export default function ProcessingNotice({ isOpen, onClose }) {
    const noticeRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (noticeRef.current && !noticeRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="processing-notice-overlay">
            <div className="processing-notice-container" ref={noticeRef}>
                <div className="processing-notice-icon">
                    <Loader2 size={24} />
                </div>
                <div className="processing-notice-content">
                    <h4>Processing Context</h4>
                    <p>Rekindle is currently analyzing your book. The recap feature will be ready in just a moment. Feel free to start reading in the meantime!</p>
                </div>
            </div>
        </div>
    );
}
