import React from 'react';

export default function RecapSkeleton() {
    return (
        <div style={styles.container}>
            {/* DB RAG Loading Indication */}
            <div style={styles.ragStatus}>
                <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '50%' }}></div>
                <div style={{ color: 'var(--accent-color)', fontWeight: 500 }}>Querying local Vector Database for semantic context...</div>
            </div>

            <div style={styles.twoColumn}>
                <div style={styles.column}>
                    <div className="skeleton" style={{ height: '30px', width: '40%', marginBottom: '30px' }}></div>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ marginBottom: '24px' }}>
                            <div className="skeleton" style={{ height: '20px', width: '90%', marginBottom: '12px' }}></div>
                            <div className="skeleton" style={{ height: '20px', width: '85%', marginBottom: '12px' }}></div>
                            <div className="skeleton" style={{ height: '20px', width: '95%', marginBottom: '12px' }}></div>
                        </div>
                    ))}
                </div>

                <div style={styles.divider}></div>

                <div style={styles.column}>
                    <div className="skeleton" style={{ height: '30px', width: '35%', marginBottom: '30px' }}></div>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ marginBottom: '20px', display: 'flex', gap: '16px' }}>
                            <div className="skeleton" style={{ height: '48px', width: '48px', borderRadius: '8px', flexShrink: 0 }}></div>
                            <div style={{ width: '100%' }}>
                                <div className="skeleton" style={{ height: '20px', width: '40%', marginBottom: '8px' }}></div>
                                <div className="skeleton" style={{ height: '16px', width: '80%' }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: '40px 32px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    },
    ragStatus: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '12px',
        marginBottom: '40px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
    },
    twoColumn: {
        display: 'flex',
        flex: 1,
    },
    column: {
        flex: 1,
        padding: '0 20px',
    },
    divider: {
        width: '1px',
        backgroundColor: 'var(--surface-hover)',
        margin: '0 20px'
    }
};
