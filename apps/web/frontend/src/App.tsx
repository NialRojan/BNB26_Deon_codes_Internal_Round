import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Dashboard from './app/owner/Dashboard'
import SetupPage from './app/owner/VaultSetup'
import AssetsPage from './app/owner/AssetClassification'
import PeoplePage from './app/owner/PartiesAssignment'
import ReadinessPage from './app/owner/ReadinessChecker'
import GuardianPortal from './app/guardian/GuardianPortal'
import ExecutorPortal from './app/executor/ExecutorPortal'
import BeneficiaryPortal from './app/beneficiary/BeneficiaryPortal'
const LandingPage = lazy(() => import('./app/LandingPage'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Suspense fallback={<div className="landing-loading">Opening Heirloom…</div>}><LandingPage /></Suspense>} />
      <Route element={<Shell />}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="assets" element={<AssetsPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="readiness" element={<ReadinessPage />} />
        <Route path="guardian" element={<GuardianPortal />} />
        <Route path="executor" element={<ExecutorPortal />} />
        <Route path="heir" element={<BeneficiaryPortal />} />
      </Route>
    </Routes>
  )
}
