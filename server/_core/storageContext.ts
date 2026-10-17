import { AsyncLocalStorage } from "node:async_hooks";

const owners = new AsyncLocalStorage<number>();

export function withStorageOwner<T>(userId: number, operation: () => T): T {
  return owners.run(userId, operation);
}

export function storageOwner(): number | undefined {
  return owners.getStore();
}
