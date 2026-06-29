# Management Center adapter shims (PR 10b)

Vendored upstream: `apps/desktop/vendor/management-center` (`@droidproxy/management-ui`).

| Upstream module | Desktop shim | Behavior |
|-----------------|--------------|----------|
| `src/services/api/client.ts` | `apiClient.shim.ts` | Routes HTTP to Tauri `mgmt_request` |
| `src/stores/useAuthStore.ts` | `useAuthStore.shim.ts` | Auto-connect via IPC; no persisted secret |
| `src/services/storage/secureStorage.ts` | `secureStorage.shim.ts` | In-memory noop storage |

Resolution is handled by `vite.management-ui.ts` for imports under the vendored tree.