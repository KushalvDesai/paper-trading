# Paper Trading Platform 📈

A digitalized paper trading application designed for people to practice trading without using real money. This platform allows you to simulate buying and tracking stocks, letting you hone your investment strategies risk-free.

## Features
- **Real-Time Data**: Integrates with the real Indian Stock Market to fetch current, accurate prices.
- **Fractional Shares**: Invest by specifying exactly how much money (₹) you want to allocate, and automatically calculate fractional shares.
- **Technical Analysis**: View interactive visual Line Charts mapping out 5D, 10D, 20D, 50D, 100D, and 300D moving averages for both NSE and BSE.
- **Portfolio Tracking**: Keep track of your holdings, average prices, and real-time Profit & Loss.
- **API Rate Limiting Protection**: Designed to safely handle the strict rate limits of the Indian Stock API. Portfolio updates are loaded manually to prevent hitting API quotas.

## Tech Stack
- **Frontend**: Next.js, React, Tailwind CSS, Recharts, Lucide-React
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL

## API Integration

This project uses the [Indian Stock Market API](https://indianapi.in/indian-stock-market) to fetch stock details and real-time prices. 

> **Rate Limit Note:** The free tier of this API only allows 16 requests per day. The application is built defensively around this limit. The backend tracks your API usage locally, and the frontend avoids automatic polling of the portfolio.

## Getting Started

### Prerequisites
- Node.js
- PostgreSQL running locally (or remotely)

### Backend Setup
1. Navigate to the `server` directory: `cd server`
2. Install dependencies: `npm install`
3. Copy the `.env.example` file to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   *You will need to add your PostgreSQL connection string and your API key from the Indian Stock Market API.*
4. Initialize the Prisma database:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Start the backend development server: `npm run dev`

### Frontend Setup
1. Navigate to the `client` directory: `cd client`
2. Install dependencies: `npm install`
3. Start the Next.js development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Disclaimer
This is a simulation tool. The data is retrieved from third-party APIs and may have delays or inaccuracies. Do not use this application for making real financial decisions.
