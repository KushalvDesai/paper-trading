import { Router, Request, Response } from 'express';
import { indianStockApi } from '../services/indianStockApi';

const router = Router();

// GET /api/stock/ipo
router.get('/ipo', async (req: Request, res: Response) => {
  try {
    const data = await indianStockApi.getIpoData();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch IPO data', details: error.message });
  }
});

// GET /api/stock/news
router.get('/news', async (req: Request, res: Response) => {
  try {
    const data = await indianStockApi.getNewsData();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch news data', details: error.message });
  }
});

// GET /api/stock/details?symbol=RELIANCE
router.get('/details', async (req: Request, res: Response) => {
  try {
    const symbol = req.query.symbol as string;
    const data = await indianStockApi.getStockDetails(symbol);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stock details', details: error.message });
  }
});

// GET /api/stock/trending
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const data = await indianStockApi.getTrendingStocks();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch trending stocks', details: error.message });
  }
});

export default router;
