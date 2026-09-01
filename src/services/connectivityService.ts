import { SyncConnectionState } from '../types';

type StatusListener = (state: SyncConnectionState, pendingCount: number) => void;

class ConnectivityService {
  private listeners: Set<StatusListener> = new Set();
  private state: SyncConnectionState = typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE';
  private pendingCount = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState('ONLINE');
      });
      window.addEventListener('offline', () => {
        this.updateState('OFFLINE');
      });
    }
  }

  public getState(): SyncConnectionState {
    return this.state;
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  public updateState(newState: SyncConnectionState, pendingCount?: number) {
    this.state = newState;
    if (pendingCount !== undefined) {
      this.pendingCount = pendingCount;
    }
    this.notify();
  }

  public updatePendingCount(count: number) {
    this.pendingCount = count;
    this.notify();
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.pendingCount);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn(this.state, this.pendingCount));
  }
}

export const connectivityService = new ConnectivityService();
