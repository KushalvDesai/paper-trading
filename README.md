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
2. Install all required dependencies explicitly:
   ```bash
   npm install @prisma/client @prisma/adapter-pg pg bcryptjs compression cors dotenv express express-rate-limit express-validator helmet jsonwebtoken morgan xlsx
   
   npm install -D typescript @types/node @types/express @types/cors @types/bcryptjs @types/compression @types/jsonwebtoken @types/morgan @types/multer @types/pg nodemon prisma ts-node
   ```
3. Copy the `.env.example` file to `.env` and fill in your credentials:
   ```
   DATABASE_URL="postgresql://user:password@host:port/dbname"
   INDIAN_STOCK_API_KEY="your_api_key"
   ```
   *You will need to add your PostgreSQL connection string and your API key from the Indian Stock Market API.*
4. **Initialize the Prisma database**:
   Make sure you have specified your `DATABASE_URL` in `.env` (pointing to a running PostgreSQL database). Then, apply the schema and generate the client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Start the backend development server: `npm run dev`

### Frontend Setup
1. Navigate to the `client` directory: `cd client`
2. Install all required dependencies explicitly:
   ```bash
   npm install @hookform/resolvers @tanstack/react-query axios lucide-react next react react-dom react-hook-form recharts xlsx zod zustand
   
   npm install -D @tailwindcss/postcss @types/node @types/react @types/react-dom babel-plugin-react-compiler eslint eslint-config-next tailwindcss typescript
   ```
3. Start the Next.js development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Disclaimer
This is a simulation tool. The data is retrieved from third-party APIs and may have delays or inaccuracies. Do not use this application for making real financial decisions.
