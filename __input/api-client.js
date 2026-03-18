import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class QogitaAPIClient {
    constructor() {
        this.baseURL = process.env.QOGITA_API_BASE_URL || 'https://api.qogita.com';
        this.email = process.env.QOGITA_EMAIL;
        this.password = process.env.QOGITA_PASSWORD;
        this.accessToken = null;
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    async authenticate() {
        try {
            const response = await this.client.post('/auth/login/', {
                email: this.email,
                password: this.password
            });

            this.accessToken = response.data.accessToken;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;

            console.log('✓ Аутентификация успешна');
            return response.data;
        } catch (error) {
            console.error('✗ Ошибка аутентификации:', error.response?.data || error.message);
            throw error;
        }
    }

    async getCatalog(params = {}) {
        try {
            const response = await this.client.get('/variants/search/download/', {
                params,
                responseType: 'text'
            });
            return response.data;
        } catch (error) {
            this.handleError('Ошибка получения каталога', error);
        }
    }

    handleError(message, error) {
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            console.error(`✗ ${message}: Rate limit exceeded. Retry after ${retryAfter} seconds`);
        } else {
            console.error(`✗ ${message}:`, error.response?.data || error.message);
        }
        throw error;
    }
}

export default QogitaAPIClient;
