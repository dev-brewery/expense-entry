'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LAST_SYNC_KEY = 'expense-tracker-last-sync';

export function SyncChecker() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  useEffect(() => {
    async function checkAndSync() {
      logger.debug('Component mounted, starting sync check...');
      try {
        // Check if enough time has passed since last sync
        const lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
        const now = Date.now();
        logger.debug('Last sync timestamp:', lastSyncTime);

        if (lastSyncTime) {
          const timeSinceLastSync = now - parseInt(lastSyncTime, 10);
          if (timeSinceLastSync < SYNC_INTERVAL_MS) {
            logger.debug(
              `Skipping sync, last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`
            );
            return;
          }
        }

        // Check if sync is needed
        const checkResponse = await fetch('/api/sync');
        const { syncNeeded } = await checkResponse.json();

        if (syncNeeded) {
          logger.info('Sync needed, triggering sync...');
          setSyncing(true);

          // Trigger sync
          const syncResponse = await fetch('/api/sync', { method: 'POST' });
          const result = await syncResponse.json();

          if (result.success && result.synced > 0) {
            setSyncResult({ synced: result.synced });
            logger.info(`Synced ${result.synced} expenses from Google Sheets`);
          }

          setSyncing(false);
        }

        // Update last sync timestamp
        localStorage.setItem(LAST_SYNC_KEY, now.toString());
        logger.debug('Sync check complete');
      } catch (error) {
        logger.error('Error during sync', error);
        logger.error('Error details:', error instanceof Error ? error.message : String(error));
        setSyncing(false);
      }
    }

    checkAndSync();
  }, []);

  if (!syncing && !syncResult) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
      {syncing ? (
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          <span>Syncing from Google Sheets...</span>
        </div>
      ) : syncResult ? (
        <span>Synced {syncResult.synced} new expenses</span>
      ) : null}
    </div>
  );
}
