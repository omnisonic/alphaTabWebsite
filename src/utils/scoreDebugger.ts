/**
 * Utility functions to debug and inspect alphaTab score structure
 * Helps diagnose why rest displacement might not be working
 */

import * as alphaTab from '@coderline/alphatab';

export interface VoiceInfo {
    voiceIndex: number;
    beatCount: number;
    restCount: number;
    noteCount: number;
    beats: BeatInfo[];
}

export interface BeatInfo {
    beatIndex: number;
    isRest: boolean;
    duration: string;
    playbackStart: number;
    playbackDuration: number;
    noteCount: number;
    voiceIndex: number;
}

export interface BarDebugInfo {
    barIndex: number;
    voices: VoiceInfo[];
    hasMultipleVoices: boolean;
    voicesWithContent: number;
}

/**
 * Analyzes a single bar to understand its voice structure
 */
export function debugBar(bar: alphaTab.model.Bar): BarDebugInfo {
    const voices: VoiceInfo[] = [];
    let voicesWithContent = 0;

    for (let voiceIndex = 0; voiceIndex < bar.voices.length; voiceIndex++) {
        const voice = bar.voices[voiceIndex];
        const beatInfo: BeatInfo[] = [];
        let restCount = 0;
        let noteCount = 0;

        for (const beat of voice.beats) {
            if (beat.isRest) {
                restCount++;
            } else {
                noteCount += beat.notes.length;
            }

            beatInfo.push({
                beatIndex: beat.index,
                isRest: beat.isRest,
                duration: getDurationName(beat.duration),
                playbackStart: beat.playbackStart,
                playbackDuration: beat.playbackDuration,
                noteCount: beat.notes.length,
                voiceIndex
            });
        }

        if (beatInfo.length > 0) {
            voicesWithContent++;
        }

        voices.push({
            voiceIndex,
            beatCount: voice.beats.length,
            restCount,
            noteCount,
            beats: beatInfo
        });
    }

    return {
        barIndex: bar.index,
        voices,
        hasMultipleVoices: voicesWithContent > 1,
        voicesWithContent
    };
}

/**
 * Analyzes the entire score to find bars with multi-voice content
 */
export function debugScore(score: alphaTab.model.Score): BarDebugInfo[] {
    const results: BarDebugInfo[] = [];

    for (const track of score.tracks) {
        for (const staff of track.staves) {
            for (const bar of staff.bars) {
                const barDebug = debugBar(bar);
                if (barDebug.voicesWithContent > 1) {
                    results.push(barDebug);
                }
            }
        }
    }

    return results;
}

/**
 * Detailed analysis of a specific bar's rest collision potential
 */
export function analyzeRestCollisions(bar: alphaTab.model.Bar): RestCollisionAnalysis {
    const collisions: PotentialCollision[] = [];
    const timePositionMap = new Map<number, BeatInfo[]>();

    // Group beats by playback start time
    for (let voiceIndex = 0; voiceIndex < bar.voices.length; voiceIndex++) {
        const voice = bar.voices[voiceIndex];
        for (const beat of voice.beats) {
            if (!timePositionMap.has(beat.playbackStart)) {
                timePositionMap.set(beat.playbackStart, []);
            }
            timePositionMap.get(beat.playbackStart)!.push({
                beatIndex: beat.index,
                isRest: beat.isRest,
                duration: getDurationName(beat.duration),
                playbackStart: beat.playbackStart,
                playbackDuration: beat.playbackDuration,
                noteCount: beat.notes.length,
                voiceIndex
            });
        }
    }

    // Check for potential collisions
    for (const [timePos, beats] of timePositionMap) {
        if (beats.length > 1) {
            const hasNote = beats.some(b => !b.isRest);
            const hasRest = beats.some(b => b.isRest);

            if (hasNote && hasRest) {
                collisions.push({
                    playbackTime: timePos,
                    beats,
                    shouldTriggerDisplacement: true,
                    reason: 'Rest and note at same time position'
                });
            }
        }
    }

    return {
        barIndex: bar.index,
        potentialCollisions: collisions,
        hasCollisions: collisions.length > 0
    };
}

export interface PotentialCollision {
    playbackTime: number;
    beats: BeatInfo[];
    shouldTriggerDisplacement: boolean;
    reason: string;
}

export interface RestCollisionAnalysis {
    barIndex: number;
    potentialCollisions: PotentialCollision[];
    hasCollisions: boolean;
}

/**
 * Get human-readable duration name
 */
function getDurationName(duration: alphaTab.model.Duration): string {
    if (duration.value === 1) return 'Whole';
    if (duration.value === 2) return 'Half';
    if (duration.value === 4) return 'Quarter';
    if (duration.value === 8) return 'Eighth';
    if (duration.value === 16) return '16th';
    if (duration.value === 32) return '32nd';
    return `${duration.value}`;
}

/**
 * Print debug info to console in a readable format
 */
export function printBarDebug(barDebug: BarDebugInfo): void {
    console.group(`Bar ${barDebug.barIndex} - ${barDebug.voicesWithContent} voices with content`);

    for (const voice of barDebug.voices) {
        if (voice.beatCount === 0) continue;

        console.group(`  Voice ${voice.voiceIndex}`);
        console.log(`    Beats: ${voice.beatCount}, Rests: ${voice.restCount}, Notes: ${voice.noteCount}`);

        for (const beat of voice.beats) {
            const type = beat.isRest ? 'REST' : `NOTE (${beat.noteCount})`;
            console.log(
                `      Beat ${beat.beatIndex}: ${type} [${beat.duration}] ` +
                `start=${beat.playbackStart} duration=${beat.playbackDuration}`
            );
        }
        console.groupEnd();
    }

    console.groupEnd();
}

/**
 * Print collision analysis to console
 */
export function printCollisionAnalysis(analysis: RestCollisionAnalysis): void {
    console.group(`Bar ${analysis.barIndex} - Rest Collision Analysis`);

    if (!analysis.hasCollisions) {
        console.log('No potential collisions detected');
    } else {
        for (const collision of analysis.potentialCollisions) {
            console.group(`  Time position ${collision.playbackTime}`);
            console.log(`  ${collision.reason}`);

            for (const beat of collision.beats) {
                const type = beat.isRest ? 'REST' : 'NOTE';
                console.log(`    Voice ${beat.voiceIndex}: ${type}`);
            }
            console.groupEnd();
        }
    }

    console.groupEnd();
}
