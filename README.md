# web-components-file-storage

## Prerequisites

- Docker and Docker Compose

## Running

Copy env file:

```bash
cp .env.example .env
```

Start the stack:

```bash
./up.sh
```

Start with file watching (auto-rebuilds on save):

```bash
./dev.sh
```

Stop (preserves DB data):

```bash
./down.sh
```

Wipe DB and restart fresh:

```bash
./reset.sh
```

App runs at `http://localhost:8080`.

## Unit tests

Run unit tests:

```bash
./test-unit.sh
```