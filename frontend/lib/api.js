import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Auto attach token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Auto redirect to login if 401
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('permissions');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// ── Auth ───────────────────────────────────────────────────────
export const loginUser = (data) => api.post('/auth/login', data);
export const logoutUser = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// ── Users ──────────────────────────────────────────────────────
export const getUsers = () => api.get('/users');
export const getUserById = (id) => api.get(`/users/${id}`);
export const createUser = (data) => api.post('/users', data);
export const updateUserPermissions = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);
export const resetUserPassword = (id, data) => api.put(`/users/${id}/reset-password`, data);

// ── Customers ──────────────────────────────────────────────────
export const getCustomers = () => api.get('/customers');
export const getCustomerById = (id) => api.get(`/customers/${id}`);
export const getCustomerLedger = (id) => api.get(`/customers/${id}/ledger`);
export const createCustomer = (data) => api.post('/customers', data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data);

// ── Products ───────────────────────────────────────────────────
export const getProducts = () => api.get('/products');
export const getProductById = (id) => api.get(`/products/${id}`);
export const getLowStockProducts = () => api.get('/products/lowstock');
export const createProduct = (data) => api.post('/products', data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data);

// ── Vendors ────────────────────────────────────────────────────
export const getVendors = () => api.get('/vendors');
export const createVendor = (data) => api.post('/vendors', data);
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendors/${id}`);

// ── Raw Materials ──────────────────────────────────────────────
export const getRawMaterials = () => api.get('/rawmaterials');
export const getLowStockMats = () => api.get('/rawmaterials/lowstock');
export const createRawMaterial = (data) => api.post('/rawmaterials', data);
export const updateRawMaterial = (id, data) => api.put(`/rawmaterials/${id}`, data);

// ── Invoices ───────────────────────────────────────────────────
export const getInvoices = () => api.get('/invoices');
export const getInvoiceById = (id) => api.get(`/invoices/${id}`);
export const createInvoice = (data) => api.post('/invoices', data);
export const updateInvoice = (id, data) => api.put(`/invoices/${id}`, data);

// ── Payments ───────────────────────────────────────────────────
export const getPayments = () => api.get('/payments');
export const getPaymentsByInvoice = (id) => api.get(`/payments/invoice/${id}`);
export const getPaymentsByCustomer = (id) => api.get(`/payments/customer/${id}`);
export const createPayment = (data) => api.post('/payments', data);
export const allocatePayment = (data) => api.post('/payments/allocate', data);

// ── Production ─────────────────────────────────────────────────
export const getProductionLogs = () => api.get('/production');
export const getDailySummary = (date) => api.get(`/production/summary?date=${date}`);
export const createProductionLog = (data) => api.post('/production', data);
export const updateProductionLog = (id, data) => api.put(`/production/${id}`, data);

// ── Inventory ──────────────────────────────────────────────────
export const getInventorySummary = () => api.get('/inventory/summary');
export const getInventoryMovements = () => api.get('/inventory');
export const addInventoryMovement = (data) => api.post('/inventory', data);

