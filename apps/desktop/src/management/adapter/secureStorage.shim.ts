/**
 * In-memory storage shim for bundled desktop mode.
 * Upstream obfuscated localStorage is disabled — Rust owns the management key.
 */

interface StorageOptions {
  obfuscate?: boolean;
  encrypt?: boolean;
}

class MemoryStorageService {
  private readonly data = new Map<string, string>();

  setItem(key: string, value: unknown): void {
    if (value === null || value === undefined) {
      this.removeItem(key);
      return;
    }
    this.data.set(key, JSON.stringify(value));
  }

  getItem<T = unknown>(_key: string, _options?: StorageOptions): T | null {
    return null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  migratePlaintextKeys(_keys: string[]): void {
    // no-op in desktop mode
  }
}

export const obfuscatedStorage = new MemoryStorageService();