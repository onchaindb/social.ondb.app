# OnDB Social App Example

A comprehensive example application demonstrating integration with **OnChainDB** and **Celestia blockchain** for
decentralized social media functionality.

## 🚀 Features

✅ **X-402 Payment Protocol**: Integrated payment handling via Tempo payment facilitator
✅ **Celestia Integration**: Full blockchain transaction support via Privy wallet
✅ **OnChainDB SDK**: Complete integration with db-client SDK and query functionality
✅ **Real-time Updates**: Live tweet feed with automatic refresh
✅ **Wallet Integration**: Seamless Privy wallet connection and payment processing
✅ **Transaction Tracking**: Full payment flow with confirmation and progress tracking
✅ **TypeScript**: Full type safety throughout the application

## 📋 Prerequisites

Before running the application, ensure you have:

1. **OnChainDB Server**: Running db-client server
2. **Celestia Testnet**: Access to Celestia testnet
3. **Privy Account**: For wallet integration and authentication
4. **Node.js**: Version 18+ recommended

## 🏗️ Architecture

### OnChainDB Integration

- **App ID**: `app_ac04adaaa50348a4` (Social app)
- **Collections**: `main`, `users`, `tweets`
- **Indexes**: `tweets_owner_index` for fast author lookups
- **SDK Integration**: Uses `@onchaindb/sdk` for query building and transactions

### Technology Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Celestia testnet via CosmJS
- **Wallet**: Privy wallet integration
- **Payments**: Tempo payment facilitator with X-402 protocol
- **Database**: OnChainDB with broker protocol

## 🚦 Getting Started

### 1. Configure Environment Variables

Create a `.env.local` file in the example-app directory:

```bash
cp .env.example .env.local
```

Configure the required variables:

```env
# OnChainDB Service Configuration
NEXT_PUBLIC_ONCHAINDB_ENDPOINT=http://localhost:9092
NEXT_PUBLIC_APP_ID=app_ac04adaaa50348a4
NEXT_PUBLIC_ONCHAINDB_API_KEY=your_api_key_here

# Privy Wallet Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Celestia Network (optional - defaults to testnet)
NEXT_PUBLIC_NETWORK=mocha-4

# X-402 Payment Configuration (optional)
NEXT_PUBLIC_X402_PREFERRED_NETWORK=base-sepolia
NEXT_PUBLIC_X402_PREFERRED_TOKEN=native
```

**Important**:
- Get your Privy App ID from [https://dashboard.privy.io](https://dashboard.privy.io)
- Configure your OnChainDB endpoint and API key
- Payment configuration determines which network/token Tempo uses for payments

### 2. Start OnChainDB Server

```bash
cd /Users/radovanstevanovic/projects/celestia/db-client
cargo run -- --dev-mode
```

The server will start on `http://localhost:9092`

### 3. Install Dependencies

```bash
cd example-app
npm install
```

### 3. Configure Environment

The app uses these default configurations:

- OnChainDB Server: `http://localhost:9092`
- Celestia Network: `mocha-4` (testnet)
- App ID: `app_ac04adaaa50348a4`
- Payment Network: `base-sepolia`

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎯 How to Use

### 1. Connect Wallet

- Click "Connect Wallet" to authenticate with Privy
- Create or connect your embedded wallet
- App will display your wallet address once connected

### 2. Create Tweets and Interact

- Click "New Tweet" to open the composer
- Write your message (max characters as configured)
- Submit to trigger the payment and storage flow:
    - Get pricing quote from OnChainDB
    - Process payment via Tempo payment facilitator
    - Store tweet data on blockchain
    - Confirm transaction on Celestia
- Like, reply to, or quote tweets (each action triggers X-402 payment flow)

### 3. View Feed

- Tweets automatically load and refresh
- Browse chronological feed of all tweets
- View user profiles and wallet information

## 📁 Project Structure

```
example-app/
├── src/
│   ├── app/
│   │   ├── api/                 # API routes
│   │   │   └── submit-tx/       # Transaction submission
│   │   ├── tweet/[tweetId]/    # Tweet detail pages
│   │   ├── user/[userId]/      # User profile pages
│   │   ├── page.tsx            # Main application page
│   │   └── layout.tsx          # App layout
│   ├── components/
│   │   ├── header.tsx          # App header
│   │   └── TweetCard.tsx       # Tweet display component
│   ├── hooks/
│   │   └── usePrivyWallet.ts   # Privy wallet integration
│   └── lib/
│       ├── services/
│       │   ├── RealSocialService.ts  # OnChainDB social service
│       │   └── TempoPaymentCallback.ts # X-402 payment handling
│       └── config.ts           # App and network configuration
├── package.json                # Dependencies and scripts
└── README.md                   # This file
```

## 🔧 Key Components

### Social Service (`src/lib/services/RealSocialService.ts`)

- Integrates with OnChainDB SDK for social features
- Handles all social operations: tweets, likes, follows, profiles
- Uses X-402 payment callbacks for monetized operations
- Provides type-safe API for all social interactions

### Payment Integration (`src/lib/services/TempoPaymentCallback.ts`)

- Creates X-402 payment callbacks for Tempo facilitator
- Handles payment flow for all write operations
- Supports multiple networks and tokens
- Provides seamless payment UX

### Wallet Integration (`src/hooks/usePrivyWallet.ts`)

- Manages Privy wallet connection and authentication
- Provides embedded wallet functionality
- Handles account information and session management

### UI Components

- **Header**: Navigation and wallet connection display
- **TweetCard**: Tweet display with like, reply, and quote actions
- **Profile Pages**: User profiles with onboarding and wallet info

## 🧪 Testing Features

### OnChainDB Integration

1. Create tweets and observe structured data storage
2. Check console for API calls to OnChainDB endpoints
3. Verify payment flow via Tempo payment facilitator

### X-402 Payment Flow

1. Connect Privy wallet and ensure funded account
2. Submit tweet - triggers X-402 payment via Tempo
3. Track payment processing and transaction confirmation
4. Test all paid operations: tweets, likes, quotes, replies, follows, profile updates

### Social Features

- Test user profiles and onboarding flow
- Create and view tweets with media attachments
- Test follow/unfollow functionality
- Monitor network requests in browser dev tools

## 🔍 API Integration

The application integrates with these OnChainDB endpoints:

```typescript
// Application info
GET /api/apps/app_ac04adaaa50348a4

// Collections and indexes
GET /api/apps/app_ac04adaaa50348a4/collections
GET /api/apps/app_ac04adaaa50348a4/indexes

// Pricing and billing
POST /api/pricing/quote
GET /api/billing/app_ac04adaaa50348a4
```

## 🚀 Production Deployment

### Build for Production

```bash
npm run build
npm start
```

### Environment Configuration

For production deployment, configure:

- OnChainDB server endpoint
- Celestia network configuration
- API keys and authentication
- Wallet network settings

### Deployment Platforms

The application can be deployed on:

- **Vercel**: Recommended for Next.js apps
- **Netlify**: Static site generation
- **Docker**: Containerized deployment
- **Custom servers**: Node.js hosting

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding Features

1. **New Social Features**: Extend `RealSocialService.ts` with new operations
2. **Advanced Queries**: Use OnChainDB SDK query builder for complex filtering
3. **Payment Customization**: Configure Tempo payment options for different networks
4. **User Management**: Expand user profile features and social graph

## 📚 Documentation

For more detailed information:

- **[OnChainDB SDK Documentation](../sdk/README.md)** - Complete SDK reference
- **[Query Building Guide](../onChainDBSDK/docs/query-building.md)** - Advanced query patterns
- **[Migration Guide](./MIGRATION-GUIDE.md)** - Upgrading from broker to OnChainDB
- **[SDK Endpoint Fixes](./SDK-ENDPOINT-FIXES.md)** - Integration troubleshooting

## 🐛 Troubleshooting

### Common Issues

1. **Wallet Connection Failed**
    - Ensure Privy wallet is properly configured
    - Check network settings match application configuration
    - Verify Privy API keys are set in environment variables

2. **Payment Processing Issues**
    - Verify sufficient funds in wallet for payment
    - Check Tempo payment facilitator status
    - Review console logs for X-402 payment errors

3. **OnChainDB Connection**
    - Ensure db-client server is running on port 9092
    - Check console for API endpoint errors
    - Verify OnChainDB API key is configured

### Debug Mode

Enable detailed logging by opening browser console - the application provides extensive debug output for all operations.

## 🤝 Contributing

This example demonstrates best practices for OnChainDB and X-402 payment integration. When contributing:

1. Follow TypeScript best practices
2. Add proper error handling
3. Include progress indicators for user operations
4. Test all payment flows thoroughly
5. Update documentation for new features

## 📄 License

This example application is part of the OnChainDB project and follows the same license terms.
