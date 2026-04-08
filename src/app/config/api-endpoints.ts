// Centralized API endpoint definitions for the application.
// Import this object where you need to call backend endpoints.

import { environment } from 'src/environments/environment';

const BASE = (environment && environment.apiBase)
  ? String(environment.apiBase).replace(/\/+$/,'')
  : '/pharmacy-1.0';

export const API_ENDPOINTS = {
  BASE,

  AUTH: {
    LOGIN: `${BASE}/api/auth/login`,
    SIGNUP: `${BASE}/api/auth/signup`,
    FORGOT_PASSWORD: `${BASE}/api/auth/forgot-password`,
    BY_EMAIL: (email: string) => `${BASE}/api/users/by-email?email=${encodeURIComponent(email)}`
  },

  DASHBOARD: {
    OVERVIEW: `${BASE}/api/dashboard/overview`,
    SALES_TRENDS: `${BASE}/api/dashboard/sales-trends`
  },

  MEDICINES: {
    LIST: `${BASE}/api/medicines`,
    DETAILS: (id: string | number) => `${BASE}/api/medicines/${id}`,
    CATEGORIES: `${BASE}/api/medicines/categories`
  },

  INVENTORY: {
    LIST: `${BASE}/api/inventory`,
    LOW_STOCK: `${BASE}/api/inventory/low-stock`,
    REORDER: (id: string | number) => `${BASE}/api/inventory/${id}/reorder`
  },

  ORDERS: {
    CREATE: `${BASE}/api/orders`,
    LIST: `${BASE}/api/orders`,
    DETAILS: (id: string | number) => `${BASE}/api/orders/${id}`
  },

  USERS: {
    LIST: `${BASE}/api/users`,
    DETAILS: (id: string | number) => `${BASE}/api/users/${id}`,
    UPDATE: (id: string | number) => `${BASE}/api/users/${id}`
  }
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;

// Usage example:
// import { API_ENDPOINTS } from './config/api-endpoints';
// this.http.post(API_ENDPOINTS.AUTH.LOGIN, { username, password });
