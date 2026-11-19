import './App.css' // primero: los estilos de cada página deben poder sobrescribirlo
import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Landing from './Landing'
import AuthPage from './auth/AuthPage'
import AdminPage from './panel/AdminPage'
import { PanelInicio } from './panel/PanelLayout'
import RecepcionPage from './panel/RecepcionPage'
import SocioPage from './panel/SocioPage'

/** Al cambiar de página, vuelve arriba (salvo enlaces a una sección con #). */
function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/registro" element={<AuthPage mode="register" />} />
        <Route path="/recuperar" element={<AuthPage mode="recover" />} />
        <Route path="/restablecer" element={<AuthPage mode="reset" />} />
        <Route path="/panel" element={<PanelInicio />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/recepcion" element={<RecepcionPage />} />
        <Route path="/mi-membresia" element={<SocioPage />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}
