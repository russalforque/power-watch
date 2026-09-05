/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { PublicHomePage } from './pages/public/PublicHomePage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminImportPage } from './pages/admin/AdminImportPage';
import { AdminReviewPage } from './pages/admin/AdminReviewPage';
import { AdminAdvisoriesListPage } from './pages/admin/AdminAdvisoriesListPage';
import { AdminAreasPage } from './pages/admin/AdminAreasPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Guest Routes */}
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<PublicHomePage />} />
          </Route>

          {/* Admin Authentication */}
          <Route path="/admin/login" element={<AdminLoginPage />} />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="advisories/import" element={<AdminImportPage />} />
            <Route path="advisories/review/:id" element={<AdminReviewPage />} />
            <Route path="advisories" element={<AdminAdvisoriesListPage />} />
            <Route path="areas" element={<AdminAreasPage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

