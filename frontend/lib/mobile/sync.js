import { getMobileDatabase, isNativeMobileApp } from './database';

export async function getPendingSyncCount() {
    if (!isNativeMobileApp()) return 0;
    const db = await getMobileDatabase();
    const result = await db.query(`SELECT COUNT(*) AS count FROM sync_outbox WHERE status = 'pending'`);
    return Number(result.values?.[0]?.count || 0);
}

export async function getPendingSyncItems(limit = 100) {
    if (!isNativeMobileApp()) return [];
    const db = await getMobileDatabase();
    const result = await db.query(
        `SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY id ASC LIMIT ?`,
        [limit]
    );
    return result.values || [];
}

export function notifyRemoteDataUpdated(detail = {}) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('factoryos-remote-data-updated', { detail }));
}

