# LibreChat — Project Architecture

LibreChat is a feature-rich, self-hostable AI chat platform built as a monorepo. It supports multiple
LLM providers (OpenAI, Anthropic, Google, Azure, Ollama, etc.), agents, MCP tool integration,
multi-user authentication, and RAG-based retrieval. This document provides a reference for
developers who want to understand how the codebase is structured and how its parts interact.

---

## 1. Directory Structure

```
LibreChat/
├── api/                          # Legacy JavaScript backend (Express entry point)
│   ├── server/
│   │   ├── index.js              # Express app initialization & server startup
│   │   ├── routes/               # REST route modules (auth, messages, agents, mcp, …)
│   │   ├── controllers/          # Request handlers (Auth, User, MCP, Tools, …)
│   │   ├── middleware/           # Auth verification, validation, error handling
│   │   └── services/             # Business logic (Runs, Endpoints, RAG, …)
│   ├── models/                   # Mongoose model definitions (legacy)
│   ├── app/clients/              # AI provider client integrations (Ollama, …)
│   ├── db/                       # Database connection helpers
│   ├── config/                   # Path resolution, parsers, logging
│   └── strategies/               # Passport authentication strategies
│
├── packages/                     # Shared TypeScript libraries
│   ├── api/                      # @librechat/api — all new backend logic (TS only)
│   │   └── src/
│   │       ├── mcp/              # Model Context Protocol implementation
│   │       ├── endpoints/        # AI provider endpoints & routing
│   │       ├── auth/             # Authentication utilities
│   │       ├── stream/           # Server-Sent Events streaming
│   │       ├── cache/            # Caching layer (Redis)
│   │       ├── files/            # File handling & storage
│   │       ├── agents/           # Agent lifecycle management
│   │       ├── prompts/          # Prompt construction
│   │       ├── tools/            # Plugin / tool registry
│   │       ├── flow/             # Conversation flow management
│   │       └── middleware/       # Express middleware (TS)
│   │
│   ├── data-provider/            # librechat-data-provider — shared API types & data service
│   │   └── src/
│   │       ├── api-endpoints.ts  # All API endpoint URL definitions
│   │       ├── data-service.ts   # Axios-based HTTP wrapper
│   │       ├── schemas.ts        # Zod validation schemas
│   │       ├── types.ts          # Shared TypeScript types
│   │       ├── react-query/      # React Query hooks (frontend)
│   │       └── keys.ts           # QueryKey & MutationKey constants
│   │
│   ├── data-schemas/             # @librechat/data-schemas — Mongoose schemas (TS)
│   │   └── src/
│   │       ├── models/           # Mongoose model definitions
│   │       ├── methods/          # Model instance methods
│   │       ├── app/              # App-level configuration models
│   │       └── types/            # TypeScript types for DB documents
│   │
│   └── client/                   # @librechat/client — shared React components & utilities
│       └── src/
│           ├── components/       # Reusable UI components
│           └── utils/            # Shared frontend helpers
│
├── client/                       # React SPA (Vite + TypeScript)
│   └── src/
│       ├── main.jsx              # React DOM root entry point
│       ├── App.jsx               # Root component, router setup
│       ├── routes/               # Page-level route components
│       ├── components/           # Feature components (Chat, Auth, Agents, MCP, …)
│       ├── store/                # Jotai atoms (global state)
│       ├── hooks/                # Custom React hooks
│       ├── data-provider/        # Feature-specific React Query wrappers
│       ├── locales/              # i18n translation files
│       └── utils/                # Frontend utility functions
│
├── e2e/                          # Playwright end-to-end tests
├── helm/                         # Kubernetes Helm charts
├── docker-compose.yml            # Local development services
├── Dockerfile                    # Multi-stage production build
├── librechat.example.yaml        # Main application configuration template
├── package.json                  # Root workspace config & scripts
├── turbo.json                    # Turbo monorepo build pipeline
└── AGENTS.md                     # Workspace boundaries, code style rules, contribution guidelines
```

---

## 2. Workspace Boundaries

| Workspace | Language | Side | Purpose |
|---|---|---|---|
| `/api` | JavaScript (legacy) | Backend | Thin Express wrapper — minimize changes here |
| `/packages/api` | **TypeScript** | Backend | All new backend logic (MCP, streaming, caching, agents) |
| `/packages/data-schemas` | TypeScript | Backend | Database models & schemas, shared across backend |
| `/packages/data-provider` | TypeScript | Shared | API types, endpoints, data service — used by both frontend and backend |
| `/client` | TypeScript / React | Frontend | Vite SPA — the chat interface |
| `/packages/client` | TypeScript | Frontend | Shared React components & utilities |

> **Rule**: All new backend code must be TypeScript in `/packages/api`. Keep `/api` changes to the
> absolute minimum — thin JS wrappers that call into `/packages/api`.

---

## 3. Technology Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (Alpine Linux in Docker) |
| Framework | Express.js v5 |
| Languages | JavaScript (`/api` legacy) + TypeScript (`/packages/api`) |
| Database | MongoDB 8 (main data store via Mongoose) |
| Full-text search | Meilisearch |
| Vector DB | PostgreSQL + pgvector (RAG / embeddings) |
| Cache / Sessions | Redis |
| Authentication | Passport.js — JWT, LDAP, OAuth2 (Google, GitHub, Discord, …), SAML, OIDC |
| AI / LLM | OpenAI SDK, Anthropic SDK, LangChain, AWS Bedrock, Azure OpenAI, Google Vertex AI, Ollama |
| Streaming | Server-Sent Events (SSE) |
| File storage | Local filesystem, AWS S3, Google Firebase |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS + Radix UI + Headless UI |
| State management | Jotai (atomic) |
| Routing | React Router v6 |
| Data fetching | React Query v4 + Axios |
| Markdown | react-markdown + rehype / remark plugins |
| Code artifacts | Monaco Editor, Mermaid, Sandpack |
| Internationalization | i18next |

### Tooling

| Tool | Purpose |
|---|---|
| Turbo | Monorepo build orchestration |
| Docker Compose | Local service orchestration |
| Playwright | End-to-end tests |
| Jest | Unit tests |
| ESLint + Prettier | Linting & formatting |
| Husky | Git hooks |

---

## 4. Core Request Flow

### Chat Message (typical path)

```
User types in ChatInput component
        │
        ▼  HTTP POST /api/messages
Express route → MessageController
        │
        ├── Auth middleware (JWT verification)
        ├── Rate-limit check
        ├── Persist Message + Conversation to MongoDB
        └── StreamService (packages/api/src/stream/)
                │
                ├── Determine AI endpoint (librechat.yaml config)
                ├── Build prompt from conversation history
                ├── Call AI provider (OpenAI, Anthropic, Ollama, …)
                └── Stream response as SSE chunks
                        │
                        ▼  SSE
                React receives chunks in real-time
                        │
                        ├── Render incremental markdown response
                        ├── Update Jotai atoms (UI state)
                        └── Final message saved to MongoDB
```

### React Data-Fetching Pattern

```
React component
  → useQuery / useMutation (React Query, packages/data-provider/src/react-query/)
  → DataService.ts (axios wrapper, packages/data-provider/src/data-service.ts)
  → Express route (api/server/routes/)
  → Controller (api/server/controllers/)
  → Mongoose model (packages/data-schemas/src/models/)
  → MongoDB
```

---

## 5. Authentication & Authorization

### Authentication strategies

| Strategy | Usage |
|---|---|
| JWT (Bearer) | Default token-based auth for all API requests |
| Local | Username / password, stored in MongoDB |
| LDAP | Enterprise Active Directory integration |
| OAuth2 | Social login: Google, GitHub, Discord, Facebook, Apple |
| SAML / OIDC | Enterprise SSO federation |

### Authorization

- **Role-based access control (RBAC)**: roles `admin`, `user`, `moderator`
- **Resource permissions**: view, edit, delete, share — configured per endpoint
- **Interface permissions**: customizable via `librechat.yaml` (e.g., hide features for certain roles)
- **Agent / prompt sharing**: per-user or per-group access rules

---

## 6. AI / LLM Integration

### Endpoint configuration (`librechat.yaml`)

```yaml
endpoints:
  openai:
    apiKey: "${OPENAI_API_KEY}"
  anthropic:
    apiKey: "${ANTHROPIC_API_KEY}"
  google:
    apiKey: "${GOOGLE_API_KEY}"
  azure:
    apiKey: "${AZURE_OPENAI_KEY}"
    resourceName: your-resource
  ollama:
    baseURL: "http://localhost:11434"   # local models
  custom:                               # any OpenAI-compatible endpoint
    baseURL: "https://your-api.example.com"
  bedrock:
    region: us-east-1
```

### Agent & tool integration

- **@librechat/agents** — external package (same team); wraps LangChain for agent execution
- **MCP (Model Context Protocol)** (`packages/api/src/mcp/`) — standardized protocol to connect
  models to external tools and services (file search, web search, code execution, custom functions)
- **RAG** — retrieval-augmented generation via pgvector + the `rag_api` service

### Streaming pipeline

```
User message
  → Select endpoint (librechat.yaml)
  → Build prompt (packages/data-provider)
  → StreamService (packages/api/src/stream/)
      ├── Call AI provider
      ├── Parse streamed tokens
      └── Forward via SSE
  → Frontend React Query / SSE consumer
  → Incremental markdown render
```

---

## 7. Configuration & Deployment

### Key configuration files

| File | Purpose |
|---|---|
| `librechat.example.yaml` | Main app config template — endpoints, interface, auth, file storage, agents |
| `.env` | Secrets & environment variables (port, DB URI, API keys, OAuth credentials) |
| `docker-compose.yml` | Local development: api, mongodb, meilisearch, vectordb, rag_api |
| `Dockerfile` | Multi-stage production image (Node 20 Alpine) |
| `turbo.json` | Turbo build pipeline (parallel, cached) |
| `package.json` (root) | npm workspaces, shared scripts |

### Docker services

| Service | Image | Port | Role |
|---|---|---|---|
| `api` | (built from `Dockerfile`) | 3080 | Express + React static assets |
| `mongodb` | `mongo:8.0` | 27017 | Primary data store |
| `meilisearch` | `getmeili/meilisearch` | 7700 | Full-text message search |
| `vectordb` | `pgvector/pgvector` | 5432 | Embeddings for RAG |
| `rag_api` | `librechat-rag-api` | 8000 | RAG retrieval service |

### Dockerfile build stages

```
Stage 1 — Build
  Install jemalloc + Python 3 + uv
  npm ci (all workspaces)
  npm run frontend (build React + TypeScript packages)
  npm prune --production

Stage 2 — Runtime
  Copy built artifacts
  Expose port 3080
  Run api/server/index.js
```

### Deployment options

- **Docker Compose** — recommended for local and self-hosted production
- **Kubernetes** — Helm charts in `/helm`
- **Railway / Zeabur / Sealos** — one-click hosted deployments
- **Manual VPS** — Node.js 20 + MongoDB + Redis

---

## 8. Testing

### Unit tests (Jest)

```bash
# From the relevant workspace directory
cd api   && npx jest <pattern>         # Backend JS tests
cd packages/api && npx jest <pattern>  # Backend TS tests
cd client && npx jest <pattern>        # Frontend component tests
```

Or from the root:

```bash
npm run test:api
npm run test:client
npm run test:packages:api
npm run test:packages:data-provider
npm run test:packages:data-schemas
npm run test:all
```

### End-to-end tests (Playwright)

```bash
npm run e2e              # Headless
npm run e2e:headed       # Visible browser
npm run e2e:ci           # CI mode
npm run e2e:a11y         # Accessibility
```

### Linting & formatting

```bash
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix
npm run format           # Prettier
```

---

## 9. Development Workflow

### First-time setup

```bash
docker compose up -d mongodb meilisearch vectordb   # Start backing services
cp .env.example .env                                # Configure environment
npm install                                         # Install all workspaces
npm run build                                       # Build TypeScript packages
```

### Day-to-day development

```bash
npm run backend:dev      # Express with file watching (port 3080)
npm run frontend:dev     # Vite with HMR (port 3090, proxies API to 3080)
```

### Adding new backend logic

1. Write TypeScript in `/packages/api/src/`.
2. Export from the package's `index.ts`.
3. Import into `/api/server/` via a thin JS wrapper.
4. Add API endpoint URL to `packages/data-provider/src/api-endpoints.ts`.
5. Add React Query hook in `packages/data-provider/src/react-query/`.
6. Run `npm run build:data-provider` to rebuild the shared package.

### Adding new frontend UI

1. Add user-facing text keys to `client/src/locales/en/translation.json`.
2. Use `useLocalize()` in components for all displayed strings.
3. Use semantic HTML with ARIA attributes for accessibility.
4. Co-locate tests in `__tests__/` directories next to components.

---

## 10. Recommended Reading Order

1. **`README.md`** — feature overview, quick-start, deployment options
2. **`AGENTS.md`** — workspace boundaries, code style rules, contribution guidelines
3. **`librechat.example.yaml`** — understand the full configuration surface
4. **`docker-compose.yml`** — understand the service topology
5. **`api/server/index.js`** — Express initialization, middleware, route registration
6. **`packages/api/src/stream/`** — the SSE streaming pipeline (core of chat)
7. **`packages/data-provider/src/`** — shared types & API contracts
8. **`client/src/routes/ChatRoute.tsx`** — main chat UI entry point
9. **`packages/api/src/mcp/`** — MCP tool integration (if working on agents/tools)
