# CyberVault — Decentralised Crypto Wallet Landing Page

A modern, fully-animated React + Vite web application for a crypto wallet with MetaMask integration. Built with Framer Motion animations, CSS Modules, and a "Ghost in the Machine" cyberpunk aesthetic.

## 🎨 Design Highlights

- **Theme**: Electric green (#00ff88) + Cyber-blue (#00d4ff) on near-black background
- **Animations**: Staggered text reveals, scroll-triggered sections, glitch effects, typewriter terminal
- **Components**: Glass-morphism cards, scanline overlays, custom crosshair cursor
- **Responsive**: Mobile-optimized with smooth animations

## 🚀 Features

✅ **Multiple Pages**
- Connect Wallet (Hero with animated stats)
- Register Identity (Document hashing + form)
- KYC Verification (Authority panel)
- Identity Lookup (Real-time queries)
- Auction System (Bidding mechanics)
- Admin Panel (Owner-only functions)

✅ **Animations**
- Staggered hero title reveal (cubic-bezier easing)
- Floating icons with infinite loop
- Scroll-triggered card animations
- Button hover states with glow effects
- Card tilt effect on mouse movement
- Typewriter terminal with cursor blink
- Number counter animations

✅ **Functionality**
- MetaMask wallet connection
- Document SHA-256 hashing
- Form validation
- Transaction simulation
- Identity lookup demo
- Responsive across all devices

## 📦 Installation

### Prerequisites
- Node.js 16+ with npm/yarn/pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server (opens at http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
cybervault/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx & Navbar.module.css
│   │   ├── Hero.jsx & Hero.module.css
│   │   ├── Features.jsx & Features.module.css
│   │   ├── Stats.jsx & Stats.module.css
│   │   ├── Terminal.jsx & Terminal.module.css
│   │   ├── TabPanels.jsx & TabPanels.module.css
│   │   └── Footer.jsx & Footer.module.css
│   ├── hooks/
│   │   ├── useCountUp.js
│   │   ├── useTilt.js
│   │   └── useScrollGlow.js
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── package.json
└── .gitignore
```

## 🎬 Key Animations

### Hero Entrance
- Text slides up with staggered delay (0.08s)
- Easing: cubic-bezier(0.22, 1, 0.36, 1)
- Duration: 0.6s each word

### Scroll Reveals
- Framer Motion `whileInView` with threshold 0.15
- Cards fade + translateY(-20px) → position
- Stagger delay between cards

### Button Interactions
- Hover: scale(1.04) with glow pulse
- Tap: scale(0.97)
- Border trace animation on hover

### Terminal Typewriter
- Character-by-character reveal (30ms interval)
- Cursor blink animation
- Line-by-line progression

## 🔧 Tech Stack

- **Frontend**: React 18 + Vite
- **Animations**: Framer Motion 10
- **Styling**: CSS Modules + CSS Variables
- **Web3**: MetaMask integration
- **Cryptography**: SubtleCrypto (SHA-256)
- **Fonts**: JetBrains Mono, Space Mono, Inter

## 🎨 Theme Colors

```css
--accent-primary: #00ff88      /* Electric green */
--accent-secondary: #00d4ff    /* Cyber blue */
--accent-warning: #ffaa00      /* Amber */
--bg-primary: #0a0a0f          /* Near-black */
--bg-secondary: #12121a        /* Dark navy */
--text-primary: #f2f4f6        /* Off-white */
--text-secondary: #8993a4      /* Muted gray */
```

## 📱 Responsive Breakpoints

- **Desktop**: Full features, 3-column grids
- **Tablet** (≤768px): 2-column grids, compact nav
- **Mobile** (≤480px): Single column, stacked buttons

## 🔐 MetaMask Integration

The app supports:
- Wallet connection via `eth_requestAccounts`
- Account switching detection
- Demo address lookup with hardcoded results
- Transaction simulation (fake signing)

**Note**: For production, integrate with actual smart contract endpoints and real transaction signing.

## 🌐 Deployment

Build and deploy to Vercel, Netlify, or any static host:

```bash
npm run build
# Deploy the `dist/` folder
```

## 📝 Future Enhancements

- [ ] Real smart contract integration (Sepolia testnet)
- [ ] User authentication & wallet profiles
- [ ] Database persistence (Supabase/Firebase)
- [ ] PDF certificate export for verified identities
- [ ] Advanced CBOM table with TanStack Table
- [ ] Cipher suite visualization charts (Recharts)
- [ ] ML-based risk analysis dashboard
- [ ] Multi-signature authorization flow

## 📄 License

MIT — Free to use and modify.

---

**Built with 💚 for the decentralised web**
