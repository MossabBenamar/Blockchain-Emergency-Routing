// ConflictHistory component - Shows recent conflict resolutions
// Displays a table of past conflicts with details about winners, losers, and outcomes

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useWebSocketEvent } from '../../hooks/useWebSocket';
import './ConflictHistory.css';

interface ConflictHistoryEntry {
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

interface ConflictHistoryProps {
    currentOrg?: string;
    maxItems?: number;
}

export function ConflictHistory({ currentOrg: _currentOrg, maxItems = 20 }: ConflictHistoryProps) {
    const [history, setHistory] = useState<ConflictHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch conflict history from API
    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.getConflictHistory();
            if (response.success && response.data) {
                setHistory(response.data.slice(0, maxItems));
            }
        } catch (err) {
            console.error('Error fetching conflict history:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch conflict history');
        } finally {
            setIsLoading(false);
        }
    }, [maxItems]);

    // Initial fetch
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Listen for new conflict resolutions and refresh
    useWebSocketEvent('CONFLICT_RESOLVED', () => {
        // Delay slightly to ensure backend has updated
        setTimeout(fetchHistory, 500);
    });

    // Format timestamp
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // Format mission ID for display
    const formatMissionId = (missionId: string) => {
        if (!missionId) return 'N/A';
        return missionId.length > 12 ? `...${missionId.slice(-8)}` : missionId;
    };

    // Get priority label
    const getPriorityLabel = (priority: number) => {
        switch (priority) {
            case 1: return 'P1 (Critical)';
            case 2: return 'P2 (High)';
            case 3: return 'P3 (Medium)';
            case 4: return 'P4 (Low)';
            case 5: return 'P5 (Routine)';
            default: return `P${priority}`;
        }
    };

    // Get resolution badge
    const getResolutionBadge = (resolution: string) => {
        switch (resolution) {
            case 'preempted':
                return <span className="badge badge--preempted">⚡ Preempted</span>;
            case 'fcfs':
                return <span className="badge badge--fcfs">🏁 FCFS</span>;
            case 'rejected':
                return <span className="badge badge--rejected">❌ Rejected</span>;
            default:
                return <span className="badge">{resolution}</span>;
        }
    };

    // Get outcome badge
    const getOutcomeBadge = (outcome: string) => {
        switch (outcome) {
            case 'rerouted':
                return <span className="badge badge--rerouted">🔄 Rerouted</span>;
            case 'aborted':
                return <span className="badge badge--aborted">🚫 Aborted</span>;
            case 'pending':
                return <span className="badge badge--pending">⏳ Pending</span>;
            default:
                return <span className="badge">{outcome}</span>;
        }
    };

    return (
        <div className="conflict-history">
            <div className="conflict-history__header">
                <h3 className="conflict-history__title">
                    ⚔️ Conflict Resolution History
                </h3>
                <button
                    className="conflict-history__refresh"
                    onClick={fetchHistory}
                    disabled={isLoading}
                >
                    {isLoading ? '⏳' : '🔄'} Refresh
                </button>
            </div>

            {error && (
                <div className="conflict-history__error">
                    ⚠️ {error}
                </div>
            )}

            {history.length === 0 && !isLoading && !error && (
                <div className="conflict-history__empty">
                    <span className="empty-icon">✨</span>
                    <p>No conflicts recorded yet</p>
                    <p className="empty-hint">Conflicts occur when two missions of the same priority compete for a segment</p>
                </div>
            )}

            {history.length > 0 && (
                <div className="conflict-history__table-wrapper">
                    <table className="conflict-history__table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Segment</th>
                                <th>Winner</th>
                                <th>Loser</th>
                                <th>Resolution</th>
                                <th>Outcome</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((entry) => (
                                <tr key={entry.conflictId}>
                                    <td className="time-cell">{formatTime(entry.timestamp)}</td>
                                    <td className="segment-cell">{entry.segmentId}</td>
                                    <td className="mission-cell">
                                        <div className="mission-info">
                                            <span className="mission-id">{formatMissionId(entry.winnerMissionId)}</span>
                                            <span className="mission-priority">{getPriorityLabel(entry.winnerPriority)}</span>
                                        </div>
                                    </td>
                                    <td className="mission-cell">
                                        <div className="mission-info">
                                            <span className="mission-id">{formatMissionId(entry.loserMissionId)}</span>
                                            <span className="mission-priority">{getPriorityLabel(entry.loserPriority)}</span>
                                        </div>
                                    </td>
                                    <td className="resolution-cell">{getResolutionBadge(entry.resolution)}</td>
                                    <td className="outcome-cell">{getOutcomeBadge(entry.loserOutcome)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="conflict-history__legend">
                <h4>Legend</h4>
                <div className="legend-items">
                    <div className="legend-item">
                        <span className="badge badge--preempted">⚡ Preempted</span>
                        <span>Higher priority wins</span>
                    </div>
                    <div className="legend-item">
                        <span className="badge badge--fcfs">🏁 FCFS</span>
                        <span>Same priority, first-come-first-served</span>
                    </div>
                    <div className="legend-item">
                        <span className="badge badge--rerouted">🔄 Rerouted</span>
                        <span>Mission found alternative path</span>
                    </div>
                    <div className="legend-item">
                        <span className="badge badge--aborted">🚫 Aborted</span>
                        <span>No alternative route available</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConflictHistory;
