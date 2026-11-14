import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'

// Fonts are bundled into our own site (no Google servers): Anton for the big
// titles, Figtree for everything else. Both use the SIL Open Font License.
import '@fontsource/anton'
import '@fontsource-variable/figtree'
import './styles/global.css'

import AuthProvider from './lib/AuthProvider.tsx'
import RequireLogin from './pages/RequireLogin.tsx'
import Home from './pages/Home.tsx'
import Estados from './pages/Estados.tsx'
import Novedades from './pages/Novedades.tsx'
import IniciarSesion from './pages/IniciarSesion.tsx'
import RecuperarContrasena from './pages/RecuperarContrasena.tsx'
import NuevaContrasena from './pages/NuevaContrasena.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/iniciar-sesion" element={<IniciarSesion />} />
          <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
          <Route path="/nueva-contrasena" element={<NuevaContrasena />} />

          {/* Need a login: logged-out visitors go to /iniciar-sesion */}
          <Route element={<RequireLogin />}>
            <Route path="/estados" element={<Estados />} />
            <Route path="/novedades" element={<Novedades />} />
          </Route>

          {/* Unknown addresses show the home page */}
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
