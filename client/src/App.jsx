import { useEffect, useState, useCallback } from 'react';
import SettingsView from './components/SettingsView';
import ListingView from './components/ListingView';
import LeadManagerListing from './components/LeadManagerListing';
import LeadProfile from './components/LeadProfile';
import Toast from './components/Toast';

function App() {
  const [view, setView] = useState('settings');
  const [listingSource, setListingSource] = useState(null);
  const [leadProfileId, setLeadProfileId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok, key: Date.now() });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'listing') {
      setListingSource(params.get('src') || null);
      setView('listing');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const openListingSameTab = (src) => {
    setListingSource(src || null);
    setView('listing');
  };

  const openListingNewTab = (src) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'listing');
    if (src) url.searchParams.set('src', src);
    else url.searchParams.delete('src');
    window.open(url.toString(), '_blank');
  };

  const goSettings = () => setView('settings');
  const openLeadManager = () => setView('leadManager');
  const openLeadProfile = (id) => {
    setLeadProfileId(id);
    setView('leadProfile');
  };

  return (
    <div id="app">
      <div className="tnav">
        <div className="tnav-l">
          <div className="nic" style={{ fontSize: 18 }}><i className="ti ti-menu-2" /></div>
          <div className="inst-pill">
            <i className="ti ti-building-bank" style={{ fontSize: 15, color: '#6B7280' }} />
            Rama University Archive
            <i className="ti ti-chevron-down" style={{ fontSize: 12, color: '#9CA3AF' }} />
          </div>
        </div>
        <div className="tnav-r">
          <button className="mio-btn"><i className="ti ti-sparkles" style={{ fontSize: 13 }} /> Ask Mio AI</button>
          <div className="nic"><i className="ti ti-layout-dashboard" style={{ fontSize: 17 }} /></div>
          <div className="nic"><i className="ti ti-settings" style={{ fontSize: 17 }} /></div>
          <div className="nic"><i className="ti ti-help-circle" style={{ fontSize: 17 }} /></div>
          <div className="nic"><i className="ti ti-bell" style={{ fontSize: 17 }} /></div>
          <div className="nav-av">IU</div>
        </div>
      </div>

      <div className="bdy">
        <div className="sb">
          <div className="si"><i className="ti ti-search" /></div>
          <div className="si on"><i className="ti ti-sparkles" /></div>
          <div className="si"><i className="ti ti-layout-grid" /></div>
          <div className="si"><i className="ti ti-building" /></div>
          <div
            className={`si ${view === 'leadManager' || view === 'leadProfile' ? 'on' : ''}`}
            onClick={openLeadManager}
            title="Lead Manager"
          >
            <i className="ti ti-users" />
          </div>
          <div className="si"><i className="ti ti-bolt" /></div>
          <div className="si-sep" />
          <div className="si"><i className="ti ti-file-text" /></div>
          <div className="si"><i className="ti ti-message-circle" /></div>
        </div>

        <div className={`view ${view === 'settings' ? 'active' : ''}`} id="vs">
          <SettingsView
            showToast={showToast}
            openListingSameTab={openListingSameTab}
            openListingNewTab={openListingNewTab}
          />
        </div>

        <div className={`view ${view === 'listing' ? 'active' : ''}`} id="vl" style={{ flexDirection: 'column' }}>
          {view === 'listing' && (
            <ListingView
              initialSource={listingSource}
              showToast={showToast}
              goSettings={goSettings}
              openLeadProfile={openLeadProfile}
            />
          )}
        </div>

        <div className={`view ${view === 'leadManager' ? 'active' : ''}`} id="vlm" style={{ flexDirection: 'column' }}>
          {view === 'leadManager' && (
            <LeadManagerListing
              showToast={showToast}
              openLeadProfile={openLeadProfile}
            />
          )}
        </div>

        <div className={`view ${view === 'leadProfile' ? 'active' : ''}`} id="vlp" style={{ flexDirection: 'column' }}>
          {view === 'leadProfile' && leadProfileId && (
            <LeadProfile
              leadId={leadProfileId}
              showToast={showToast}
              goLeadManager={openLeadManager}
            />
          )}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

export default App;
