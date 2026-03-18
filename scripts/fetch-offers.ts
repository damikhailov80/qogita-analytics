import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface AuthResponse {
    accessToken: string;
}

interface Offer {
    qid: string;
    gtin: string;
    price: string;
    currency: string;
    inventory: number;
    isPreOrder: boolean;
    estimatedDeliveryTimeWeeks: number | null;
    moq: number;
    mov: string;
    seller: string;
    sellerName: string;
    sellerCountry: string;
}

interface VariantOffersResponse {
    offers: Offer[];
}

interface OfferWithVariant extends Offer {
    variantName: string;
    variantBrand: string;
    variantCategory: string;
    variantImageUrl: string;
}

class QogitaOffersClient {
    private baseURL: string;
    private email: string;
    private password: string;
    private accessToken: string | null = null;
    private client: AxiosInstance;

    constructor() {
        this.baseURL = process.env.QOGITA_API_BASE_URL || 'https://api.qogita.com';
        this.email = process.env.QOGITA_EMAIL || '';
        this.password = process.env.QOGITA_PASSWORD || '';

        if (!this.email || !this.password) {
            throw new Error('QOGITA_EMAIL and QOGITA_PASSWORD must be set in .env file');
        }

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    async authenticate(): Promise<void> {
        try {
            console.log('[Qogita Offers] Authenticating...');
            const response = await this.client.post<AuthResponse>('/auth/login/', {
                email: this.email,
                password: this.password
            });

            this.accessToken = response.data.accessToken;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
            console.log('[Qogita Offers] Authentication successful');
        } catch (error: any) {
            throw new Error(`Authentication failed: ${error.response?.data || error.message}`);
        }
    }

    async getCatalog(): Promise<string> {
        try {
            console.log('[Qogita Offers] Downloading catalog...');
            const response = await this.client.get('/variants/search/download/', {
                params: {
                    brand_name: '4711'
                },
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

    async getVariantOffers(fid: string, slug: string): Promise<Offer[]> {
        try {
            const response = await this.client.get<VariantOffersResponse>(
                `/variants/${fid}/${slug}/offers/`
            );

            // Debug: log first offer structure
            if (response.data.offers && response.data.offers.length > 0) {
                console.log('[Qogita Offers] Sample offer structure:', JSON.stringify(response.data.offers[0], null, 2));
            }

            return response.data.offers || [];
        } catch (error: any) {
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
            }
            // Return empty array if variant has no offers or not found
            if (error.response?.status === 404 || error.response?.status === 400) {
                return [];
            }
            const errorData = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Failed to fetch offers for ${fid}/${slug}: ${errorData}`);
        }
    }

    async getAllOffers(): Promise<OfferWithVariant[]> {
        const allOffers: OfferWithVariant[] = [];

        try {
            // Step 1: Get catalog
            const catalogCSV = await this.getCatalog();
            const lines = catalogCSV.split('\n');

            console.log(`[Qogita Offers] Parsing catalog with ${lines.length - 1} products...`);

            // Step 2: Parse CSV and extract variants
            const variants: Array<{ gtin: string; fid: string; slug: string; name: string; brand: string; category: string; imageUrl: string }> = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = this.parseCSVLine(line);
                if (values.length < 13) continue;

                const gtin = values[0];
                const name = values[1] || '';
                const category = values[2] || '';
                const brand = values[3] || '';
                const productUrl = values[11]; // Product URL is column 12 (index 11)
                const imageUrl = values[12] || '';

                // Debug first few lines
                if (i <= 3) {
                    console.log(`[Qogita Offers] Line ${i}: GTIN=${gtin}, Name=${name}, URL=${productUrl}`);
                }

                // Extract fid and slug from Product URL
                const urlParts = productUrl.split('/').filter(p => p);
                if (urlParts.length >= 2) {
                    const fid = urlParts[urlParts.length - 2];
                    const slug = urlParts[urlParts.length - 1];
                    variants.push({ gtin, fid, slug, name, brand, category, imageUrl });
                } else {
                    if (i <= 3) {
                        console.log(`[Qogita Offers] Failed to parse URL: ${productUrl}, parts: ${urlParts.length}`);
                    }
                }
            }

            console.log(`[Qogita Offers] Found ${variants.length} variants, fetching offers...`);

            // Step 3: Fetch offers for each variant in parallel batches
            const batchSize = 50; // Process 50 variants at a time
            let processed = 0;

            for (let i = 0; i < variants.length; i += batchSize) {
                const batch = variants.slice(i, i + batchSize);

                console.log(`[Qogita Offers] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(variants.length / batchSize)} (variants ${i + 1}-${Math.min(i + batchSize, variants.length)}/${variants.length})...`);

                // Fetch all offers in this batch in parallel
                const batchPromises = batch.map(async (variant) => {
                    try {
                        const offers = await this.getVariantOffers(variant.fid, variant.slug);

                        return offers.map(offer => ({
                            ...offer,
                            gtin: variant.gtin,
                            productUrl: `https://www.qogita.com/products/${variant.fid}/${variant.slug}/`,
                            variantName: variant.name,
                            variantBrand: variant.brand,
                            variantCategory: variant.category,
                            variantImageUrl: variant.imageUrl,
                            variantFid: variant.fid,
                            variantSlug: variant.slug
                        }));
                    } catch (error: any) {
                        // Skip variants with errors
                        return [];
                    }
                });

                const batchResults = await Promise.all(batchPromises);

                // Flatten and add to allOffers
                for (const offers of batchResults) {
                    allOffers.push(...offers);
                }

                processed += batch.length;
                console.log(`[Qogita Offers] Collected ${allOffers.length} offers so far...`);

                // Small delay between batches to avoid rate limiting
                if (i + batchSize < variants.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log(`[Qogita Offers] Successfully fetched ${allOffers.length} offers from ${variants.length} variants`);
            return allOffers;
        } catch (error: any) {
            throw new Error(`Failed to fetch all offers: ${error.message}`);
        }
    }

    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current);
        return result;
    }
}

function convertToCSV(offers: OfferWithVariant[]): string {
    if (offers.length === 0) {
        return '';
    }

    // CSV headers
    const headers = [
        'qid',
        'gtin',
        'price',
        'currency',
        'inventory',
        'isPreOrder',
        'estimatedDeliveryTimeWeeks',
        'moq',
        'mov',
        'seller',
        'sellerName',
        'sellerCountry',
        'variantName',
        'variantBrand',
        'variantCategory',
        'variantImageUrl'
    ];

    const csvRows = [headers.join(',')];

    // Convert each offer to CSV row
    for (const offer of offers) {
        const row = [
            offer.qid,
            offer.gtin,
            offer.price,
            offer.currency,
            offer.inventory,
            offer.isPreOrder,
            offer.estimatedDeliveryTimeWeeks ?? '',
            offer.moq,
            offer.mov,
            offer.seller,
            `"${(offer.sellerName || '').replace(/"/g, '""')}"`,
            offer.sellerCountry,
            `"${(offer.variantName || '').replace(/"/g, '""')}"`,
            `"${(offer.variantBrand || '').replace(/"/g, '""')}"`,
            `"${(offer.variantCategory || '').replace(/"/g, '""')}"`,
            offer.variantImageUrl ?? ''
        ];
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

async function main() {
    try {
        console.log('[Qogita Offers] Starting offers fetch...');

        const client = new QogitaOffersClient();
        await client.authenticate();

        const offers = await client.getAllOffers();

        if (offers.length === 0) {
            console.log('[Qogita Offers] No offers found');
            return;
        }

        // Convert to JSON
        console.log('[Qogita Offers] Converting to JSON...');
        const json = JSON.stringify(offers, null, 2);

        // Save to file
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `offers-${timestamp}.json`;
        const catalogDir = path.join(process.cwd(), 'catalog');

        // Create catalog directory if it doesn't exist
        if (!fs.existsSync(catalogDir)) {
            fs.mkdirSync(catalogDir, { recursive: true });
        }

        const filepath = path.join(catalogDir, filename);
        fs.writeFileSync(filepath, json, 'utf-8');

        console.log(`[Qogita Offers] Successfully saved ${offers.length} offers to ${filepath}`);
    } catch (error: any) {
        console.error('[Qogita Offers] Error:', error.message);
        console.error('[Qogita Offers] Stack:', error.stack);
        process.exit(1);
    }
}

main();
