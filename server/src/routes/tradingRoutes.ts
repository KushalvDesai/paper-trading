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
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ error: 'Invalid symbol or shares' });
    }

    // Fetch current details from API to get the price
    const stockDetails: any = await indianStockApi.getStockDetails(symbol);
    const currentPrice = extractPrice(stockDetails);
    
    if (currentPrice <= 0) {
      return res.status(400).json({ error: 'Could not fetch current price to buy' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const totalTransactionValue = shares * currentPrice;
    
    // Taxes for Buying
    const stt = totalTransactionValue * 0.001; // 0.1% STT
    const stampDuty = totalTransactionValue * 0.00015; // 0.015% Stamp Duty
    const totalTaxes = stt + stampDuty;
    
    const totalCost = totalTransactionValue + totalTaxes;

    if (user.wallet < totalCost) {
      return res.status(400).json({ error: `Insufficient funds. Cost is ₹${totalCost.toFixed(2)} (including taxes ₹${totalTaxes.toFixed(2)}) but wallet has ₹${user.wallet.toFixed(2)}` });
    }

    // Update or create position
    let position = await prisma.position.findUnique({ 
      where: { symbol_userId: { symbol, userId } } 
    });
    
    if (position) {
      const totalCost = (position.shares * position.averagePrice) + (shares * currentPrice);
      const newShares = position.shares + shares;
      const newAverage = totalCost / newShares;
      
      position = await prisma.position.update({
        where: { symbol_userId: { symbol, userId } },
        data: { shares: newShares, averagePrice: newAverage, lastFetchedPrice: currentPrice, boughtAtPrice: currentPrice }
      });
    } else {
      position = await prisma.position.create({
        data: {
          symbol,
          shares,
          averagePrice: currentPrice,
          lastFetchedPrice: currentPrice,
          boughtAtPrice: currentPrice,
          userId
        }
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { wallet: { decrement: totalCost } }
    });

    res.json({ 
      message: 'Stock purchased successfully', 
      position, 
      purchasePrice: currentPrice,
      taxes: { stt, stampDuty, totalTaxes },
      totalCost
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to buy stock', details: error.message });
  }
});

// POST /api/trading/sell
router.post('/sell', async (req: Request, res: Response) => {
  try {
    const { symbol, sharesToSell } = req.body;
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!symbol || !sharesToSell || sharesToSell <= 0) {
      return res.status(400).json({ error: 'Invalid symbol or shares' });
    }

    const position = await prisma.position.findUnique({
      where: { symbol_userId: { symbol, userId } }
    });

    if (!position || position.shares < sharesToSell) {
      return res.status(400).json({ error: 'Not enough shares to sell' });
    }

    // Fetch current details from API to get the price
    const stockDetails: any = await indianStockApi.getStockDetails(symbol);
    const currentPrice = extractPrice(stockDetails);

    if (currentPrice <= 0) {
      return res.status(400).json({ error: 'Could not fetch current price to sell' });
    }

    const totalTransactionValue = sharesToSell * currentPrice;

    // Holding Period calculation for Capital Gains
    const daysHeld = (new Date().getTime() - new Date(position.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    const isShortTerm = daysHeld <= 365;

    // Profit Calculation
    const profit = (currentPrice - position.averagePrice) * sharesToSell;

    let capitalGainsTax = 0;
    if (profit > 0) {
      if (isShortTerm) {
        capitalGainsTax = profit * 0.20; // 20% STCG
      } else {
        const taxableLTCG = Math.max(0, profit - 125000);
        capitalGainsTax = taxableLTCG * 0.125; // 12.5% LTCG over 1.25 lakh
      }
    }

    const stt = totalTransactionValue * 0.001; // 0.1% STT on sell
    const totalTaxes = capitalGainsTax + stt;

    const totalRevenue = totalTransactionValue - totalTaxes;

    // Deduct shares and add to wallet
    if (position.shares === sharesToSell) {
      await prisma.position.delete({
        where: { symbol_userId: { symbol, userId } }
      });
    } else {
      await prisma.position.update({
        where: { symbol_userId: { symbol, userId } },
        data: { shares: position.shares - sharesToSell }
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { wallet: { increment: totalRevenue } }
    });

    res.json({ 
      message: 'Stock sold successfully', 
      revenue: totalRevenue, 
      sellPrice: currentPrice,
      taxes: { stt, capitalGainsTax, totalTaxes },
      profit,
      isShortTerm
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to sell stock', details: error.message });
  }
});

// GET /api/trading/portfolio
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const skipApi = req.query.skipApi === 'true';
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const positions = await prisma.position.findMany({ where: { userId } });
    
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
              where: { symbol_userId: { symbol: pos.symbol, userId } },
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: { networth: user.wallet + totalPortfolioValue }
      });
    }

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
    const userId = req.headers['x-user-id'] as string;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    await prisma.position.delete({
      where: { symbol_userId: { symbol, userId } }
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
