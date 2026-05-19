import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './skin-v2.css'; // additive overrides — must come AFTER styles.css

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
