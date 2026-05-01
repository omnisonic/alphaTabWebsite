/**
 * Instrumentation utilities to trace alphaTab's rest displacement algorithm
 * Patches the rendering pipeline to log what's happening
 */

import * as alphaTab from '@coderline/alphatab';

interface RestCollisionOffsetLog {
    beatIndex: number;
    voiceIndex: number;
    isRest: boolean;
    currentY: number;
    collisionDetected: boolean;
    offsetApplied: number;
    linesToPixel: number;
    reservedAreaCount: number;
    timestamp: number;
}

const collisionOffsetLogs: RestCollisionOffsetLog[] = [];

/**
 * Hooks into the score render event to inspect what's happening during rendering
 */
export function instrumentAlphaTab(api: alphaTab.AlphaTabApi): void {
    console.log('=== Instrumenting alphaTab for rest collision analysis ===');

    // Hook into renderFinished to capture detailed rendering info
    const originalRenderFinished = api.renderer?.scoreRenderer?.render;

    // Better approach: hook into the score's render method
    if (api.renderer) {
        console.log('AlphaTab Renderer available, setting up instrumentation');
    }

    // Try to access internal state after rendering
    const originalUpdateSettings = api.updateSettings.bind(api);
    api.updateSettings = function() {
        const result = originalUpdateSettings();
        logRenderingState(api);
        return result;
    };
}

/**
 * Log rendering state after a render completes
 */
export function logRenderingState(api: alphaTab.AlphaTabApi): void {
    if (!api.score) {
        console.log('No score loaded');
        return;
    }

    console.group('=== alphaTab Rendering State ===');

    // Examine the canvas/DOM for rest positions
    const partials = (api as any).partials;
    if (partials) {
        console.log('Partials count:', partials.length);

        // Try to inspect SVG rendering
        inspectSVGRests();
    }

    console.groupEnd();
}

/**
 * Inspect the SVG DOM to see where rests are actually positioned
 */
export function inspectSVGRests(): void {
    const svgElement = document.querySelector('svg');
    if (!svgElement) {
        console.log('No SVG found');
        return;
    }

    console.group('SVG Rest Glyphs Analysis');

    // Find rest symbols - these are typically text elements with specific Unicode
    const textElements = svgElement.querySelectorAll('text');
    const restUnicodes = ['𝄽', '𝄾', '𝄿', '𝅀', '𝅁', '𝅂']; // Rest glyphs in Unicode

    let restElements: Array<{ element: SVGTextElement; y: number; text: string }> = [];

    textElements.forEach((el) => {
        // Check if this is a rest glyph
        if (el.textContent && (
            el.textContent.includes('𝄽') ||
            el.textContent.includes('𝄾') ||
            el.textContent.includes('𝄿') ||
            el.textContent.includes('𝅀') ||
            el.textContent.includes('𝅁') ||
            el.textContent.includes('𝅂') ||
            el.getAttribute('data-glyph') === 'rest' ||
            el.className.baseVal.includes('rest')
        )) {
            const y = parseFloat(el.getAttribute('y') || '0');
            restElements.push({
                element: el,
                y,
                text: el.textContent || ''
            });
        }
    });

    if (restElements.length === 0) {
        console.log('No rest glyphs found by Unicode - searching by attributes...');

        // Alternative: look for elements with y attributes that might be rests
        // Rests are usually positioned on staff lines
        textElements.forEach((el) => {
            if (el.getAttribute('data-note-type') === 'rest' ||
                el.getAttribute('class')?.includes('rest')) {
                const y = parseFloat(el.getAttribute('y') || '0');
                const x = parseFloat(el.getAttribute('x') || '0');
                console.log(`Rest at x=${x}, y=${y}:`, el.textContent?.substring(0, 20));
            }
        });
    } else {
        console.log(`Found ${restElements.length} rest glyphs`);

        // Group rests by Y position to see clustering
        const byY = new Map<number, Array<{ element: SVGTextElement; y: number; text: string }>>();
        restElements.forEach((rest) => {
            const key = Math.round(rest.y / 5) * 5; // Round to nearest 5px
            if (!byY.has(key)) {
                byY.set(key, []);
            }
            byY.get(key)!.push(rest);
        });

        console.log('Rests grouped by Y position:');
        Array.from(byY.entries())
            .sort((a, b) => a[0] - b[0])
            .forEach(([y, rests]) => {
                console.log(`  Y=${y}: ${rests.length} rests`);
                rests.forEach((rest, idx) => {
                    console.log(`    ${idx}: ${rest.text} at (y=${rest.y})`);
                });
            });
    }

    console.groupEnd();
}

/**
 * Check beat information from rendered partials
 */
export function inspectBeatPositions(api: alphaTab.AlphaTabApi): void {
    if (!api.score) return;

    console.group('Beat Y-Position Information');

    const track = api.score.tracks[0];
    const staff = track.staves[0];

    for (let barIndex = 0; barIndex < Math.min(5, staff.bars.length); barIndex++) {
        const bar = staff.bars[barIndex];
        console.group(`Bar ${barIndex}`);

        for (let voiceIndex = 0; voiceIndex < bar.voices.length; voiceIndex++) {
            const voice = bar.voices[voiceIndex];
            if (voice.beats.length === 0) continue;

            console.group(`  Voice ${voiceIndex}`);
            for (const beat of voice.beats.slice(0, 4)) {
                if (beat.isRest) {
                    console.log(
                        `    Beat ${beat.index}: REST at playbackStart=${beat.playbackStart}, ` +
                        `duration=${beat.displayDuration}, voice.index=${voice.index}`
                    );
                }
            }
            console.groupEnd();
        }

        console.groupEnd();
    }

    console.groupEnd();
}

/**
 * Inspect the score structure - tracks and staves
 */
export function inspectScoreStructure(api: alphaTab.AlphaTabApi): void {
    if (!api.score) {
        console.log('No score loaded');
        return;
    }

    console.group('=== Score Structure Analysis ===');
    console.log(`Total Tracks: ${api.score.tracks.length}`);

    for (let trackIndex = 0; trackIndex < api.score.tracks.length; trackIndex++) {
        const track = api.score.tracks[trackIndex];
        console.group(`Track ${trackIndex}: ${track.name}`);
        console.log(`  Staves: ${track.staves.length}`);

        for (let staffIndex = 0; staffIndex < track.staves.length; staffIndex++) {
            const staff = track.staves[staffIndex];
            console.group(`  Staff ${staffIndex}`);
            console.log(`    Bars: ${staff.bars.length}`);

            // Analyze first few bars
            let hasNotes = 0;
            let hasRests = 0;
            let totalBeats = 0;

            for (let barIndex = 0; barIndex < Math.min(3, staff.bars.length); barIndex++) {
                const bar = staff.bars[barIndex];
                for (let voiceIndex = 0; voiceIndex < bar.voices.length; voiceIndex++) {
                    const voice = bar.voices[voiceIndex];
                    for (const beat of voice.beats) {
                        totalBeats++;
                        if (beat.isRest) {
                            hasRests++;
                        } else {
                            hasNotes++;
                        }
                    }
                }
            }

            console.log(`    First 3 bars: ${hasNotes} notes, ${hasRests} rests, ${totalBeats} total beats`);
            console.groupEnd();
        }

        console.groupEnd();
    }

    console.groupEnd();
}

/**
 * Detailed analysis: check if Pavena has notes and rests in same staff or different tracks
 */
export function analyzeRestVsNoteDistribution(api: alphaTab.AlphaTabApi): void {
    if (!api.score) {
        console.log('No score loaded');
        return;
    }

    console.group('=== Rest vs Note Distribution Analysis ===');

    // For each track, check the first staff
    for (let trackIndex = 0; trackIndex < api.score.tracks.length; trackIndex++) {
        const track = api.score.tracks[trackIndex];
        if (track.staves.length === 0) continue;

        const staff = track.staves[0];
        console.group(`Track ${trackIndex} (${track.name}) - Staff 0`);

        // Check bar 0
        if (staff.bars.length > 0) {
            const bar = staff.bars[0];
            const voiceContents = new Map<number, { hasNotes: boolean; hasRests: boolean }>();

            for (let voiceIndex = 0; voiceIndex < bar.voices.length; voiceIndex++) {
                const voice = bar.voices[voiceIndex];
                let hasNotes = false;
                let hasRests = false;

                for (const beat of voice.beats) {
                    if (beat.isRest) {
                        hasRests = true;
                    } else {
                        hasNotes = true;
                    }
                }

                voiceContents.set(voiceIndex, { hasNotes, hasRests });
            }

            // Report
            let voiceWithNotes = -1;
            let voiceWithRests: number[] = [];

            for (const [voiceIdx, content] of voiceContents) {
                if (content.hasNotes) voiceWithNotes = voiceIdx;
                if (content.hasRests) voiceWithRests.push(voiceIdx);
            }

            console.log(`Bar 0 analysis:`);
            console.log(`  Voices with notes: ${voiceWithNotes >= 0 ? voiceWithNotes : 'none'}`);
            console.log(`  Voices with rests: ${voiceWithRests.length > 0 ? voiceWithRests.join(', ') : 'none'}`);

            if (voiceWithNotes >= 0 && voiceWithRests.length > 0) {
                console.log(`  ✓ SAME STAFF: Notes in voice ${voiceWithNotes}, rests in voice(s) ${voiceWithRests.join(', ')}`);
            }
        }

        console.groupEnd();
    }

    console.groupEnd();
}

/**
 * Get summary of what we found
 */
export function getSummary(): {
    collisionsDetected: number;
    offsetsApplied: number;
    averageOffset: number;
} {
    const appliedOffsets = collisionOffsetLogs.filter(log => log.offsetApplied !== 0);

    return {
        collisionsDetected: collisionOffsetLogs.filter(log => log.collisionDetected).length,
        offsetsApplied: appliedOffsets.length,
        averageOffset: appliedOffsets.length > 0
            ? appliedOffsets.reduce((sum, log) => sum + log.offsetApplied, 0) / appliedOffsets.length
            : 0
    };
}
