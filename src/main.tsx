import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'

// Fonts are bundled into our own site (no Google servers): Anton for the big
// titles, Figtree for everything else. Both use the SIL Open Font License.
import '@fontsource/anton'
import '@fontsource-variable/figtree'
import './styles/global.css'

import Home from './pages/Home.tsx'
import Estados from './pages/Estados.tsx'
import Novedades from './pages/Novedades.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/estados" element={<Estados />} />
        <Route path="/novedades" element={<Novedades />} />
        {/* Unknown addresses show the home page */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
