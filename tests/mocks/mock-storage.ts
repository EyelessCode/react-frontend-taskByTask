export class MockStorage implements Storage {
  private store = new Map<string, string>();
  private simulateQuotaError = false;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.simulateQuotaError) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.store.set(key, String(value));
  }

  setSimulateQuotaExceeded(simulate: boolean): void {
    this.simulateQuotaError = simulate;
  }
}
