import type { BrowserContext, Worker } from '@playwright/test';

async function getExtensionWorker(context: BrowserContext): Promise<Worker> {
  const existing = context.serviceWorkers().find((worker) =>
    worker.url().startsWith('chrome-extension://'),
  );
  if (existing) return existing;
  return context.waitForEvent('serviceworker', {
    predicate: (worker) => worker.url().startsWith('chrome-extension://'),
    timeout: 15_000,
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const worker = await getExtensionWorker(context);
  return new URL(worker.url()).host;
}

export async function setExtensionStorage(
  context: BrowserContext,
  key: string,
  value: unknown,
): Promise<void> {
  const worker = await getExtensionWorker(context);
  await worker.evaluate(
    async ({ storageKey, storageValue }) => {
      await chrome.storage.local.set({ [storageKey]: storageValue });
    },
    { storageKey: key, storageValue: value },
  );
}

export async function getExtensionStorage<T>(
  context: BrowserContext,
  key: string,
): Promise<T | undefined> {
  const worker = await getExtensionWorker(context);
  return worker.evaluate(async (storageKey) => {
    const result = await chrome.storage.local.get(storageKey);
    return result[storageKey] as T | undefined;
  }, key);
}
