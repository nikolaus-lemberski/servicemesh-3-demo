# Service B

Simple service with one downstream call, written in TypeScript / Node.js Express.

Endpoints:

* "/" - Main endpoint that calls service-c and returns the response
* "/health" - Health check endpoint that returns "UP"

## Develop

Install Node.js runtime (version 18 or higher)

Install dependencies:
```bash
npm install
```

For development with auto-reload:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

### Unit tests

```bash
npm test
```

For watch mode:
```bash
npm run test:watch
```

### Container image

Use provided Containerfile to create a container image:

```bash
podman build -t service-b .
```