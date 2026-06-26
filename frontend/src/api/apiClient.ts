export const API_BASE = 'http://localhost:5000/api';

export class ApiClient {
  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API Request Failed: ${response.statusText}`);
    }

    return response.json();
  }

  static async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  static async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async checkAuth(): Promise<any> {
    return this.get('/auth/me');
  }

  static async getInventory(): Promise<any> {
    return this.get('/inventory/catalogue');
  }

  static async getSavedSizes(): Promise<any> {
    return this.get('/sizes/saved');
  }

  static async saveSize(data: { calculatedRingSize: number; fingerWidthMm: number; confidenceScore: number }): Promise<any> {
    return this.post('/sizes/save', data);
  }

  static async createOrder(data: any): Promise<any> {
    return this.post('/orders/create', data);
  }
}
