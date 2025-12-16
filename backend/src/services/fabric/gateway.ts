import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Identity, Signer, signers, Gateway, Network } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config, getCryptoPaths } from '../../config';

// Store active connections
let gatewayInstance: Gateway | null = null;
let clientInstance: grpc.Client | null = null;
let networkInstance: Network | null = null;

/**
 * Create a new gRPC connection to the peer
 */
async function newGrpcConnection(orgType: 'medical' | 'police' = 'medical'): Promise<grpc.Client> {
  const cryptoPaths = getCryptoPaths(orgType);
  
  const tlsRootCert = fs.readFileSync(cryptoPaths.tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

  return new grpc.Client(
    cryptoPaths.peerEndpoint,
    tlsCredentials,
    {
      'grpc.ssl_target_name_override': cryptoPaths.peerHostAlias,
    }
  );
}

/**
 * Create identity from X.509 certificate
 */
async function newIdentity(orgType: 'medical' | 'police' = 'medical'): Promise<Identity> {
  const cryptoPaths = getCryptoPaths(orgType);
  
  // Find the certificate file
  const certDir = cryptoPaths.certPath;
  const certFiles = fs.readdirSync(certDir);
  const certFile = certFiles.find(f => f.endsWith('.pem') || f.endsWith('cert.pem'));
  
  if (!certFile) {
    throw new Error(`No certificate file found in ${certDir}`);
  }
  
  const credentials = fs.readFileSync(path.join(certDir, certFile));
  
  return { mspId: cryptoPaths.mspId, credentials };
}

/**
 * Create signer from private key
 */
async function newSigner(orgType: 'medical' | 'police' = 'medical'): Promise<Signer> {
  const cryptoPaths = getCryptoPaths(orgType);
  
  // Find the private key file
  const keyDir = cryptoPaths.keyPath;
  const keyFiles = fs.readdirSync(keyDir);
  const keyFile = keyFiles.find(f => f.endsWith('_sk') || f.endsWith('.key'));
  
  if (!keyFile) {
    throw new Error(`No private key file found in ${keyDir}`);
  }
  
  const privateKeyPem = fs.readFileSync(path.join(keyDir, keyFile));
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  
  return signers.newPrivateKeySigner(privateKey);
}

/**
 * Connect to the Fabric Gateway
 */
export async function connectGateway(orgType: 'medical' | 'police' = 'medical'): Promise<Gateway> {
  // Return existing connection if available
  if (gatewayInstance && networkInstance) {
    return gatewayInstance;
  }
  
  console.log(`Connecting to Fabric Gateway as ${orgType}...`);
  
  const client = await newGrpcConnection(orgType);
  clientInstance = client;
  
  const gateway = connect({
    client,
    identity: await newIdentity(orgType),
    signer: await newSigner(orgType),
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }), // 5 seconds
    endorseOptions: () => ({ deadline: Date.now() + 15000 }), // 15 seconds
    submitOptions: () => ({ deadline: Date.now() + 5000 }), // 5 seconds
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }), // 60 seconds
  });
  
  gatewayInstance = gateway;
  networkInstance = gateway.getNetwork(config.channelName);
  
  console.log(`Connected to channel: ${config.channelName}`);
  
  return gateway;
}

/**
 * Get the contract instance for the routing chaincode
 * The contractName parameter specifies which contract within the chaincode to use
 * Functions will be called as ContractName:FunctionName
 */
export async function getContract(contractName?: string): Promise<Contract> {
  if (!networkInstance) {
    await connectGateway();
  }
  
  if (!networkInstance) {
    throw new Error('Failed to connect to network');
  }
  
  // When contractName is provided, Fabric Gateway SDK will prefix function calls with it
  return networkInstance.getContract(config.chaincodeName, contractName);
}

/**
 * Helper to decode Uint8Array result to string and parse as JSON
 */
export function decodeResult<T>(result: Uint8Array): T {
  const decoded = Buffer.from(result).toString('utf-8');
  if (!decoded || decoded.length === 0) {
    throw new Error('Empty response from chaincode');
  }
  return JSON.parse(decoded) as T;
}

/**
 * Helper to safely decode result that might be null/empty
 */
export function decodeResultOrDefault<T>(result: Uint8Array, defaultValue: T): T {
  const decoded = Buffer.from(result).toString('utf-8');
  if (!decoded || decoded.length === 0 || decoded === 'null') {
    return defaultValue;
  }
  try {
    return JSON.parse(decoded) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Disconnect from the Fabric Gateway
 */
export async function disconnectGateway(): Promise<void> {
  if (gatewayInstance) {
    gatewayInstance.close();
    gatewayInstance = null;
  }
  
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
  
  networkInstance = null;
  
  console.log('Disconnected from Fabric Gateway');
}

/**
 * Check if connected to the gateway
 */
export function isConnected(): boolean {
  return gatewayInstance !== null && networkInstance !== null;
}

