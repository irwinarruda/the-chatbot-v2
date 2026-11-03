---
name: client-architecture
description: Always load for any change under src/client: placing code, adding a module, route, screen, component, Zustand service, repository, gateway or parser, or deciding what may import what in the web app. Use alongside client-service-styleguide and client-jsx-styleguide.
---

# Client architecture

## Model

Explicit MVVM with a DDD-style model, the web counterpart of favo-cli's client:

```text
TanStack route  ->  screen / component (View)
                        |
                        v
               Zustand service (ViewModel)
               state, computed values, actions
                        |
                        v
          repository or gateway port (interface)
                        |
            +-----------+-----------+
            v                       v
     Api* adapter              Browser* / Cookie* / Storage* adapter
     (ApiClient, contracts)    (MediaRecorder, cookies, localStorage)
```

- **Service**: a Zustand state and action contract plus its creator. It is the application layer.
- **Repository**: a port plus an `Api*` adapter for the backend, parsing every response with a contract schema.
- **Gateway**: a port plus an adapter for a browser capability.
- **Entity and DTO**: the domain from `src/domain`, wire types from `src/contracts`, and client-only shapes in `app/entities` and `app/dtos`.

Do not add a second application class between a service and a repository. Everything under an `app/` folder is free of React, TanStack and views, so it can be tested without a DOM.

## Folders

```text
src/client/
  routes/        TanStack page routes: guard access, validate search, render one screen
  shared/
    app/         services, gateways, entities and dtos with no module owner (prefs, privacy, ApiClient)
    components/  ui/ (shadcn primitives), terminal/ (app chrome), domain-free shared views
    error/       ApiError and the helpers views use to show errors
    hooks/       React hooks with no module owner
    i18n/        dictionaries
    stores/      app.ts: the one flat store
    styles/      tailwind.css: the Favo theme tokens
  modules/<m>/
    app/         services/ repositories/ gateways/ entities/ dtos/ utils/
    parsers/     pure transformations owned by the module: route search, formatting
    screens/<ScreenName>/index.tsx
    components/  views shared by the module's screens
```

Add only folders with a real role.

## Dependency direction

```text
route -> screen -> component
view -> service (through useApp) -> repository / gateway port
service -> domain, contracts, parsers
```

- Views never import a repository, gateway or `ApiClient`; they read and act through `useApp`. `tests/architecture.test.ts` enforces it.
- The `app/` layer never imports React, TanStack, screens or components.
- The client reaches the server only through HTTP and the server functions in `src/server/shared/http/functions/`.
- `shared/stores/app.ts` is the composition root: it builds every adapter and passes it to its service creator. Tests call the same creators with fakes.

## Working references

- `src/client/modules/todos/`: the full vertical, from route search parser to repository.
- `src/client/modules/chat/app/`: a service over a streaming repository and two browser gateways.
- `src/client/shared/stores/app.ts`: one flat store composed from every service.

## Checklist

1. Each new file sits in the folder its role names.
2. `bun run test:unit` and `bun run test:ui` pass, including the architecture test.
