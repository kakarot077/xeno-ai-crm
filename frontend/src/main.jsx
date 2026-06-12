import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import AppLayout  from './layouts/AppLayout';
import Dashboard  from './pages/Dashboard';
import Segments   from './pages/Segments';
import Campaigns  from './pages/Campaigns';
import Analytics  from './pages/Analytics';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/segments"   element={<Segments />} />
          <Route path="/campaigns"  element={<Campaigns />} />
          <Route path="/analytics"  element={<Analytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
