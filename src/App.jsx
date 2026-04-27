import React from 'react'
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom'
import './styles.css'
import { auth, db } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, onSnapshot, query, writeBatch, doc } from 'firebase/firestore'
import BookForm from './BookForm'
import GoodreadsImporter from './GoodreadsImporter'

const BookContext = React.createContext({ stacks:[], archives:[], departures:[], queue:[], recent:[], allBooks:[] });
function useLibrary() { return React.useContext(BookContext); }

function BookCover({ label, small, muted, coverUrl }) { 
  if (coverUrl) return <img src={coverUrl} alt={label} className={`bookCover ${small ? 'small' : ''} ${muted ? 'mutedCover' : ''}`} style={{ objectFit: 'cover', padding: 0, border: '1px solid #c7b8a4' }} />;
  return <div className={`bookCover ${small ? 'small' : ''} ${muted ? 'mutedCover' : ''}`}>{label}</div>;
}
function Header() { 
  const handleLogout = () => { if (auth.currentUser) signOut(auth); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="titleRow">
        <span className="ornament" /><h1>Benedict Library</h1><span className="ornament" />
      </div>
      {auth.currentUser && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '-10px', marginBottom: '16px' }}>
          <Link to="/add-book" className="backLink" style={{ cursor: 'pointer', fontSize: '10px', padding: '4px 10px', background: 'var(--blue)', color: '#fff', border: 'none' }}>+ Add Book</Link>
          <button onClick={handleLogout} className="backLink" style={{ cursor: 'pointer', fontSize: '10px', padding: '4px 10px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' }}>Log Out</button>
        </div>
      )}
    </div>
  ); 
}
function Shell({ children }) { return <div className="page"><Header />{children}</div> }

function Home() { 
  const { stacks, archives, departures, queue, recent, allBooks } = useLibrary();
  const currentlyReading = allBooks.find(b => b.status === 'Currently Reading');
  const annals = allBooks.filter(b => b.finishedAt).sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 5);
  
  return (<Shell>
  <section className="panel hero"><div className="heroText"><div className="kicker">On the Desk.</div><h2>{currentlyReading ? currentlyReading.title : 'Nothing currently on the desk'}</h2><p>{currentlyReading ? currentlyReading.reading : 'No active reading progress logged.'}</p></div>{currentlyReading && <Link to={`/book/${encodeURIComponent(currentlyReading.title)}`} className="primaryBtn" style={{textAlign:'center'}}>View Log</Link>}</section>
  <section className="plaqueGrid"><Link to="/stacks" className="plaque linkCard"><h3>The Stacks</h3><div className="count">{stacks.length} Physical Volumes</div><p>Active physical holdings, on shelves or on loan.</p></Link><Link to="/archives" className="plaque linkCard"><h3>The Archives</h3><div className="count">{archives.length} Digital Volumes</div><p>Cataloged ebooks and audiobooks.</p></Link></section>
  <section className="middleGrid"><Link to="/reading-ledger" className="panel linkCard"><h3>Recently Cataloged</h3>{recent.length === 0 && <p className="pageSubtitle">No recently cataloged books.</p>}<div className="coverRow">{recent.map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /><div className="caption">New</div></div>)}</div><h3 className="queueTitle">The Queue</h3>{queue.length === 0 && <p className="pageSubtitle">Your queue is empty.</p>}<div className="coverRow">{queue.slice(0, 5).map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /></div>)}</div></Link><Link to="/reading-ledger" className="panel linkCard timeline"><h3>The Annals</h3>{annals.length === 0 ? <p className="pageSubtitle">No reading history.</p> : annals.map(b => <div key={b.id} className="entry"><div className="year">{new Date(b.finishedAt).getFullYear()}</div><div>Finished {b.title} · {new Date(b.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div></div>)}</Link></section>
  <section className="bottomGrid"><Link to="/circulation" className="panel linkCard"><h3>The Circulation Desk</h3>{stacks.filter(b => b.status === 'On Loan').length === 0 ? <p className="pageSubtitle">No books currently on loan.</p> : stacks.filter(b => b.status === 'On Loan').map(b => <div key={b.title} className="bookCard"><BookCover label="On Loan" coverUrl={b.coverUrl} small /><div><h4>{b.title}</h4><p>{b.author}</p><div className="tags"><span>On Loan</span></div></div></div>)}</Link><Link to="/departures" className="panel linkCard"><h3>The Ledger of Departures</h3>{departures.length === 0 && <p className="pageSubtitle">No departed books.</p>}{departures.map(d => <div key={d.title} className="bookCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>Archived</span></div></div></div>)}</Link></section>
  <footer className="footerLinks"><Link to="/circulation">Circulation List</Link><Link to="/catalog">Detailed Catalog</Link><Link to="/departures">Past Departures</Link></footer>
</Shell>) }

function BookCard({ item }) { return <Link to={`/book/${encodeURIComponent(item.title)}`} className="detailCard"><div className="detailCover"><BookCover label={item.title} coverUrl={item.coverUrl} small /></div><div className="detailMeta"><h4>{item.title}</h4><div className="author">{item.author}</div><div className="tags">{(item.tags||[]).map(t => <span key={t}>{t}</span>)}</div></div></Link> }
function InventoryPage({ title, subtitle, items, hero }) { const [query, setQuery] = React.useState(''); const filtered = items.filter(i => `${i.title} ${i.author} ${(i.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase())); return <Shell><div className="pageView"><Link className="backLink" to="/">← Back</Link><h2 className="pageTitle">{title}</h2><p className="pageSubtitle">{subtitle}</p>{hero}<div className="searchBar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search titles, authors, tags..." /></div><div className="detailList">{filtered.map(item => <BookCard key={item.id} item={item} />)}</div></div></Shell> }
function StacksPage() { const { stacks } = useLibrary(); return <InventoryPage title="The Stacks" subtitle="Physical holdings with locations, tags, and ownership details." items={stacks} hero={<div className="inventoryHero"><div className="inventoryStat"><div className="statLabel">Physical Volumes</div><div className="statValue">{stacks.length}</div></div><div className="inventoryStat"><div className="statLabel">On Loan</div><div className="statValue">{stacks.filter(b=>b.status === 'On Loan').length}</div></div><div className="inventoryStat"><div className="statLabel">Signed</div><div className="statValue">{stacks.filter(b=>(b.tags||[]).includes('Signed')).length}</div></div></div>} /> }
function ArchivesPage() { const { archives } = useLibrary(); return <InventoryPage title="The Archives" subtitle="Digital holdings and future local-file support." items={archives} hero={<div className="inventoryHero"><div className="inventoryStat"><div className="statLabel">Digital Volumes</div><div className="statValue">{archives.length}</div></div><div className="inventoryStat"><div className="statLabel">Audiobooks</div><div className="statValue">{archives.filter(b=>b.type === 'Audiobook').length}</div></div><div className="inventoryStat"><div className="statLabel">Local Files</div><div className="statValue">0</div></div></div>} /> }
function CirculationPage() { const { stacks } = useLibrary(); const loaned = stacks.filter(b=>b.status === 'On Loan'); return <InventoryPage title="The Circulation Desk" subtitle="Books currently out on loan and active circulation status." items={loaned} hero={<div className="inventoryHero"><div className="inventoryStat"><div className="statLabel">Out on Loan</div><div className="statValue">{loaned.length}</div></div><div className="inventoryStat"><div className="statLabel">Due This Week</div><div className="statValue">0</div></div><div className="inventoryStat"><div className="statLabel">Borrowers</div><div className="statValue">0</div></div></div>} /> }
function ReadingLedgerPage() {
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

  return <Shell><div className="pageView"><Link className="backLink" to="/">← Back</Link><h2 className="pageTitle">The Reading Ledger</h2><p className="pageSubtitle">Queue and completed reading annals.</p><div className="ledgerGrid" style={{gridTemplateColumns: "1fr 1fr"}}><section className="ledgerPanel"><div className="panelTop"><h3>The Queue</h3><div style={{display:'flex',gap:'8px'}}>{managing ? <><button onClick={selectAll} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'var(--muted)'}}>{selected.size === queue.length ? 'Deselect All' : 'Select All'}</button><button onClick={deleteSelected} disabled={selected.size===0} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:selected.size===0?'#ccc':'#c94a4a'}}>Delete ({selected.size})</button><button onClick={()=>setManaging(false)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Done</button></> : <button onClick={()=>setManaging(true)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Manage</button>}<div className="panelPill">{queue.length} books</div></div></div>{queue.length === 0 && <p className="pageSubtitle">Queue is empty.</p>}<div className="coverRow wrap largeQueue">{queue.map((q) => <div key={q.id} className="queueThumb" onClick={() => toggleSelect(q.id)} style={{cursor: managing ? 'pointer' : 'default', transition: 'all 0.1s', transform: selected.has(q.id) ? 'scale(0.95)' : 'none', opacity: managing && !selected.has(q.id) ? 0.7 : 1, boxShadow: selected.has(q.id) ? '0 0 0 4px #c94a4a' : 'none', borderRadius: '4px'}}><BookCover label={q.title} coverUrl={q.coverUrl} small /></div>)}</div><div className="ledgerStats"><div><span>Queue</span><strong>{queue.length}</strong></div><div><span>Completed</span><strong>{annals.length}</strong></div></div></section><section className="ledgerPanel annalsPanel"><div className="panelTop"><h3>The Annals</h3><div className="panelPill">Yearly timeline</div></div><div className="timelineBlock">{annals.length === 0 ? <p className="pageSubtitle">No history available.</p> : Object.entries(groupedAnnals).sort((a,b)=>b[0]-a[0]).map(([year, books]) => <div key={year} style={{marginBottom: "16px"}}><div className="year" style={{marginBottom: "8px"}}>{year}</div>{books.map(b => <div key={b.id} className="entry" style={{borderLeft: "2px solid var(--line)", paddingLeft: "10px", marginLeft: "4px", marginBottom: "8px"}}>Finished {b.title} &middot; {new Date(b.finishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>)}</div>)}</div></section></div></div></Shell>;
}
function DeparturesPage() { const { departures } = useLibrary(); return <Shell><div className="pageView"><Link className="backLink" to="/">← Back</Link><h2 className="pageTitle">The Ledger of Departures</h2><p className="pageSubtitle">Books that left the collection permanently.</p><div className="departuresGrid">{departures.map(d => <div key={d.id} className="departureCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>{d.status}</span><span>Archived</span></div></div></div>)}</div></div></Shell> }
function CatalogPage() { const { allBooks } = useLibrary(); return <Shell><div className="pageView"><Link className="backLink" to="/">← Back</Link><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 className="pageTitle">Detailed Catalog</h2><div style={{display: "flex", gap: "10px"}}><GoodreadsImporter /><Link to="/add-book" className="primaryBtn">Add Book</Link></div></div><p className="pageSubtitle">A complete inventory view of the collection.</p><div className="searchBar"><input placeholder="Search the full catalog..." /></div><div className="detailList">{allBooks.map(item => <BookCard key={item.id} item={item} />)}</div></div></Shell> }
function BookPage() { 
  const { allBooks } = useLibrary();
  const { title } = useParams(); 
  const decoded = decodeURIComponent(title || ''); 
  const item = allBooks.find(b => b.title === decoded) || { author: 'Unknown Author', status: 'Unknown', location: 'Unassigned', cataloged: 'Unknown', provenance: 'No notes.', reading: 'No log.', ownership: 'Unknown.' }; 
  return <Shell><div className="pageView"><Link className="backLink" to="/">← Back</Link><div className="bookHero"><BookCover label={decoded || 'Book'} coverUrl={item.coverUrl} /><div className="bookHeroText"><div style={{display:'flex',justifyContent:'space-between'}}><h2 className="pageTitle">{decoded}</h2>{item.id && <Link to={`/edit-book/${item.id}`} className="backLink" style={{alignSelf:'center',marginBottom:0}}>Edit</Link>}</div><div className="author bookHeroAuthor">{item.author}</div><div className="tags"><span>{item.status}</span><span>{item.location}</span></div><div className="bookMetaGrid"><div><span>Status</span><strong>{item.status}</strong></div><div><span>Location</span><strong>{item.location}</strong></div><div><span>Cataloged</span><strong>{item.cataloged}</strong></div></div></div></div><div className="bookDetailSections"><section className="bookDetailSection"><h3>Provenance</h3><p>{item.provenance}</p></section><section className="bookDetailSection"><h3>Reading Log</h3><div style={{marginBottom:'10px',fontSize:'13px',color:'var(--muted)'}}>{item.startedAt && <div style={{marginBottom:'4px'}}><strong>Started:</strong> {new Date(item.startedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</div>}{item.finishedAt && <div><strong>Finished:</strong> {new Date(item.finishedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</div>}</div><p>{item.reading}</p></section><section className="bookDetailSection"><h3>Ownership</h3><p>{item.ownership}</p></section></div></div></Shell> 
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
  const queue = books.filter(b => b.status === 'Queue');
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
        </Routes>
      </BrowserRouter>
    </BookContext.Provider>
  ); 
}








