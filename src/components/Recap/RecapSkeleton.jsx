import React from 'react';

export default function RecapSkeleton() {
    return (
        <div className="skeleton-container">
            <div className="rag-status-box animate-in">
                <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }}></div>
                <div style={{ fontWeight: 600 }}>Querying local Vector Database for semantic context...</div>
            </div>

            <div className="skeleton-two-column animate-in" style={{ animationDelay: '0.1s' }}>
                <div className="skeleton-column">
                    <div className="skeleton" style={{ height: '28px', width: '40%', marginBottom: '24px' }}></div>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ marginBottom: '20px' }}>
                            <div className="skeleton" style={{ height: '16px', width: '90%', marginBottom: '10px' }}></div>
                            <div className="skeleton" style={{ height: '16px', width: '85%', marginBottom: '10px' }}></div>
                            <div className="skeleton" style={{ height: '16px', width: '95%', marginBottom: '10px' }}></div>
                        </div>
                    ))}
                </div>

                <div className="skeleton-divider"></div>

                <div className="skeleton-column">
                    <div className="skeleton" style={{ height: '28px', width: '35%', marginBottom: '24px' }}></div>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                            <div className="skeleton" style={{ height: '40px', width: '40px', borderRadius: '50%', flexShrink: 0 }}></div>
                            <div style={{ width: '100%', paddingTop: '4px' }}>
                                <div className="skeleton" style={{ height: '16px', width: '40%', marginBottom: '6px' }}></div>
                                <div className="skeleton" style={{ height: '12px', width: '70%' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
