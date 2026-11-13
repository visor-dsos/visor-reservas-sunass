import React from 'react';
import {createRoot} from 'react-dom/client';
import ReservasDashboard from './ReservasDashboard';
import './base.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ReservasDashboard/></React.StrictMode>);
