'use client';

import { useEffect, useState } from 'react';

export function SyncChecker() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  useEffect(() => {
    async function checkAndSync() {
      try {
        // Check if sync is needed
        const checkResponse = await fetch('/api/sync');
        const { syncNeeded } = await checkResponse.json();

        if (syncNeeded) {
          console.log('[SyncChecker] Sync needed, triggering sync...');
          setSyncing(true);

          // Trigger sync
          const syncResponse = await fetch('/api/sync', { method: 'POST' });
          const result = await syncResponse.json();

          if (result.success && result.synced > 0) {
            setSyncResult({ synced: result.synced });
            console.log(`[SyncChecker] Synced ${result.synced} expenses from Google Sheets`);
          }

          setSyncing(false);
        }
      } catch (error) {
        console.error('[SyncChecker] Error during sync:', error);
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
