'use client';

import React, { useEffect, useState } from 'react';
import * as alphaTab from '@coderline/alphatab';
import { debugScore, analyzeRestCollisions, BarDebugInfo, RestCollisionAnalysis, printBarDebug, printCollisionAnalysis } from '@site/src/utils/scoreDebugger';
import { inspectSVGRests, inspectBeatPositions, inspectScoreStructure, analyzeRestVsNoteDistribution } from '@site/src/utils/alphaTabInstrumentation';
import styles from './styles.module.scss';

interface DebugPanelProps {
    api: alphaTab.AlphaTabApi | null;
    isOpen: boolean;
    onClose: () => void;
}

export const ScoreDebugger: React.FC<DebugPanelProps> = ({ api, isOpen, onClose }) => {
    const [multiVoiceBars, setMultiVoiceBars] = useState<BarDebugInfo[]>([]);
    const [collisionAnalysis, setCollisionAnalysis] = useState<RestCollisionAnalysis[]>([]);
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

    useEffect(() => {
        if (!api || !api.score) return;

        // Debug the score
        const multiVoice = debugScore(api.score);
        setMultiVoiceBars(multiVoice);

        // Analyze collisions for each multi-voice bar
        const collisions: RestCollisionAnalysis[] = [];
        for (const track of api.score.tracks) {
            for (const staff of track.staves) {
                for (const bar of staff.bars) {
                    const analysis = analyzeRestCollisions(bar);
                    if (analysis.hasCollisions) {
                        collisions.push(analysis);
                    }
                }
            }
        }
        setCollisionAnalysis(collisions);

        // Log to console for inspection
        console.log('=== Score Debug Info ===');
        console.log(`Found ${multiVoice.length} multi-voice bars`);
        console.log(`Found ${collisions.length} bars with collision potential`);

        for (const barDebug of multiVoice.slice(0, 5)) {
            printBarDebug(barDebug);
        }

        for (const analysis of collisions.slice(0, 5)) {
            printCollisionAnalysis(analysis);
        }
    }, [api?.score]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 200,
            right: 20,
            width: 400,
            maxHeight: 500,
            background: '#f5f5f5',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: 16,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Score Debugger</h3>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 20,
                        cursor: 'pointer',
                        padding: 0
                    }}>
                    ×
                </button>
            </div>

            <div style={{ marginBottom: 12 }}>
                <h4>Multi-Voice Bars: {multiVoiceBars.length}</h4>
                <div style={{ fontSize: 12 }}>
                    {multiVoiceBars.slice(0, 10).map((bar, idx) => (
                        <div
                            key={idx}
                            onClick={() => setSelectedBarIndex(bar.barIndex)}
                            style={{
                                padding: '8px',
                                background: selectedBarIndex === bar.barIndex ? '#e3f2fd' : '#fff',
                                border: '1px solid #ddd',
                                marginBottom: 4,
                                cursor: 'pointer',
                                borderRadius: 4
                            }}>
                            <strong>Bar {bar.barIndex}</strong>: {bar.voicesWithContent} voices
                        </div>
                    ))}
                </div>
            </div>

            {selectedBarIndex !== null && (
                <div style={{ marginBottom: 12 }}>
                    <h4>Collision Analysis</h4>
                    {collisionAnalysis
                        .filter(a => a.barIndex === selectedBarIndex)
                        .map((analysis, idx) => (
                            <div key={idx} style={{ fontSize: 12, background: '#fff3cd', padding: 8, borderRadius: 4 }}>
                                <div><strong>Potential collisions: {analysis.potentialCollisions.length}</strong></div>
                                {analysis.potentialCollisions.map((coll, cidx) => (
                                    <div key={cidx} style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #ffc107' }}>
                                        <div>Time: {coll.playbackTime}</div>
                                        <div>{coll.reason}</div>
                                        {coll.beats.map((beat, bidx) => (
                                            <div key={bidx} style={{ marginLeft: 8 }}>
                                                Voice {beat.voiceIndex}: {beat.isRest ? 'REST' : 'NOTE'}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}

                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => {
                                console.clear();
                                inspectScoreStructure(api!);
                            }}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: '#ff6b6b',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                minWidth: '80px'
                            }}>
                            Score Structure
                        </button>
                        <button
                            onClick={() => {
                                console.clear();
                                analyzeRestVsNoteDistribution(api!);
                            }}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: '#51cf66',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                minWidth: '80px'
                            }}>
                            Rest/Note Analysis
                        </button>
                        <button
                            onClick={() => {
                                console.clear();
                                console.log('=== SVG Rest Position Analysis ===');
                                inspectSVGRests();
                                inspectBeatPositions(api!);
                            }}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                background: '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                fontSize: 11,
                                minWidth: '80px'
                            }}>
                            SVG Rests
                        </button>
                    </div>
                </div>
            )}

            <div style={{ fontSize: 11, color: '#666' }}>
                Check console for detailed logs (press F12)
            </div>
        </div>
    );
};
