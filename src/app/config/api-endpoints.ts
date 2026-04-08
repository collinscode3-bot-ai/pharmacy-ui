// Centralized API endpoint definitions for the application.
// Import this object where you need to call backend endpoints.

export const API_ENDPOINTS = {
  BASE: '/pharmacy-1.0',

  AUTH: {
    LOGIN: '/pharmacy-1.0/api/auth/login',
    // LOGOUT: '/api/auth/logout',
    SIGNUP: '/pharmacy-1.0/api/auth/signup',
    FORGOT_PASSWORD: '/pharmacy-1.0/api/auth/forgot-password',
    BY_EMAIL: (email: string) => `/pharmacy-1.0/api/users/by-email?email=${encodeURIComponent(email)}`,
    // PROFILE: '/api/auth/profile'
  },

  DASHBOARD: {
    OVERVIEW: '/api/dashboard/overview',
    SALES_TRENDS: '/api/dashboard/sales-trends'
  },

  MEDICINES: {
    LIST: '/api/medicines',
    DETAILS: (id: string | number) => `/api/medicines/${id}`,
    CATEGORIES: '/api/medicines/categories'
  },

  INVENTORY: {
    LIST: '/api/inventory',
    LOW_STOCK: '/api/inventory/low-stock',
    REORDER: (id: string | number) => `/api/inventory/${id}/reorder`
  },

  ORDERS: {
    CREATE: '/api/orders',
    LIST: '/api/orders',
    DETAILS: (id: string | number) => `/api/orders/${id}`
  },

  USERS: {
    LIST: '/api/users',
    DETAILS: (id: string | number) => `/api/users/${id}`,
    UPDATE: (id: string | number) => `/pharmacy-1.0/api/users/${id}`
  }
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;

// Usage example:
// import { API_ENDPOINTS } from './config/api-endpoints';
// this.http.post(API_ENDPOINTS.AUTH.LOGIN, { username, password });
