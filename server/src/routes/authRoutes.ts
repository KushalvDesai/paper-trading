import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      id: user.id,
      username: user.username,
      wallet: user.wallet,
      networth: user.networth
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      username: user.username,
      wallet: user.wallet,
      networth: user.networth
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.post('/wallet', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { action, amount } = req.body;
    if (!amount || amount <= 0 || (action !== 'deposit' && action !== 'withdraw')) {
      return res.status(400).json({ error: 'Invalid action or amount' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (action === 'withdraw' && user.wallet < amount) {
      return res.status(400).json({ error: 'Insufficient funds for withdrawal' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        wallet: action === 'deposit' ? { increment: amount } : { decrement: amount },
        networth: action === 'deposit' ? { increment: amount } : { decrement: amount }
      }
    });

    res.json({ message: `Successfully ${action}ed funds`, wallet: updatedUser.wallet });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process wallet transaction', details: error.message });
  }
});

export default router;
