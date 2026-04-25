import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Stats from './components/Stats'
import Terminal from './components/Terminal'
import Footer from './components/Footer'
import { ZKPanel } from './components/ZKPanel'
import {
  ConnectPanel,
  RegisterPanel,
  VerifyPanel,
  LookupPanel,
  AuctionPanel,
  AdminPanel,
} from './components/TabPanels'
import { useWallet } from './hooks/useWallet'

export default function App() {
  const [currentTab, setCurrentTab] = useState('connect')

  const {
    account,
    isConnected,
    isWrongNetwork,
    connect,
    error: walletError,
    CHAIN_NAME,
  } = useWallet()

  const handleRegister = () => setCurrentTab('register')

  return (
    <div className="app">
      <div className="bg-grid" />

      {isWrongNetwork && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#b45309', color: '#fff', textAlign: 'center',
          padding: '0.5rem', fontSize: '0.85rem',
        }}>
          ⚠️ Wrong network. Please switch MetaMask to <strong>{CHAIN_NAME}</strong>.
        </div>
      )}

      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isConnected={isConnected}
        walletAddress={account}
      />

      <main style={{ paddingTop: isWrongNetwork ? '90px' : '60px', flex: 1, width: '100%' }}>
        {walletError && (
          <div style={{
            background: '#7f1d1d22', border: '1px solid #ef444444',
            color: '#fca5a5', borderRadius: '8px',
            padding: '0.75rem 1rem', margin: '1rem auto', maxWidth: '600px', fontSize: '0.85rem',
          }}>
            {walletError}
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentTab === 'connect' ? (
            <motion.div
              key="hero-view"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Hero onConnect={connect} onRegister={handleRegister} isConnected={isConnected} account={account} />
              <Features />
              <Stats />
              <Terminal />
            </motion.div>
          ) : (
            <motion.div
              key="tab-view"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {currentTab === 'register' && <RegisterPanel isConnected={isConnected} account={account} />}
              {currentTab === 'verify'   && <VerifyPanel   isConnected={isConnected} account={account} />}
              {currentTab === 'lookup'   && <LookupPanel />}
              {currentTab === 'auction'  && <AuctionPanel  isConnected={isConnected} account={account} />}
              {currentTab === 'zk'       && <ZKPanel isConnected={isConnected} />}
              {currentTab === 'admin'    && <AdminPanel    isConnected={isConnected} account={account} />}
              {/* New tab: verifier key management */}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}