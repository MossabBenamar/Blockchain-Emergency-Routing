# Hyperledger Fabric: Complete Technical Guide

## Table of Contents

1. [What is Hyperledger Fabric?](#1-what-is-hyperledger-fabric)
2. [Key Concepts](#2-key-concepts)
3. [Core Components](#3-core-components)
4. [Network Architecture](#4-network-architecture)
5. [Identity & Membership](#5-identity--membership)
6. [Channels & Privacy](#6-channels--privacy)
7. [Smart Contracts (Chaincode)](#7-smart-contracts-chaincode)
8. [Ledger Structure](#8-ledger-structure)
9. [Transaction Flow](#9-transaction-flow)
10. [Consensus Mechanism](#10-consensus-mechanism)
11. [Practical Example](#11-practical-example)
12. [Comparison with Other Blockchains](#12-comparison-with-other-blockchains)

---

## 1. What is Hyperledger Fabric?

### 1.1 Overview

**Hyperledger Fabric** is an open-source, enterprise-grade, **permissioned blockchain** framework hosted by the Linux Foundation. Unlike public blockchains (Bitcoin, Ethereum), Fabric is designed for business use cases where:

- Participants are **known and authenticated**
- Transactions may need to be **private** between specific parties
- **Performance** matters (thousands of TPS vs. 7-15 TPS for Bitcoin)
- **Governance** and **compliance** are required

### 1.2 Key Differentiators

| Feature | Public Blockchain (Ethereum) | Hyperledger Fabric |
|---------|------------------------------|-------------------|
| **Participation** | Anyone can join | Permissioned (invitation only) |
| **Identity** | Pseudonymous | Known identities (X.509 certs) |
| **Consensus** | Proof of Work/Stake | Pluggable (Raft, Kafka) |
| **Smart Contracts** | Solidity (EVM) | Go, JavaScript, Java |
| **Privacy** | All transactions public | Channels & Private Data |
| **Performance** | ~15-30 TPS | ~3,000-20,000 TPS |
| **Cryptocurrency** | Required (ETH for gas) | Optional (no native coin) |

### 1.3 When to Use Fabric

✅ **Good fit:**
- Supply chain tracking between known partners
- Healthcare data sharing between hospitals
- Financial settlements between banks
- Government inter-agency systems
- **Emergency vehicle coordination** (our project!)

❌ **Not ideal for:**
- Public, trustless applications
- Cryptocurrency/DeFi
- When anonymity is required

---

## 2. Key Concepts

### 2.1 Permissioned vs Permissionless

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERMISSIONLESS (Bitcoin, Ethereum)           │
│                                                                 │
│   Anyone can:                                                   │
│   ✓ Join the network                                           │
│   ✓ Read all transactions                                      │
│   ✓ Submit transactions                                        │
│   ✓ Participate in consensus (mining/staking)                  │
│                                                                 │
│   Trust model: "Don't trust anyone, verify everything"         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PERMISSIONED (Hyperledger Fabric)            │
│                                                                 │
│   Participants must:                                            │
│   ✓ Be invited/approved to join                                │
│   ✓ Have verified identity (certificate)                       │
│   ✓ Follow access control rules                                │
│   ✓ Belong to an organization                                  │
│                                                                 │
│   Trust model: "Trust but verify, with accountability"         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Organizations

An **Organization** represents a distinct entity in the network (company, hospital, government agency).

```
┌─────────────────────────────────────────────────────────────────┐
│                        FABRIC NETWORK                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Org A     │  │   Org B     │  │   Org C     │             │
│  │  (Hospital) │  │(Fire Dept)  │  │  (Police)   │             │
│  │             │  │             │  │             │             │
│  │ - Peers     │  │ - Peers     │  │ - Peers     │             │
│  │ - Users     │  │ - Users     │  │ - Users     │             │
│  │ - CA        │  │ - CA        │  │ - CA        │             │
│  │ - MSP       │  │ - MSP       │  │ - MSP       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Each organization:
- Has its own **Certificate Authority (CA)**
- Manages its own **users and identities**
- Operates its own **peer nodes**
- Has a **Membership Service Provider (MSP)** defining its identity rules

### 2.3 The Ledger

The ledger is the **single source of truth** shared across the network.

```
┌─────────────────────────────────────────────────────────────────┐
│                          LEDGER                                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    BLOCKCHAIN                            │   │
│  │   (Immutable, append-only log of all transactions)       │   │
│  │                                                          │   │
│  │   ┌───────┐   ┌───────┐   ┌───────┐   ┌───────┐        │   │
│  │   │Block 0│──▶│Block 1│──▶│Block 2│──▶│Block 3│        │   │
│  │   │Genesis│   │       │   │       │   │       │        │   │
│  │   └───────┘   └───────┘   └───────┘   └───────┘        │   │
│  │                                                          │   │
│  │   Each block contains:                                   │   │
│  │   - Header (hash of previous block)                      │   │
│  │   - Transactions                                         │   │
│  │   - Metadata                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    WORLD STATE                           │   │
│  │   (Current state database - key-value store)             │   │
│  │                                                          │   │
│  │   Key              │ Value                               │   │
│  │   ─────────────────┼─────────────────────────────────   │   │
│  │   vehicle:AMB-001  │ {status: "active", org: "medical"} │   │
│  │   segment:S-001    │ {status: "reserved", mission: "M1"}│   │
│  │   mission:M-001    │ {status: "active", vehicle: "AMB1"}│   │
│  │                                                          │   │
│  │   Databases: LevelDB (default) or CouchDB (rich queries) │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight**: The blockchain stores the *history* of all changes, while the world state stores the *current* value of each key. Smart contracts read/write the world state.

---

## 3. Core Components

### 3.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     HYPERLEDGER FABRIC COMPONENTS                        │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         CLIENT APPLICATION                        │   │
│  │          (Your app that interacts with the blockchain)            │   │
│  │                    Uses: Fabric Gateway SDK                       │   │
│  └───────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                            PEERS                                  │   │
│  │                                                                   │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │   │
│  │   │  Peer 0     │    │  Peer 1     │    │  Peer 2     │         │   │
│  │   │  (Org A)    │    │  (Org B)    │    │  (Org C)    │         │   │
│  │   │             │    │             │    │             │         │   │
│  │   │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │         │   │
│  │   │ │Chaincode│ │    │ │Chaincode│ │    │ │Chaincode│ │         │   │
│  │   │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │         │   │
│  │   │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │         │   │
│  │   │ │ Ledger  │ │    │ │ Ledger  │ │    │ │ Ledger  │ │         │   │
│  │   │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │         │   │
│  │   └─────────────┘    └─────────────┘    └─────────────┘         │   │
│  │                                                                   │   │
│  └───────────────────────────────┬──────────────────────────────────┘   │
│                                  │                                       │
│                                  ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                       ORDERING SERVICE                            │   │
│  │              (Orders transactions into blocks)                    │   │
│  │                                                                   │   │
│  │        ┌──────────┐   ┌──────────┐   ┌──────────┐               │   │
│  │        │Orderer 0 │   │Orderer 1 │   │Orderer 2 │               │   │
│  │        └──────────┘   └──────────┘   └──────────┘               │   │
│  │                    (Raft Consensus Cluster)                       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    CERTIFICATE AUTHORITIES                        │   │
│  │                (Issue identities to participants)                 │   │
│  │                                                                   │   │
│  │        ┌─────────┐    ┌─────────┐    ┌─────────┐                │   │
│  │        │  CA     │    │  CA     │    │  CA     │                │   │
│  │        │ (Org A) │    │ (Org B) │    │ (Org C) │                │   │
│  │        └─────────┘    └─────────┘    └─────────┘                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Peers

**Peers** are the workhorses of the network. They:

1. **Host the ledger** - Store a copy of the blockchain and world state
2. **Run chaincode** - Execute smart contracts
3. **Endorse transactions** - Simulate and sign transaction proposals
4. **Validate blocks** - Check transactions before committing

**Types of Peers:**

| Type | Role |
|------|------|
| **Endorsing Peer** | Simulates transactions and provides signatures |
| **Committing Peer** | Validates and commits blocks to ledger (all peers) |
| **Anchor Peer** | Known peer for cross-org communication |
| **Leader Peer** | Receives blocks from orderer, distributes to org |

```
┌─────────────────────────────────────────────────────────────┐
│                        PEER NODE                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    CHAINCODE                            │ │
│  │                                                         │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │ │
│  │   │  Vehicle    │  │  Mission    │  │ Reservation │   │ │
│  │   │  Contract   │  │  Contract   │  │  Contract   │   │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘   │ │
│  │                                                         │ │
│  │   Runs in Docker container, isolated from peer         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                      LEDGER                             │ │
│  │                                                         │ │
│  │   ┌─────────────────┐    ┌─────────────────┐          │ │
│  │   │   Blockchain    │    │   World State   │          │ │
│  │   │   (file-based)  │    │   (LevelDB or   │          │ │
│  │   │                 │    │    CouchDB)     │          │ │
│  │   └─────────────────┘    └─────────────────┘          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    GOSSIP PROTOCOL                      │ │
│  │        (Peer-to-peer communication for blocks,          │ │
│  │         state sync, and peer discovery)                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Ordering Service

The **Ordering Service** is responsible for:

1. **Receiving endorsed transactions** from peers
2. **Ordering transactions** into a deterministic sequence
3. **Creating blocks** from batches of transactions
4. **Distributing blocks** to all peers on the channel

**Important:** Orderers do NOT execute chaincode or validate transaction logic. They only order.

```
┌─────────────────────────────────────────────────────────────┐
│                     ORDERING SERVICE                         │
│                                                              │
│              Transaction Pool                                │
│                    │                                         │
│                    ▼                                         │
│   ┌────────────────────────────────────┐                    │
│   │           RAFT CLUSTER             │                    │
│   │                                    │                    │
│   │  ┌────────┐ ┌────────┐ ┌────────┐ │                    │
│   │  │Orderer1│ │Orderer2│ │Orderer3│ │                    │
│   │  │(Leader)│ │(Follow)│ │(Follow)│ │                    │
│   │  └────────┘ └────────┘ └────────┘ │                    │
│   │                                    │                    │
│   │  - Leader receives transactions    │                    │
│   │  - Replicates to followers         │                    │
│   │  - Commits when majority agrees    │                    │
│   └────────────────────────────────────┘                    │
│                    │                                         │
│                    ▼                                         │
│              Create Block                                    │
│                    │                                         │
│                    ▼                                         │
│         Distribute to all Peers                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Consensus Options:**

| Consensus | Description | Use Case |
|-----------|-------------|----------|
| **Raft** | Crash fault tolerant, leader-based | Production (recommended) |
| **Solo** | Single orderer, no fault tolerance | Development only |
| ~~Kafka~~ | Deprecated in Fabric 2.x | Legacy systems |

### 3.4 Certificate Authority (CA)

The **CA** issues digital certificates (X.509) that serve as identities in the network.

```
┌─────────────────────────────────────────────────────────────┐
│                   CERTIFICATE AUTHORITY                      │
│                        (Fabric CA)                           │
│                                                              │
│   Responsibilities:                                          │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  1. REGISTRATION                                       │ │
│   │     - Admin registers new user                         │ │
│   │     - Assigns roles and attributes                     │ │
│   │                                                        │ │
│   │  2. ENROLLMENT                                         │ │
│   │     - User requests certificate                        │ │
│   │     - CA issues X.509 certificate + private key        │ │
│   │                                                        │ │
│   │  3. REVOCATION                                         │ │
│   │     - Invalidate compromised certificates              │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                              │
│   Certificate Contents:                                      │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  Subject: CN=dispatcher1, OU=client, O=OrgMedical     │ │
│   │  Issuer: CN=ca.medical.emergency.net                  │ │
│   │  Valid: 2024-01-01 to 2025-01-01                      │ │
│   │  Public Key: RSA 2048-bit                             │ │
│   │                                                        │ │
│   │  ATTRIBUTES (custom fields):                           │ │
│   │    - role: dispatcher                                  │ │
│   │    - orgType: medical                                  │ │
│   │    - priorityLevel: 1                                  │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Membership Service Provider (MSP)

The **MSP** defines the rules for identity validation within an organization.

```
┌─────────────────────────────────────────────────────────────┐
│                            MSP                               │
│              (Membership Service Provider)                   │
│                                                              │
│   What MSP Contains:                                         │
│   ┌───────────────────────────────────────────────────────┐ │
│   │                                                        │ │
│   │   /msp                                                 │ │
│   │   ├── cacerts/           # Root CA certificates       │ │
│   │   │   └── ca-cert.pem                                  │ │
│   │   ├── intermediatecerts/ # Intermediate CA certs      │ │
│   │   ├── admincerts/        # Admin certificates         │ │
│   │   ├── signcerts/         # This entity's certificate  │ │
│   │   │   └── cert.pem                                     │ │
│   │   ├── keystore/          # Private key                │ │
│   │   │   └── key.pem                                      │ │
│   │   └── config.yaml        # MSP configuration          │ │
│   │                                                        │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                              │
│   MSP Validates:                                             │
│   ✓ Certificate is signed by trusted CA                     │
│   ✓ Certificate is not revoked                              │
│   ✓ Certificate belongs to this organization                │
│   ✓ User has required roles/attributes                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Network Architecture

### 4.1 Sample Network Topology

Here's how our Emergency Routing System network would look:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        EMERGENCY ROUTING NETWORK                                 │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         CHANNEL: smartcity-routing                        │   │
│  │                                                                           │   │
│  │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐       │   │
│  │   │   OrgMedical    │   │    OrgFire      │   │   OrgPolice     │       │   │
│  │   │                 │   │                 │   │                 │       │   │
│  │   │ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │       │   │
│  │   │ │peer0.medical│ │   │ │ peer0.fire  │ │   │ │peer0.police │ │       │   │
│  │   │ │  (anchor)   │ │   │ │  (anchor)   │ │   │ │  (anchor)   │ │       │   │
│  │   │ │             │ │   │ │             │ │   │ │             │ │       │   │
│  │   │ │ [Chaincode] │ │   │ │ [Chaincode] │ │   │ │ [Chaincode] │ │       │   │
│  │   │ │ [Ledger]    │ │   │ │ [Ledger]    │ │   │ │ [Ledger]    │ │       │   │
│  │   │ │ [CouchDB]   │ │   │ │ [CouchDB]   │ │   │ │ [CouchDB]   │ │       │   │
│  │   │ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │       │   │
│  │   │                 │   │                 │   │                 │       │   │
│  │   │ ┌─────────────┐ │   │ ┌─────────────┐ │   │ ┌─────────────┐ │       │   │
│  │   │ │  CA.medical │ │   │ │   CA.fire   │ │   │ │  CA.police  │ │       │   │
│  │   │ └─────────────┘ │   │ └─────────────┘ │   │ └─────────────┘ │       │   │
│  │   │                 │   │                 │   │                 │       │   │
│  │   │ Users:          │   │ Users:          │   │ Users:          │       │   │
│  │   │ - admin         │   │ - admin         │   │ - admin         │       │   │
│  │   │ - dispatcher1   │   │ - dispatcher1   │   │ - dispatcher1   │       │   │
│  │   │ - dispatcher2   │   │ - dispatcher2   │   │ - dispatcher2   │       │   │
│  │   └─────────────────┘   └─────────────────┘   └─────────────────┘       │   │
│  │                                                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                         │
│                                        │ Blocks                                  │
│                                        ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                          ORDERING SERVICE                                 │   │
│  │                                                                           │   │
│  │   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐             │   │
│  │   │   orderer0    │   │   orderer1    │   │   orderer2    │             │   │
│  │   │  (leader)     │◀─▶│  (follower)   │◀─▶│  (follower)   │             │   │
│  │   └───────────────┘   └───────────────┘   └───────────────┘             │   │
│  │                          RAFT CONSENSUS                                   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Communication Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMMUNICATION PATTERNS                        │
│                                                                  │
│   1. CLIENT → PEER (Submit Transaction)                         │
│      ┌────────┐        gRPC         ┌────────┐                  │
│      │ Client │ ──────────────────▶ │  Peer  │                  │
│      └────────┘                      └────────┘                  │
│                                                                  │
│   2. PEER → PEER (Gossip Protocol)                              │
│      ┌────────┐        Gossip       ┌────────┐                  │
│      │ Peer A │ ◀────────────────▶ │ Peer B │                  │
│      └────────┘                      └────────┘                  │
│      - Block dissemination                                       │
│      - State synchronization                                     │
│      - Peer discovery                                            │
│                                                                  │
│   3. PEER → ORDERER (Submit endorsed tx)                        │
│      ┌────────┐        gRPC         ┌─────────┐                 │
│      │  Peer  │ ──────────────────▶ │ Orderer │                 │
│      └────────┘                      └─────────┘                 │
│                                                                  │
│   4. ORDERER → PEER (Deliver blocks)                            │
│      ┌─────────┐      gRPC          ┌────────┐                  │
│      │ Orderer │ ──────────────────▶│  Peer  │                  │
│      └─────────┘                     └────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Identity & Membership

### 5.1 Identity Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      IDENTITY HIERARCHY                          │
│                                                                  │
│                    ┌───────────────┐                            │
│                    │   Root CA     │                            │
│                    │ (Network-wide)│                            │
│                    └───────┬───────┘                            │
│                            │                                     │
│           ┌────────────────┼────────────────┐                   │
│           │                │                │                   │
│           ▼                ▼                ▼                   │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│   │ Org CA        │ │ Org CA        │ │ Org CA        │        │
│   │ (Medical)     │ │ (Fire)        │ │ (Police)      │        │
│   └───────┬───────┘ └───────┬───────┘ └───────┬───────┘        │
│           │                 │                 │                 │
│     ┌─────┴─────┐     ┌─────┴─────┐     ┌─────┴─────┐          │
│     │           │     │           │     │           │          │
│     ▼           ▼     ▼           ▼     ▼           ▼          │
│  ┌─────┐    ┌─────┐ ┌─────┐  ┌─────┐ ┌─────┐   ┌─────┐        │
│  │Admin│    │Users│ │Admin│  │Users│ │Admin│   │Users│        │
│  └─────┘    └─────┘ └─────┘  └─────┘ └─────┘   └─────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Certificate Attributes for Access Control

```javascript
// Example: Medical Dispatcher Certificate
{
  "subject": {
    "commonName": "dispatcher1",
    "organizationalUnit": "client",
    "organization": "OrgMedical"
  },
  "issuer": {
    "commonName": "ca.medical.emergency.net"
  },
  "attributes": {
    "hf.Registrar.Roles": "client",
    "hf.Affiliation": "medical",
    
    // Custom attributes for our application
    "role": "dispatcher",
    "orgType": "medical",
    "canCreateMission": "true",
    "canRegisterVehicle": "true",
    "maxPriorityLevel": "1"
  }
}
```

### 5.3 Attribute-Based Access Control (ABAC)

```go
// In chaincode: Check if caller can create a mission
func (c *MissionContract) CreateMission(ctx contractapi.TransactionContextInterface, ...) error {
    
    // Get caller's identity
    clientIdentity := ctx.GetClientIdentity()
    
    // Check organization
    mspID, _ := clientIdentity.GetMSPID()
    if mspID != "MedicalMSP" && mspID != "FireMSP" && mspID != "PoliceMSP" {
        return fmt.Errorf("organization not authorized to create missions")
    }
    
    // Check role attribute
    role, found, _ := clientIdentity.GetAttributeValue("role")
    if !found || (role != "dispatcher" && role != "admin") {
        return fmt.Errorf("only dispatchers can create missions")
    }
    
    // Check specific permission
    canCreate, found, _ := clientIdentity.GetAttributeValue("canCreateMission")
    if !found || canCreate != "true" {
        return fmt.Errorf("user lacks canCreateMission permission")
    }
    
    // Proceed with mission creation...
}
```

---

## 6. Channels & Privacy

### 6.1 What is a Channel?

A **Channel** is a private "subnet" of communication within a Fabric network. Only organizations that are members of a channel can:
- See transactions on that channel
- Execute chaincode on that channel
- Access the channel's ledger

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FABRIC NETWORK                                  │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CHANNEL A: smartcity-routing                  │    │
│  │                                                                  │    │
│  │    Members: OrgMedical, OrgFire, OrgPolice, OrgInfrastructure   │    │
│  │    Purpose: Emergency vehicle routing coordination               │    │
│  │    Chaincode: routing                                            │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CHANNEL B: medical-private                    │    │
│  │                                                                  │    │
│  │    Members: OrgMedical only                                      │    │
│  │    Purpose: Patient data (HIPAA compliance)                      │    │
│  │    Chaincode: patient-records                                    │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CHANNEL C: police-fire-ops                    │    │
│  │                                                                  │    │
│  │    Members: OrgFire, OrgPolice                                   │    │
│  │    Purpose: Joint tactical operations                            │    │
│  │    Chaincode: tactical-ops                                       │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

Note: Each channel has its own ledger. Organizations can be on multiple channels.
```

### 6.2 Private Data Collections (PDC)

For finer-grained privacy WITHIN a channel, use **Private Data Collections**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PRIVATE DATA COLLECTIONS                              │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐     │
│   │              CHANNEL: smartcity-routing                        │     │
│   │                                                                │     │
│   │   PUBLIC DATA (visible to all channel members):                │     │
│   │   ┌─────────────────────────────────────────────────────────┐ │     │
│   │   │  - Segment reservations (segmentId, status, priority)   │ │     │
│   │   │  - Mission summaries (missionId, orgType, status)       │ │     │
│   │   │  - Vehicle IDs and types                                │ │     │
│   │   └─────────────────────────────────────────────────────────┘ │     │
│   │                                                                │     │
│   │   PRIVATE COLLECTION: MedicalPrivate                          │     │
│   │   (Only OrgMedical can access)                                 │     │
│   │   ┌─────────────────────────────────────────────────────────┐ │     │
│   │   │  - Patient information                                  │ │     │
│   │   │  - Medical condition details                            │ │     │
│   │   │  - Hospital destination specifics                       │ │     │
│   │   └─────────────────────────────────────────────────────────┘ │     │
│   │                                                                │     │
│   │   PRIVATE COLLECTION: PoliceFireIncident                      │     │
│   │   (Only OrgPolice and OrgFire can access)                      │     │
│   │   ┌─────────────────────────────────────────────────────────┐ │     │
│   │   │  - Hazmat incident details                              │ │     │
│   │   │  - Crime scene coordinates                              │ │     │
│   │   │  - Tactical information                                 │ │     │
│   │   └─────────────────────────────────────────────────────────┘ │     │
│   │                                                                │     │
│   └───────────────────────────────────────────────────────────────┘     │
│                                                                          │
│   HOW IT WORKS:                                                          │
│   - Private data stored only on authorized peers                         │
│   - Hash of private data stored on public ledger (for verification)     │
│   - Other orgs can verify data exists without seeing content            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Smart Contracts (Chaincode)

### 7.1 What is Chaincode?

**Chaincode** is Fabric's term for smart contracts. It's the business logic that:
- Reads and writes to the world state
- Validates transaction inputs
- Enforces business rules
- Emits events

```
┌─────────────────────────────────────────────────────────────────┐
│                        CHAINCODE                                 │
│                                                                  │
│   Supported Languages:                                           │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│   │     Go      │  │ JavaScript  │  │    Java     │            │
│   │ (recommended)│  │  (Node.js)  │  │             │            │
│   └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│   Deployment:                                                    │
│   - Packaged as tar.gz                                          │
│   - Installed on endorsing peers                                 │
│   - Runs in Docker container (isolated)                          │
│   - Approved by organizations                                    │
│   - Committed to channel                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Chaincode Structure (Go Example)

```go
package main

import (
    "encoding/json"
    "fmt"
    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ============================================================
// DATA STRUCTURES
// ============================================================

type Vehicle struct {
    VehicleID     string `json:"vehicleId"`
    OrgType       string `json:"orgType"`
    VehicleType   string `json:"vehicleType"`
    PriorityLevel int    `json:"priorityLevel"`
    Status        string `json:"status"`
}

// ============================================================
// SMART CONTRACT
// ============================================================

type VehicleContract struct {
    contractapi.Contract
}

// RegisterVehicle creates a new vehicle in the world state
func (c *VehicleContract) RegisterVehicle(
    ctx contractapi.TransactionContextInterface,
    vehicleID string,
    orgType string,
    vehicleType string,
    priorityLevel int,
) error {
    
    // 1. ACCESS CONTROL - Check caller has permission
    clientIdentity := ctx.GetClientIdentity()
    mspID, _ := clientIdentity.GetMSPID()
    
    // Verify caller's org matches the vehicle's org
    expectedMSP := orgType + "MSP" // e.g., "medicalMSP"
    if mspID != expectedMSP {
        return fmt.Errorf("cannot register vehicle for different organization")
    }
    
    // 2. VALIDATION - Check vehicle doesn't already exist
    existing, err := ctx.GetStub().GetState(vehicleID)
    if err != nil {
        return fmt.Errorf("failed to read state: %v", err)
    }
    if existing != nil {
        return fmt.Errorf("vehicle %s already exists", vehicleID)
    }
    
    // 3. CREATE OBJECT
    vehicle := Vehicle{
        VehicleID:     vehicleID,
        OrgType:       orgType,
        VehicleType:   vehicleType,
        PriorityLevel: priorityLevel,
        Status:        "active",
    }
    
    // 4. SERIALIZE TO JSON
    vehicleJSON, err := json.Marshal(vehicle)
    if err != nil {
        return fmt.Errorf("failed to marshal vehicle: %v", err)
    }
    
    // 5. WRITE TO WORLD STATE
    err = ctx.GetStub().PutState(vehicleID, vehicleJSON)
    if err != nil {
        return fmt.Errorf("failed to write state: %v", err)
    }
    
    // 6. EMIT EVENT
    ctx.GetStub().SetEvent("VehicleRegistered", vehicleJSON)
    
    return nil
}

// GetVehicle retrieves a vehicle from the world state
func (c *VehicleContract) GetVehicle(
    ctx contractapi.TransactionContextInterface,
    vehicleID string,
) (*Vehicle, error) {
    
    vehicleJSON, err := ctx.GetStub().GetState(vehicleID)
    if err != nil {
        return nil, fmt.Errorf("failed to read state: %v", err)
    }
    if vehicleJSON == nil {
        return nil, fmt.Errorf("vehicle %s does not exist", vehicleID)
    }
    
    var vehicle Vehicle
    err = json.Unmarshal(vehicleJSON, &vehicle)
    if err != nil {
        return nil, fmt.Errorf("failed to unmarshal: %v", err)
    }
    
    return &vehicle, nil
}

// QueryVehiclesByOrg uses CouchDB rich query
func (c *VehicleContract) QueryVehiclesByOrg(
    ctx contractapi.TransactionContextInterface,
    orgType string,
) ([]*Vehicle, error) {
    
    // CouchDB Mango query
    queryString := fmt.Sprintf(`{
        "selector": {
            "orgType": "%s"
        }
    }`, orgType)
    
    resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()
    
    var vehicles []*Vehicle
    for resultsIterator.HasNext() {
        queryResult, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        
        var vehicle Vehicle
        json.Unmarshal(queryResult.Value, &vehicle)
        vehicles = append(vehicles, &vehicle)
    }
    
    return vehicles, nil
}

// ============================================================
// MAIN - Register contracts
// ============================================================

func main() {
    chaincode, err := contractapi.NewChaincode(&VehicleContract{})
    if err != nil {
        fmt.Printf("Error creating chaincode: %v", err)
        return
    }
    
    if err := chaincode.Start(); err != nil {
        fmt.Printf("Error starting chaincode: %v", err)
    }
}
```

### 7.3 Chaincode Lifecycle (Fabric 2.x)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CHAINCODE LIFECYCLE                                  │
│                                                                          │
│   Step 1: PACKAGE                                                        │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  $ peer lifecycle chaincode package routing.tar.gz \            │   │
│   │      --path ./chaincode \                                        │   │
│   │      --lang golang \                                             │   │
│   │      --label routing_1.0                                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Step 2: INSTALL (on each peer that will endorse)                      │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  $ peer lifecycle chaincode install routing.tar.gz              │   │
│   │                                                                  │   │
│   │  → Returns: Package ID (e.g., routing_1.0:abc123...)            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Step 3: APPROVE (each org approves the chaincode definition)          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  $ peer lifecycle chaincode approveformyorg \                   │   │
│   │      --channelID smartcity-routing \                             │   │
│   │      --name routing \                                            │   │
│   │      --version 1.0 \                                             │   │
│   │      --package-id routing_1.0:abc123... \                        │   │
│   │      --sequence 1 \                                              │   │
│   │      --endorsement-policy "OR('MedicalMSP.peer','FireMSP.peer')" │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Step 4: CHECK COMMIT READINESS                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  $ peer lifecycle chaincode checkcommitreadiness \              │   │
│   │      --channelID smartcity-routing \                             │   │
│   │      --name routing \                                            │   │
│   │      --version 1.0                                               │   │
│   │                                                                  │   │
│   │  Output:                                                         │   │
│   │    MedicalMSP: true                                              │   │
│   │    FireMSP: true                                                 │   │
│   │    PoliceMSP: true                                               │   │
│   │    InfraMSP: false  ← Waiting for this org                      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Step 5: COMMIT (once majority approves)                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  $ peer lifecycle chaincode commit \                            │   │
│   │      --channelID smartcity-routing \                             │   │
│   │      --name routing \                                            │   │
│   │      --version 1.0 \                                             │   │
│   │      --sequence 1                                                │   │
│   │                                                                  │   │
│   │  → Chaincode is now active on the channel!                      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Ledger Structure

### 8.1 Block Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BLOCK STRUCTURE                                │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         BLOCK HEADER                               │  │
│  │                                                                    │  │
│  │   Block Number:        42                                          │  │
│  │   Previous Hash:       0x7a8b9c...                                │  │
│  │   Data Hash:           0x3d4e5f... (hash of all transactions)     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         BLOCK DATA                                 │  │
│  │                                                                    │  │
│  │   ┌─────────────────────────────────────────────────────────────┐ │  │
│  │   │  Transaction 1                                               │ │  │
│  │   │  ├── Header: channel, tx_type, timestamp                    │ │  │
│  │   │  ├── Signature: creator's signature                         │ │  │
│  │   │  ├── Proposal: chaincode name, function, arguments          │ │  │
│  │   │  ├── Response: chaincode execution result                   │ │  │
│  │   │  ├── Endorsements: [sig1, sig2, ...] from endorsing peers   │ │  │
│  │   │  └── Read/Write Set:                                        │ │  │
│  │   │        Reads:  [{key: "vehicle:AMB-001", version: 3}]       │ │  │
│  │   │        Writes: [{key: "vehicle:AMB-001", value: {...}}]     │ │  │
│  │   └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                    │  │
│  │   ┌─────────────────────────────────────────────────────────────┐ │  │
│  │   │  Transaction 2                                               │ │  │
│  │   │  └── ...                                                     │ │  │
│  │   └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                    │  │
│  │   ┌─────────────────────────────────────────────────────────────┐ │  │
│  │   │  Transaction N                                               │ │  │
│  │   │  └── ...                                                     │ │  │
│  │   └─────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         BLOCK METADATA                             │  │
│  │                                                                    │  │
│  │   - Orderer signature                                              │  │
│  │   - Transaction validation codes (valid/invalid for each tx)      │  │
│  │   - Commit hash                                                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 World State Databases

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORLD STATE OPTIONS                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        LevelDB (Default)                         │    │
│  │                                                                  │    │
│  │   Pros:                          Cons:                           │    │
│  │   ✓ Embedded (no extra setup)    ✗ Key-value only               │    │
│  │   ✓ Fast for simple queries      ✗ No rich queries              │    │
│  │   ✓ Low resource usage           ✗ Only key-based lookups       │    │
│  │                                                                  │    │
│  │   Best for: Simple data models, high performance                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       CouchDB (Recommended)                      │    │
│  │                                                                  │    │
│  │   Pros:                          Cons:                           │    │
│  │   ✓ Rich JSON queries            ✗ Separate container           │    │
│  │   ✓ Complex selectors            ✗ Slightly slower              │    │
│  │   ✓ Indexes for performance      ✗ More resources               │    │
│  │                                                                  │    │
│  │   Example Query (Mango):                                         │    │
│  │   {                                                              │    │
│  │     "selector": {                                                │    │
│  │       "orgType": "medical",                                      │    │
│  │       "status": "active",                                        │    │
│  │       "priorityLevel": {"$lte": 2}                              │    │
│  │     },                                                           │    │
│  │     "sort": [{"priorityLevel": "asc"}],                         │    │
│  │     "limit": 10                                                  │    │
│  │   }                                                              │    │
│  │                                                                  │    │
│  │   Best for: Complex queries, JSON documents, our project!       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Transaction Flow

### 9.1 Execute-Order-Validate Architecture

Fabric uses a unique **Execute-Order-Validate (EOV)** model:

```
┌─────────────────────────────────────────────────────────────────────────┐
│              EXECUTE-ORDER-VALIDATE ARCHITECTURE                         │
│                                                                          │
│   Traditional Blockchain (Ethereum):                                     │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   Order → Execute → Validate                                     │   │
│   │   (All nodes execute all transactions sequentially)              │   │
│   │   Problem: Slow, no parallelism                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Hyperledger Fabric:                                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │   Execute → Order → Validate                                     │   │
│   │                                                                  │   │
│   │   1. EXECUTE: Subset of peers simulate transaction              │   │
│   │      (in parallel, before ordering)                              │   │
│   │                                                                  │   │
│   │   2. ORDER: Orderer creates deterministic order                  │   │
│   │      (doesn't execute, just sequences)                           │   │
│   │                                                                  │   │
│   │   3. VALIDATE: All peers validate and commit                     │   │
│   │      (check endorsements, detect conflicts)                      │   │
│   │                                                                  │   │
│   │   Benefits:                                                      │   │
│   │   ✓ Parallel execution                                          │   │
│   │   ✓ Deterministic ordering                                       │   │
│   │   ✓ Non-deterministic chaincode is OK                           │   │
│   │   ✓ Endorsement flexibility                                      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Complete Transaction Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           TRANSACTION FLOW                                           │
│                                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐       │
│  │  Client  │    │ Endorsing    │    │   Ordering   │    │  Committing      │       │
│  │   App    │    │   Peers      │    │   Service    │    │    Peers         │       │
│  └────┬─────┘    └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘       │
│       │                 │                   │                     │                  │
│       │ ┌───────────────────────────────────────────────────────────────────────┐   │
│       │ │ PHASE 1: ENDORSEMENT                                                  │   │
│       │ └───────────────────────────────────────────────────────────────────────┘   │
│       │                 │                   │                     │                  │
│       │ 1. Submit       │                   │                     │                  │
│       │    Proposal     │                   │                     │                  │
│       │────────────────>│                   │                     │                  │
│       │                 │                   │                     │                  │
│       │                 │ 2. SIMULATE:      │                     │                  │
│       │                 │    Execute chaincode                    │                  │
│       │                 │    (READ current state)                 │                  │
│       │                 │    (COMPUTE new state)                  │                  │
│       │                 │    (DO NOT commit yet)                  │                  │
│       │                 │                   │                     │                  │
│       │                 │ 3. Create Read/Write Set:               │                  │
│       │                 │    Reads: [keys read + versions]        │                  │
│       │                 │    Writes: [keys to write + new values] │                  │
│       │                 │                   │                     │                  │
│       │ 4. Endorsement  │                   │                     │                  │
│       │    Response     │                   │                     │                  │
│       │<────────────────│                   │                     │                  │
│       │    (RW Set +    │                   │                     │                  │
│       │     Signature)  │                   │                     │                  │
│       │                 │                   │                     │                  │
│       │ [Repeat for each required endorser per policy]            │                  │
│       │                 │                   │                     │                  │
│       │ ┌───────────────────────────────────────────────────────────────────────┐   │
│       │ │ PHASE 2: ORDERING                                                     │   │
│       │ └───────────────────────────────────────────────────────────────────────┘   │
│       │                 │                   │                     │                  │
│       │ 5. Collect endorsements             │                     │                  │
│       │    Verify signatures                │                     │                  │
│       │    Check policy satisfied           │                     │                  │
│       │                 │                   │                     │                  │
│       │ 6. Submit Transaction               │                     │                  │
│       │    (with endorsements)──────────────>│                     │                  │
│       │                 │                   │                     │                  │
│       │                 │                   │ 7. ORDER:           │                  │
│       │                 │                   │    Collect txs      │                  │
│       │                 │                   │    Create block     │                  │
│       │                 │                   │                     │                  │
│       │                 │                   │ 8. Deliver Block    │                  │
│       │                 │                   │────────────────────>│                  │
│       │                 │                   │                     │                  │
│       │ ┌───────────────────────────────────────────────────────────────────────┐   │
│       │ │ PHASE 3: VALIDATION & COMMIT                                          │   │
│       │ └───────────────────────────────────────────────────────────────────────┘   │
│       │                 │                   │                     │                  │
│       │                 │                   │                     │ 9. VALIDATE:    │
│       │                 │                   │                     │    For each tx: │
│       │                 │                   │                     │                  │
│       │                 │                   │                     │    a) Check     │
│       │                 │                   │                     │       endorsement│
│       │                 │                   │                     │       policy    │
│       │                 │                   │                     │                  │
│       │                 │                   │                     │    b) MVCC check:│
│       │                 │                   │                     │       Read set  │
│       │                 │                   │                     │       versions  │
│       │                 │                   │                     │       still valid?│
│       │                 │                   │                     │                  │
│       │                 │                   │                     │    c) Mark tx   │
│       │                 │                   │                     │       valid/    │
│       │                 │                   │                     │       invalid   │
│       │                 │                   │                     │                  │
│       │                 │                   │                     │ 10. COMMIT:     │
│       │                 │                   │                     │     Append block│
│       │                 │                   │                     │     Update world│
│       │                 │                   │                     │     state (valid│
│       │                 │                   │                     │     txs only)   │
│       │                 │                   │                     │                  │
│       │ 11. Event notification              │                     │                  │
│       │<──────────────────────────────────────────────────────────│                  │
│       │                 │                   │                     │                  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 MVCC Conflicts

**Multi-Version Concurrency Control (MVCC)** prevents conflicting updates:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MVCC CONFLICT EXAMPLE                            │
│                                                                          │
│   Initial State:                                                         │
│   segment:S-001 = {status: "free", version: 5}                          │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────     │
│                                                                          │
│   Time T1: Transaction A (Ambulance wants segment)                       │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  ENDORSE: Read segment:S-001 (version 5)                        │   │
│   │           Compute: set status = "reserved"                       │   │
│   │           Write Set: {segment:S-001: {status: "reserved"}}      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Time T2: Transaction B (Fire truck wants same segment)                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  ENDORSE: Read segment:S-001 (version 5) ← Same version!        │   │
│   │           Compute: set status = "reserved"                       │   │
│   │           Write Set: {segment:S-001: {status: "reserved"}}      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Time T3: Orderer creates block with both transactions                 │
│   Block contains: [Tx A, Tx B] (in that order)                          │
│                                                                          │
│   Time T4: Validation                                                    │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Tx A: Read version 5, current version 5 → VALID ✓              │   │
│   │        Commit → segment:S-001 now version 6                      │   │
│   │                                                                  │   │
│   │  Tx B: Read version 5, current version 6 → INVALID ✗            │   │
│   │        MVCC CONFLICT! Transaction fails.                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   Result:                                                                │
│   - Tx A committed successfully                                          │
│   - Tx B rejected (client must retry)                                   │
│   - No inconsistent state possible                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Consensus Mechanism

### 10.1 Raft Consensus

Fabric 2.x uses **Raft** for ordering consensus:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RAFT CONSENSUS                                 │
│                                                                          │
│   Key Properties:                                                        │
│   - Crash Fault Tolerant (CFT)                                          │
│   - Leader-based                                                         │
│   - Requires 2f+1 nodes to tolerate f failures                          │
│   - Example: 3 orderers can tolerate 1 failure                          │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     RAFT CLUSTER (3 nodes)                       │   │
│   │                                                                  │   │
│   │         ┌──────────────┐                                        │   │
│   │         │   LEADER     │  ◄── Receives all transactions        │   │
│   │         │  (Orderer 1) │      Replicates to followers           │   │
│   │         └──────┬───────┘                                        │   │
│   │                │                                                 │   │
│   │         ┌──────┴──────┐                                         │   │
│   │         │             │                                         │   │
│   │         ▼             ▼                                         │   │
│   │  ┌────────────┐ ┌────────────┐                                  │   │
│   │  │  FOLLOWER  │ │  FOLLOWER  │                                  │   │
│   │  │ (Orderer 2)│ │ (Orderer 3)│                                  │   │
│   │  └────────────┘ └────────────┘                                  │   │
│   │                                                                  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   How it works:                                                          │
│   1. Leader receives transaction                                         │
│   2. Leader appends to its log                                          │
│   3. Leader replicates to followers                                      │
│   4. When majority acknowledges → entry is COMMITTED                    │
│   5. Leader creates block and delivers to peers                         │
│                                                                          │
│   Leader Election:                                                       │
│   - If leader fails, followers detect via heartbeat timeout             │
│   - Followers start election                                             │
│   - Candidate with majority votes becomes new leader                    │
│   - Typically < 1 second failover                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Endorsement Policies

**Endorsement policies** define which organizations must endorse a transaction:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ENDORSEMENT POLICIES                               │
│                                                                          │
│   Policy Syntax Examples:                                                │
│                                                                          │
│   1. ANY single org:                                                     │
│      "OR('MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer')"         │
│      → Any one organization can endorse                                 │
│                                                                          │
│   2. ALL orgs must agree:                                               │
│      "AND('MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer')"        │
│      → Every organization must endorse                                  │
│                                                                          │
│   3. Majority (2 of 3):                                                 │
│      "OutOf(2, 'MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer')"   │
│      → At least 2 organizations must endorse                            │
│                                                                          │
│   4. Complex combinations:                                               │
│      "OR(                                                               │
│         AND('MedicalMSP.peer', 'FireMSP.peer'),                        │
│         AND('PoliceMSP.peer', 'InfraMSP.peer')                         │
│       )"                                                                 │
│      → Either (Medical AND Fire) OR (Police AND Infra)                  │
│                                                                          │
│   ─────────────────────────────────────────────────────────────────     │
│                                                                          │
│   For Emergency Routing System:                                          │
│                                                                          │
│   DEFAULT (most operations):                                             │
│   "OR('MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer')"            │
│   → Fast: any org can endorse routine operations                        │
│                                                                          │
│   CRITICAL (conflict resolution):                                        │
│   "OutOf(2, 'MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer')"      │
│   → Requires agreement from 2+ orgs for disputed segments               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Practical Example

### 11.1 Our Emergency Routing Scenario

Let's walk through how a mission is created in our system:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│               EXAMPLE: Create Mission for Ambulance AMB-001                      │
│                                                                                  │
│  ACTORS:                                                                         │
│  - dispatcher1@medical (has role: dispatcher, org: medical)                     │
│  - peer0.medical.emergency.net (endorsing peer for Medical)                     │
│  - orderer0.emergency.net (Raft leader)                                         │
│                                                                                  │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                  │
│  STEP 1: Client Application (Dispatch Console)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  const gateway = await Gateway.connect({                                   │ │
│  │    identity: 'dispatcher1',                                                │ │
│  │    wallet: medicalWallet,                                                  │ │
│  │    connection: connectionProfile                                           │ │
│  │  });                                                                       │ │
│  │                                                                            │ │
│  │  const network = await gateway.getNetwork('smartcity-routing');           │ │
│  │  const contract = network.getContract('routing');                          │ │
│  │                                                                            │ │
│  │  await contract.submitTransaction(                                         │ │
│  │    'CreateMission',                                                        │ │
│  │    'MISSION-001',           // missionId                                   │ │
│  │    'AMB-001',               // vehicleId                                   │ │
│  │    'N1', '48.8566', '2.3522', // origin (Hospital)                        │ │
│  │    'N19', '48.8600', '2.3400', // destination (Incident)                  │ │
│  │    'Traffic Accident'        // description                                │ │
│  │  );                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  STEP 2: Proposal sent to peer0.medical                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Proposal:                                                                 │ │
│  │    Channel: smartcity-routing                                              │ │
│  │    Chaincode: routing                                                      │ │
│  │    Function: CreateMission                                                 │ │
│  │    Args: [MISSION-001, AMB-001, N1, 48.8566, ...]                         │ │
│  │    Creator: dispatcher1@MedicalMSP                                         │ │
│  │    Signature: 0x3a4b5c...                                                  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  STEP 3: Peer simulates chaincode execution                                     │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  // Inside chaincode                                                       │ │
│  │                                                                            │ │
│  │  // 1. Access control check                                                │ │
│  │  mspID = ctx.GetClientIdentity().GetMSPID()  // "MedicalMSP"              │ │
│  │  role = ctx.GetClientIdentity().GetAttributeValue("role")  // "dispatcher"│ │
│  │  ✓ Authorized                                                              │ │
│  │                                                                            │ │
│  │  // 2. Validate vehicle exists                                             │ │
│  │  vehicleJSON = ctx.GetStub().GetState("vehicle:AMB-001")                  │ │
│  │  READ SET: [{key: "vehicle:AMB-001", version: 3}]                         │ │
│  │  ✓ Vehicle found, status: active                                          │ │
│  │                                                                            │ │
│  │  // 3. Check vehicle not already on mission                                │ │
│  │  activeMission = ctx.GetStub().GetState("active-mission:AMB-001")         │ │
│  │  READ SET: [{key: "active-mission:AMB-001", version: 0}]  // doesn't exist│ │
│  │  ✓ Vehicle available                                                       │ │
│  │                                                                            │ │
│  │  // 4. Create mission object                                               │ │
│  │  mission = {                                                               │ │
│  │    missionId: "MISSION-001",                                               │ │
│  │    vehicleId: "AMB-001",                                                   │ │
│  │    orgType: "medical",                                                     │ │
│  │    priorityLevel: 1,                                                       │ │
│  │    status: "pending",                                                      │ │
│  │    createdAt: 1701792000,                                                  │ │
│  │    ...                                                                     │ │
│  │  }                                                                         │ │
│  │                                                                            │ │
│  │  // 5. Write to state (simulated, not committed yet)                       │ │
│  │  ctx.GetStub().PutState("mission:MISSION-001", missionJSON)               │ │
│  │  ctx.GetStub().PutState("active-mission:AMB-001", "MISSION-001")          │ │
│  │  WRITE SET: [                                                              │ │
│  │    {key: "mission:MISSION-001", value: {...}},                            │ │
│  │    {key: "active-mission:AMB-001", value: "MISSION-001"}                  │ │
│  │  ]                                                                         │ │
│  │                                                                            │ │
│  │  // 6. Emit event                                                          │ │
│  │  ctx.GetStub().SetEvent("MissionCreated", missionJSON)                    │ │
│  │                                                                            │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  STEP 4: Peer returns endorsement                                               │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Endorsement Response:                                                     │ │
│  │    Status: SUCCESS                                                         │ │
│  │    Read Set: [{vehicle:AMB-001, v3}, {active-mission:AMB-001, v0}]        │ │
│  │    Write Set: [{mission:MISSION-001, ...}, {active-mission:AMB-001, ...}] │ │
│  │    Signature: peer0.medical signs the RW set                              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  STEP 5: Client collects endorsements, submits to orderer                       │
│  (Since policy is OR, one endorsement from Medical is sufficient)              │
│                                                                                  │
│  STEP 6: Orderer creates block, delivers to all peers                          │
│                                                                                  │
│  STEP 7: All peers validate and commit                                          │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │  Validation:                                                               │ │
│  │  ✓ Endorsement policy satisfied (MedicalMSP.peer signed)                  │ │
│  │  ✓ MVCC check: vehicle:AMB-001 still at version 3                         │ │
│  │  ✓ MVCC check: active-mission:AMB-001 still at version 0                  │ │
│  │                                                                            │ │
│  │  → Transaction VALID                                                       │ │
│  │  → Commit to world state                                                   │ │
│  │  → Emit chaincode event to subscribers                                     │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  RESULT: Mission MISSION-001 is now on the blockchain!                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Comparison with Other Blockchains

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN COMPARISON                                             │
│                                                                                      │
│ ┌──────────────────┬───────────────────┬───────────────────┬───────────────────┐   │
│ │    Feature       │ Hyperledger Fabric│     Ethereum      │     Bitcoin       │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Type             │ Permissioned      │ Public/Private    │ Public            │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Participation    │ Invited only      │ Open to all       │ Open to all       │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Identity         │ Known (X.509)     │ Pseudonymous      │ Pseudonymous      │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Consensus        │ Raft (CFT)        │ PoS               │ PoW               │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ TPS              │ 3,000-20,000      │ 15-30             │ 7                 │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Finality         │ Immediate         │ ~15 minutes       │ ~60 minutes       │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Smart Contracts  │ Go, JS, Java      │ Solidity          │ Bitcoin Script    │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Privacy          │ Channels + PDC    │ All public        │ All public        │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Native Currency  │ None (optional)   │ ETH (required)    │ BTC (required)    │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Governance       │ Consortium-based  │ Community/DAO     │ Miner voting      │   │
│ ├──────────────────┼───────────────────┼───────────────────┼───────────────────┤   │
│ │ Best For         │ Enterprise B2B    │ DeFi, NFTs, dApps │ Value transfer    │   │
│ └──────────────────┴───────────────────┴───────────────────┴───────────────────┘   │
│                                                                                      │
│ WHY FABRIC FOR EMERGENCY ROUTING?                                                   │
│                                                                                      │
│ ✓ Known participants (hospitals, police, fire) → Permissioned fits perfectly       │
│ ✓ High performance needed for real-time routing → 3000+ TPS                        │
│ ✓ Immediate finality → Can't wait 15 min for ambulance route!                      │
│ ✓ Privacy between agencies → Channels and PDC                                       │
│ ✓ No cryptocurrency needed → Simpler, no gas fees                                   │
│ ✓ Flexible access control → Attribute-based policies                               │
│ ✓ Rich queries → CouchDB for complex segment queries                               │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: How Components Work Together

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    HOW IT ALL FITS TOGETHER                                          │
│                                                                                      │
│   1. IDENTITY LAYER                                                                  │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  Certificate Authorities issue X.509 certs to users and peers           │    │
│      │  MSP validates identities and extracts roles/attributes                 │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                           │
│                                          ▼                                           │
│   2. APPLICATION LAYER                                                               │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  Client apps use Fabric Gateway SDK to submit transactions              │    │
│      │  SDK handles peer discovery, endorsement collection, ordering           │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                           │
│                                          ▼                                           │
│   3. ENDORSEMENT LAYER                                                               │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  Peers execute chaincode, simulate transactions                         │    │
│      │  Create read/write sets, sign endorsements                              │    │
│      │  Endorsement policy determines required signatures                       │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                           │
│                                          ▼                                           │
│   4. ORDERING LAYER                                                                  │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  Raft cluster orders transactions deterministically                      │    │
│      │  Creates blocks, delivers to all peers on channel                        │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                           │
│                                          ▼                                           │
│   5. VALIDATION & COMMIT LAYER                                                       │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  All peers validate: endorsement policy + MVCC version checks           │    │
│      │  Valid transactions committed to world state                            │    │
│      │  Block appended to blockchain                                            │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                          │                                           │
│                                          ▼                                           │
│   6. STATE LAYER                                                                     │
│      ┌─────────────────────────────────────────────────────────────────────────┐    │
│      │  World State: Current key-value pairs (LevelDB or CouchDB)              │    │
│      │  Blockchain: Immutable history of all transactions                       │    │
│      │  Events: Chaincode events notify listening applications                  │    │
│      └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

