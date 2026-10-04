import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Dashboard from './app/owner/Dashboard'
import SetupPage from './app/owner/VaultSetup'
import AssetsPage from './app/owner/AssetClassification'
import PeoplePage from './app/owner/PartiesAssignment'
import ReadinessPage from './app/owner/ReadinessChecker'
import GuardianRecoveryPortal from './app/guardian/GuardianRecoveryPortal'
import ExecutorPortal from './app/executor/ExecutorPortal'
import BeneficiaryPortal from './app/beneficiary/BeneficiaryPortal'

// B2B2C Law Firm & Client Inheritance Flows
import LawFirmDashboard from './app/lawyer/LawFirmDashboard'
import CreateVaultPage from './app/lawyer/CreateVaultPage'
import DocumentVerification from './app/lawyer/DocumentVerification'
import ExecuteWillPage from './app/lawyer/ExecuteWillPage'
import ClientVaultDashboard from './app/client/ClientVaultDashboard'
import ClientOnboarding from './app/client/ClientOnboarding'
import AssetOnboarding from './app/client/AssetOnboarding'
import CryptoDeposit from './app/client/CryptoDeposit'
import SecretSealing from './app/client/SecretSealing'
import PerAssetCustomization from './app/client/PerAssetCustomization'
import RecoveryTimelinePage from './app/recovery/RecoveryTimelinePage'
import StagedReleasePortal from './app/heir/StagedReleasePortal'

const LandingPage = lazy(() => import('./app/LandingPage'))

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<div className="landing-loading">Opening Heirloom…</div>}>
            <LandingPage />
          </Suspense>
        }
      />
      <Route element={<Shell />}>
        {/* Core & Owner Routes */}
        <Route path="/app" element={<Dashboard />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/readiness" element={<ReadinessPage />} />

        {/* Law Firm Workspace Routes */}
        <Route path="/lawyer" element={<LawFirmDashboard />} />
        <Route path="/lawyer/create" element={<CreateVaultPage />} />
        <Route path="/lawyer/verification" element={<DocumentVerification />} />
        <Route path="/lawyer/execute" element={<ExecuteWillPage />} />

        {/* Client Private Vault Routes */}
        <Route path="/client/vault" element={<ClientVaultDashboard />} />
        <Route path="/client/onboarding" element={<ClientOnboarding />} />
        <Route path="/client/assets" element={<AssetOnboarding />} />
        <Route path="/client/deposit" element={<CryptoDeposit />} />
        <Route path="/client/seal" element={<SecretSealing />} />
        <Route path="/client/customize" element={<PerAssetCustomization />} />

        {/* Recovery State Machine & Veto */}
        <Route path="/recovery" element={<RecoveryTimelinePage />} />

        {/* Guardian & Fiduciary Portals */}
        <Route path="/guardian" element={<GuardianRecoveryPortal />} />
        <Route path="/executor" element={<ExecutorPortal />} />
        <Route path="/heir" element={<BeneficiaryPortal />} />
        <Route path="/heir/releases" element={<StagedReleasePortal />} />
      </Route>
    </Routes>
  )
}
