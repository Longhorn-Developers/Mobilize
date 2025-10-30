// Cloudflare API client to replace Supabase
// Provides similar interface to Supabase client

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CloudflareAuthUser {
  id: string;
  email: string;
  display_name?: string | null;
}

export interface CloudflareAuthSession {
  user: CloudflareAuthUser;
  token: string;
}

export interface CloudflareAuthState {
  user: CloudflareAuthUser | null;
  session: CloudflareAuthSession | null;
  initialized: boolean;
}

export class CloudflareClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Auth methods
  get auth() {
    return {
      signUp: async (credentials: { email: string; password: string; display_name?: string }) => {
        const response = await fetch(`${this.baseUrl}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Registration failed');
        }

        const data = await response.json();
        this.setToken(data.token);
        return { data: data, error: null };
      },

      signInWithPassword: async (credentials: { email: string; password: string }) => {
        const response = await fetch(`${this.baseUrl}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Login failed');
        }

        const data = await response.json();
        this.setToken(data.token);
        return { data: data, error: null };
      },

      signOut: async () => {
        try {
          await fetch(`${this.baseUrl}/auth/logout`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          this.clearToken();
        }
        return { error: null };
      },

      getUser: async () => {
        if (!this.token) {
          return { data: { user: null }, error: null };
        }

        try {
          const response = await fetch(`${this.baseUrl}/auth/verify`, {
            headers: this.getAuthHeaders(),
          });

          if (!response.ok) {
            this.clearToken();
            return { data: { user: null }, error: null };
          }

          const data = await response.json();
          return { data: data, error: null };
        } catch (error) {
          console.error('Get user error:', error);
          return { data: { user: null }, error };
        }
      },

      onAuthStateChange: (callback: (event: string, session: CloudflareAuthSession | null) => void) => {
        // Simple implementation - in production, you might want to use WebSocket or polling
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                // Cleanup if needed
              }
            }
          }
        };
      }
    };
  }

  // Database methods (similar to Supabase's from() method)
  from(table: string) {
    return {
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          single: async () => {
            const response = await fetch(`${this.baseUrl}/${table}?${column}=${value}`, {
              headers: this.getAuthHeaders(),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch ${table}`);
            }
            
            const data = await response.json();
            return { data: data[table] || data, error: null };
          },
          
          then: async (callback: (result: any) => any) => {
            const response = await fetch(`${this.baseUrl}/${table}?${column}=${value}`, {
              headers: this.getAuthHeaders(),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to fetch ${table}`);
            }
            
            const data = await response.json();
            const result = { data: data[table] || data, error: null };
            return callback(result);
          }
        }),
        
        single: async () => {
          const response = await fetch(`${this.baseUrl}/${table}`, {
            headers: this.getAuthHeaders(),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch ${table}`);
          }
          
          const data = await response.json();
          return { data: data[table] || data, error: null };
        },
        
        then: async (callback: (result: any) => any) => {
          const response = await fetch(`${this.baseUrl}/${table}`, {
            headers: this.getAuthHeaders(),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch ${table}`);
          }
          
          const data = await response.json();
          const result = { data: data[table] || data, error: null };
          return callback(result);
        }
      }),

      insert: (data: any) => ({
        select: (columns?: string) => ({
          single: async () => {
            const response = await fetch(`${this.baseUrl}/${table}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `Failed to insert into ${table}`);
            }
            
            const result = await response.json();
            return { data: result[table] || result, error: null };
          },
          
          then: async (callback: (result: any) => any) => {
            const response = await fetch(`${this.baseUrl}/${table}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `Failed to insert into ${table}`);
            }
            
            const result = await response.json();
            const response_data = { data: result[table] || result, error: null };
            return callback(response_data);
          }
        }),
        
        then: async (callback: (result: any) => any) => {
          const response = await fetch(`${this.baseUrl}/${table}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders(),
            },
            body: JSON.stringify(data),
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `Failed to insert into ${table}`);
          }
          
          const result = await response.json();
          const response_data = { data: result[table] || result, error: null };
          return callback(response_data);
        }
      }),

      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: (columns?: string) => ({
            single: async () => {
              const response = await fetch(`${this.baseUrl}/${table}?${column}=${value}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...this.getAuthHeaders(),
                },
                body: JSON.stringify(data),
              });
              
              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to update ${table}`);
              }
              
              const result = await response.json();
              return { data: result[table] || result, error: null };
            }
          }),
          
          then: async (callback: (result: any) => any) => {
            const response = await fetch(`${this.baseUrl}/${table}?${column}=${value}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeaders(),
              },
              body: JSON.stringify(data),
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `Failed to update ${table}`);
            }
            
            const result = await response.json();
            const response_data = { data: result[table] || result, error: null };
            return callback(response_data);
          }
        })
      }),

      delete: () => ({
        eq: (column: string, value: any) => ({
          then: async (callback: (result: any) => any) => {
            const response = await fetch(`${this.baseUrl}/${table}?${column}=${value}`, {
              method: 'DELETE',
              headers: this.getAuthHeaders(),
            });
            
            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || `Failed to delete from ${table}`);
            }
            
            const result = await response.json();
            const response_data = { data: result, error: null };
            return callback(response_data);
          }
        })
      })
    };
  }

  private getAuthHeaders() {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private setToken(token: string) {
    this.token = token;
    AsyncStorage.setItem('cloudflare_token', token);
  }

  private clearToken() {
    this.token = null;
    AsyncStorage.removeItem('cloudflare_token');
  }

  async initialize() {
    try {
      const storedToken = await AsyncStorage.getItem('cloudflare_token');
      if (storedToken) {
        this.token = storedToken;
      }
    } catch (error) {
      console.error('Failed to initialize Cloudflare client:', error);
    }
  }

  // Public method to get the base URL for direct API calls
  getBaseUrl() {
    return this.baseUrl;
  }

  // Public method to get auth headers for direct API calls
  getHeaders() {
    return this.getAuthHeaders();
  }
}

// Create and export the client instance
const cloudflareUrl = process.env.EXPO_PUBLIC_CLOUDFLARE_API_URL || 'http://localhost:8787';
export const cloudflare = new CloudflareClient(cloudflareUrl);
