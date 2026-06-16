import * as dotenv from 'dotenv';

import prisma from '../db';

dotenv.config();
const BASE_URL = 'https://stock.indianapi.in';

interface FetchOptions {
  endpoint: string;
  params?: Record<string, string>;
}

class IndianStockApiClient {
  private readonly apiKey1: string;
  private readonly apiKey2: string;

  constructor() {
    this.apiKey1 = process.env.INDIAN_STOCK_API_KEY_1 || process.env.INDIAN_STOCK_API_KEY || '';
    this.apiKey2 = process.env.INDIAN_STOCK_API_KEY_2 || '';
    if (!this.apiKey1 && !this.apiKey2) {
      console.warn('Neither INDIAN_STOCK_API_KEY_1 nor INDIAN_STOCK_API_KEY_2 is defined in environment variables.');
    }
  }

  private async fetchFromApi<T>({ endpoint, params }: FetchOptions): Promise<T> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let usage = await prisma.apiUsage.findUnique({ where: { date: today } });
    if (!usage) {
      try {
        usage = await prisma.apiUsage.create({ data: { date: today, count: 0 } });
      } catch (e) {
        // Handle concurrent creation
        usage = await prisma.apiUsage.findUnique({ where: { date: today } });
      }
    }

    if (usage && usage.count >= 34) {
      throw new Error('Daily API rate limit of 34 calls reached across both keys.');
    }

    const currentApiKey = (usage && usage.count >= 17 && this.apiKey2) ? this.apiKey2 : this.apiKey1;

    let url = `${BASE_URL}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams(params);
      url += `?${queryParams.toString()}`;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': currentApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as T;

      if (usage) {
        await prisma.apiUsage.update({
          where: { id: usage.id },
          data: { count: { increment: 1 } }
        });
      }

      return data;
    } catch (error) {
      console.error(`Error fetching from Indian Stock API [${endpoint}]:`, error);
      throw error;
    }
  }

  public async getIpoData() {
    return this.fetchFromApi({ endpoint: '/ipo' });
  }

  public async getNewsData() {
    return this.fetchFromApi({ endpoint: '/news' });
  }

  public async getStockDetails(symbol?: string) {
    const params: Record<string, string> = {};
    if (symbol) params.name = symbol;
    return this.fetchFromApi({ endpoint: '/stock', params });
  }

  public async getTrendingStocks() {
    return this.fetchFromApi({ endpoint: '/trending' });
  }

  public async getStatement() {
    return this.fetchFromApi({ endpoint: '/statement' });
  }

  public async getCommoditiesData() {
    return this.fetchFromApi({ endpoint: '/commodities' });
  }

  public async getMutualFundsData() {
    return this.fetchFromApi({ endpoint: '/mutual_funds' });
  }

  public async getPriceShockersData() {
    return this.fetchFromApi({ endpoint: '/price_shockers' });
  }

  public async getBseMostActive() {
    return this.fetchFromApi({ endpoint: '/BSE_most_active' });
  }

  public async getNseMostActive() {
    return this.fetchFromApi({ endpoint: '/NSE_most_active' });
  }

  public async getHistoricalData(symbol: string, range?: string) {
    const params: Record<string, string> = { symbol };
    if (range) params.range = range;
    return this.fetchFromApi({ endpoint: '/historical_data', params });
  }

  public async searchIndustry(query?: string) {
    const params: Record<string, string> = {};
    if (query) params.query = query;
    return this.fetchFromApi({ endpoint: '/industry_search', params });
  }
}

export const indianStockApi = new IndianStockApiClient();
