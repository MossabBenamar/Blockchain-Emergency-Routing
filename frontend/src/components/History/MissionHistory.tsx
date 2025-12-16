/**
 * MissionHistory Component
 * 
 * Displays mission history and event timeline
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { MissionHistoryEntry, HistoryEvent, HistoryStats, OrgType } from '../../types';
import './MissionHistory.css';

interface MissionHistoryProps {
  currentOrg: OrgType;
  onMissionSelect?: (missionId: string) => void;
}

type TabType = 'missions' | 'events' | 'stats';
type StatusFilter = 'all' | 'pending' | 'active' | 'completed' | 'aborted';

export function MissionHistory({ currentOrg, onMissionSelect }: MissionHistoryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('missions');
  const [missions, setMissions] = useState<MissionHistoryEntry[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [missionDetail, setMissionDetail] = useState<{
    mission: MissionHistoryEntry;
    events: HistoryEvent[];
  } | null>(null);

  // Fetch missions
  const fetchMissions = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getMissionHistory({
        status: statusFilter === 'all' ? undefined : statusFilter,
        org: currentOrg,
        limit: 50,
      });
      if (response.success) {
        setMissions(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching mission history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg, statusFilter]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getHistoryEvents({
        limit: 100,
        type: 'mission',
      });
      if (response.success) {
        setEvents(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getHistoryStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch mission detail
  const fetchMissionDetail = useCallback(async (missionId: string) => {
    try {
      const response = await api.getMissionHistoryDetail(missionId);
      if (response.success) {
        setMissionDetail({
          mission: response.data.mission,
          events: response.data.events || response.data.timeline || [],
        });
      }
    } catch (error) {
      console.error('Error fetching mission detail:', error);
    }
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'missions') {
      fetchMissions();
    } else if (activeTab === 'events') {
      fetchEvents();
    } else if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, fetchMissions, fetchEvents, fetchStats]);

  // Refresh missions when filter changes
  useEffect(() => {
    if (activeTab === 'missions') {
      fetchMissions();
    }
  }, [statusFilter, fetchMissions]);

  // Handle mission click
  const handleMissionClick = (missionId: string) => {
    if (selectedMission === missionId) {
      setSelectedMission(null);
      setMissionDetail(null);
    } else {
      setSelectedMission(missionId);
      fetchMissionDetail(missionId);
      onMissionSelect?.(missionId);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Format duration
  const formatDuration = (ms: number | null | undefined) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status badge class
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'active': return 'status-active';
      case 'pending': return 'status-pending';
      case 'aborted': return 'status-aborted';
      default: return '';
    }
  };

  // Get event icon
  const getEventIcon = (action: string) => {
    switch (action) {
      case 'CREATED': return '🆕';
      case 'ACTIVATED': return '▶️';
      case 'COMPLETED': return '✅';
      case 'ABORTED': return '❌';
      case 'RESERVED': return '🔒';
      case 'RELEASED': return '🔓';
      case 'VEHICLE_ARRIVED': return '🏁';
      default: return '📌';
    }
  };

  return (
    <div className="mission-history">
      <div className="history-header">
        <h2>📜 History</h2>
        <button 
          className="refresh-btn"
          onClick={() => {
            if (activeTab === 'missions') fetchMissions();
            else if (activeTab === 'events') fetchEvents();
            else fetchStats();
          }}
          disabled={isLoading}
        >
          🔄
        </button>
      </div>

      {/* Tabs */}
      <div className="history-tabs">
        <button
          className={`tab-btn ${activeTab === 'missions' ? 'active' : ''}`}
          onClick={() => setActiveTab('missions')}
        >
          Missions
        </button>
        <button
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
      </div>

      {/* Content */}
      <div className="history-content">
        {isLoading && <div className="loading-spinner">Loading...</div>}

        {/* Missions Tab */}
        {activeTab === 'missions' && !isLoading && (
          <>
            {/* Filter */}
            <div className="filter-row">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="status-filter"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="aborted">Aborted</option>
              </select>
            </div>

            {/* Mission List */}
            <div className="mission-list">
              {missions.length === 0 ? (
                <p className="empty-message">No missions found</p>
              ) : (
                missions.map((mission) => (
                  <div
                    key={mission.missionId}
                    className={`mission-item ${selectedMission === mission.missionId ? 'selected' : ''}`}
                    onClick={() => handleMissionClick(mission.missionId)}
                  >
                    <div className="mission-header">
                      <span className="mission-id">{mission.missionId.slice(-10)}</span>
                      <span className={`status-badge ${getStatusClass(mission.status)}`}>
                        {mission.status}
                      </span>
                    </div>
                    <div className="mission-info">
                      <span className="vehicle-id">🚗 {mission.vehicleId}</span>
                      <span className="org-type">
                        {mission.orgType === 'medical' ? '🏥' : '🚔'}
                      </span>
                    </div>
                    <div className="mission-route">
                      {mission.originNode} → {mission.destNode}
                    </div>
                    <div className="mission-meta">
                      <span className="time">{formatTime(mission.createdAt)}</span>
                      {mission.duration !== null && mission.duration !== undefined && (
                        <span className="duration">⏱ {formatDuration(mission.duration)}</span>
                      )}
                    </div>

                    {/* Expanded Detail */}
                    {selectedMission === mission.missionId && missionDetail && (
                      <div className="mission-detail">
                        <div className="detail-section">
                          <h4>Path</h4>
                          <div className="path-segments">
                            {missionDetail.mission.path?.join(' → ') || 'No path'}
                          </div>
                        </div>
                        {missionDetail.events.length > 0 && (
                          <div className="detail-section">
                            <h4>Timeline</h4>
                            <div className="timeline">
                              {missionDetail.events.map((event) => (
                                <div key={event.id} className="timeline-item">
                                  <span className="event-icon">{getEventIcon(event.action)}</span>
                                  <span className="event-action">{event.action}</span>
                                  <span className="event-time">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && !isLoading && (
          <div className="events-list">
            {events.length === 0 ? (
              <p className="empty-message">No events recorded yet</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="event-item">
                  <div className="event-header">
                    <span className="event-icon">{getEventIcon(event.action)}</span>
                    <span className="event-action">{event.action}</span>
                    <span className={`event-type type-${event.type}`}>{event.type}</span>
                  </div>
                  <div className="event-details">
                    {event.data.details || `${event.type} ${event.action}`}
                  </div>
                  <div className="event-meta">
                    {event.data.vehicleId && (
                      <span className="event-vehicle">🚗 {event.data.vehicleId}</span>
                    )}
                    <span className="event-time">{formatTime(event.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && !isLoading && stats && (
          <div className="stats-panel">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{stats.totalMissionsOnChain}</span>
                <span className="stat-label">Total Missions</span>
              </div>
              <div className="stat-card success">
                <span className="stat-value">{stats.missionsByStatus.completed}</span>
                <span className="stat-label">Completed</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-value">{stats.missionsByStatus.active}</span>
                <span className="stat-label">Active</span>
              </div>
              <div className="stat-card danger">
                <span className="stat-value">{stats.missionsByStatus.aborted}</span>
                <span className="stat-label">Aborted</span>
              </div>
            </div>

            <div className="stats-section">
              <h4>By Organization</h4>
              <div className="org-stats">
                <div className="org-stat medical">
                  <span className="org-icon">🏥</span>
                  <span className="org-name">Medical</span>
                  <span className="org-count">{stats.missionsByOrg.medical}</span>
                </div>
                <div className="org-stat police">
                  <span className="org-icon">🚔</span>
                  <span className="org-name">Police</span>
                  <span className="org-count">{stats.missionsByOrg.police}</span>
                </div>
              </div>
            </div>

            <div className="stats-section">
              <h4>Performance</h4>
              <div className="performance-stats">
                <div className="perf-item">
                  <span className="perf-label">Avg Path Length</span>
                  <span className="perf-value">{stats.averagePathLength} segments</span>
                </div>
                <div className="perf-item">
                  <span className="perf-label">Avg Duration</span>
                  <span className="perf-value">
                    {stats.averageDuration ? formatDuration(stats.averageDuration) : '-'}
                  </span>
                </div>
                <div className="perf-item">
                  <span className="perf-label">Success Rate</span>
                  <span className="perf-value">
                    {stats.totalMissionsOnChain > 0
                      ? Math.round((stats.missionsByStatus.completed / 
                          (stats.missionsByStatus.completed + stats.missionsByStatus.aborted || 1)) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="perf-item">
                  <span className="perf-label">Events Tracked</span>
                  <span className="perf-value">{stats.totalEvents}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MissionHistory;

