import { Router, Request, Response } from 'express';
import prisma from '../db';
import { indianStockApi } from '../services/indianStockApi';

const router = Router();

// Helper to extract a single price from the API response
const extractPrice = (data: any): number => {
  if (!data) return 0;
  if (data.currentPrice) {
    if (data.currentPrice.NSE) return Number(data.currentPrice.NSE);
    if (data.currentPrice.BSE) return Number(data.currentPrice.BSE);
    if (data.currentPrice) return Number(data.currentPrice);
  }
  if (data.price) return Number(data.price);
  
  return 0; // Return 0 if unable to extract explicitly
};

// POST /api/trading/buy
router.post('/buy', async (req: Request, res: Response) => {
  try {
    const { symbol, shares } = req.body;
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid symbol or shares' });
    }

    // Fetch current details from API to get the price
    const stockDetails: any = await indianStockApi.getStockDetails(symbol);
    const currentPrice = extractPrice(stockDetails);

    // Update or create position
    let position = await prisma.position.findUnique({ where: { symbol } });
    
    if (position) {
      const totalCost = (position.shares * position.averagePrice) + (shares * currentPrice);
      const newShares = position.shares + shares;
      const newAverage = totalCost / newShares;
      
      position = await prisma.position.update({
        where: { symbol },
        data: { shares: newShares, averagePrice: newAverage, lastFetchedPrice: currentPrice, boughtAtPrice: currentPrice }
      });
    } else {
      position = await prisma.position.create({
        data: {
          symbol,
          shares,
          averagePrice: currentPrice,
          lastFetchedPrice: currentPrice,
          boughtAtPrice: currentPrice
        }
      });
    }

    res.json({ message: 'Stock purchased successfully', position, purchasePrice: currentPrice });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to buy stock', details: error.message });
  }
});

// GET /api/trading/portfolio
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const skipApi = req.query.skipApi === 'true';
    const positions = await prisma.position.findMany();
    
    // We will attempt to fetch current price for each, but we might hit rate limit (16/day)
    // We will use a try-catch per stock to gracefully handle limits.
    const enrichedPositions = await Promise.all(positions.map(async (pos) => {
      let currentPrice = pos.lastFetchedPrice ?? pos.averagePrice;
      let error = null;
      
      if (!skipApi) {
        try {
          const stockDetails: any = await indianStockApi.getStockDetails(pos.symbol);
          const fetchedPrice = extractPrice(stockDetails);
          if (fetchedPrice > 0) {
            currentPrice = fetchedPrice;
            
            // Update lastFetchedPrice in DB for future fallback
            await prisma.position.update({
              where: { symbol: pos.symbol },
              data: { lastFetchedPrice: currentPrice }
            });
          }
        } catch (err: any) {
          error = err.message;
        }
      }
      
      const profitLoss = (currentPrice - pos.averagePrice) * pos.shares;
      const profitLossPercentage = ((currentPrice - pos.averagePrice) / pos.averagePrice) * 100;
      
      return {
        ...pos,
        currentPrice,
        profitLoss,
        profitLossPercentage,
        apiError: error
      };
    }));

    const totalProfitLoss = enrichedPositions.reduce((acc, pos) => acc + pos.profitLoss, 0);
    const totalPortfolioValue = enrichedPositions.reduce((acc, pos) => acc + (pos.currentPrice * pos.shares), 0);
    const totalInvestment = enrichedPositions.reduce((acc, pos) => acc + (pos.averagePrice * pos.shares), 0);

    const sortedByPerformance = [...enrichedPositions].sort((a, b) => b.profitLossPercentage - a.profitLossPercentage);
    const bestPerformer = sortedByPerformance.length > 0 ? sortedByPerformance[0] : null;
    const worstPerformer = sortedByPerformance.length > 0 ? sortedByPerformance[sortedByPerformance.length - 1] : null;

    res.json({ 
      positions: enrichedPositions, 
      totalProfitLoss,
      totalPortfolioValue,
      totalInvestment,
      bestPerformer,
      worstPerformer
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch portfolio', details: error.message });
  }
});
// DELETE /api/trading/position/:symbol
router.delete('/position/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    await prisma.position.delete({
      where: { symbol }
    });

    res.json({ message: 'Position deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.status(500).json({ error: 'Failed to delete position', details: error.message });
  }
});

export default router;
