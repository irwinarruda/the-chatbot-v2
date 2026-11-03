# State lifecycles

## Overlapping requests

A list load can be superseded by a newer one. Keep a request counter in the creator closure, bump it per call, and ignore results and errors from older calls. Loading flags clear only for the newest request.

## Mutation consistency

Choose one path per mutation: accept the authoritative entity the server returns, refresh because the backend owns ordering or generated fields, or acknowledge an optimistic item and reconcile it through a stream event by its correlation id. Never update from the response and then refetch by habit.

## Optimistic items

Use them only when latency hurts and there is a deterministic reconciliation key. An optimistic item has a client correlation id, a visible pending or failed state, exact reconciliation and a rollback. Never let a failed optimistic item look confirmed.

## Streams

The repository owns parsing, reconnect and cancellation; the service owns connection state and reduces events by persisted id; the view renders status. Key each subscription by the conversation it belongs to; opening another one cancels the previous one and ignores late callbacks. Reduce updates by exact id, never by "the most plausible item". Batch high-frequency progress (`createChatProgressBatcher`) before it reaches the store.

## Media and devices

Recorder, device and timer handles live inside a gateway adapter; a ref holds only the session or cleanup handle. Clean up tracks, timers and object URLs explicitly. Device discovery never mixes with message reduction.

## Server rendering

Never write request-specific data into the process-global store during server render. Request data travels through route context and is hydrated into the browser store by an explicit action (`hydratePrefs`). Later hydration calls say whether they replace, merge or ignore.

## Browser storage

Services do not know cookie names or storage keys; a `Cookie*` or `Storage*` gateway does. Cookie parsing that the server also needs lives in `src/contracts`.

## Resets

A restartable workflow has an explicit reset that clears only what it owns: selections, drafts, fetched collections, flags, optimistic items, subscriptions and media handles. Stop subscriptions before clearing the state that names them. Signing out runs every module's reset.
