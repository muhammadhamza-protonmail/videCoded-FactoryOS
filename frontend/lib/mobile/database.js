import { Capacitor } from '@capacitor/core';
import { MOBILE_DATABASE_NAME, mobileSchemaSql } from './schema';

let sqliteConnection;
let databaseConnection;
let initializePromise;

export function isNativeMobileApp() {
    if (typeof window === 'undefined') return false;

    const platform = Capacitor.getPlatform?.();
    if (platform === 'android' || platform === 'ios') return true;

    return Boolean(
        Capacitor.isNativePlatform?.()
        || window.Capacitor?.isNativePlatform?.()
        || window.Capacitor?.getPlatform?.() === 'android'
        || window.Capacitor?.getPlatform?.() === 'ios'
    );
}

async function createDatabaseConnection() {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');

    if (!sqliteConnection) {
        sqliteConnection = new SQLiteConnection(CapacitorSQLite);
    }

    const existing = await sqliteConnection.isConnection(MOBILE_DATABASE_NAME, false).catch(() => ({ result: false }));
    const db = existing.result
        ? await sqliteConnection.retrieveConnection(MOBILE_DATABASE_NAME, false)
        : await sqliteConnection.createConnection(MOBILE_DATABASE_NAME, false, 'no-encryption', 1, false);

    const opened = await db.isDBOpen().catch(() => ({ result: false }));
    if (!opened.result) {
        await db.open();
    }

    return db;
}

async function getCount(db, tableName, where = '', values = []) {
    const result = await db.query(`SELECT COUNT(*) AS count FROM ${tableName} ${where}`, values);
    return Number(result.values?.[0]?.count || 0);
}

async function seedUser(db, user) {
    const count = await getCount(db, 'users', 'WHERE username = ?', [user.username]);
    if (count > 0) {
        await db.run(
            `UPDATE users
             SET factory_id = COALESCE(factory_id, ?),
                 status = COALESCE(status, 'active')
             WHERE username = ?`,
            [user.factory_id, user.username]
        );
        return;
    }

    await db.run(
        `INSERT INTO users (user_id, username, password, full_name, role, factory_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [user.user_id, user.username, user.password, user.full_name, user.role, user.factory_id]
    );
}

async function seedDefaults(db) {
    if (await getCount(db, 'factories') === 0) {
        await db.run(
            `INSERT INTO factories (factory_id, name, address, status)
             VALUES (?, ?, ?, ?)`,
            ['factory_1', 'Default Factory 1', 'System Default Address', 'active']
        );
    }

    if (await getCount(db, 'global_settings') === 0) {
        await db.run(`INSERT INTO global_settings (app_name) VALUES (?)`, ['FactoryOS']);
    }

    await seedUser(db, {
        user_id: 'S001',
        username: 'superadmin',
        password: 'superadmin123',
        full_name: 'System Superadmin',
        role: 'superadmin',
        factory_id: 'factory_1',
    });

    await seedUser(db, {
        user_id: 'A001',
        username: 'admin',
        password: 'admin123',
        full_name: 'System Admin',
        role: 'admin',
        factory_id: 'factory_1',
    });

    await seedUser(db, {
        user_id: 'U001',
        username: 'user1',
        password: 'user123',
        full_name: 'Factory User',
        role: 'user',
        factory_id: 'factory_1',
    });
}

export async function ensureMobileDefaults() {
    const db = await initializeMobileDatabase();
    if (!db) return null;

    await db.execute(mobileSchemaSql);
    await seedDefaults(db);
    return db;
}

export async function initializeMobileDatabase() {
    if (!isNativeMobileApp()) return null;

    if (!initializePromise) {
        initializePromise = (async () => {
            databaseConnection = await createDatabaseConnection();
            await databaseConnection.execute(mobileSchemaSql);
            await seedDefaults(databaseConnection);
            return databaseConnection;
        })().catch((error) => {
            initializePromise = null;
            databaseConnection = null;
            throw error;
        });
    }

    return initializePromise;
}

export async function getMobileDatabase() {
    return databaseConnection || initializeMobileDatabase();
}
