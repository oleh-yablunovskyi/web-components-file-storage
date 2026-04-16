# web-components-file-storage

## Prerequisites

- Docker and Docker Compose

## Running

```bash
# Copy env file
cp .env.example .env

# Start the stack
./up.sh

# Start with file watching (auto-rebuilds on save)
./dev.sh

# Stop (preserves DB data)
./down.sh

# Wipe DB and restart fresh
./reset.sh
```

App runs at `http://localhost:8080`.