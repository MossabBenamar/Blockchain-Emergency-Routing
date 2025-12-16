// ConflictAlert component - Real-time notifications for conflict events
// Shows toast notifications when missions are preempted, rerouted, or aborted

import { useState, useEffect, useCallback } from 'react';
import { useWebSocketEvent } from '../../hooks/useWebSocket';
import './ConflictAlert.css';

interface ConflictNotification {
    id: string;
    type: 'preempted' | 'rerouted' | 'aborted' | 'resolved';
    title: string;
    message: string;
    timestamp: number;
    segmentId?: string;
    missionId?: string;
    priority?: 'high' | 'medium' | 'low';
}

interface ConflictAlertProps {
    // Props can be extended for future org-specific filtering
}

export function ConflictAlert(_props: ConflictAlertProps) {
    const [notifications, setNotifications] = useState<ConflictNotification[]>([]);

    // Auto-dismiss notifications after 6 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setNotifications(prev =>
                prev.filter(n => now - n.timestamp < 6000)
            );
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Add a notification
    const addNotification = useCallback((notification: Omit<ConflictNotification, 'id' | 'timestamp'>) => {
        const newNotification: ConflictNotification = {
            ...notification,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
        };
        setNotifications(prev => [newNotification, ...prev].slice(0, 5)); // Keep max 5 notifications
    }, []);

    // Remove a notification
    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Handle MISSION_PREEMPTED event
    useWebSocketEvent('MISSION_PREEMPTED', (message) => {
        const { preemptorMissionId, targetMissionId, preemptedSegments } = message.payload;
        addNotification({
            type: 'preempted',
            title: '⚡ Mission Preempted',
            message: `Mission ${targetMissionId?.slice(-8)} was preempted by ${preemptorMissionId?.slice(-8)} on segment(s): ${preemptedSegments?.join(', ')}`,
            priority: 'high',
            missionId: targetMissionId,
        });
    });

    // Handle MISSION_REROUTED event
    useWebSocketEvent('MISSION_REROUTED', (message) => {
        const { missionId, oldPath, newPath, reason } = message.payload;
        addNotification({
            type: 'rerouted',
            title: '🔄 Mission Rerouted',
            message: `Mission ${missionId?.slice(-8)} rerouted from ${oldPath?.length || 0} to ${newPath?.length || 0} segments. ${reason || ''}`,
            priority: 'medium',
            missionId,
        });
    });

    // Handle MISSION_ABORTED (due to conflict)
    useWebSocketEvent('MISSION_ABORTED', (message) => {
        const { missionId, reason, dueToConflict } = message.payload;
        if (dueToConflict) {
            addNotification({
                type: 'aborted',
                title: '❌ Mission Aborted',
                message: `Mission ${missionId?.slice(-8)} aborted: ${reason || 'No alternative route available'}`,
                priority: 'high',
                missionId,
            });
        }
    });

    // Handle CONFLICT_RESOLVED event
    useWebSocketEvent('CONFLICT_RESOLVED', (message) => {
        const { conflictId: _conflictId, winner, loser, segmentId, resolution, loserRerouted } = message.payload;
        addNotification({
            type: 'resolved',
            title: '✅ Conflict Resolved',
            message: `${winner?.slice(-8)} wins segment ${segmentId}. ${loser?.slice(-8)} ${loserRerouted ? 'rerouted' : 'affected'} (${resolution})`,
            priority: 'medium',
            segmentId,
        });
    });

    // Handle VEHICLE_REROUTED event (from simulation)
    useWebSocketEvent('VEHICLE_REROUTED', (message) => {
        const { vehicleId, missionId, newPath, currentSegment } = message.payload;
        addNotification({
            type: 'rerouted',
            title: '🚗 Vehicle Rerouted',
            message: `Vehicle ${vehicleId} now on segment ${currentSegment}, following new ${newPath?.length || 0}-segment route`,
            priority: 'medium',
            missionId,
        });
    });

    if (notifications.length === 0) {
        return null;
    }

    return (
        <div className="conflict-alert-container">
            {notifications.map(notification => (
                <div
                    key={notification.id}
                    className={`conflict-alert conflict-alert--${notification.type} conflict-alert--${notification.priority}`}
                >
                    <div className="conflict-alert__header">
                        <span className="conflict-alert__title">{notification.title}</span>
                        <button
                            className="conflict-alert__close"
                            onClick={() => removeNotification(notification.id)}
                        >
                            ×
                        </button>
                    </div>
                    <p className="conflict-alert__message">{notification.message}</p>
                    <div className="conflict-alert__footer">
                        <span className="conflict-alert__time">
                            {new Date(notification.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default ConflictAlert;
