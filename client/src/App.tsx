import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Header from './Header'
import Footer from './Footer'
import AuthModal, { type AuthMode } from './AuthModal'
import UploadModal from './UploadModal'
import Gallery from './Gallery'
import ImageDetail from './ImageDetail'
import './App.css'

function App() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  // Bumped after each upload so the gallery knows to reload
  const [uploadCount, setUploadCount] = useState(0)

  const requireLogin = () => setAuthMode('login')

  return (
    <>
      <Header onAuth={setAuthMode} onUpload={() => setShowUpload(true)} />

      <main className="container-xxl pb-4">
        <Routes>
          <Route path="/" element={<Gallery requireLogin={requireLogin} uploadCount={uploadCount} />} />
          <Route path="/images/:id" element={<ImageDetail requireLogin={requireLogin} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="container-xxl py-3 text-body-secondary">
        <Footer />
      </footer>

      <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onSwitch={setAuthMode} />
      <UploadModal
        show={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => setUploadCount((n) => n + 1)}
      />
    </>
  )
}

export default App
