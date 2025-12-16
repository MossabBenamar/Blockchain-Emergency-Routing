// Header Component - Organization Switcher and Status

import React from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Ambulance, 
  Shield,
  Activity
} from 'lucide-react';
import './Header.css';

interface HeaderProps {
  currentOrg: 'medical' | 'police';
  onOrgChange: (org: 'medical' | 'police') => void;
  isConnected: boolean;
  blockchainStatus: 'connected' | 'disconnected' | 'unknown';
}

export const Header: React.FC<HeaderProps> = ({
  currentOrg,
  onOrgChange,
  isConnected,
  blockchainStatus,
}) => {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <Radio className="logo-icon" size={28} />
          <div className="logo-text">
            <span className="logo-title">Emergency Routing</span>
            <span className="logo-subtitle">Blockchain-Based Dynamic Routing</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="org-switcher">
          <button
            className={`org-btn medical ${currentOrg === 'medical' ? 'active' : ''}`}
            onClick={() => onOrgChange('medical')}
          >
            <Ambulance size={18} />
            <span>Medical</span>
          </button>
          <button
            className={`org-btn police ${currentOrg === 'police' ? 'active' : ''}`}
            onClick={() => onOrgChange('police')}
          >
            <Shield size={18} />
            <span>Police</span>
          </button>
        </div>
      </div>

      <div className="header-right">
        <div className="status-indicators">
          <div className={`status-item ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>WebSocket</span>
          </div>
          <div className={`status-item ${blockchainStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            <Activity size={16} />
            <span>Blockchain</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

