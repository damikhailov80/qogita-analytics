import axios, { AxiosInstance } from 'axios';

interface AuthResponse {
    accessToken: string;
}

export class QogitaAPIClient {
    private baseURL: string;
    private email: string;
    private password: string;
    private accessToken: string | null = null;
    private client: AxiosInstance;

    constructor() {
        this.baseURL = process.env.QOGITA_API_BASE_URL || 'https://api.qogita.com';
        this.email = process.env.QOGITA_EMAIL || '';
        this.password = process.env.QOGITA_PASSWORD || '';

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    async authenticate(): Promise<AuthResponse> {
        try {
            const response = await this.client.post<AuthResponse>('/auth/login/', {
                email: this.email,
                password: this.password
            });

            this.accessToken = response.data.accessToken;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;

            return response.data;
        } catch (error: any) {
            throw new Error(`Authentication failed: ${error.response?.data || error.message}`);
        }
    }

    async getCatalog(params: Record<string, any> = {}): Promise<string> {
        try {
            const response = await this.client.get('/variants/search/download/', {
                params,
                responseType: 'text'
            });
            return response.data;
        } catch (error: any) {
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
            }
            throw new Error(`Failed to get catalog: ${error.response?.data || error.message}`);
        }
    }
}
