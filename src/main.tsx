import { createRoot } from 'react-dom/client'
import App from './App'
import { recordPageView } from './lib/stats'
import '@fontsource/barlow-condensed/latin-400.css'
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import './styles/global.css'

if (import.meta.env.PROD) recordPageView()

createRoot(document.getElementById('root')!).render(<App />)
