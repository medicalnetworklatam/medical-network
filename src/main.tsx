import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'

// The site's fonts and colour tokens. The fonts are self-hosted (no Google
// servers): Albert Sans and Space Grotesk, SIL Open Font License.
import './styles/global.css'
import './styles/redesign.css'

import AuthProvider from './lib/AuthProvider.tsx'
import ProfileProvider from './lib/ProfileProvider.tsx'
import RequireLogin from './pages/RequireLogin.tsx'
import Home from './pages/Home.tsx'
import Estados from './pages/Estados.tsx'
import Novedades from './pages/Novedades.tsx'
import NovedadPost from './pages/NovedadPost.tsx'
import IniciarSesion from './pages/IniciarSesion.tsx'
import RecuperarContrasena from './pages/RecuperarContrasena.tsx'
import NuevaContrasena from './pages/NuevaContrasena.tsx'
import Perfil from './pages/Perfil.tsx'
import Comunidad from './pages/Comunidad.tsx'
import Chat from './pages/Chat.tsx'
import RequireAdmin from './pages/RequireAdmin.tsx'
import AdminClientes from './pages/AdminClientes.tsx'
import AdminCliente from './pages/AdminCliente.tsx'
import AdminNovedades from './pages/AdminNovedades.tsx'

// The state picker used to keep the chosen states in this browser only
// ("mn_estados"). The state is now saved to the account: remove the old copy.
try {
  localStorage.removeItem('mn_estados')
} catch {
  /* storage blocked (e.g. private mode): nothing to remove */
}

// The home page's "Menú" used to switch between five colour palettes and
// remembered the choice in this browser ("mnl-palette"). The palette is now
// chosen for good (Flatline): remove the old choice.
try {
  localStorage.removeItem('mnl-palette')
} catch {
  /* storage blocked (e.g. private mode): nothing to remove */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/iniciar-sesion" element={<IniciarSesion />} />
            <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
            <Route path="/nueva-contrasena" element={<NuevaContrasena />} />

            {/* Need a login: logged-out visitors go to /iniciar-sesion, and
                logged-in users without a first name to /perfil first */}
            <Route element={<RequireLogin />}>
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/estados" element={<Estados />} />
              <Route path="/novedades" element={<Novedades />} />
              <Route path="/novedades/:id" element={<NovedadPost />} />
              <Route path="/comunidad" element={<Comunidad />} />
              <Route path="/chat" element={<Chat />} />

              {/* Admins only: everyone else is sent to /novedades */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminClientes />} />
                <Route path="/admin/clientes/:id" element={<AdminCliente />} />
                <Route path="/admin/novedades" element={<AdminNovedades />} />
              </Route>
            </Route>

            {/* Unknown addresses show the home page */}
            <Route path="*" element={<Home />} />
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  </StrictMode>,
)
