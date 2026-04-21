import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import Stats from './components/Stats'
import Terminal from './components/Terminal'
import Footer from './components/Footer'
import {
  ConnectPanel,
  RegisterPanel,
  VerifyPanel,
  LookupPanel,
  AuctionPanel,
  AdminPanel,
} from './components/TabPanels'

export default function App() {
  const [currentTab, setCurrentTab] = useState('connect')
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState(null)
  const [isOwner] = useState(false)

  const handleConnect = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
        setWalletAddress(accounts[0])
        setIsConnected(true)
        // Show ACCESS GRANTED toast (in Hero component)
      } catch (error) {
        console.error('Connection failed:', error)
      }
    } else {
      alert('MetaMask not detected. Please install the extension.')
    }
  }

  const handleRegister = () => {
    setCurrentTab('register')
  }

  return (
    <div className="app">
      {/* Animated background grid */}
      <div className="bg-grid" />

      {/* Navbar */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isConnected={isConnected}
        walletAddress={walletAddress}
      />

      {/* Main content */}
      <main style={{ paddingTop: '60px', flex: 1, width: '100%' }}>
        {/* Hero or Tab Panel */}
        <AnimatePresence mode="wait">
          {currentTab === 'connect' ? (
            <motion.div
              key="hero-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Hero onConnect={handleConnect} onRegister={handleRegister} />

              {/* Only show feature sections when on connect tab */}
              <Features />
              <Stats />
              <Terminal />
            </motion.div>
          ) : (
            <motion.div
              key="tab-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
            >
              {currentTab === 'register' && <RegisterPanel isConnected={isConnected} />}
              {currentTab === 'verify' && <VerifyPanel isConnected={isConnected} />}
              {currentTab === 'lookup' && <LookupPanel />}
              {currentTab === 'auction' && <AuctionPanel isConnected={isConnected} />}
              {currentTab === 'admin' && <AdminPanel isConnected={isConnected} isOwner={isOwner} />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
