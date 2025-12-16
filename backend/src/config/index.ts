import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Base paths
const projectRoot = path.resolve(__dirname, '..', '..');
const networkPath = path.resolve(projectRoot, '..', 'blockchain', 'network');

// HTTP port
const httpPort = parseInt(process.env.PORT || '3001', 10);

// WebSocket port defaults to HTTP port + 1 (3001 -> 3002, 3003 -> 3004)
const wsPort = parseInt(process.env.WS_PORT || String(httpPort + 1), 10);

// Organization - accept both ORG and ORG_TYPE for convenience
const orgType = process.env.ORG || process.env.ORG_TYPE || 'medical';

export const config = {
  // Server
  port: httpPort,
  wsPort: wsPort,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Fabric
  channelName: process.env.CHANNEL_NAME || 'emergency-channel',
  chaincodeName: process.env.CHAINCODE_NAME || 'routing',

  // Organization
  orgType: orgType,
  mspId: orgType === 'police' ? 'PoliceMSP' : 'MedicalMSP',

  // Peer (auto-configured based on org)
  peerEndpoint: orgType === 'police' ? 'localhost:9051' : 'localhost:7051',
  peerHostAlias: orgType === 'police' ? 'peer0.police.emergency.net' : 'peer0.medical.emergency.net',

  // Paths
  paths: {
    networkPath,
    organizations: path.join(networkPath, 'organizations'),
  },
};

// Get crypto paths based on organization
export function getCryptoPaths(orgType: 'medical' | 'police' = 'medical') {
  const orgDomain = orgType === 'medical'
    ? 'medical.emergency.net'
    : 'police.emergency.net';

  const peerName = orgType === 'medical'
    ? 'peer0.medical.emergency.net'
    : 'peer0.police.emergency.net';

  const orgPath = path.join(
    config.paths.organizations,
    'peerOrganizations',
    orgDomain
  );

  return {
    tlsCertPath: path.join(orgPath, 'peers', peerName, 'tls', 'ca.crt'),
    certPath: path.join(orgPath, 'users', `Admin@${orgDomain}`, 'msp', 'signcerts'),
    keyPath: path.join(orgPath, 'users', `Admin@${orgDomain}`, 'msp', 'keystore'),
    mspId: orgType === 'medical' ? 'MedicalMSP' : 'PoliceMSP',
    peerEndpoint: orgType === 'medical' ? 'localhost:7051' : 'localhost:9051',
    peerHostAlias: peerName,
  };
}

export default config;

