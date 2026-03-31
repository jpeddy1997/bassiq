import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import BassIQ from './BassIQ.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BassIQ />
  </StrictMode>,
)
