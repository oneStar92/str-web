import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="login-page">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Routes>

        <footer>
          <span>© {new Date().getFullYear()} STr 레인져스</span>
          <span className="credit">Built with Codex · One Star</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}
