'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, DollarSign, Briefcase, RefreshCw, AlertCircle, TrendingUp, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:5000/api';

export default function PaperTradingApp() {
  const [symbol, setSymbol] = useState('');
  const [stockDetails, setStockDetails] = useState<any>(null);
  const [amount, setAmount] = useState<string>('1000');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [walletAmount, setWalletAmount] = useState('');

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      setUser(res.data);
    } catch (err: any) {
      console.error('Failed to fetch user', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { username, password });
      setUser(res.data);
      axios.defaults.headers.common['x-user-id'] = res.data.id;
    } catch (err: any) {
      setLoginError(err.response?.data?.error || 'Login failed');
    }
  };

  const fetchPortfolio = async (skipApi = false) => {
    if (!user) return;
    setPortfolioLoading(true);
    try {
      const res = await axios.get(`${API_URL}/trading/portfolio${skipApi ? '?skipApi=true' : ''}`);
      setPortfolio(res.data);
    } catch (err: any) {
      console.error('Failed to fetch portfolio', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Portfolio is loaded on startup using cached prices (skipApi=true) to save API limits.
  useEffect(() => {
    if (user) {
      fetchPortfolio(true);
    }
  }, [user]);

  const handleSearch = async () => {
    if (!symbol) return;
    setLoading(true);
    setError('');
    setStockDetails(null);
    setSuccess('');
    try {
      const res = await axios.get(`${API_URL}/stock/details`, { params: { symbol } });
      setStockDetails({ symbol, data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch stock details. You may have hit the daily limit.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    const numAmount = Number(amount);
    if (!stockDetails || numAmount <= 0) return;
    
    const currentPrice = extractPrice(stockDetails.data);
    if (currentPrice <= 0) {
      setError('Could not extract current price to calculate shares.');
      return;
    }
    
    const calculatedShares = numAmount / currentPrice;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API_URL}/trading/buy`, {
        symbol: stockDetails.symbol,
        shares: calculatedShares
      });
      setSuccess(`Successfully invested ₹${res.data.totalCost.toFixed(2)} (including ₹${res.data.taxes.totalTaxes.toFixed(2)} in taxes) to buy ${calculatedShares.toFixed(4)} shares of ${stockDetails.symbol}. Click Refresh in your portfolio to see updates.`);
      await fetchUser();
      // Removed automatic fetchPortfolio() to save API rate limit
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to buy stock');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (symbol: string) => {
    if (!window.confirm(`Are you sure you want to delete your position in ${symbol}?`)) return;
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/trading/position/${symbol}`);
      // Refresh the portfolio without hitting the API to save rate limits
      await fetchPortfolio(true); 
    } catch (err: any) {
      console.error('Failed to delete position', err);
      setError('Failed to delete position.');
    } finally {
      setLoading(false);
    }
  };

  const handleWallet = async (action: 'deposit' | 'withdraw') => {
    const amountNum = Number(walletAmount);
    if (!amountNum || amountNum <= 0) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API_URL}/auth/wallet`, { action, amount: amountNum });
      setSuccess(res.data.message);
      setWalletAmount('');
      await fetchUser();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSell = async (symbol: string, currentShares: number) => {
    const input = window.prompt(`How many shares of ${symbol} do you want to sell? (Max: ${currentShares.toFixed(4)})`, currentShares.toString());
    if (!input) return;
    const sharesToSell = Number(input);
    if (isNaN(sharesToSell) || sharesToSell <= 0 || sharesToSell > currentShares) {
      alert('Invalid shares amount');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/trading/sell`, { symbol, sharesToSell });
      const taxMsg = res.data.taxes.totalTaxes > 0 ? ` (Tax deducted: ₹${res.data.taxes.totalTaxes.toFixed(2)}${res.data.taxes.capitalGainsTax > 0 ? ` incl. ${res.data.isShortTerm ? 'STCG' : 'LTCG'}` : ''})` : '';
      setSuccess(`Successfully sold ${sharesToSell} shares of ${symbol} for ₹${res.data.revenue.toFixed(2)}${taxMsg}.`);
      await fetchPortfolio(true);
      await fetchUser();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to sell stock');
    } finally {
      setLoading(false);
    }
  };

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

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans text-neutral-100">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Briefcase className="w-8 h-8 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight">Login</h1>
          </div>
          {loginError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{loginError}</p>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2.5 rounded-lg transition mt-4"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const netWorth = (user.wallet || 0) + (portfolio?.totalPortfolioValue || 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex justify-between items-center pb-6 border-b border-neutral-800">
          <div className="flex items-center space-x-3">
            <Briefcase className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-semibold tracking-tight text-white">Paper Trading</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-neutral-400 text-sm hidden sm:inline">User: <span className="text-white font-medium">{user.username}</span></span>
            <span className="text-neutral-400 text-sm">Wallet: <span className="text-white font-medium">₹{user.wallet?.toFixed(2)}</span></span>
            <span className="text-neutral-400 text-sm">Net Worth: <span className="text-emerald-400 font-bold">₹{netWorth.toFixed(2)}</span></span>
            <button onClick={() => { setUser(null); delete axios.defaults.headers.common['x-user-id']; }} className="text-sm bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded transition">Logout</button>
          </div>
        </header>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center space-x-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <p>{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Trade */}
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-medium mb-6 text-white flex items-center">
                <Search className="w-5 h-5 mr-2 text-neutral-400" />
                Find Stock
              </h2>
              
              <div className="flex space-x-3 mb-6">
                <input 
                  type="text" 
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. RELIANCE"
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
                <button 
                  onClick={handleSearch}
                  disabled={loading || !symbol}
                  className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-medium px-6 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>

              {stockDetails && (
                <div className="mt-6 pt-6 border-t border-neutral-800 space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-neutral-400">Symbol</p>
                      <p className="text-2xl font-bold">{stockDetails.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-neutral-400">Current Price</p>
                      <p className="text-3xl font-light text-emerald-400">
                        ₹{extractPrice(stockDetails.data).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {stockDetails.data?.stockTechnicalData && (
                    <div className="bg-neutral-950 p-5 rounded-xl border border-neutral-800 mt-6 shadow-inner">
                      <div className="flex items-center space-x-2 mb-4">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-medium text-neutral-300">Technical Moving Averages</h3>
                      </div>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart 
                            data={stockDetails.data.stockTechnicalData.map((d: any) => ({
                              days: `${d.days}D`,
                              NSE: Number(d.nsePrice),
                              BSE: Number(d.bsePrice)
                            }))}
                            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                            <XAxis 
                              dataKey="days" 
                              stroke="#737373" 
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              domain={['auto', 'auto']}
                              stroke="#737373" 
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) => `₹${value}`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '8px', fontSize: '12px' }}
                              itemStyle={{ color: '#e5e5e5' }}
                              labelStyle={{ color: '#a3a3a3', marginBottom: '4px' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="NSE" 
                              stroke="#34d399" 
                              strokeWidth={2}
                              dot={{ fill: '#0a0a0a', stroke: '#34d399', strokeWidth: 2, r: 3 }}
                              activeDot={{ r: 5, fill: '#34d399' }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="BSE" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              dot={{ fill: '#0a0a0a', stroke: '#3b82f6', strokeWidth: 2, r: 3 }}
                              activeDot={{ r: 5, fill: '#3b82f6' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center space-x-4 mt-2">
                         <div className="flex items-center text-xs text-neutral-400">
                           <div className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></div> NSE
                         </div>
                         <div className="flex items-center text-xs text-neutral-400">
                           <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></div> BSE
                         </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-end space-x-3 mt-4">
                    <div className="flex-1">
                      <label className="block text-sm text-neutral-400 mb-2">Investment Amount (₹)</label>
                      <input 
                        type="number" 
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
                      />
                    </div>
                    <button 
                      onClick={handleBuy}
                      disabled={loading || Number(amount) <= 0}
                      className="flex-1 bg-white hover:bg-neutral-200 text-neutral-950 font-medium px-6 py-2.5 rounded-lg transition disabled:opacity-50 flex justify-center items-center"
                    >
                      <DollarSign className="w-5 h-5 mr-1" />
                      Invest
                    </button>
                  </div>
                  {amount && Number(amount) > 0 && extractPrice(stockDetails.data) > 0 && (
                    <p className="text-xs text-neutral-500 text-center mt-2">
                      Est. Shares: {(Number(amount) / extractPrice(stockDetails.data)).toFixed(4)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Wallet Management */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-medium mb-4 text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
                Wallet Management
              </h2>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => handleWallet('deposit')}
                  className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-4 py-2 rounded-lg font-medium transition"
                >
                  Deposit
                </button>
                <button
                  onClick={() => handleWallet('withdraw')}
                  className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-2 rounded-lg font-medium transition"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Portfolio */}
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl h-full flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-medium text-white">Your Portfolio</h2>
                <button 
                  onClick={() => fetchPortfolio(false)} 
                  disabled={portfolioLoading}
                  className={`text-neutral-400 hover:text-white transition p-2 disabled:opacity-50 disabled:cursor-not-allowed`} 
                  title="Refresh API Prices"
                >
                  <RefreshCw className={`w-5 h-5 ${portfolioLoading ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>

              {portfolio ? (
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {portfolio.positions.length > 0 && (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-4 shadow-inner">
                      <h3 className="text-xs font-medium text-neutral-500 mb-3 uppercase tracking-wider">Portfolio Overview</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                          <p className="text-neutral-500 mb-1 text-xs">Total Value</p>
                          <p className="font-bold text-white text-base">₹{portfolio.totalPortfolioValue?.toFixed(2)}</p>
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                          <p className="text-neutral-500 mb-1 text-xs">Total Invested</p>
                          <p className="font-medium text-neutral-300 text-base">₹{portfolio.totalInvestment?.toFixed(2)}</p>
                        </div>
                        <div className="col-span-2 bg-neutral-900 border border-neutral-800 rounded-lg p-3 flex justify-between items-center">
                          <p className="text-neutral-500 text-xs">Total P&L</p>
                          <p className={`font-bold text-lg ${portfolio.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {portfolio.totalProfitLoss >= 0 ? '+' : ''}₹{portfolio.totalProfitLoss?.toFixed(2)}
                          </p>
                        </div>
                        
                        {portfolio.bestPerformer && (
                          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 border-l-2 border-l-emerald-500">
                            <p className="text-neutral-500 mb-1 text-xs">Best Performer</p>
                            <p className="font-medium text-emerald-400 flex items-center justify-between">
                              {portfolio.bestPerformer.symbol} 
                              <span className="text-xs bg-emerald-400/10 px-1.5 py-0.5 rounded">+{portfolio.bestPerformer.profitLossPercentage.toFixed(2)}%</span>
                            </p>
                          </div>
                        )}
                        {portfolio.worstPerformer && (
                          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3 border-l-2 border-l-red-500">
                            <p className="text-neutral-500 mb-1 text-xs">Worst Performer</p>
                            <p className="font-medium text-red-400 flex items-center justify-between">
                              {portfolio.worstPerformer.symbol} 
                              <span className="text-xs bg-red-400/10 px-1.5 py-0.5 rounded">{portfolio.worstPerformer.profitLossPercentage.toFixed(2)}%</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {portfolio.positions.length === 0 ? (
                    <div className="text-center text-neutral-500 py-10">
                      No positions yet. Make your first trade!
                    </div>
                  ) : (
                    portfolio.positions.map((pos: any) => (
                      <div key={pos.symbol} className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-lg block">{pos.symbol}</span>
                            <span className="text-neutral-300 text-sm">{pos.shares.toFixed(4)} Shares</span>
                          </div>
                          <div className="flex space-x-1">
                            <button 
                              onClick={() => handleSell(pos.symbol, pos.shares)}
                              className="text-neutral-500 hover:text-emerald-400 transition px-3 py-1.5 rounded-md hover:bg-emerald-400/10 text-sm font-medium"
                              title="Sell Shares"
                            >
                              Sell
                            </button>
                            <button 
                              onClick={() => handleDelete(pos.symbol)}
                              className="text-neutral-500 hover:text-red-400 transition p-1.5 rounded-md hover:bg-red-400/10"
                              title="Delete Position"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-xs text-neutral-500 mb-2 border-b border-neutral-800 pb-2 space-y-0.5">
                          <p><span className="text-neutral-400">Position ID:</span> {pos.id}</p>
                          <p><span className="text-neutral-400">Last Bought Price:</span> ₹{pos.boughtAtPrice?.toFixed(2) || 'N/A'}</p>
                          <p><span className="text-neutral-400">Last Fetched Price:</span> ₹{pos.lastFetchedPrice?.toFixed(2) || 'N/A'}</p>
                          <p><span className="text-neutral-400">Created:</span> {new Date(pos.createdAt).toLocaleString()}</p>
                          <p><span className="text-neutral-400">Updated:</span> {new Date(pos.updatedAt).toLocaleString()}</p>
                        </div>
                        
                        <div className="flex justify-between text-sm mb-1 text-neutral-400">
                          <span>Avg Price: ₹{pos.averagePrice.toFixed(2)}</span>
                          <span>Current: ₹{pos.currentPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800">
                          <span className="text-sm text-neutral-400">P&L</span>
                          <span className={`font-medium ${pos.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pos.profitLoss >= 0 ? '+' : ''}₹{pos.profitLoss.toFixed(2)} 
                            <span className="ml-1 opacity-75">
                              ({pos.profitLossPercentage.toFixed(2)}%)
                            </span>
                          </span>
                        </div>
                        {pos.apiError && (
                          <p className="text-xs text-amber-500 mt-2">Warning: Using old price ({pos.apiError})</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-neutral-500 py-10 space-y-4">
                  <p>Portfolio updates are manual to conserve API rate limits.</p>
                  <button 
                    onClick={() => fetchPortfolio(false)} 
                    disabled={portfolioLoading}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${portfolioLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    {portfolioLoading ? 'Loading...' : 'Load Portfolio'}
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
