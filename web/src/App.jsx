import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Home from './pages/Home.jsx';
import Desert from './pages/Desert.jsx';
import Canyon from './pages/Canyon.jsx';
import Members from './pages/Members.jsx';
import { Navigate } from 'react-router-dom';

function AuthLayout({ children }) {
  return (
    <div className="login-page">
      {children}
      <footer>
        <span>© {new Date().getFullYear()} STr 레인져스</span>
        <span className="credit">Built with Codex · One Star</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route
          path="/signup"
          element={
            <AuthLayout>
              <Signup />
            </AuthLayout>
          }
        />
        <Route path="/home" element={<Home />}>
          <Route index element={<Navigate to="/home/desert" replace />} />
          <Route path="desert" element={<Desert />} />
          <Route path="canyon" element={<Canyon />} />
          <Route path="members" element={<Members />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
