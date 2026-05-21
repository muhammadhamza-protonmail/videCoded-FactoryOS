import { ensureMobileDefaults, getMobileDatabase, isNativeMobileApp } from './database';

const allModules = [
    'dashboard', 'customers', 'products', 'vendors', 'rawmaterials',
    'production', 'invoices', 'payments', 'inventory', 'users'
];

const tableConfig = {
    customers: { table: 'customers', id: 'customer_id', prefix: 'C', order: 'name ASC' },
    vendors: { table: 'vendors', id: 'vendor_id', prefix: 'V', order: 'name ASC' },
    products: { table: 'products', id: 'product_id', prefix: 'P', order: 'name ASC' },
    rawmaterials: { table: 'raw_materials', id: 'material_id', prefix: 'RM', order: 'name ASC' },
    production: { table: 'production_logs', id: 'log_id', prefix: 'PL', order: 'date DESC' },
    invoices: { table: 'invoices', id: 'invoice_id', prefix: 'INV', order: 'date DESC' },
    payments: { table: 'payments', id: 'payment_id', prefix: 'PAY', order: 'date DESC' },
    inventory: { table: 'inventory_movements', id: 'movement_id', prefix: 'IM', order: 'rowid DESC' },
    users: { table: 'users', id: 'user_id', prefix: 'U', order: 'username ASC' },
};

const tableColumnCache = {};

function axiosResponse(data, status = 200) {
    return { data, status, statusText: 'OK', headers: {}, config: {} };
}

function axiosError(message, status = 400) {
    const error = new Error(message);
    error.response = { status, data: { error: message } };
    return error;
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

function currentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return {};
    }
}

function activeFactoryId() {
    return currentUser().factory_id || 'factory_1';
}

function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function permissionsFor(user, rows = []) {
    const permissions = {};
    rows.forEach(row => {
        permissions[row.module] = {
            view: Boolean(row.can_view),
            add: Boolean(row.can_add),
            edit: Boolean(row.can_edit),
            delete: Boolean(row.can_delete),
        };
    });

    if (user.role === 'admin' || user.role === 'superadmin') {
        allModules.forEach(moduleName => {
            permissions[moduleName] = { view: true, add: true, edit: true, delete: true };
        });
    }

    return permissions;
}

async function nextId(db, config) {
    const result = await db.query(`SELECT COUNT(*) AS count FROM ${config.table}`);
    const count = Number(result.values?.[0]?.count || 0) + 1;
    return `${config.prefix}${String(count).padStart(3, '0')}`;
}

function cleanPayload(payload) {
    return Object.fromEntries(
        Object.entries(payload || {}).filter(([, value]) => value !== undefined)
    );
}

async function tableColumns(db, tableName) {
    if (!tableColumnCache[tableName]) {
        const result = await db.query(`PRAGMA table_info(${tableName})`);
        tableColumnCache[tableName] = (result.values || []).map(column => column.name);
    }

    return tableColumnCache[tableName];
}

async function cleanTablePayload(db, config, payload) {
    const columns = await tableColumns(db, config.table);
    const row = cleanPayload(payload);
    return Object.fromEntries(
        Object.entries(row).filter(([column]) => columns.includes(column))
    );
}

async function queueChange(db, operation, resource, recordId, payload) {
    await db.run(
        `INSERT INTO sync_outbox (operation, resource, record_id, payload, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [operation, resource, recordId || null, JSON.stringify(payload || {})]
    );

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('factoryos-local-data-changed', {
            detail: { operation, resource, recordId }
        }));
    }
}

async function insertRow(db, resource, payload, queue = true) {
    const config = tableConfig[resource];
    const id = payload[config.id] || await nextId(db, config);
    const row = await cleanTablePayload(db, config, {
        ...payload,
        [config.id]: id,
        factory_id: payload.factory_id || activeFactoryId(),
    });
    const columns = Object.keys(row);

    await db.run(
        `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        columns.map(column => row[column])
    );

    const inserted = await getRow(db, config, id);
    if (queue) await queueChange(db, 'create', resource, id, inserted);
    return inserted;
}

async function updateRow(db, resource, id, payload, queue = true) {
    const config = tableConfig[resource];
    const row = await cleanTablePayload(db, config, payload);
    const columns = Object.keys(row).filter(column => column !== config.id);
    if (columns.length === 0) return getRow(db, config, id);

    await db.run(
        `UPDATE ${config.table} SET ${columns.map(column => `${column} = ?`).join(', ')} WHERE ${config.id} = ?`,
        [...columns.map(column => row[column]), id]
    );

    const updated = await getRow(db, config, id);
    if (queue) await queueChange(db, 'update', resource, id, updated);
    return updated;
}

async function listRows(db, config) {
    const result = await db.query(
        `SELECT * FROM ${config.table} WHERE COALESCE(factory_id, ?) = ? ORDER BY ${config.order}`,
        [activeFactoryId(), activeFactoryId()]
    );
    return result.values || [];
}

async function getRow(db, config, id) {
    const result = await db.query(`SELECT * FROM ${config.table} WHERE ${config.id} = ?`, [id]);
    return result.values?.[0] || null;
}

async function listInvoices(db) {
    const result = await db.query(
        `SELECT i.*, c.name AS customer_name
         FROM invoices i LEFT JOIN customers c ON i.customer_id = c.customer_id
         WHERE COALESCE(i.factory_id, ?) = ? ORDER BY i.date DESC, i.rowid DESC`,
        [activeFactoryId(), activeFactoryId()]
    );
    return result.values || [];
}

async function invoiceDetail(db, invoiceId) {
    const invoice = (await db.query(
        `SELECT i.*, c.name AS customer_name
         FROM invoices i LEFT JOIN customers c ON i.customer_id = c.customer_id
         WHERE i.invoice_id = ?`,
        [invoiceId]
    )).values?.[0];

    if (!invoice) throw axiosError('Invoice not found', 404);

    const items = (await db.query(
        `SELECT ii.*, p.name AS product_name
         FROM invoice_items ii LEFT JOIN products p ON ii.product_id = p.product_id
         WHERE ii.invoice_id = ?`,
        [invoiceId]
    )).values || [];

    const payments = (await db.query(
        `SELECT * FROM payments WHERE invoice_id = ? ORDER BY date DESC`,
        [invoiceId]
    )).values || [];

    return { invoice, items, payments };
}

async function createInvoice(db, payload) {
    if (!payload.customer_id) throw axiosError('Please select a customer');
    if (!Array.isArray(payload.items) || payload.items.length === 0) throw axiosError('Invoice items are required');

    const invoiceId = await nextId(db, tableConfig.invoices);
    const invoiceNo = payload.invoice_no || `INV-${String(invoiceId).replace(/^INV/, '').padStart(3, '0')}`;
    const items = payload.items.map(item => ({
        product_id: item.product_id,
        quantity: Math.round(normalizeNumber(item.quantity)),
        unit_price: normalizeNumber(item.unit_price),
    }));
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const customer = await getRow(db, tableConfig.customers, payload.customer_id);
    if (!customer) throw axiosError('Customer not found', 404);
    const customerBalance = normalizeNumber(customer.balance_due);
    const advanceAvailable = Math.max(-customerBalance, 0);
    const advanceApplied = Math.min(advanceAvailable, totalAmount);
    const invoiceBalanceDue = totalAmount - advanceApplied;
    const invoiceStatus = invoiceBalanceDue <= 0 ? 'paid' : advanceApplied > 0 ? 'partial' : 'unpaid';

    const invoice = await insertRow(db, 'invoices', {
        invoice_id: invoiceId,
        invoice_no: invoiceNo,
        date: payload.date || today(),
        customer_id: payload.customer_id,
        due_date: payload.due_date || null,
        total_amount: totalAmount,
        amount_paid: advanceApplied,
        balance_due: invoiceBalanceDue,
        status: invoiceStatus,
    }, false);

    for (const item of items) {
        await db.run(
            `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, line_total, factory_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [invoiceId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price, activeFactoryId()]
        );
        await db.run(
            `UPDATE products SET current_stock = ROUND(COALESCE(current_stock, 0) - ?, 0)
             WHERE product_id = ? AND COALESCE(factory_id, ?) = ?`,
            [item.quantity, item.product_id, activeFactoryId(), activeFactoryId()]
        );
    }

    await db.run(
        `UPDATE customers SET balance_due = COALESCE(balance_due, 0) + ?
         WHERE customer_id = ? AND COALESCE(factory_id, ?) = ?`,
        [totalAmount, payload.customer_id, activeFactoryId(), activeFactoryId()]
    );

    await queueChange(db, 'create', 'invoices', invoiceId, { ...invoice, items });
    return invoice;
}

async function listPayments(db) {
    const result = await db.query(
        `SELECT p.*, c.name AS customer_name, i.invoice_no
         FROM payments p
         LEFT JOIN customers c ON p.customer_id = c.customer_id
         LEFT JOIN invoices i ON p.invoice_id = i.invoice_id
         WHERE COALESCE(p.factory_id, ?) = ? ORDER BY p.date DESC, p.rowid DESC`,
        [activeFactoryId(), activeFactoryId()]
    );
    return result.values || [];
}

async function applyPaymentToInvoice(db, payment, invoiceId) {
    const invoice = await getRow(db, tableConfig.invoices, invoiceId);
    if (!invoice) throw axiosError('Invoice not found', 404);
    if (invoice.customer_id !== payment.customer_id) throw axiosError('Invoice does not belong to this customer', 400);
    if (payment.invoice_id && payment.invoice_id !== invoiceId) throw axiosError('Payment is already allocated to an invoice', 400);

    const amount = normalizeNumber(payment.amount);
    const amountPaid = Math.min(normalizeNumber(invoice.total_amount), normalizeNumber(invoice.amount_paid) + amount);
    const balanceDue = Math.max(normalizeNumber(invoice.total_amount) - amountPaid, 0);

    await db.run(
        `UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ?
         WHERE invoice_id = ?`,
        [amountPaid, balanceDue, balanceDue <= 0 ? 'paid' : 'partial', invoiceId]
    );

    await db.run(
        `UPDATE payments SET invoice_id = ? WHERE payment_id = ?`,
        [invoiceId, payment.payment_id]
    );
}

async function createPayment(db, payload) {
    if (!payload.customer_id) throw axiosError('Please select a customer');
    const amount = normalizeNumber(payload.amount);
    if (amount <= 0) throw axiosError('Amount is required');
    if (payload.invoice_id) {
        const invoice = await getRow(db, tableConfig.invoices, payload.invoice_id);
        if (!invoice) throw axiosError('Invoice not found', 404);
        if (invoice.customer_id !== payload.customer_id) throw axiosError('Invoice does not belong to this customer', 400);
    }

    const payment = await insertRow(db, 'payments', {
        payment_id: await nextId(db, tableConfig.payments),
        invoice_id: payload.invoice_id || null,
        customer_id: payload.customer_id,
        date: payload.date || today(),
        amount,
        method: payload.method || 'Cash',
        receipt_no: payload.receipt_no || `RCPT-${Date.now()}`,
        notes: payload.notes || null,
    }, false);

    if (payload.invoice_id) {
        await applyPaymentToInvoice(db, payment, payload.invoice_id);
        payment.invoice_id = payload.invoice_id;
    }

    await db.run(
        `UPDATE customers SET balance_due = COALESCE(balance_due, 0) - ?
         WHERE customer_id = ? AND COALESCE(factory_id, ?) = ?`,
        [amount, payload.customer_id, activeFactoryId(), activeFactoryId()]
    );

    await queueChange(db, 'create', 'payments', payment.payment_id, payment);
    return payment;
}

async function inventorySummary(db) {
    const products = (await db.query(
        `SELECT product_id, name, unit, current_stock, reorder_level, sale_price,
         current_stock * sale_price AS stock_value,
         CASE WHEN current_stock <= 0 THEN 'out_of_stock' WHEN current_stock <= reorder_level THEN 'low_stock' ELSE 'ok' END AS stock_status
         FROM products WHERE COALESCE(status, 'active') = 'active' AND COALESCE(factory_id, ?) = ? ORDER BY name ASC`,
        [activeFactoryId(), activeFactoryId()]
    )).values || [];

    const materials = (await db.query(
        `SELECT rm.material_id, rm.name, rm.unit, rm.current_stock, rm.reorder_level, rm.cost_per_unit,
         rm.current_stock * rm.cost_per_unit AS stock_value, v.name AS vendor_name,
         CASE WHEN rm.current_stock <= 0 THEN 'out_of_stock' WHEN rm.current_stock <= rm.reorder_level THEN 'low_stock' ELSE 'ok' END AS stock_status
         FROM raw_materials rm LEFT JOIN vendors v ON rm.vendor_id = v.vendor_id
         WHERE COALESCE(rm.factory_id, ?) = ? ORDER BY rm.name ASC`,
        [activeFactoryId(), activeFactoryId()]
    )).values || [];

    return {
        summary: {
            total_products: products.length,
            total_materials: materials.length,
            low_stock_products: products.filter(item => item.stock_status === 'low_stock').length,
            out_of_stock_products: products.filter(item => item.stock_status === 'out_of_stock').length,
            low_stock_materials: materials.filter(item => item.stock_status === 'low_stock').length,
            total_product_value: products.reduce((sum, item) => sum + Number(item.stock_value || 0), 0),
            total_material_value: materials.reduce((sum, item) => sum + Number(item.stock_value || 0), 0),
        },
        products,
        materials,
    };
}

async function addInventoryMovement(db, payload, queue = true) {
    const quantity = normalizeNumber(payload.quantity);
    if (!payload.type || !payload.item_type || !payload.item_id || quantity <= 0) {
        throw axiosError('type, item_type, item_id and quantity are required');
    }

    const normalizedQuantity = payload.item_type === 'product' ? Math.round(quantity) : quantity;
    const unitPriceValue = payload.unit_price ?? payload.new_unit_price;
    const unitPrice = unitPriceValue !== undefined && unitPriceValue !== null && unitPriceValue !== ''
        ? Number(unitPriceValue)
        : null;

    const movement = await insertRow(db, 'inventory', {
        ...payload,
        movement_id: payload.movement_id || await nextId(db, tableConfig.inventory),
        date: payload.date || today(),
        quantity: normalizedQuantity,
        unit_price: unitPrice,
        total_amount: unitPrice === null ? null : normalizedQuantity * unitPrice,
    }, false);

    const operator = payload.type === 'IN' ? '+' : '-';

    if (payload.item_type === 'raw_material') {
        await db.run(
            `UPDATE raw_materials
             SET current_stock = COALESCE(current_stock, 0) ${operator} ?,
                 cost_per_unit = COALESCE(?, cost_per_unit)
             WHERE material_id = ? AND COALESCE(factory_id, ?) = ?`,
            [normalizedQuantity, unitPrice, payload.item_id, activeFactoryId(), activeFactoryId()]
        );
    }

    if (payload.item_type === 'product') {
        await db.run(
            `UPDATE products
             SET current_stock = ROUND(COALESCE(current_stock, 0) ${operator} ?, 0),
                 sale_price = COALESCE(?, sale_price)
             WHERE product_id = ? AND COALESCE(factory_id, ?) = ?`,
            [normalizedQuantity, unitPrice, payload.item_id, activeFactoryId(), activeFactoryId()]
        );
    }

    if (queue) await queueChange(db, 'create', 'inventory', movement.movement_id, movement);
    return movement;
}

async function listProduction(db) {
    const result = await db.query(
        `SELECT pl.*, p.name AS product_name, rm.name AS material_name, m.name AS machine_name
         FROM production_logs pl
         LEFT JOIN products p ON pl.product_id = p.product_id
         LEFT JOIN raw_materials rm ON pl.material_id = rm.material_id
         LEFT JOIN machines m ON pl.machine_id = m.machine_id
         WHERE COALESCE(pl.factory_id, ?) = ? ORDER BY pl.date DESC, pl.rowid DESC`,
        [activeFactoryId(), activeFactoryId()]
    );
    return result.values || [];
}

async function createProduction(db, payload) {
    const unitsProduced = Math.round(normalizeNumber(payload.units_produced));
    if (!payload.product_id || unitsProduced <= 0) throw axiosError('Product and units produced are required');

    const totalCost = normalizeNumber(payload.mat_cost)
        + normalizeNumber(payload.elec_cost)
        + normalizeNumber(payload.shift_expense)
        + normalizeNumber(payload.other_expense);
    const netProfit = payload.net_profit ?? (normalizeNumber(payload.total_sale_value) - totalCost);
    const log = await insertRow(db, 'production', {
        ...payload,
        log_id: payload.log_id || await nextId(db, tableConfig.production),
        date: payload.date || today(),
        units_produced: unitsProduced,
        net_profit: netProfit,
    }, false);

    await db.run(
        `UPDATE products SET current_stock = ROUND(COALESCE(current_stock, 0) + ?, 0)
         WHERE product_id = ? AND COALESCE(factory_id, ?) = ?`,
        [unitsProduced, payload.product_id, activeFactoryId(), activeFactoryId()]
    );

    if (payload.material_id && normalizeNumber(payload.bags_consumed) > 0) {
        await db.run(
            `UPDATE raw_materials SET current_stock = COALESCE(current_stock, 0) - ?
             WHERE material_id = ? AND COALESCE(factory_id, ?) = ?`,
            [normalizeNumber(payload.bags_consumed), payload.material_id, activeFactoryId(), activeFactoryId()]
        );
    }

    await addInventoryMovement(db, {
        type: 'IN',
        item_type: 'product',
        item_id: payload.product_id,
        quantity: unitsProduced,
        unit: 'piece',
        reference: log.log_id,
        notes: 'Production output',
    }, false);

    await queueChange(db, 'create', 'production', log.log_id, log);
    return log;
}

async function userPermissions(db, userId) {
    const rows = (await db.query(
        `SELECT module, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = ?`,
        [userId]
    )).values || [];

    const permissions = {};
    rows.forEach(row => {
        permissions[row.module] = {
            view: Boolean(row.can_view),
            add: Boolean(row.can_add),
            edit: Boolean(row.can_edit),
            delete: Boolean(row.can_delete),
        };
    });
    return permissions;
}

async function savePermissions(db, userId, permissions = {}) {
    await db.run(`DELETE FROM user_permissions WHERE user_id = ?`, [userId]);
    for (const [moduleName, perms] of Object.entries(permissions)) {
        await db.run(
            `INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, moduleName, perms.view ? 1 : 0, perms.add ? 1 : 0, perms.edit ? 1 : 0, perms.delete ? 1 : 0]
        );
    }
}

async function getUserPayload(db, userId) {
    const user = await getRow(db, tableConfig.users, userId);
    if (!user) throw axiosError('User not found', 404);
    return { user, permissions: await userPermissions(db, userId) };
}

async function createUser(db, payload) {
    if (!payload.username || !payload.password) throw axiosError('Username and password required');
    const user = await insertRow(db, 'users', {
        user_id: payload.user_id || await nextId(db, tableConfig.users),
        username: payload.username,
        password: payload.password,
        full_name: payload.full_name || payload.username,
        role: payload.role || 'user',
        status: payload.status || 'active',
        factory_id: activeFactoryId(),
    }, false);
    await savePermissions(db, user.user_id, payload.permissions || {});
    await queueChange(db, 'create', 'users', user.user_id, { user, permissions: payload.permissions || {} });
    return user;
}

async function updateUser(db, userId, payload) {
    const user = await updateRow(db, 'users', userId, {
        full_name: payload.full_name,
        role: payload.role,
        status: payload.status,
    }, false);
    await savePermissions(db, userId, payload.permissions || {});
    await queueChange(db, 'update', 'users', userId, { user, permissions: payload.permissions || {} });
    return user;
}

export function shouldUseMobileDatabase() {
    return isNativeMobileApp();
}

export async function mobileLogin(credentials) {
    const db = await ensureMobileDefaults();
    if (!db) throw axiosError('Mobile database is not ready yet. Please reopen the app and try again.');

    const userResult = await db.query(
        `SELECT * FROM users WHERE username = ? AND COALESCE(status, 'active') = 'active'`,
        [credentials.username]
    );
    const user = userResult.values?.[0];

    if (!user) {
        throw axiosError(`No active local user found for "${credentials.username}"`, 401);
    }

    if (user.password !== credentials.password) {
        throw axiosError('Invalid username or password', 401);
    }

    const permissionRows = (await db.query(
        `SELECT module, can_view, can_add, can_edit, can_delete FROM user_permissions WHERE user_id = ?`,
        [user.user_id]
    )).values || [];

    return axiosResponse({
        message: 'Login successful',
        token: `mobile-local-${user.user_id}-${Date.now()}`,
        user: {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            factory_id: user.factory_id || 'factory_1',
        },
        permissions: permissionsFor(user, permissionRows),
    });
}

export async function mobileRequest(method, path, payload) {
    const db = await getMobileDatabase();
    const normalizedMethod = method.toLowerCase();
    const normalizedPath = path.split('?')[0].replace(/^\/+/, '');
    const parts = normalizedPath.split('/');
    const resource = parts[0];
    const id = parts[1];

    if (resource === 'auth' && id === 'me') return axiosResponse(currentUser());
    if (resource === 'auth' && id === 'logout') return axiosResponse({ message: 'Logged out' });

    if (resource === 'inventory' && id === 'summary') return axiosResponse(await inventorySummary(db));
    if (resource === 'inventory' && normalizedMethod === 'post') return axiosResponse({ message: 'Inventory movement recorded', movement: await addInventoryMovement(db, payload || {}) }, 201);

    if (resource === 'products' && id === 'lowstock') {
        const rows = (await db.query(
            `SELECT * FROM products WHERE current_stock <= reorder_level AND COALESCE(status, 'active') = 'active' AND COALESCE(factory_id, ?) = ? ORDER BY name ASC`,
            [activeFactoryId(), activeFactoryId()]
        )).values || [];
        return axiosResponse(rows);
    }

    if (resource === 'rawmaterials' && id === 'lowstock') {
        const rows = (await db.query(
            `SELECT * FROM raw_materials WHERE current_stock <= reorder_level AND COALESCE(factory_id, ?) = ? ORDER BY name ASC`,
            [activeFactoryId(), activeFactoryId()]
        )).values || [];
        return axiosResponse(rows);
    }

    if (resource === 'invoices') {
        if (normalizedMethod === 'get' && id) return axiosResponse(await invoiceDetail(db, id));
        if (normalizedMethod === 'get') return axiosResponse(await listInvoices(db));
        if (normalizedMethod === 'post') return axiosResponse({ message: 'Invoice created', invoice: await createInvoice(db, payload || {}) }, 201);
    }

    if (resource === 'payments') {
        if (normalizedMethod === 'get' && parts[1] === 'customer') {
            const rows = (await db.query(
                `SELECT p.*, i.invoice_no FROM payments p
                 LEFT JOIN invoices i ON p.invoice_id = i.invoice_id
                 WHERE p.customer_id = ? ORDER BY p.date DESC, p.rowid DESC`,
                [parts[2]]
            )).values || [];
            return axiosResponse({
                payments: rows,
                payment_count: rows.length,
                total_paid: rows.reduce((sum, payment) => sum + normalizeNumber(payment.amount), 0),
            });
        }
        if (normalizedMethod === 'post' && id === 'allocate') {
            const payment = await getRow(db, tableConfig.payments, payload?.payment_id);
            if (!payment) throw axiosError('Payment not found', 404);
            await applyPaymentToInvoice(db, payment, payload?.invoice_id);
            await queueChange(db, 'update', 'payments', payment.payment_id, { ...payment, invoice_id: payload?.invoice_id });
            return axiosResponse({ message: 'Payment allocated to invoice' });
        }
        if (normalizedMethod === 'get') return axiosResponse(await listPayments(db));
        if (normalizedMethod === 'post') return axiosResponse({ message: 'Payment recorded', payment: await createPayment(db, payload || {}) }, 201);
    }

    if (resource === 'production') {
        if (normalizedMethod === 'get' && id === 'summary') return axiosResponse({});
        if (normalizedMethod === 'get') return axiosResponse(await listProduction(db));
        if (normalizedMethod === 'post') return axiosResponse({ message: 'Production log saved', log: await createProduction(db, payload || {}) }, 201);
        if (normalizedMethod === 'put') return axiosResponse({ message: 'Production log updated', log: await updateRow(db, 'production', id, payload || {}) });
    }

    if (resource === 'users') {
        if (normalizedMethod === 'get' && id) return axiosResponse(await getUserPayload(db, id));
        if (normalizedMethod === 'get') return axiosResponse(await listRows(db, tableConfig.users));
        if (normalizedMethod === 'post') return axiosResponse({ message: 'User created', user: await createUser(db, payload || {}) }, 201);
        if (normalizedMethod === 'put' && parts[2] === 'reset-password') {
            await updateRow(db, 'users', id, { password: payload?.new_password }, false);
            await queueChange(db, 'update', 'users', id, { passwordChanged: true });
            return axiosResponse({ message: 'Password reset successfully' });
        }
        if (normalizedMethod === 'put') return axiosResponse({ message: 'User updated', user: await updateUser(db, id, payload || {}) });
    }

    if (normalizedMethod === 'get' && resource === 'customers' && parts[2] === 'ledger') {
        const customer = await getRow(db, tableConfig.customers, id);
        const invoices = (await db.query(`SELECT * FROM invoices WHERE customer_id = ? ORDER BY date ASC`, [id])).values || [];
        const payments = (await db.query(`SELECT * FROM payments WHERE customer_id = ? ORDER BY date ASC`, [id])).values || [];
        const ledger = [
            ...invoices.map(invoice => ({ date: invoice.date, type: 'invoice', description: `Invoice ${invoice.invoice_no}`, debit: invoice.total_amount, credit: 0, reference: invoice.invoice_id })),
            ...payments.map(payment => ({ date: payment.date, type: 'payment', description: `Payment - ${payment.method}`, debit: 0, credit: payment.amount, reference: payment.payment_id })),
        ].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        ledger.forEach(entry => {
            runningBalance += normalizeNumber(entry.debit) - normalizeNumber(entry.credit);
            entry.running_balance = runningBalance;
        });
        return axiosResponse({ customer, total_invoices: invoices.length, total_payments: payments.length, balance_due: customer?.balance_due || 0, ledger });
    }

    const config = tableConfig[resource];
    if (!config) return axiosResponse(normalizedMethod === 'get' ? [] : { message: 'Saved locally' });

    if (normalizedMethod === 'get' && id) {
        const row = await getRow(db, config, id);
        if (!row) throw axiosError('Record not found', 404);
        return axiosResponse(row);
    }

    if (normalizedMethod === 'get') return axiosResponse(await listRows(db, config));

    if (normalizedMethod === 'post') {
        const defaults = {
            customers: { balance_due: 0, status: 'active' },
            vendors: { current_payable: 0 },
            products: { current_stock: 0, reorder_level: 0, sale_price: 0, status: 'active' },
            rawmaterials: { current_stock: 0, reorder_level: 0, cost_per_unit: 0 },
        }[resource] || {};
        return axiosResponse({ message: 'Saved locally', [resource.slice(0, -1)]: await insertRow(db, resource, { ...defaults, ...(payload || {}) }) }, 201);
    }

    if (normalizedMethod === 'put') {
        const row = await updateRow(db, resource, id, payload || {});
        if (!row) throw axiosError('Record not found', 404);
        return axiosResponse({ message: 'Updated locally', [resource.slice(0, -1)]: row });
    }

    if (normalizedMethod === 'delete') {
        await db.run(`DELETE FROM ${config.table} WHERE ${config.id} = ?`, [id]);
        await queueChange(db, 'delete', resource, id, {});
        return axiosResponse({ message: 'Deleted locally' });
    }

    return axiosResponse({ message: 'OK' });
}
