# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /chaincode

# Copy go module files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the chaincode
RUN CGO_ENABLED=0 GOOS=linux go build -o chaincode .

# Runtime stage
FROM alpine:3.18

WORKDIR /chaincode

COPY --from=builder /chaincode/chaincode .

EXPOSE 9999

CMD ["./chaincode"]

