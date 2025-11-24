import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HiMenuAlt2, HiLogout } from 'react-icons/hi';
import { supabase } from '../lib/supabaseClient.js';

const ADMIN_ROLES = ['SUPER', 'ADMIN'];
const NAV_ITEMS = [
  { id: 'desert', label: '사막폭풍 전장', restricted: false, to: '/home/desert' },
  { id: 'canyon', label: '협곡폭풍 전장', restricted: false, to: '/home/canyon' },
  { id: 'members', label: '연맹원 관리', restricted: true, to: '/home/members' },
];

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [permission, setPermission] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCompactView, setIsCompactView] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('desert');

  useEffect(() => {
    if (!supabase) {
      navigate('/');
      return;
    }

    const fetchProfile = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        navigate('/');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? '');

      const { data, error } = await supabase
        .from('user_info')
        .select('permission, approval_status')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (error || !data || data.approval_status !== 'APPROVED') {
        navigate('/');
        return;
      }

      setPermission(data.permission ?? '');
      setLoading(false);
    };

    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => {
      setIsCompactView(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isCompactView) {
      setIsMobileMenuOpen(false);
      setIsSidebarOpen(true);
    }
  }, [isCompactView]);

  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/home/canyon')) {
      setActiveSection('canyon');
    } else if (path.startsWith('/home/members')) {
      setActiveSection('members');
    } else {
      setActiveSection('desert');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!loading && location.pathname === '/home') {
      navigate('/home/desert', { replace: true });
    }
  }, [loading, location.pathname, navigate]);

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    navigate('/');
  };

  const handleNavSelect = (item) => {
    const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
    if (disabled) return;
    navigate(item.to);
    if (isCompactView) {
      setIsMobileMenuOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="home-page loading">
        <p>프로필을 불러오는 중입니다…</p>
      </div>
    );
  }

  const outletContext = { userId, userEmail, permission, isCompactView };

  return (
    <div className={`home-page${isSidebarOpen ? '' : ' sidebar-collapsed'}`}>
      <aside className="home-sidebar">
        <nav>
          {NAV_ITEMS.map((item) => {
            const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`sidebar-btn${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                type="button"
                disabled={disabled}
                onClick={() => handleNavSelect(item)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="home-main">
        <header className="home-header">
          <div className="header-left">
            <div className="header-menu-wrapper">
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => {
                  if (isCompactView) {
                    setIsMobileMenuOpen((prev) => !prev);
                  } else {
                    setIsSidebarOpen((prev) => !prev);
                  }
                }}
                aria-pressed={isCompactView ? undefined : isSidebarOpen}
                aria-expanded={isCompactView ? isMobileMenuOpen : undefined}
                aria-label="메뉴"
              >
                <HiMenuAlt2 aria-hidden="true" />
              </button>

              {isCompactView && isMobileMenuOpen && (
                <div className="header-menu-dropdown">
                  {NAV_ITEMS.map((item) => {
                    const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="dropdown-item"
                        disabled={disabled}
                        onClick={() => handleNavSelect(item)}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="user-panel">
            {!isCompactView && <span className="user-email">{userEmail}</span>}
            <button type="button" className="logout-btn" onClick={handleLogout} aria-label="로그아웃">
              <HiLogout aria-hidden="true" />
            </button>
          </div>
        </header>

        <section className="home-content">
          <Outlet context={outletContext} />
        </section>
      </main>

      {!isCompactView && (
        <nav className="home-bottom-nav">
          {NAV_ITEMS.map((item) => {
            const disabled = item.restricted && !ADMIN_ROLES.includes(permission);
            const isActive = activeSection === item.id;
            return (
              <Link
                key={item.id}
                className={`bottom-btn${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                to={disabled ? '#' : item.to}
                onClick={(e) => {
                  if (disabled) e.preventDefault();
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
