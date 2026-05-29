import React from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import './styles.css'

// Apply dark-mode theme immediately upon load to prevent bright-screen flashing
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, onSnapshot, query, writeBatch, doc, updateDoc } from 'firebase/firestore'
import BookForm from './BookForm'
import GoodreadsImporter from './GoodreadsImporter'

const BookContext = React.createContext({ stacks:[], archives:[], departures:[], queue:[], recent:[], allBooks:[] });
export function useLibrary() { return React.useContext(BookContext); }

function BookCover({ label, small, muted, coverUrl }) { 
  if (coverUrl) return <img src={coverUrl} alt={label} className={`bookCover ${small ? 'small' : ''} ${muted ? 'mutedCover' : ''}`} style={{ objectFit: 'cover', padding: 0, border: '1px solid #c7b8a4' }} />;
  return <div className={`bookCover ${small ? 'small' : ''} ${muted ? 'mutedCover' : ''}`}>{label}</div>;
}

export function Header() { 
  const [isDark, setIsDark] = React.useState(document.body.classList.contains('dark-mode'));
  
  const toggleTheme = () => {
    if (document.body.classList.contains('dark-mode')) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => { if (auth.currentUser) signOut(auth); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', position: 'relative', padding: '10px 0 16px' }}>
      <button 
        onClick={toggleTheme} 
        title="Toggle Theme" 
        style={{ position: 'absolute', top: '18px', right: '22px', background: 'transparent', border: '1px solid var(--line)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px', color: 'var(--muted)', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', userSelect: 'none', outline: 'none', zIndex: 10 }}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Benedict Library title flanked by two large shield crests and ornaments */}
      <div className="titleRow" style={{ margin: '14px 0 6px 0', gap: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <span className="ornament" style={{ width: '10vw', maxWidth: '160px' }} />
        
        {/* Left Shield Crest (Scaled so rendered outline matches visual cap-height) */}
        <svg viewBox="0 15 100 43" fill="none" className="headerCrest" style={{ color: 'var(--blue)', flexShrink: 0, overflow: 'visible' }}>
          {/* Shield Outline */}
          <path d="M35 15H65V35C65 48 50 58 50 58C50 58 35 48 35 35V15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          {/* Laurel Wreaths */}
          <path d="M26 20C22 26 22 36 30 43" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
          <path d="M74 20C78 26 78 36 70 43" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
          {/* Open Book (Unified, background-masked shape for high legibility) */}
          <path d="M 50,21 C 46,19 41,19 37,21 V 34 C 41,32 46,32 50,34 C 54,32 59,32 63,34 V 21 C 59,19 54,19 50,21 Z" fill="var(--bg)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M 50,21 V 34" stroke="currentColor" strokeWidth="2"/>
          {/* Guiding Star */}
          <path d="M50 8L52 12L56 12L53 14L54 18L50 16L46 18L47 14L44 12L48 12L50 8Z" fill="currentColor"/>
        </svg>

        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1 style={{ margin: 0, lineHeight: '1' }}>Benedict Library</h1>
        </Link>

        {/* Right Shield Crest (Scaled so rendered outline matches visual cap-height) */}
        <svg viewBox="0 15 100 43" fill="none" className="headerCrest" style={{ color: 'var(--blue)', flexShrink: 0, overflow: 'visible' }}>
          {/* Shield Outline */}
          <path d="M35 15H65V35C65 48 50 58 50 58C50 58 35 48 35 35V15Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          {/* Laurel Wreaths */}
          <path d="M26 20C22 26 22 36 30 43" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
          <path d="M74 20C78 26 78 36 70 43" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
          {/* Open Book (Unified, background-masked shape for high legibility) */}
          <path d="M 50,21 C 46,19 41,19 37,21 V 34 C 41,32 46,32 50,34 C 54,32 59,32 63,34 V 21 C 59,19 54,19 50,21 Z" fill="var(--bg)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M 50,21 V 34" stroke="currentColor" strokeWidth="2"/>
          {/* Guiding Star */}
          <path d="M50 8L52 12L56 12L53 14L54 18L50 16L46 18L47 14L44 12L48 12L50 8Z" fill="currentColor"/>
        </svg>

        <span className="ornament" style={{ width: '10vw', maxWidth: '160px' }} />
      </div>

      {/* Private Library subtitle kicker directly below */}
      <div className="studyKicker" style={{ marginTop: '4px' }}>Private Library</div>

      {auth.currentUser && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', marginBottom: '8px', alignItems: 'center' }}>
          <Link to="/add-book" className="primaryBtn" style={{ cursor: 'pointer', fontSize: '10px', padding: '0 10px', border: 'none', display: 'inline-flex', alignItems: 'center', height: '22px', lineHeight: '1' }}>+ Add Book</Link>
        </div>
      )}
    </div>
  ); 
}
function Shell({ children }) { return <div className="page" style={{ position: 'relative' }}><Header />{children}</div> }

function Home() { 
  const { stacks, archives, departures, queue, recent, allBooks } = useLibrary();
  const currentlyReading = allBooks.find(b => b.status === 'Currently Reading');
  const annals = allBooks.filter(b => b.finishedAt).sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 8);
  const homeAnnalsGrouped = annals.reduce((acc, b) => { const y = new Date(b.finishedAt).getFullYear(); acc[y] = acc[y] || []; acc[y].push(b); return acc; }, {});
  const recentDepartures = [...departures].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 3);
  
  const [quickPage, setQuickPage] = React.useState('');
  const [isEditingPage, setIsEditingPage] = React.useState(false);

  const handleQuickPageUpdate = async (e) => {
    e.preventDefault();
    if (!currentlyReading || !currentlyReading.id || !quickPage.toString().trim()) return;
    const newPage = parseInt(quickPage, 10);
    const totalP = parseInt(currentlyReading.totalPages, 10);
    if (isNaN(newPage) || newPage < 0) return alert('Please enter a valid page number.');

    const updatedFields = {
      currentPage: newPage
    };

    if (!isNaN(totalP) && totalP > 0 && newPage >= totalP) {
      const confirmCompletion = window.confirm(`You reached page ${newPage} of ${totalP}! Would you like to mark this book as Finished?`);
      if (confirmCompletion) {
        updatedFields.status = 'Owned';
        updatedFields.inQueue = false;
        updatedFields.finishedAt = new Date().toISOString().split('T')[0];
      }
    }

    await updateDoc(doc(db, 'books', currentlyReading.id), updatedFields);
    setQuickPage('');
    setIsEditingPage(false);
  };

  let progressPct = 0;
  let hasProgress = false;
  if (currentlyReading) {
    const cur = parseInt(currentlyReading.currentPage, 10) || 0;
    const tot = parseInt(currentlyReading.totalPages, 10) || 0;
    if (tot > 0) {
      progressPct = Math.min(100, Math.max(0, Math.round((cur / tot) * 1000) / 10));
      hasProgress = true;
    }
  }

  const recentSessions = currentlyReading && Array.isArray(currentlyReading.readingSessions)
    ? [...currentlyReading.readingSessions].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 2)
    : [];

  return (<Shell>
  <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px 20px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
      <div className="heroText" style={{ flex: '1 1 300px' }}>
        <div className="kicker">On the Desk.</div>
        <h2 style={{ fontSize: '32px', margin: '0 0 6px 0', fontWeight: 'bold' }}>{currentlyReading ? currentlyReading.title : 'Nothing currently on the desk'}</h2>
        
        {currentlyReading && (
          <div style={{ margin: '14px 0 0 0', maxWidth: '380px' }}>
            {isEditingPage ? (
              <form onSubmit={handleQuickPageUpdate} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                <input 
                  type="number" 
                  value={quickPage} 
                  onChange={e => setQuickPage(e.target.value)} 
                  placeholder="Page" 
                  min="0"
                  max={currentlyReading.totalPages || undefined}
                  style={{ width: '64px', height: '26px', fontSize: '11px', padding: '2px 6px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--cream)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', outline: 'none' }} 
                  autoFocus
                />
                <button 
                  type="submit" 
                  style={{ fontSize: '10px', padding: '0 10px', height: '26px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: '4px', border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 'bold' }}
                >
                  Save
                </button>
                <button 
                  type="button" 
                  onClick={() => { setIsEditingPage(false); setQuickPage(''); }}
                  style={{ fontSize: '10px', padding: '0 10px', height: '26px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--cream)', color: 'var(--ink)', fontWeight: 'normal' }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="bookProgressBlock" style={{ padding: '12px 14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px', border: '1px solid var(--line)', background: 'rgba(255,254,251,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--ink)' }}>
                    <span>Reading Progress: <strong>{currentlyReading.currentPage || 0}</strong> of <strong>{currentlyReading.totalPages || 0}</strong> pages</span>
                    <strong style={{ color: 'var(--blue)' }}>{progressPct}%</strong>
                  </div>
                  <div className="progressBarBg" style={{ height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                    <div className="progressBarFill" style={{ width: `${progressPct}%`, height: '100%', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setQuickPage(currentlyReading.currentPage || '');
                      setIsEditingPage(true);
                    }}
                    style={{ fontSize: '10px', padding: '0 10px', height: '22px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: '4px', border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 'bold' }}
                  >
                    Update
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {currentlyReading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignSelf: 'center', flexShrink: 0 }}>
          <Link to={`/book/${encodeURIComponent(currentlyReading.title)}`} className="primaryBtn" style={{ textAlign: 'center', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '36px', padding: '0 20px', minWidth: '110px' }}>
            View Log
          </Link>
        </div>
      )}
    </div>
    
    {recentSessions.length > 0 && (
      <div className="deskReflections" style={{ marginTop: '8px', paddingTop: '12px', width: '100%' }}>
        <div className="reflectionTitle" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '8px', fontFamily: 'Inter, sans-serif', fontWeight: 'bold' }}>Active Reflections:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentSessions.map((s, idx) => (
            <div key={idx} className="reflectionText" style={{ fontSize: '12px', fontStyle: 'italic', lineHeight: '1.4' }}>
              <strong>p. {s.page}</strong> ({new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}): "{s.notes}"
            </div>
          ))}
        </div>
      </div>
    )}
  </section>
  <section className="plaqueGrid"><Link to="/stacks" className="plaque linkCard"><h3>The Stacks</h3><div className="count">{stacks.length} Physical Volumes</div><p>Active physical holdings, on shelves or on loan.</p></Link><Link to="/archives" className="plaque linkCard"><h3>The Archives</h3><div className="count">{archives.length} Digital Volumes</div><p>Cataloged ebooks and audiobooks.</p></Link></section>
  <section className="middleGrid"><Link to="/reading-ledger" className="panel linkCard"><h3>Recently Cataloged</h3>{recent.length === 0 && <p className="pageSubtitle">No recently cataloged books.</p>}<div className="coverRow">{recent.map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /><div className="caption">New</div></div>)}</div><h3 className="queueTitle">The Queue</h3>{queue.length === 0 && <p className="pageSubtitle">Your queue is empty.</p>}<div className="coverRow">{queue.slice(0, 5).map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /></div>)}</div></Link><Link to="/reading-ledger" className="panel linkCard timeline"><h3>The Annals</h3>{annals.length === 0 ? <p className="pageSubtitle">No reading history.</p> : Object.entries(homeAnnalsGrouped).sort((a,b)=>b[0]-a[0]).map(([year, books]) => <div key={year} style={{marginBottom:'12px'}}><div className="year" style={{marginBottom:'6px'}}>{year}</div>{books.map(b => <div key={b.id} className="entry" style={{marginBottom:'8px'}}>Finished {b.title} &middot; {new Date(b.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div>)}</div>)}</Link></section>
  <section className="bottomGrid"><Link to="/circulation" className="panel linkCard"><h3>The Circulation Desk</h3>{stacks.filter(b => b.status === 'On Loan').length === 0 ? <p className="pageSubtitle">No books currently on loan.</p> : stacks.filter(b => b.status === 'On Loan').map(b => <div key={b.id || b.title} className="bookCard"><BookCover label="On Loan" coverUrl={b.coverUrl} small /><div><h4>{b.title}</h4><p>{b.author}</p><div className="tags"><span className="tag-loan">On Loan to {b.borrower}</span>{b.dueAt && <span>Due {new Date(b.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>}</div></div></div>)}</Link><Link to="/departures" className="panel linkCard"><h3>The Ledger of Departures</h3>{recentDepartures.length === 0 && <p className="pageSubtitle">No departed books.</p>}{recentDepartures.map(d => <div key={d.title} className="bookCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>Archived</span></div></div></div>)}</Link></section>
  <footer className="footerLinks"><Link to="/circulation">Circulation Desk</Link><Link to="/series">The Series</Link><Link to="/catalog">Catalog Ledger</Link><Link to="/insights">Library Insights</Link><Link to="/commonplace">Commonplace Book</Link><Link to="/wishlist">Wishlist Ledger</Link><Link to="/departures">Past Departures</Link>{auth.currentUser && <button onClick={() => signOut(auth)} style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', padding: 0, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Log Out</button>}</footer>
</Shell>) }

function BookCard({ item }) { 
  const location = useLocation(); 
  const starsString = item.rating > 0 ? <span style={{ color: '#dca842', fontWeight: 'bold', marginLeft: '6px', fontSize: '13px' }}>{'★'.repeat(item.rating)}</span> : null;
  
  let cardProgress = null;
  const cur = parseInt(item.currentPage, 10);
  const tot = parseInt(item.totalPages, 10);
  if (item.status === 'Currently Reading' && !isNaN(cur) && !isNaN(tot) && tot > 0) {
    const pct = Math.min(100, Math.max(0, Math.round((cur / tot) * 100)));
    cardProgress = (
      <div style={{ marginTop: '8px', width: '100%', maxWidth: '200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--muted)', marginBottom: '2px', fontFamily: 'Inter, sans-serif' }}>
          <span>Reading Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="progressBarBg" style={{ height: '4px', borderRadius: '2px', overflow: 'hidden', borderWidth: 0 }}>
          <div className="progressBarFill" style={{ width: `${pct}%`, height: '100%' }} />
        </div>
      </div>
    );
  }

  return <Link to={`/book/${encodeURIComponent(item.title)}`} state={{ from: location.pathname }} className="detailCard"><div className="detailCover"><BookCover label={item.title} coverUrl={item.coverUrl} small /></div><div className="detailMeta"><h4 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>{item.title} {starsString}</h4><div className="author">{item.author}</div><div className="tags">{item.status === 'On Loan' && item.borrower && <span className="tag-loan">On Loan to {item.borrower}{item.dueAt ? ` (Due ${new Date(item.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' })})` : ' (No due date)'}</span>}{item.status === 'Wishlist' && <span className="tag-wishlist">Wishlist {item.price ? ` (${item.price})` : ''}</span>}{item.series && <span className="tag-series">{item.series}{item.seriesNumber ? ` #${item.seriesNumber}` : ''}</span>}{(item.tags||[]).map(t => <span key={t}>{t}</span>)}</div>{cardProgress}</div></Link> }
function InventoryPage({ title, subtitle, items, renderHero }) { const navigate = useNavigate(); const [query, setQuery] = React.useState(''); const filtered = items.filter(i => `${i.title} ${i.author} ${i.status} ${i.type} ${(i.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase())); return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><h2 className="pageTitle">{title}</h2><p className="pageSubtitle">{subtitle}</p>{renderHero ? renderHero(query, setQuery) : null}<div className="searchBar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, authors, tags..." /></div><div className="detailList">{filtered.map(item => <BookCard key={item.id} item={item} />)}</div></div></Shell> }
function StacksPage() { const { stacks } = useLibrary(); return <InventoryPage title="The Stacks" subtitle="Physical holdings with locations, tags, and ownership details." items={stacks} renderHero={(query, setQuery) => <div className="inventoryHero"><div className="inventoryStat" onClick={()=>setQuery('')} style={{cursor:'pointer',borderColor:query===''?'var(--blue)':''} }><div className="statLabel">Physical Volumes</div><div className="statValue">{stacks.length}</div></div><div className="inventoryStat" onClick={()=>setQuery('On Loan')} style={{cursor:'pointer',borderColor:query==='On Loan'?'var(--blue)':''} }><div className="statLabel">On Loan</div><div className="statValue">{stacks.filter(b=>b.status === 'On Loan').length}</div></div><div className="inventoryStat" onClick={()=>setQuery('Signed')} style={{cursor:'pointer',borderColor:query==='Signed'?'var(--blue)':''} }><div className="statLabel">Signed</div><div className="statValue">{stacks.filter(b=>(b.tags||[]).includes('Signed')).length}</div></div></div>} /> }
function ArchivesPage() { const { archives } = useLibrary(); return <InventoryPage title="The Archives" subtitle="Digital holdings and future local-file support." items={archives} renderHero={(query, setQuery) => <div className="inventoryHero"><div className="inventoryStat" onClick={()=>setQuery('')} style={{cursor:'pointer',borderColor:query===''?'var(--blue)':''} }><div className="statLabel">Digital Volumes</div><div className="statValue">{archives.length}</div></div><div className="inventoryStat" onClick={()=>setQuery('Audiobook')} style={{cursor:'pointer',borderColor:query==='Audiobook'?'var(--blue)':''} }><div className="statLabel">Audiobooks</div><div className="statValue">{archives.filter(b=>b.type === 'Audiobook').length}</div></div><div className="inventoryStat" onClick={()=>setQuery('Ebook')} style={{cursor:'pointer',borderColor:query==='Ebook'?'var(--blue)':''} }><div className="statLabel">Ebooks</div><div className="statValue">{archives.filter(b=>b.type === 'Ebook').length}</div></div></div>} /> }
function CirculationPage() {
  const { stacks } = useLibrary();
  const loaned = stacks.filter(b => b.status === 'On Loan');
  
  // Calculate dynamic circulation metrics
  const uniqueBorrowers = Array.from(new Set(loaned.map(b => b.borrower).filter(Boolean))).length;
  
  // Calculate books due this week
  const dueThisWeek = loaned.filter(b => {
    if (!b.dueAt) return false;
    const dueDate = new Date(b.dueAt);
    if (isNaN(dueDate)) return false;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    sevenDaysFromNow.setHours(23,59,59,999);
    
    return dueDate >= today && dueDate <= sevenDaysFromNow;
  }).length;

  return (
    <InventoryPage 
      title="The Circulation Desk" 
      subtitle="Books currently out on loan and active circulation status." 
      items={loaned} 
      renderHero={() => (
        <div className="inventoryHero">
          <div className="inventoryStat">
            <div className="statLabel">Out on Loan</div>
            <div className="statValue">{loaned.length}</div>
          </div>
          <div className="inventoryStat">
            <div className="statLabel">Due This Week</div>
            <div className="statValue">{dueThisWeek}</div>
          </div>
          <div className="inventoryStat">
            <div className="statLabel">Borrowers</div>
            <div className="statValue">{uniqueBorrowers}</div>
          </div>
        </div>
      )} 
    />
  );
}
function ReadingLedgerPage() {
  const navigate = useNavigate();
  const { queue, allBooks } = useLibrary();
  const [managing, setManaging] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());

  const annals = allBooks.filter(b => b.finishedAt).sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  const groupedAnnals = {};
  annals.forEach(b => {
    const year = new Date(b.finishedAt).getFullYear();
    if (!groupedAnnals[year]) groupedAnnals[year] = [];
    groupedAnnals[year].push(b);
  });

  const toggleSelect = (id) => {
    if (!managing) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === queue.length) setSelected(new Set());
    else setSelected(new Set(queue.map(q => q.id)));
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Permanently delete ${selected.size} books?`)) return;
    const batch = writeBatch(db);
    selected.forEach(id => {
      batch.delete(doc(db, 'books', id));
    });
    await batch.commit();
    setSelected(new Set());
    setManaging(false);
  };

  const moveSubQueueItem = async (subQueue, index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === subQueue.length - 1) return;
    const newSubQueue = [...subQueue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newSubQueue[index];
    newSubQueue[index] = newSubQueue[targetIndex];
    newSubQueue[targetIndex] = temp;
    const batch = writeBatch(db);
    newSubQueue.forEach((q, i) => {
      batch.update(doc(db, 'books', q.id), { queueOrder: i });
    });
    await batch.commit();
  };

  const physicalEbookQueue = queue.filter(b => b.type === 'Physical' || b.type === 'Ebook');
  const audiobookQueue = queue.filter(b => b.type === 'Audiobook');

  const renderQueueItem = (q, index, subQueue) => {
    const isSelected = selected.has(q.id);
    if (managing) {
      return (
        <div 
          key={q.id} 
          className="detailCard" 
          onClick={() => toggleSelect(q.id)} 
          style={{
            cursor: 'pointer', 
            transition: 'all 0.1s', 
            opacity: !isSelected ? 0.7 : 1, 
            boxShadow: isSelected ? '0 0 0 4px #c94a4a' : undefined, 
            border: isSelected ? '1px solid transparent' : undefined
          }}
        >
          <div className="detailCover"><BookCover label={q.title} coverUrl={q.coverUrl} small /></div>
          <div className="detailMeta">
            <h4>{q.title}</h4>
            <div className="author">{q.author}</div>
            <div className="tags">{(q.tags||[]).map(t => <span key={t}>{t}</span>)}</div>
          </div>
        </div>
      );
    }
    
    return (
      <div key={q.id} className="detailCard" style={{display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
          <button 
            onClick={() => moveSubQueueItem(subQueue, index, 'up')} 
            disabled={index === 0} 
            style={{border:'none',background:'transparent',cursor:index===0?'default':'pointer',color:index===0?'var(--line)':'var(--blue)',fontSize:'16px',padding:0}}
          >
            ▲
          </button>
          <button 
            onClick={() => moveSubQueueItem(subQueue, index, 'down')} 
            disabled={index === subQueue.length - 1} 
            style={{border:'none',background:'transparent',cursor:index===subQueue.length-1?'default':'pointer',color:index===subQueue.length-1?'var(--line)':'var(--blue)',fontSize:'16px',padding:0}}
          >
            ▼
          </button>
        </div>
        <Link to={`/book/${encodeURIComponent(q.title)}`} style={{display: 'flex', gap: '14px', flex: '1 1 180px'}}>
          <div className="detailCover"><BookCover label={q.title} coverUrl={q.coverUrl} small /></div>
          <div className="detailMeta">
            <h4 style={{color: 'var(--ink)'}}>{q.title}</h4>
            <div className="author" style={{color: 'var(--muted)'}}>{q.author}</div>
            <div className="tags">
              {q.series && <span style={{backgroundColor:'#e8ebf2',borderColor:'#c1c9dd',color:'#4a5d85'}}>{q.series}{q.seriesNumber ? ` #${q.seriesNumber}` : ''}</span>}
              {(q.tags||[]).map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </Link>
        <button 
          onClick={async (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            await updateDoc(doc(db, 'books', q.id), { status: 'Currently Reading', inQueue: false, startedAt: new Date().toISOString().split('T')[0] }); 
          }} 
          className="primaryBtn" 
          style={{padding:'6px 12px', fontSize:'12px', background:'var(--muted)', whiteSpace: 'nowrap'}}
        >
          Read Now
        </button>
      </div>
    );
  };

  return (
    <Shell>
      <div className="pageView">
        <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button>
        <h2 className="pageTitle">The Reading Ledger</h2>
        <p className="pageSubtitle">Queue and completed reading annals.</p>
        
        <div className="ledgerGrid">
          <section className="ledgerPanel">
            <div className="panelTop" style={{ flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '28px', margin: 0 }}>The Queue</h3>
              <div style={{display:'flex', gap:'8px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%'}}>
                {managing ? (
                  <>
                    <button onClick={selectAll} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'var(--muted)'}}>{selected.size === queue.length ? 'Deselect All' : 'Select All'}</button>
                    <button onClick={deleteSelected} disabled={selected.size===0} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:selected.size===0?'#ccc':'#c94a4a'}}>Delete ({selected.size})</button>
                    <button onClick={()=>setManaging(false)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Done</button>
                  </>
                ) : (
                  <button onClick={()=>setManaging(true)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Manage</button>
                )}
              </div>
            </div>

            <h4 style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '6px', marginTop: '16px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--blue)' }}>Volumes & E-Books</h4>
            {physicalEbookQueue.length === 0 ? (
              <p className="pageSubtitle" style={{ margin: '8px 0 16px 0', fontSize: '12px' }}>No volumes in this queue.</p>
            ) : (
              <div className="detailList" style={{ marginTop: '8px', marginBottom: '20px' }}>
                {physicalEbookQueue.map((q, index) => renderQueueItem(q, index, physicalEbookQueue))}
              </div>
            )}

            <h4 style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '6px', marginTop: '20px', fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', color: 'var(--blue)' }}>Audiobooks</h4>
            {audiobookQueue.length === 0 ? (
              <p className="pageSubtitle" style={{ margin: '8px 0 16px 0', fontSize: '12px' }}>No audiobooks in this queue.</p>
            ) : (
              <div className="detailList" style={{ marginTop: '8px' }}>
                {audiobookQueue.map((q, index) => renderQueueItem(q, index, audiobookQueue))}
              </div>
            )}


          </section>

          <section className="ledgerPanel annalsPanel">
            <div className="panelTop" style={{ justifyContent: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '28px', margin: 0 }}>The Annals</h3>
            </div>
            <div className="timelineBlock">
              {annals.length === 0 ? (
                <p className="pageSubtitle">No history available.</p>
              ) : (
                Object.entries(groupedAnnals).sort((a,b)=>b[0]-a[0]).map(([year, books]) => (
                  <div key={year} style={{marginBottom: "16px"}}>
                    <div className="year" style={{marginBottom: "8px"}}>{year}</div>
                    {books.map(b => (
                      <div key={b.id} className="entry" style={{borderLeft: "2px solid var(--line)", paddingLeft: "10px", marginLeft: "4px", marginBottom: "8px"}}>
                        Finished {b.title} &middot; {new Date(b.finishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
function DeparturesPage() { const navigate = useNavigate(); const { departures } = useLibrary(); return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><h2 className="pageTitle">The Ledger of Departures</h2><p className="pageSubtitle">Books that left the collection permanently.</p><div className="departuresGrid">{departures.map(d => <div key={d.id} className="departureCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>{d.status}</span><span>Archived</span></div></div></div>)}</div></div></Shell> }
function CatalogPage() { 
  const navigate = useNavigate(); 
  const { allBooks } = useLibrary(); 
  const [query, setQuery] = React.useState(''); 
  const [typeFilter, setTypeFilter] = React.useState('All'); 
  const [statusFilter, setStatusFilter] = React.useState('All'); 
  const [ratingFilter, setRatingFilter] = React.useState('All');

  const filtered = allBooks.filter(i => { 
    const matchesQuery = `${i.title} ${i.author} ${(i.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()); 
    const matchesType = typeFilter === 'All' || i.type === typeFilter; 
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter || (statusFilter === 'Queue' && i.inQueue); 
    const matchesRating = ratingFilter === 'All' || 
                          (ratingFilter === '7' && i.rating === 7) ||
                          (ratingFilter === '6+' && i.rating >= 6) ||
                          (ratingFilter === '5+' && i.rating >= 5) ||
                          (ratingFilter === '4+' && i.rating >= 4) ||
                          (ratingFilter === 'Unrated' && (!i.rating || i.rating === 0));
    return matchesQuery && matchesType && matchesStatus && matchesRating; 
  }); 

  return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 className="pageTitle">Detailed Catalog</h2><div style={{display: "flex", gap: "10px"}}><GoodreadsImporter /><Link to="/add-book" className="primaryBtn">Add Book</Link></div></div><p className="pageSubtitle">A complete inventory view of the collection.</p><div className="searchBar" style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px'}}><input style={{flex: '1 1 250px'}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the full catalog..." /><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{flex: '0 1 auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: '#fffaf6', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', outline: 'none'}}><option value="All">All Formats</option><option value="Physical">Physical</option><option value="Ebook">Ebook</option><option value="Audiobook">Audiobook</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{flex: '0 1 auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: '#fffaf6', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', outline: 'none'}}><option value="All">All Statuses</option><option value="Owned">Owned</option><option value="Queue">In Queue</option><option value="Wishlist">Wishlist</option><option value="Currently Reading">Currently Reading</option><option value="On Loan">On Loan</option><option value="Borrowed">Borrowed</option><option value="Sold">Sold</option><option value="Donated">Donated</option><option value="Gifted">Gifted</option></select><select value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)} style={{flex: '0 1 auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: '#fffaf6', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', outline: 'none'}}><option value="All">All Ratings</option><option value="7">7 Stars</option><option value="6+">6+ Stars</option><option value="5+">5+ Stars</option><option value="4+">4+ Stars</option><option value="Unrated">Unrated</option></select></div><div className="detailList">{filtered.map(item => <BookCard key={item.id} item={item} />)}</div></div></Shell> }
function BookPage() { 
  const navigate = useNavigate(); 
  const location = useLocation();
  const { allBooks } = useLibrary();
  const { title } = useParams(); 
  const decoded = decodeURIComponent(title || ''); 
  const item = allBooks.find(b => b.title === decoded) || { author: 'Unknown Author', status: 'Unknown', location: 'Unassigned', cataloged: 'Unknown', provenance: 'No notes.', reading: 'No log.', ownership: 'Unknown.', rating: 0, price: '', purchaseUrl: '', quotes: [] }; 
  
  const fromPath = location.state?.from || '';
  let backLabel = '← Back';
  if (fromPath.includes('/stacks')) backLabel = '← Back to The Stacks';
  else if (fromPath.includes('/archives')) backLabel = '← Back to The Archives';
  else if (fromPath.includes('/circulation')) backLabel = '← Back to Circulation';
  else if (fromPath.includes('/reading-ledger')) backLabel = '← Back to Ledger';
  else if (fromPath.includes('/catalog')) backLabel = '← Back to Catalog';
  else if (fromPath === '/') backLabel = '← Back to Home';

  const [showExLibris, setShowExLibris] = React.useState(false);
  const [quoteText, setQuoteText] = React.useState('');
  const [quotePage, setQuotePage] = React.useState('');
  const [quoteNotes, setQuoteNotes] = React.useState('');

  const [sessionPage, setSessionPage] = React.useState('');
  const [sessionDate, setSessionDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [sessionNotes, setSessionNotes] = React.useState('');

  React.useEffect(() => {
    if (item && item.currentPage !== undefined) {
      setSessionPage(item.currentPage);
    }
  }, [item]);

  const handleLogSession = async (e) => {
    e.preventDefault();
    if (!sessionPage.toString().trim() || !item.id) return;
    const pastSessions = Array.isArray(item.readingSessions) ? item.readingSessions : [];
    const newPage = parseInt(sessionPage, 10);
    const totalP = parseInt(item.totalPages, 10);

    const newSession = {
      page: newPage,
      date: sessionDate,
      notes: sessionNotes.trim(),
      addedAt: new Date().toISOString().split('T')[0]
    };

    const updatedFields = {
      currentPage: newPage,
      readingSessions: [...pastSessions, newSession]
    };

    if (!isNaN(totalP) && totalP > 0 && newPage >= totalP) {
      const confirmCompletion = window.confirm(`You reached page ${newPage} of ${totalP}! Would you like to mark this book as Finished?`);
      if (confirmCompletion) {
        updatedFields.status = 'Owned';
        updatedFields.inQueue = false;
        updatedFields.finishedAt = sessionDate;
      }
    }

    await updateDoc(doc(db, 'books', item.id), updatedFields);
    setSessionNotes('');
  };

  const handleFinish = async () => {
    if (!item.id) return;
    await updateDoc(doc(db, 'books', item.id), { status: 'Owned', inQueue: false, finishedAt: new Date().toISOString().split('T')[0] });
  };

  const handleReturn = async () => {
    if (!item.id) return;
    const pastLoans = Array.isArray(item.loans) ? item.loans : [];
    const newLoan = {
      borrower: item.borrower || 'Unknown Borrower',
      lentAt: item.lentAt || new Date().toISOString().split('T')[0],
      returnedAt: new Date().toISOString().split('T')[0]
    };
    await updateDoc(doc(db, 'books', item.id), {
      status: 'Owned',
      borrower: '',
      lentAt: '',
      dueAt: '',
      loans: [...pastLoans, newLoan]
    });
  };

  const handleAcquire = async () => {
    if (!item.id) return;
    await updateDoc(doc(db, 'books', item.id), {
      status: 'Owned',
      price: '',
      purchaseUrl: ''
    });
  };

  const handleAddQuote = async (e) => {
    e.preventDefault();
    if (!quoteText.trim()) return;
    const pastQuotes = Array.isArray(item.quotes) ? item.quotes : [];
    const newQuote = {
      text: quoteText.trim(),
      page: quotePage.trim(),
      notes: quoteNotes.trim(),
      addedAt: new Date().toISOString().split('T')[0]
    };
    await updateDoc(doc(db, 'books', item.id), {
      quotes: [...pastQuotes, newQuote]
    });
    setQuoteText('');
    setQuotePage('');
    setQuoteNotes('');
  };

  let progressPct = 0;
  let hasProgress = false;
  const cur = parseInt(item.currentPage, 10);
  const tot = parseInt(item.totalPages, 10);
  if (!isNaN(cur) && !isNaN(tot) && tot > 0) {
    progressPct = Math.min(100, Math.max(0, Math.round((cur / tot) * 1000) / 10));
    hasProgress = true;
  }

  return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>{backLabel}</button><div className="bookHero"><BookCover label={decoded || 'Book'} coverUrl={item.coverUrl} /><div className="bookHeroText"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}><h2 className="pageTitle" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: 0 }}>{decoded} {item.rating > 0 && <span style={{ color: '#dca842', fontSize: '20px', letterSpacing: '1px' }}>{'★'.repeat(item.rating)}</span>}</h2><div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>{item.status === 'Currently Reading' && <button onClick={handleFinish} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center',border:'none',cursor:'pointer'}}>Finish Book</button>}{item.status === 'On Loan' && <button onClick={handleReturn} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center',backgroundColor:'#a05252',border:'none',cursor:'pointer'}}>Return Book</button>}{item.status === 'Wishlist' && <button onClick={handleAcquire} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center',backgroundColor:'#4a8a52',border:'none',cursor:'pointer'}}>Acquire Book</button>}{item.finishedAt && <button onClick={() => setShowExLibris(true)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center',backgroundColor:'#b79f7b',border:'none',cursor:'pointer'}}>Ex Libris Card</button>}{item.id && <Link to={`/edit-book/${item.id}`} className="backLink" style={{alignSelf:'center',marginBottom:0}}>Edit</Link>}</div></div><div className="author bookHeroAuthor">{item.author}</div>{item.series && <div style={{marginBottom:'8px',fontSize:'14px',color:'var(--blue)',fontStyle:'italic'}}><strong>{item.series}</strong> {item.seriesNumber ? `· Book ${item.seriesNumber}` : ''}</div>}<div className="tags"><span>{item.status}</span><span>{item.location || 'Unassigned'}</span>{item.status === 'Wishlist' && item.price && <span className="tag-wishlist-detail" style={{fontWeight:'bold'}}>Price: {item.price}</span>}{item.status === 'Wishlist' && item.purchaseUrl && <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" className="purchase-link" style={{textDecoration:'underline'}}>Purchase Link</a>}</div><div className="bookMetaGrid"><div><span>Status</span><strong>{item.status}</strong></div><div><span>Location</span><strong>{item.location || 'Unassigned'}</strong></div><div><span>Cataloged</span><strong>{item.cataloged}</strong></div></div>
            {hasProgress && (
              <div className="bookProgressBlock" style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--ink)' }}>
                  <span>Reading Progress: <strong>{item.currentPage}</strong> of <strong>{item.totalPages}</strong> pages</span>
                  <strong style={{ color: 'var(--blue)' }}>{progressPct}%</strong>
                </div>
                <div className="progressBarBg" style={{ height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                  <div className="progressBarFill" style={{ width: `${progressPct}%`, height: '100%', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
            </div></div>{showExLibris && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowExLibris(false)}>
          <div style={{ background: '#fcf8f2', border: '8px double #c7b8a4', maxWidth: '380px', width: '100%', padding: '30px 24px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: '4px', fontFamily: 'Cormorant Garamond, serif', color: '#3c3228', backgroundImage: 'radial-gradient(rgba(0,0,0,0.02) 20%, transparent 20%), radial-gradient(rgba(0,0,0,0.02) 20%, transparent 20%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 4px 4px' }} onClick={e => e.stopPropagation()}>
            <button style={{ position: 'absolute', top: '10px', right: '14px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#71645a', fontFamily: 'inherit' }} onClick={() => setShowExLibris(false)}>×</button>
            <div style={{ border: '1px solid #c7b8a4', padding: '16px', background: 'rgba(255,255,255,0.7)', borderRadius: '2px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', letterSpacing: '4px', color: '#b79f7b', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>Ex Libris</div>
              <h3 style={{ fontSize: '32px', margin: '10px 0 2px 0', lineHeight: 1.1 }}>{decoded}</h3>
              <div style={{ fontSize: '16px', color: '#71645a', fontStyle: 'italic', marginBottom: '14px' }}>{item.author}</div>
              <div style={{ color: '#dca842', fontSize: '20px', margin: '10px 0' }}>{'★'.repeat(item.rating || 7)}</div>
              <div style={{ display: 'inline-block', border: '2px solid #a05252', color: '#a05252', textTransform: 'uppercase', padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', borderRadius: '4px', margin: '14px 0', transform: 'rotate(-4deg)', boxShadow: '0 0 0 1px #a05252' }}>
                COMPLETED &middot; {item.finishedAt ? new Date(item.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'TODAY'}
              </div>
              <div style={{ borderTop: '1px dashed var(--line)', marginTop: '14px', paddingTop: '12px', fontSize: '13px', fontStyle: 'italic', color: '#71645a', lineHeight: 1.4, textAlign: 'left' }}>
                "{item.reading || item.provenance || 'A treasured addition to the scriptorium collection.'}"
              </div>
              <div style={{ marginTop: '20px', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: '#b79f7b' }}>Benedict Library Ledger</div>
            </div>
          </div>
        </div>
      )}

      {((item.status === 'On Loan' && item.borrower) || (Array.isArray(item.loans) && item.loans.length > 0)) && (<div className="panel" style={{ marginTop: '14px', background: '#fffcf7', border: '1px solid #d8c6ad', padding: '16px', borderRadius: '12px' }}><h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', margin: '0 0 10px 0', color: 'var(--blue)' }}>Lending Registry</h3>{item.status === 'On Loan' && (<div className="loanStatusBox" style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', fontSize: '13px' }}><strong>Currently Lent To:</strong> <span style={{fontSize: '14px', fontWeight: 'bold'}}>{item.borrower}</span><div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}><span><strong>Date Lent:</strong> {item.lentAt ? new Date(item.lentAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Unrecorded'}</span><span><strong>Date Due:</strong> {item.dueAt ? new Date(item.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No due date / Open loan'}</span></div></div>)}{Array.isArray(item.loans) && item.loans.length > 0 && (<div><h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', margin: '0 0 8px 0', color: 'var(--muted)' }}>Past Circulations</h4><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{item.loans.map((loan, idx) => (<div key={idx} style={{ borderLeft: '2px solid var(--line)', paddingLeft: '10px', marginLeft: '4px', fontSize: '12px', color: 'var(--muted)' }}>Lent to <strong>{loan.borrower}</strong> &middot;{' '}{loan.lentAt ? new Date(loan.lentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unrecorded'}{' '}to{' '}{loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unrecorded'}</div>))}</div></div>)}</div>)}

      {item.id && (
        <div className="panel" style={{ marginTop: '14px', background: '#fffefb', border: '1px solid #d9cdbd', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', margin: '0 0 10px 0', color: 'var(--blue)' }}>The Scriptorium Commonplace</h3>
          {Array.isArray(item.quotes) && item.quotes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {item.quotes.map((q, idx) => (
                <div key={idx} className="quoteCard" style={{ padding: '12px 14px', borderRadius: '8px', fontSize: '13px' }}>
                  <p style={{ margin: '0 0 6px 0', fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.45 }}>"{q.text}"</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
                    <span>{q.page ? `Page ${q.page}` : 'Unrecorded page'}</span>
                    {q.notes && <span style={{ fontWeight: '500', color: 'var(--blue)' }}>{q.notes}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddQuote} style={{ display: 'grid', gap: '10px', borderTop: '1px dashed var(--line)', paddingTop: '14px' }}>
            <h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', margin: '0', color: 'var(--muted)' }}>Record a Notable Passage</h4>
            <div>
              <textarea value={quoteText} onChange={e => setQuoteText(e.target.value)} required placeholder="Type the quote or passage here..." style={{ width: '100%', minHeight: '60px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fffefb', padding: '8px 10px', font: 'inherit', color: 'var(--ink)', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
              <input type="text" value={quotePage} onChange={e => setQuotePage(e.target.value)} placeholder="Page (e.g. 142)" style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '8px 12px', font: 'inherit', color: 'var(--ink)' }} />
              <input type="text" value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} placeholder="Notes / Theme (e.g. Socratic Wisdom)" style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '8px 12px', font: 'inherit', color: 'var(--ink)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="primaryBtn" style={{ padding: '6px 14px', fontSize: '12px', border: 'none', cursor: 'pointer' }}>Record Passage</button>
            </div>
          </form>
        </div>
      )}

      <div className="bookDetailSections">
        <section className="bookDetailSection" style={{ gridColumn: 'span 3' }}>
          <h3>Reading Sessions Ledger</h3>
          <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--muted)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {item.startedAt && <span><strong>Started:</strong> {new Date(item.startedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</span>}
            {item.finishedAt && <span><strong>Finished:</strong> {new Date(item.finishedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</span>}
          </div>
          
          {Array.isArray(item.readingSessions) && item.readingSessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {[...item.readingSessions].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0)).map((s, idx) => (
                <div key={idx} className="sessionCard" style={{ padding: '12px 14px', borderRadius: '8px', fontSize: '13px', borderLeft: '3px solid #dca842' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--blue)', marginBottom: '4px', fontSize: '11px' }}>
                    <span>Checkpoint: p. {s.page}</span>
                    <span>{s.date ? new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unrecorded'}</span>
                  </div>
                  <p style={{ margin: '0', fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.45 }}>"{s.notes || 'Progress checkpoint.'}"</p>
                </div>
              ))}
            </div>
          ) : (
            item.reading && <p className="sessionCard" style={{ fontStyle: 'italic', padding: '14px', borderRadius: '8px', marginBottom: '20px' }}>{item.reading}</p>
          )}

          {item.status === 'Currently Reading' && (
            <form onSubmit={handleLogSession} className="progressWrapper" style={{ borderStyle: 'dashed', padding: '16px', borderRadius: '12px', display: 'grid', gap: '10px', marginTop: '14px' }}>
              <h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', margin: '0', color: 'var(--blue)' }}>Log a Reading Session</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="searchBar" style={{ margin: 0 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--muted)' }}>Page Reached</label>
                  <input type="number" value={sessionPage} onChange={e => setSessionPage(e.target.value)} required min="0" placeholder="e.g. 150" style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '8px 12px', font: 'inherit', color: 'var(--ink)' }} />
                </div>
                <div className="searchBar" style={{ margin: 0 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--muted)' }}>Session Date</label>
                  <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '8px 12px', font: 'inherit', color: 'var(--ink)' }} />
                </div>
              </div>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--muted)' }}>Reflections / Notes (Optional)</label>
                <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Log your observations, insights, or reactions here..." style={{ width: '100%', minHeight: '60px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fffefb', padding: '8px 10px', font: 'inherit', color: 'var(--ink)', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="primaryBtn" style={{ padding: '6px 14px', fontSize: '12px', border: 'none', cursor: 'pointer' }}>Log Session</button>
              </div>
            </form>
          )}
        </section>

        <section className="bookDetailSection" style={{ gridColumn: 'span 2' }}>
          <h3>Provenance</h3>
          <p>{item.provenance}</p>
        </section>

        <section className="bookDetailSection" style={{ gridColumn: 'span 1' }}>
          <h3>Ownership</h3>
          <p>{item.ownership}</p>
        </section>
      </div></div></Shell> 
}

function SeriesPage() {
  const navigate = useNavigate();
  const { allBooks } = useLibrary();
  
  const seriesGroups = allBooks.reduce((acc, b) => {
    if (b.series) {
      acc[b.series] = acc[b.series] || [];
      acc[b.series].push(b);
    }
    return acc;
  }, {});

  const [query, setQuery] = React.useState('');
  const [expandedSeries, setExpandedSeries] = React.useState(null);
  const seriesNames = Object.keys(seriesGroups).filter(s => s.toLowerCase().includes(query.toLowerCase())).sort();

  return <Shell>
    <div className="pageView">
      <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 className="pageTitle">The Series</h2></div>
      <p className="pageSubtitle">Collections and series you own.</p>
      <div className="searchBar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search series..." /></div>
      
      <div className="timelineBlock" style={{marginTop: '20px'}}>
        {seriesNames.length === 0 ? <p className="pageSubtitle">No series found.</p> : seriesNames.map(s => {
          const isExpanded = expandedSeries === s;
          return (
          <div key={s} style={{marginBottom: "12px"}}>
            <div onClick={() => setExpandedSeries(isExpanded ? null : s)} className="panel" style={{margin:0,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{margin:0,fontSize:'22px',fontFamily:'Cormorant Garamond, serif',lineHeight:1}}>{s}</h3>
              <div style={{color:'var(--muted)',fontSize:'14px'}}>{seriesGroups[s].length} Books {isExpanded ? '▼' : '▶'}</div>
            </div>
            {isExpanded && (
            <div className="detailList" style={{padding:'12px 0 12px 20px', borderLeft:'2px solid var(--line)', marginLeft:'16px', marginTop:'8px'}}>
              {seriesGroups[s].sort((a,b) => {
                const numA = parseFloat(a.seriesNumber);
                const numB = parseFloat(b.seriesNumber);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.title.localeCompare(b.title);
              }).map(item => <BookCard key={item.id} item={item} />)}
            </div>
            )}
          </div>
        )})}
      </div>
    </div>
  </Shell>
}

function InsightsPage() {
  const navigate = useNavigate();
  const { allBooks } = useLibrary();

  // 1. Basic Stats
  const totalBooks = allBooks.length;

  // 2. Format Composition
  const formatTally = allBooks.reduce((acc, b) => {
    const type = b.type || 'Physical';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, { Physical: 0, Ebook: 0, Audiobook: 0 });

  // 3. Shelf Occupancy (active physical books, excluding departed)
  const activePhysical = allBooks.filter(b => b.type === 'Physical' && !['Gifted', 'Sold', 'Donated'].includes(b.status));
  const shelfOccupancy = activePhysical.reduce((acc, b) => {
    const loc = b.location || 'Unassigned';
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});

  // 4. Top Collected Authors (split by physical/ebook and audiobook)
  const physicalEbookAuthorTally = allBooks.reduce((acc, b) => {
    const type = b.type || 'Physical';
    if (type === 'Physical' || type === 'Ebook') {
      const author = b.author || 'Unknown Author';
      acc[author] = (acc[author] || 0) + 1;
    }
    return acc;
  }, {});
  const sortedPhysicalEbookAuthors = Object.entries(physicalEbookAuthorTally).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const audiobookAuthorTally = allBooks.reduce((acc, b) => {
    const type = b.type || 'Physical';
    if (type === 'Audiobook') {
      const author = b.author || 'Unknown Author';
      acc[author] = (acc[author] || 0) + 1;
    }
    return acc;
  }, {});
  const sortedAudiobookAuthors = Object.entries(audiobookAuthorTally).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // 5. Annual Reading Velocity (with format breakdowns)
  const annualCompletions = allBooks.reduce((acc, b) => {
    if (b.finishedAt) {
      const year = new Date(b.finishedAt).getFullYear();
      if (!isNaN(year)) {
        acc[year] = acc[year] || { total: 0, Physical: 0, Ebook: 0, Audiobook: 0 };
        const type = b.type === 'Physical' ? 'Physical' : (b.type === 'Ebook' ? 'Ebook' : 'Audiobook');
        acc[year].total += 1;
        acc[year][type] += 1;
      }
    }
    return acc;
  }, {});
  const sortedYears = Object.entries(annualCompletions).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxYearCount = Math.max(...Object.values(annualCompletions).map(y => y.total), 1);
  const maxFormatCount = Math.max(...Object.values(annualCompletions).flatMap(y => [y.Physical, y.Ebook, y.Audiobook]), 1);

  // 6. In Reading Queue Tally
  const queueBooksCount = allBooks.filter(b => b.status === 'Queue' || b.inQueue).length;

  // 7. Series Stats
  const seriesGroups = allBooks.reduce((acc, b) => {
    if (b.series) acc[b.series] = (acc[b.series] || 0) + 1;
    return acc;
  }, {});
  const totalSeries = Object.keys(seriesGroups).length;

  return (
    <Shell>
      <div className="pageView">
        <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button>
        <h2 className="pageTitle">Library Insights</h2>
        <p className="pageSubtitle">A visual ledger and dynamic statistics of your personal collection.</p>

        {/* Overview Row */}
        <div className="inventoryHero" style={{ marginBottom: '24px' }}>
          <div className="inventoryStat">
            <div className="statLabel">Total Collection</div>
            <div className="statValue">{totalBooks}</div>
          </div>
          <div className="inventoryStat">
            <div className="statLabel">In Reading Queue</div>
            <div className="statValue">{queueBooksCount}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Volumes waiting on ledger</div>
          </div>
          <div className="inventoryStat">
            <div className="statLabel">Active Series</div>
            <div className="statValue">{totalSeries}</div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="ledgerGrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px', display: 'grid' }}>
          
          {/* Format Composition */}
          <section className="ledgerPanel" style={{ minHeight: 'auto' }}>
            <div className="panelTop">
              <h3>Format Composition</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              {Object.entries(formatTally).map(([format, count]) => {
                const percentage = totalBooks > 0 ? Math.round((count / totalBooks) * 100) : 0;
                return (
                  <div key={format} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <strong>{format}</strong>
                      <span style={{ color: 'var(--muted)' }}>{count} volumes ({percentage}%)</span>
                    </div>
                    <div className="progressContainer" style={{ height: '8px', border: 'none' }}>
                      <div className="progressFill" style={{ width: `${percentage}%`, background: 'var(--blue)', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Reading Velocity Bar Chart */}
          <section className="ledgerPanel" style={{ minHeight: 'auto' }}>
            <div className="panelTop">
              <h3>Annual Reading Velocity</h3>
            </div>
            {sortedYears.length === 0 ? (
              <p className="pageSubtitle" style={{ margin: '20px 0 0' }}>No reading timeline data logged yet.</p>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '140px', marginTop: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--line)' }}>
                  {sortedYears.map(([year, data]) => {
                    return (
                      <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', width: '65px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>{data.total}</span>
                        {/* Side-by-Side Grouped Bars */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '80px', width: '100%', justifyContent: 'center' }}>
                          {/* Physical Bar Group */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            {data.Physical > 0 && <span style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '2px' }}>{data.Physical}</span>}
                            <div style={{ width: '10px', height: `${(data.Physical / maxFormatCount) * 100}%`, background: 'var(--blue)', borderRadius: '2px 2px 0 0', minHeight: data.Physical > 0 ? '2px' : '0' }} title={`${data.Physical} physical finished`} />
                          </div>
                          {/* Ebook Bar Group */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            {data.Ebook > 0 && <span style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '2px' }}>{data.Ebook}</span>}
                            <div style={{ width: '10px', height: `${(data.Ebook / maxFormatCount) * 100}%`, background: '#6d7e9e', borderRadius: '2px 2px 0 0', minHeight: data.Ebook > 0 ? '2px' : '0' }} title={`${data.Ebook} ebook finished`} />
                          </div>
                          {/* Audiobook Bar Group */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                            {data.Audiobook > 0 && <span style={{ fontSize: '9px', color: 'var(--muted)', marginBottom: '2px' }}>{data.Audiobook}</span>}
                            <div style={{ width: '10px', height: `${(data.Audiobook / maxFormatCount) * 100}%`, background: '#b79f7b', borderRadius: '2px 2px 0 0', minHeight: data.Audiobook > 0 ? '2px' : '0' }} title={`${data.Audiobook} audiobook finished`} />
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px', whiteSpace: 'nowrap' }}>{year}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Visual Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '14px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: 'var(--blue)', borderRadius: '3px' }} />
                    <span>Physical</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#6d7e9e', borderRadius: '3px' }} />
                    <span>Ebook</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', background: '#b79f7b', borderRadius: '3px' }} />
                    <span>Audiobook</span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Shelf Occupancy */}
          <section className="ledgerPanel" style={{ minHeight: 'auto' }}>
            <div className="panelTop">
              <h3>Shelf Occupancy</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              {Object.entries(shelfOccupancy).length === 0 ? (
                <p className="pageSubtitle" style={{ margin: 0 }}>No active physical holdings cataloged.</p>
              ) : (
                Object.entries(shelfOccupancy).sort((a,b) => b[1] - a[1]).map(([shelf, count]) => (
                  <div key={shelf} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
                    <span style={{ fontWeight: '500' }}>{shelf}</span>
                    <div style={{ flex: 1, borderBottom: '1px dotted var(--line)', margin: '0 8px' }} />
                    <strong style={{ color: 'var(--blue)' }}>{count} volumes</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Top Collected Authors */}
          <section className="ledgerPanel" style={{ minHeight: 'auto' }}>
            <div className="panelTop">
              <h3>Top Collected Authors</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
              <div>
                <h4 style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '4px', marginTop: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--blue)' }}>Volumes</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {sortedPhysicalEbookAuthors.length === 0 ? (
                    <p className="pageSubtitle" style={{ margin: 0, fontSize: '11px' }}>No authors cataloged.</p>
                  ) : (
                    sortedPhysicalEbookAuthors.map(([author, count]) => (
                      <div key={author} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px' }}>
                        <span style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }} title={author}>{author}</span>
                        <div style={{ flex: 1, borderBottom: '1px dotted var(--line)', margin: '0 4px' }} />
                        <strong style={{ color: 'var(--blue)', flexShrink: 0 }}>{count} vol</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ borderBottom: '1px dashed var(--line)', paddingBottom: '4px', marginTop: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: '16px', color: 'var(--blue)' }}>Audio</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {sortedAudiobookAuthors.length === 0 ? (
                    <p className="pageSubtitle" style={{ margin: 0, fontSize: '11px' }}>No authors cataloged.</p>
                  ) : (
                    sortedAudiobookAuthors.map(([author, count]) => (
                      <div key={author} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px' }}>
                        <span style={{ fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85px' }} title={author}>{author}</span>
                        <div style={{ flex: 1, borderBottom: '1px dotted var(--line)', margin: '0 4px' }} />
                        <strong style={{ color: 'var(--blue)', flexShrink: 0 }}>{count} vol</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </Shell>
  );
}

function CommonplacePage() {
  const navigate = useNavigate();
  const { allBooks } = useLibrary();

  // Aggregate all quotes from all books
  const allQuotes = allBooks.flatMap(b => {
    const quotes = Array.isArray(b.quotes) ? b.quotes : [];
    return quotes.map(q => ({
      ...q,
      bookTitle: b.title,
      bookAuthor: b.author
    }));
  }).sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

  return (
    <Shell>
      <div className="pageView">
        <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button>
        <h2 className="pageTitle">The Commonplace Book</h2>
        <p className="pageSubtitle">A dynamic repository of recorded passages, quotes, and wisdom from your collection.</p>
        {allQuotes.length === 0 ? (
          <p className="pageSubtitle" style={{ marginTop: '20px' }}>No passages recorded yet. Go to any book's page to add a quote!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {allQuotes.map((q, idx) => (
              <div key={idx} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fffdf9', height: 'fit-content', border: '1px solid var(--line)' }}>
                <p style={{ margin: '0', fontStyle: 'italic', fontSize: '14px', lineHeight: 1.45, color: 'var(--ink)' }}>
                  "{q.text}"
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--muted)', borderTop: '1px dashed var(--line)', paddingTop: '8px', marginTop: '6px' }}>
                  <span>{q.page ? `Page ${q.page}` : 'Unrecorded page'}</span>
                  {q.notes && <span style={{ fontWeight: '500', color: 'var(--blue)' }}>{q.notes}</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                  From <Link to={`/book/${encodeURIComponent(q.bookTitle)}`} style={{ fontWeight: 'bold', color: 'var(--blue)', textDecoration: 'underline' }}>{q.bookTitle}</Link> by {q.bookAuthor}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function WishlistPage() {
  const navigate = useNavigate();
  const { allBooks } = useLibrary();

  const wishlistBooks = allBooks.filter(b => b.status === 'Wishlist');

  const handleAcquireBook = async (id) => {
    await updateDoc(doc(db, 'books', id), {
      status: 'Owned',
      price: '',
      purchaseUrl: ''
    });
  };

  return (
    <Shell>
      <div className="pageView">
        <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="pageTitle">The Wishlist Ledger</h2>
          <Link to="/add-book" className="primaryBtn">Add Book</Link>
        </div>
        <p className="pageSubtitle">Books you wish to acquire for your scriptorium collection.</p>
        {wishlistBooks.length === 0 ? (
          <p className="pageSubtitle" style={{ marginTop: '20px' }}>Your Wishlist Ledger is currently empty.</p>
        ) : (
          <div className="detailList" style={{ marginTop: '16px' }}>
            {wishlistBooks.map(item => (
              <div key={item.id} className="detailCard" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                <Link to={`/book/${encodeURIComponent(item.title)}`} style={{ display: 'flex', gap: '14px', flex: '1 1 180px' }}>
                  <div className="detailCover"><BookCover label="Wishlist" coverUrl={item.coverUrl} small muted /></div>
                  <div className="detailMeta">
                    <h4 style={{ color: 'var(--ink)' }}>{item.title}</h4>
                    <div className="author" style={{ color: 'var(--muted)' }}>{item.author}</div>
                    <div className="tags">
                      {item.price && <span className="tag-wishlist-detail" style={{ fontWeight: 'bold' }}>Planned Price: {item.price}</span>}
                      {item.purchaseUrl && <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="purchase-link" style={{ textDecoration: 'underline' }}>Purchase Link</a>}
                    </div>
                  </div>
                </Link>
                <button 
                  onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await handleAcquireBook(item.id); }} 
                  className="primaryBtn" 
                  style={{ padding: '8px 14px', fontSize: '12px', background: '#4a8a52', whiteSpace: 'nowrap', border: 'none', cursor: 'pointer' }}
                >
                  Acquire Volume
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Login() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Shell>
      <div className="pageView">
        <h2 className="pageTitle" style={{ textAlign: 'center' }}>Librarian Access</h2>
        <div className="panel" style={{ maxWidth: '360px', margin: '40px auto', padding: '30px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {error && <p style={{ color: 'red', fontSize: '13px', margin: '0' }}>{error}</p>}
            <div className="searchBar" style={{ margin: 0 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="searchBar" style={{ margin: 0 }}>
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="primaryBtn" style={{ marginTop: '5px', cursor: 'pointer' }}>Log In</button>
          </form>
        </div>
      </div>
    </Shell>
  );
}

export default function App() { 
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [books, setBooks] = React.useState([]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'books'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBooks(data);
    });
    return unsubscribe;
  }, [user]);

  if (loading) return <div className="page" style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Cormorant Garamond', fontSize: '24px' }}>Loading...</div>;

  if (!user) {
    return <BrowserRouter><Login /></BrowserRouter>;
  }

  const stacks = books.filter(b => b.type === 'Physical' && ['Owned', 'On Loan', 'Currently Reading', 'Borrowed'].includes(b.status));
  const archives = books.filter(b => (b.type === 'Ebook' || b.type === 'Audiobook') && ['Owned', 'On Loan', 'Currently Reading', 'Borrowed'].includes(b.status));
  const departures = books.filter(b => ['Gifted', 'Sold', 'Donated'].includes(b.status));
  const queue = books.filter(b => b.status === 'Queue' || b.inQueue).sort((a, b) => {
    if (a.queueOrder !== undefined && b.queueOrder !== undefined) return a.queueOrder - b.queueOrder;
    if (a.queueOrder !== undefined) return -1;
    if (b.queueOrder !== undefined) return 1;
    return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
  });
  const recent = [...books].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 5);
  
  const libraryData = { stacks, archives, departures, queue, recent, allBooks: books };

  return (
    <BookContext.Provider value={libraryData}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stacks" element={<StacksPage />} />
          <Route path="/archives" element={<ArchivesPage />} />
          <Route path="/circulation" element={<CirculationPage />} />
          <Route path="/reading-ledger" element={<ReadingLedgerPage />} />
          <Route path="/departures" element={<DeparturesPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/book/:title" element={<BookPage />} />
          <Route path="/add-book" element={<BookForm />} />
          <Route path="/edit-book/:id" element={<BookForm />} />
          <Route path="/series" element={<SeriesPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/commonplace" element={<CommonplacePage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
        </Routes>
      </BrowserRouter>
    </BookContext.Provider>
  ); 
}








