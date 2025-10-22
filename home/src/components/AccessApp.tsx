import { useState } from 'react';
import { Header } from './Header';
import { GrantPermissionForm } from './GrantPermissionForm';
import { PermissionList } from './PermissionList';
import { CheckAccess } from './CheckAccess';
import '../styles/AccessApp.css';

type TabKey = 'grant' | 'permissions' | 'check';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'grant', label: 'Grant Permission' },
  { key: 'permissions', label: 'My Permissions' },
  { key: 'check', label: 'Check Access' },
];

export function AccessApp() {
  const [activeTab, setActiveTab] = useState<TabKey>('grant');

  return (
    <div className="access-app">
      <Header />
      <main className="access-content">
        <div className="tabs">
          <nav className="tab-nav">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`tab-button ${activeTab === key ? 'active' : 'inactive'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        <section className="tab-panel">
          {activeTab === 'grant' && <GrantPermissionForm />}
          {activeTab === 'permissions' && <PermissionList />}
          {activeTab === 'check' && <CheckAccess />}
        </section>
      </main>
    </div>
  );
}
