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

## End-to-end tests

Self-contained — starts the stack, runs Playwright, tears it down:

```bash
./test-e2e.sh
```

Keep the stack up after tests:

```bash
KEEP_STACK=1 ./test-e2e.sh
```

Step through tests in the Playwright Inspector (headed browser, pauses before every action):

```bash
PWDEBUG=1 ./test-e2e.sh
```

Extra flags are forwarded to `playwright test` (e.g. `--headed`, `--ui`, `-g "pattern"`).