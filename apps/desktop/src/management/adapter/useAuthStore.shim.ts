/**
 * Auth store shim for desktop IPC mode.
 * Never persists or exposes managementSecretKey — connection is owned by Rust.
 */

import { create } from "zustand";
import { apiClient } from "./apiClient.shim";
import { versionApi } from "@droidproxy/management-ui/services/api/version";
import { useConfigStore } from "@droidproxy/management-ui/stores/useConfigStore";
import { useModelsStore } from "@droidproxy/management-ui/stores/useModelsStore";

const DESKTOP_API_BASE = "http://127.0.0.1:8418";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
type ServerRuntimeKind = "cpa" | "home" | "unknown";

type LoginCredentials = {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
};

export type AuthStoreState = {
  isAuthenticated: boolean;
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
  serverRuntimeKind: ServerRuntimeKind;
  supportsPlugin: boolean;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  updateServerVersion: (
    version: string | null,
    buildDate?: string | null,
    runtimeKind?: ServerRuntimeKind | null
  ) => void;
  updateServerRuntimeKind: (runtimeKind: ServerRuntimeKind) => void;
  updateServerPluginSupport: (supportsPlugin: boolean) => void;
  updateConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
};

let restoreSessionPromise: Promise<boolean> | null = null;

const detectRuntimeKind = async (): Promise<ServerRuntimeKind> => {
  try {
    return await versionApi.detectRuntimeKind();
  } catch {
    return "unknown";
  }
};

const connectViaIpc = async (): Promise<void> => {
  apiClient.setConfig({ apiBase: DESKTOP_API_BASE, managementKey: "ipc" });
  useModelsStore.getState().clearCache();
  await useConfigStore.getState().fetchConfig(undefined, true);
};

export const useAuthStore = create<AuthStoreState>()((set, get) => ({
  isAuthenticated: false,
  apiBase: DESKTOP_API_BASE,
  managementKey: "",
  rememberPassword: false,
  serverVersion: null,
  serverBuildDate: null,
  serverRuntimeKind: "unknown",
  supportsPlugin: false,
  connectionStatus: "disconnected",
  connectionError: null,

  restoreSession: () => {
    if (restoreSessionPromise) return restoreSessionPromise;

    restoreSessionPromise = (async () => {
      try {
        set({
          connectionStatus: "connecting",
          serverVersion: null,
          serverBuildDate: null,
          serverRuntimeKind: "unknown",
          supportsPlugin: false
        });
        await connectViaIpc();
        const runtimeKind = await detectRuntimeKind();
        set({
          isAuthenticated: true,
          apiBase: DESKTOP_API_BASE,
          managementKey: "",
          connectionStatus: "connected",
          connectionError: null,
          ...(runtimeKind !== "unknown" ? { serverRuntimeKind: runtimeKind } : {})
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Connection failed";
        set({
          isAuthenticated: false,
          connectionStatus: "error",
          connectionError: message
        });
        return false;
      } finally {
        restoreSessionPromise = null;
      }
    })();

    return restoreSessionPromise;
  },

  login: async (credentials) => {
    void credentials;
    await get().restoreSession();
  },

  logout: () => {
    restoreSessionPromise = null;
    useConfigStore.getState().clearCache();
    useModelsStore.getState().clearCache();
    set({
      isAuthenticated: false,
      apiBase: DESKTOP_API_BASE,
      managementKey: "",
      serverVersion: null,
      serverBuildDate: null,
      serverRuntimeKind: "unknown",
      supportsPlugin: false,
      connectionStatus: "disconnected",
      connectionError: null
    });
  },

  checkAuth: async () => {
    try {
      apiClient.setConfig({ apiBase: DESKTOP_API_BASE, managementKey: "ipc" });
      set({ supportsPlugin: false });
      await useConfigStore.getState().fetchConfig();
      const runtimeKind = await detectRuntimeKind();
      set({
        isAuthenticated: true,
        connectionStatus: "connected",
        ...(runtimeKind !== "unknown" ? { serverRuntimeKind: runtimeKind } : {})
      });
      return true;
    } catch {
      set({
        isAuthenticated: false,
        connectionStatus: "error",
        supportsPlugin: false
      });
      return false;
    }
  },

  updateServerVersion: (version, buildDate, runtimeKind) => {
    set((state) => ({
      serverVersion: version || null,
      serverBuildDate: buildDate || null,
      serverRuntimeKind: runtimeKind || state.serverRuntimeKind
    }));
  },

  updateServerRuntimeKind: (runtimeKind) => {
    set({ serverRuntimeKind: runtimeKind });
  },

  updateServerPluginSupport: (supportsPlugin) => {
    set({ supportsPlugin });
  },

  updateConnectionStatus: (status, error = null) => {
    set({
      connectionStatus: status,
      connectionError: error
    });
  }
}));

if (typeof window !== "undefined") {
  window.addEventListener("unauthorized", () => {
    useAuthStore.getState().logout();
  });

  window.addEventListener("server-version-update", ((event: CustomEvent) => {
    const detail = event.detail || {};
    const runtimeKind =
      detail.runtimeKind === "cpa" || detail.runtimeKind === "home" ? detail.runtimeKind : null;
    useAuthStore
      .getState()
      .updateServerVersion(detail.version || null, detail.buildDate || null, runtimeKind);
  }) as EventListener);

  window.addEventListener("server-plugin-support-update", ((event: CustomEvent) => {
    useAuthStore.getState().updateServerPluginSupport(event.detail?.supportsPlugin === true);
  }) as EventListener);
}