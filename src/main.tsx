import ProductionDataAdmin from './ProductionDataAdmin';
import React from 'react';
import {createRoot} from 'react-dom/client';
import ReservasInstitutional from './ReservasInstitutional';
import './base.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{location.pathname==='/admin'?<ProductionDataAdmin/>:<ReservasInstitutional/>}</React.StrictMode>);
