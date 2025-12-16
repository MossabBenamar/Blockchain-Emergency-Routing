/**
 * Conflict Resolution Service
 * 
 * Handles automatic priority-based conflict resolution for emergency vehicle routing.
 * - Higher priority (lower number) always wins segment conflicts
 * - Same priority: First-come-first-served (existing reservation wins)
 * - Losing missions are automatically rerouted to alternative paths
 * - If no alternative path exists, the mission is aborted
 */

import { broadcastMessage } from '../realtime/websocket';
import * as missionService from '../fabric/mission.service';
import * as segmentService from '../fabric/segment.service';
import * as couchdb from '../couchdb';
import routingService from '../routing';
import { Mission, Conflict, Segment } from '../../models/types';

// Conflict resolution history entry
interface ConflictResolutionEntry {
    conflictId: string;
    timestamp: number;
    segmentId: string;
    winnerMissionId: string;
    winnerPriority: number;
    loserMissionId: string;
    loserPriority: number;
    resolution: 'preempted' | 'fcfs' | 'rejected';
    loserOutcome: 'rerouted' | 'aborted' | 'pending';
    newPath?: string[];
}

// In-memory conflict history (could be persisted to database)
const conflictHistory: ConflictResolutionEntry[] = [];
const MAX_HISTORY_SIZE = 100;

/**
 * Handle a conflict between two missions competing for the same segment
 * @param conflict The conflict object from the blockchain
 * @returns Resolution result
 */
export async function handleConflict(conflict: Conflict): Promise<{
    winner: string;
    loser: string;
    loserRerouted: boolean;
    newPath?: string[];
}> {
    console.log(`[ConflictService] Handling conflict ${conflict.conflictId}`);
    console.log(`  Segment: ${conflict.segmentId}`);
    console.log(`  Mission1: ${conflict.mission1Id} (priority ${conflict.priority1})`);
    console.log(`  Mission2: ${conflict.mission2Id} (priority ${conflict.priority2})`);

    let winner: string;
    let loser: string;
    let resolution: 'preempted' | 'fcfs' | 'rejected';

    // Determine winner based on priority
    if (conflict.priority1 < conflict.priority2) {
        // Mission 1 has higher priority (lower number wins)
        winner = conflict.mission1Id;
        loser = conflict.mission2Id;
        resolution = 'preempted';
    } else if (conflict.priority2 < conflict.priority1) {
        // Mission 2 has higher priority
        winner = conflict.mission2Id;
        loser = conflict.mission1Id;
        resolution = 'preempted';
    } else {
        // Same priority - First Come First Served
        // Mission 1 already has the segment, so Mission 1 wins
        winner = conflict.mission1Id;
        loser = conflict.mission2Id;
        resolution = 'fcfs';
    }

    console.log(`[ConflictService] Resolution: ${winner} wins (${resolution})`);

    // Try to reroute the losing mission
    const rerouteResult = await rerouteMission(loser, [conflict.segmentId]);

    // Record in history
    const historyEntry: ConflictResolutionEntry = {
        conflictId: conflict.conflictId,
        timestamp: Date.now(),
        segmentId: conflict.segmentId,
        winnerMissionId: winner,
        winnerPriority: winner === conflict.mission1Id ? conflict.priority1 : conflict.priority2,
        loserMissionId: loser,
        loserPriority: loser === conflict.mission1Id ? conflict.priority1 : conflict.priority2,
        resolution,
        loserOutcome: rerouteResult.success ? 'rerouted' : 'aborted',
        newPath: rerouteResult.newPath,
    };
    addToHistory(historyEntry);

    // Broadcast conflict resolution event
    broadcastMessage({
        type: 'CONFLICT_RESOLVED',
        payload: {
            conflictId: conflict.conflictId,
            winner,
            loser,
            segmentId: conflict.segmentId,
            resolution,
            loserRerouted: rerouteResult.success,
            newPath: rerouteResult.newPath,
        },
        timestamp: Date.now(),
    });

    return {
        winner,
        loser,
        loserRerouted: rerouteResult.success,
        newPath: rerouteResult.newPath,
    };
}

/**
 * Preempt segments from a lower-priority mission for a higher-priority mission
 * @param preemptorMissionId The mission taking over the segments
 * @param targetMissionId The mission losing the segments
 * @param segments The segments to preempt
 */
export async function preemptMission(
    preemptorMissionId: string,
    targetMissionId: string,
    segments: string[]
): Promise<{ success: boolean; targetRerouted: boolean; newPath?: string[] }> {
    console.log(`[ConflictService] Preempting segments ${segments.join(', ')} from ${targetMissionId} for ${preemptorMissionId}`);

    // Get the target mission
    const targetMission = await couchdb.getMission(targetMissionId);
    if (!targetMission || targetMission.status !== 'active') {
        console.log(`[ConflictService] Target mission ${targetMissionId} not found or not active`);
        return { success: false, targetRerouted: false };
    }

    // Broadcast preemption event
    broadcastMessage({
        type: 'MISSION_PREEMPTED',
        payload: {
            preemptorMissionId,
            targetMissionId,
            preemptedSegments: segments,
        },
        timestamp: Date.now(),
    });

    // Try to reroute the target mission
    const rerouteResult = await rerouteMission(targetMissionId, segments);

    return {
        success: true,
        targetRerouted: rerouteResult.success,
        newPath: rerouteResult.newPath,
    };
}

/**
 * Reroute a mission to avoid specified segments
 * @param missionId The mission to reroute
 * @param excludeSegments Segments to avoid in the new route
 */
export async function rerouteMission(
    missionId: string,
    excludeSegments: string[]
): Promise<{ success: boolean; newPath?: string[]; error?: string }> {
    console.log(`[ConflictService] Attempting to reroute mission ${missionId}`);
    console.log(`  Excluding segments: ${excludeSegments.join(', ')}`);

    try {
        // Get the mission
        const mission = await couchdb.getMission(missionId);
        if (!mission) {
            return { success: false, error: 'Mission not found' };
        }

        if (mission.status !== 'active') {
            return { success: false, error: `Mission is not active (status: ${mission.status})` };
        }

        // Get current segment statuses
        const segments = await couchdb.getAllSegments();
        const segmentMap = new Map<string, Segment>();
        segments.forEach(seg => segmentMap.set(seg.segmentId, seg));

        // Find the vehicle's current position (first segment in path that's still reserved/occupied)
        // For now, assume vehicle is at the start of its path
        // In a real implementation, we'd check simulation state for current position

        // Get origin node from the current path
        let startNode = mission.originNode;

        // If mission is active and has a path, try to find current position
        if (mission.path && mission.path.length > 0) {
            const firstSegment = segmentMap.get(mission.path[0]);
            if (firstSegment) {
                startNode = firstSegment.fromNode;
            }
        }

        // Calculate new route excluding the contested segments
        const newRoute = routingService.calculateRoute(
            startNode,
            mission.destNode,
            mission.priorityLevel,
            segmentMap as any,
            excludeSegments
        );

        if (!newRoute.success) {
            console.log(`[ConflictService] No alternative route found for ${missionId}`);

            // Abort the mission since no route is possible
            await abortMissionDueToConflict(missionId, `No alternative route available (blocked by ${excludeSegments.join(', ')})`);

            return { success: false, error: newRoute.error || 'No alternative route found' };
        }

        console.log(`[ConflictService] Found alternative route for ${missionId}: ${newRoute.path.join(' -> ')}`);

        // Update the mission with the new path
        await missionService.updateMissionPath(missionId, newRoute.path);

        // Broadcast reroute event
        broadcastMessage({
            type: 'MISSION_REROUTED',
            payload: {
                missionId,
                oldPath: mission.path,
                newPath: newRoute.path,
                reason: `Preempted from segment(s): ${excludeSegments.join(', ')}`,
            },
            timestamp: Date.now(),
        });

        return { success: true, newPath: newRoute.path };
    } catch (error) {
        console.error(`[ConflictService] Error rerouting mission ${missionId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Abort a mission due to a conflict that cannot be resolved
 */
export async function abortMissionDueToConflict(missionId: string, reason: string): Promise<void> {
    console.log(`[ConflictService] Aborting mission ${missionId}: ${reason}`);

    try {
        await missionService.abortMission(missionId, reason);

        // Broadcast abort event
        broadcastMessage({
            type: 'MISSION_ABORTED',
            payload: {
                missionId,
                reason,
                dueToConflict: true,
            },
            timestamp: Date.now(),
        });
    } catch (error) {
        console.error(`[ConflictService] Error aborting mission ${missionId}:`, error);
    }
}

/**
 * Check if a segment can be reserved by a mission, considering priority
 * @param segmentId The segment to check
 * @param newMissionId The mission trying to reserve
 * @param newPriority The priority of the new mission
 * @returns Whether the reservation would succeed and if preemption is needed
 */
export async function checkSegmentAvailability(
    segmentId: string,
    newMissionId: string,
    newPriority: number
): Promise<{
    available: boolean;
    requiresPreemption: boolean;
    existingMissionId?: string;
    existingPriority?: number;
}> {
    const segment = await couchdb.getSegment(segmentId);

    if (!segment) {
        return { available: false, requiresPreemption: false };
    }

    if (segment.status === 'free') {
        return { available: true, requiresPreemption: false };
    }

    // Segment is reserved or occupied
    // Default to priority 5 (lowest) if not set - this allows higher priority to preempt
    const existingPriority = segment.priorityLevel ?? 5;
    const existingMissionId = segment.missionId;

    console.log(`[ConflictService] Checking segment ${segmentId}: status=${segment.status}, existingPriority=${existingPriority}, newPriority=${newPriority}`);

    if (newPriority < existingPriority) {
        // New mission has higher priority (lower number) - can preempt
        console.log(`[ConflictService] -> Can preempt: ${newPriority} < ${existingPriority}`);
        return {
            available: true,
            requiresPreemption: true,
            existingMissionId,
            existingPriority,
        };
    }

    // New mission has lower or equal priority - cannot take segment
    console.log(`[ConflictService] -> Cannot preempt: ${newPriority} >= ${existingPriority}`);
    return {
        available: false,
        requiresPreemption: false,
        existingMissionId,
        existingPriority,
    };
}

/**
 * Reserve segments for a mission with automatic conflict resolution
 * This is the main entry point for segment reservation with preemption
 */
export async function reservePathWithConflictResolution(
    missionId: string,
    path: string[],
    priority: number,
    vehicleId: string
): Promise<{
    success: boolean;
    reservedSegments: string[];
    preemptedMissions: string[];
    reroutedMissions: string[];
    abortedMissions: string[];
    error?: string;
}> {
    console.log(`[ConflictService] Reserving path for ${missionId} with priority ${priority}`);

    const reservedSegments: string[] = [];
    const preemptedMissions: string[] = [];
    const reroutedMissions: string[] = [];
    const abortedMissions: string[] = [];

    for (const segmentId of path) {
        const availability = await checkSegmentAvailability(segmentId, missionId, priority);

        if (!availability.available) {
            console.log(`[ConflictService] Segment ${segmentId} not available for ${missionId}`);
            return {
                success: false,
                reservedSegments,
                preemptedMissions,
                reroutedMissions,
                abortedMissions,
                error: `Segment ${segmentId} blocked by higher/equal priority mission ${availability.existingMissionId}`,
            };
        }

        if (availability.requiresPreemption && availability.existingMissionId) {
            console.log(`[ConflictService] Preempting ${availability.existingMissionId} for segment ${segmentId}`);

            preemptedMissions.push(availability.existingMissionId);

            // Reroute the preempted mission
            const rerouteResult = await rerouteMission(availability.existingMissionId, [segmentId]);

            if (rerouteResult.success) {
                reroutedMissions.push(availability.existingMissionId);
            } else {
                abortedMissions.push(availability.existingMissionId);
            }
        }

        // Reserve the segment
        try {
            await segmentService.reserveSegment({
                segmentId,
                vehicleId,
                missionId,
                priorityLevel: priority,
            });
            reservedSegments.push(segmentId);
        } catch (error) {
            console.error(`[ConflictService] Error reserving segment ${segmentId}:`, error);
            return {
                success: false,
                reservedSegments,
                preemptedMissions,
                reroutedMissions,
                abortedMissions,
                error: `Failed to reserve segment ${segmentId}`,
            };
        }
    }

    return {
        success: true,
        reservedSegments,
        preemptedMissions,
        reroutedMissions,
        abortedMissions,
    };
}

/**
 * Get conflict resolution history
 */
export function getConflictHistory(): ConflictResolutionEntry[] {
    return [...conflictHistory];
}

/**
 * Add entry to conflict history
 */
function addToHistory(entry: ConflictResolutionEntry): void {
    conflictHistory.unshift(entry);

    // Keep only the most recent entries
    while (conflictHistory.length > MAX_HISTORY_SIZE) {
        conflictHistory.pop();
    }
}

/**
 * Clear conflict history (for testing)
 */
export function clearConflictHistory(): void {
    conflictHistory.length = 0;
}

export default {
    handleConflict,
    preemptMission,
    rerouteMission,
    abortMissionDueToConflict,
    checkSegmentAvailability,
    reservePathWithConflictResolution,
    getConflictHistory,
    clearConflictHistory,
};
