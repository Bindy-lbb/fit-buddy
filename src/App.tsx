import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import GroupPage from './pages/GroupPage'
import MemberPage from './pages/MemberPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/g/:code" element={<GroupPage />} />
      <Route path="/g/:code/m/:memberId" element={<MemberPage />} />
      <Route path="/g/:code/me" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
