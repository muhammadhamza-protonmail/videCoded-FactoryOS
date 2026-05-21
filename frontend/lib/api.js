import axios from 'axios';
import { API_BASE_URL, getRuntimeApiBaseUrl } from './config';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    config.baseURL = getRuntimeApiBaseUrl();
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

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

const request = (method, path, data) => api[method](path, data);

export const loginUser = (data) => api.post('/auth/login', data);
export const logoutUser = () => request('post', '/auth/logout');
export const getMe = () => request('get', '/auth/me');

export const getUsers = () => request('get', '/users');
export const getUserById = (id) => request('get', `/users/${id}`);
export const createUser = (data) => request('post', '/users', data);
export const updateUserPermissions = (id, data) => request('put', `/users/${id}`, data);
export const deleteUser = (id) => request('delete', `/users/${id}`);
export const resetUserPassword = (id, data) => request('put', `/users/${id}/reset-password`, data);

export const getCustomers = () => request('get', '/customers');
export const getCustomerById = (id) => request('get', `/customers/${id}`);
export const getCustomerLedger = (id) => request('get', `/customers/${id}/ledger`);
export const createCustomer = (data) => request('post', '/customers', data);
export const updateCustomer = (id, data) => request('put', `/customers/${id}`, data);

export const getProducts = () => request('get', '/products');
export const getProductById = (id) => request('get', `/products/${id}`);
export const getLowStockProducts = () => request('get', '/products/lowstock');
export const createProduct = (data) => request('post', '/products', data);
export const updateProduct = (id, data) => request('put', `/products/${id}`, data);

export const getVendors = () => request('get', '/vendors');
export const createVendor = (data) => request('post', '/vendors', data);
export const updateVendor = (id, data) => request('put', `/vendors/${id}`, data);
export const deleteVendor = (id) => request('delete', `/vendors/${id}`);

export const getRawMaterials = () => request('get', '/rawmaterials');
export const getLowStockMats = () => request('get', '/rawmaterials/lowstock');
export const createRawMaterial = (data) => request('post', '/rawmaterials', data);
export const updateRawMaterial = (id, data) => request('put', `/rawmaterials/${id}`, data);

export const getInvoices = () => request('get', '/invoices');
export const getInvoiceById = (id) => request('get', `/invoices/${id}`);
export const createInvoice = (data) => request('post', '/invoices', data);
export const updateInvoice = (id, data) => request('put', `/invoices/${id}`, data);

export const getPayments = () => request('get', '/payments');
export const getPaymentsByInvoice = (id) => request('get', `/payments/invoice/${id}`);
export const getPaymentsByCustomer = (id) => request('get', `/payments/customer/${id}`);
export const createPayment = (data) => request('post', '/payments', data);
export const allocatePayment = (data) => request('post', '/payments/allocate', data);

export const getProductionLogs = () => request('get', '/production');
export const getDailySummary = (date) => request('get', `/production/summary?date=${date}`);
export const createProductionLog = (data) => request('post', '/production', data);
export const updateProductionLog = (id, data) => request('put', `/production/${id}`, data);

export const getInventorySummary = () => request('get', '/inventory/summary');
export const getInventoryMovements = () => request('get', '/inventory');
export const addInventoryMovement = (data) => request('post', '/inventory', data);
