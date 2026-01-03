## Complete Tech Stack

## **BACKEND**

### **Core Framework**

- Node.js (v18+) + Express.js

### **Database**

- PostgreSQL 14+ with PostGIS extension

### **Map Data & Routing**

- OpenStreetMap (Manhattan extract)
- OSRM (Open Source Routing Machine) - Docker deployment

### **Real-time Communication**

- Socket.IO

### **Blockchain Integration**

- Hyperledger Fabric SDK for Node.js (fabric-network, fabric-ca-client)

### **Key Dependencies**

```json
{
  "express": "^4.18.2",
  "socket.io": "^4.6.1",
  "fabric-network": "^2.2.20",
  "fabric-ca-client": "^2.2.20",
  "pg": "^8.11.0",
  "pg-promise": "^11.5.4",
  "dotenv": "^16.0.3",
  "bcrypt": "^5.1.1",
  "jsonwebtoken": "^9.0.2",
  "cors": "^2.8.5",
  "axios": "^1.6.0",
  "morgan": "^1.10.0"
}
```

### **Development Tools**

- Nodemon
- Jest (testing)
- Postman (API testing)

---

## **FRONTEND**

### **Core Framework**

- React 18+ with Vite (or Create React App)

### **Map Visualization**

- Leaflet.js
- React-Leaflet

### **UI Framework**

- Tailwind CSS (utility-first styling)
- shadcn/ui or Material-UI (component library)

### **State Management**

- React Context API + useReducer (simple state)
- OR Redux Toolkit (complex state)

### **Real-time**

- Socket.IO Client

### **HTTP Requests**

- Axios

### **Key Dependencies**

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "leaflet": "^1.9.4",
  "react-leaflet": "^4.2.1",
  "socket.io-client": "^4.6.1",
  "axios": "^1.6.0",
  "tailwindcss": "^3.3.0",
  "@headlessui/react": "^1.7.17",
  "@heroicons/react": "^2.0.18",
  "recharts": "^2.10.0",
  "date-fns": "^2.30.0",
  "react-hot-toast": "^2.4.1"
}
```

---

## **BLOCKCHAIN LAYER**

### **Chaincode (Smart Contracts)**

- Go 1.20+
- Hyperledger Fabric Contract API (Go)

### **Key Go Dependencies**

```go
github.com/hyperledger/fabric-contract-api-go/contractapi
github.com/hyperledger/fabric-chaincode-go/shim
```

---

## **INFRASTRUCTURE**

### **Containerization**

- Docker + Docker Compose

### **Hyperledger Fabric Network**

- Fabric 2.5+
- Fabric CA
- CouchDB or LevelDB (peer state database)

### **Development Tools**

- Fabric Test Network
- Peer binaries
- Configtxgen, cryptogen

---

## **OPTIONAL ENHANCEMENTS**

### **Backend**

- Redis (caching vehicle locations)
- Winston (logging)
- Helmet (security headers)
- Rate-limiter-flexible (API rate limiting)

### **Frontend**

- React Query (server state management)
- Zustand (lightweight state management)
- Framer Motion (animations)
- React Hook Form (forms)

### **Monitoring**

- Prometheus + Grafana (Fabric metrics)
- PM2 (Node.js process management)

---

## **DEVELOPMENT ENVIRONMENT**

- Git + GitHub
- VSCode with extensions (ESLint, Prettier, Go)
- Postman or Insomnia (API testing)
- pgAdmin (PostgreSQL GUI)

---

**Summary:** Node.js + Express backend, React + Leaflet frontend, Go chaincodes, PostgreSQL + PostGIS for maps, OSRM for routing, Socket.IO for real-time, Fabric SDK for blockchain integration.