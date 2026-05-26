import React from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import './styles.css'
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
  const annals = allBooks.filter(b => b.finishedAt).sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 8);
  const homeAnnalsGrouped = annals.reduce((acc, b) => { const y = new Date(b.finishedAt).getFullYear(); acc[y] = acc[y] || []; acc[y].push(b); return acc; }, {});
  const recentDepartures = [...departures].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 3);
  
  return (<Shell>
  <section className="panel hero"><div className="heroText"><div className="kicker">On the Desk.</div><h2>{currentlyReading ? currentlyReading.title : 'Nothing currently on the desk'}</h2><p>{currentlyReading ? currentlyReading.reading : 'No active reading progress logged.'}</p></div>{currentlyReading && <Link to={`/book/${encodeURIComponent(currentlyReading.title)}`} className="primaryBtn" style={{textAlign:'center'}}>View Log</Link>}</section>
  <section className="plaqueGrid"><Link to="/stacks" className="plaque linkCard"><h3>The Stacks</h3><div className="count">{stacks.length} Physical Volumes</div><p>Active physical holdings, on shelves or on loan.</p></Link><Link to="/archives" className="plaque linkCard"><h3>The Archives</h3><div className="count">{archives.length} Digital Volumes</div><p>Cataloged ebooks and audiobooks.</p></Link></section>
  <section className="middleGrid"><Link to="/reading-ledger" className="panel linkCard"><h3>Recently Cataloged</h3>{recent.length === 0 && <p className="pageSubtitle">No recently cataloged books.</p>}<div className="coverRow">{recent.map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /><div className="caption">New</div></div>)}</div><h3 className="queueTitle">The Queue</h3>{queue.length === 0 && <p className="pageSubtitle">Your queue is empty.</p>}<div className="coverRow">{queue.slice(0, 5).map((b) => <div key={b.id} className="mini"><BookCover label={b.title} coverUrl={b.coverUrl} small /></div>)}</div></Link><Link to="/reading-ledger" className="panel linkCard timeline"><h3>The Annals</h3>{annals.length === 0 ? <p className="pageSubtitle">No reading history.</p> : Object.entries(homeAnnalsGrouped).sort((a,b)=>b[0]-a[0]).map(([year, books]) => <div key={year} style={{marginBottom:'12px'}}><div className="year" style={{marginBottom:'6px'}}>{year}</div>{books.map(b => <div key={b.id} className="entry" style={{marginBottom:'8px'}}>Finished {b.title} &middot; {new Date(b.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</div>)}</div>)}</Link></section>
  <section className="bottomGrid"><Link to="/circulation" className="panel linkCard"><h3>The Circulation Desk</h3>{stacks.filter(b => b.status === 'On Loan').length === 0 ? <p className="pageSubtitle">No books currently on loan.</p> : stacks.filter(b => b.status === 'On Loan').map(b => <div key={b.id || b.title} className="bookCard"><BookCover label="On Loan" coverUrl={b.coverUrl} small /><div><h4>{b.title}</h4><p>{b.author}</p><div className="tags"><span style={{ backgroundColor: '#fff0eb', borderColor: '#ffcbb3', color: '#b34700' }}>On Loan to {b.borrower}</span>{b.dueAt && <span>Due {new Date(b.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>}</div></div></div>)}</Link><Link to="/departures" className="panel linkCard"><h3>The Ledger of Departures</h3>{recentDepartures.length === 0 && <p className="pageSubtitle">No departed books.</p>}{recentDepartures.map(d => <div key={d.title} className="bookCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>Archived</span></div></div></div>)}</Link></section>
  <footer className="footerLinks"><Link to="/circulation">Circulation List</Link><Link to="/series">The Series</Link><Link to="/catalog">Detailed Catalog</Link><Link to="/insights">Library Insights</Link><Link to="/departures">Past Departures</Link></footer>
</Shell>) }

function BookCard({ item }) { const location = useLocation(); return <Link to={`/book/${encodeURIComponent(item.title)}`} state={{ from: location.pathname }} className="detailCard"><div className="detailCover"><BookCover label={item.title} coverUrl={item.coverUrl} small /></div><div className="detailMeta"><h4>{item.title}</h4><div className="author">{item.author}</div><div className="tags">{item.status === 'On Loan' && item.borrower && <span style={{ backgroundColor: '#fff0eb', borderColor: '#ffcbb3', color: '#b34700' }}>On Loan to {item.borrower}{item.dueAt ? ` (Due ${new Date(item.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' })})` : ' (No due date)'}</span>}{item.series && <span style={{backgroundColor:'#e8ebf2',borderColor:'#c1c9dd',color:'#4a5d85'}}>{item.series}{item.seriesNumber ? ` #${item.seriesNumber}` : ''}</span>}{(item.tags||[]).map(t => <span key={t}>{t}</span>)}</div></div></Link> }
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

  const moveQueueItem = async (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === queue.length - 1) return;
    const newQueue = [...queue];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    const batch = writeBatch(db);
    newQueue.forEach((q, i) => {
      batch.update(doc(db, 'books', q.id), { queueOrder: i });
    });
    await batch.commit();
  };

  return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><h2 className="pageTitle">The Reading Ledger</h2><p className="pageSubtitle">Queue and completed reading annals.</p><div className="ledgerGrid"><section className="ledgerPanel"><div className="panelTop"><h3>The Queue</h3><div style={{display:'flex',gap:'8px'}}>{managing ? <><button onClick={selectAll} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'var(--muted)'}}>{selected.size === queue.length ? 'Deselect All' : 'Select All'}</button><button onClick={deleteSelected} disabled={selected.size===0} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:selected.size===0?'#ccc':'#c94a4a'}}>Delete ({selected.size})</button><button onClick={()=>setManaging(false)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Done</button></> : <button onClick={()=>setManaging(true)} className="primaryBtn" style={{padding:'4px 10px',fontSize:'12px',background:'transparent',color:'var(--muted)',border:'1px solid var(--muted)'}}>Manage</button>}<div className="panelPill">{queue.length} books</div></div></div>{queue.length === 0 && <p className="pageSubtitle">Queue is empty.</p>}<div className="detailList" style={{ marginTop: '12px' }}>{queue.map((q, index) => managing ? <div key={q.id} className="detailCard" onClick={() => toggleSelect(q.id)} style={{cursor: 'pointer', transition: 'all 0.1s', opacity: !selected.has(q.id) ? 0.7 : 1, boxShadow: selected.has(q.id) ? '0 0 0 4px #c94a4a' : undefined, border: selected.has(q.id) ? '1px solid transparent' : undefined}}><div className="detailCover"><BookCover label={q.title} coverUrl={q.coverUrl} small /></div><div className="detailMeta"><h4>{q.title}</h4><div className="author">{q.author}</div><div className="tags">{(q.tags||[]).map(t => <span key={t}>{t}</span>)}</div></div></div> : <div key={q.id} className="detailCard" style={{display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between'}}><div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}><button onClick={() => moveQueueItem(index, 'up')} disabled={index===0} style={{border:'none',background:'transparent',cursor:index===0?'default':'pointer',color:index===0?'var(--line)':'var(--blue)',fontSize:'16px',padding:0}}>▲</button><button onClick={() => moveQueueItem(index, 'down')} disabled={index===queue.length-1} style={{border:'none',background:'transparent',cursor:index===queue.length-1?'default':'pointer',color:index===queue.length-1?'var(--line)':'var(--blue)',fontSize:'16px',padding:0}}>▼</button></div><Link to={`/book/${encodeURIComponent(q.title)}`} style={{display: 'flex', gap: '14px', flex: '1 1 180px'}}><div className="detailCover"><BookCover label={q.title} coverUrl={q.coverUrl} small /></div><div className="detailMeta"><h4 style={{color: 'var(--ink)'}}>{q.title}</h4><div className="author" style={{color: 'var(--muted)'}}>{q.author}</div><div className="tags">{q.series && <span style={{backgroundColor:'#e8ebf2',borderColor:'#c1c9dd',color:'#4a5d85'}}>{q.series}{q.seriesNumber ? ` #${q.seriesNumber}` : ''}</span>}{(q.tags||[]).map(t => <span key={t}>{t}</span>)}</div></div></Link><button onClick={async (e) => { e.preventDefault(); e.stopPropagation(); await updateDoc(doc(db, 'books', q.id), { status: 'Currently Reading', inQueue: false, startedAt: new Date().toISOString().split('T')[0] }); }} className="primaryBtn" style={{padding:'6px 12px', fontSize:'12px', background:'var(--muted)', whiteSpace: 'nowrap'}}>Read Now</button></div>)}</div><div className="ledgerStats"><div><span>Queue</span><strong>{queue.length}</strong></div><div><span>Completed</span><strong>{annals.length}</strong></div></div></section><section className="ledgerPanel annalsPanel"><div className="panelTop"><h3>The Annals</h3><div className="panelPill">Yearly timeline</div></div><div className="timelineBlock">{annals.length === 0 ? <p className="pageSubtitle">No history available.</p> : Object.entries(groupedAnnals).sort((a,b)=>b[0]-a[0]).map(([year, books]) => <div key={year} style={{marginBottom: "16px"}}><div className="year" style={{marginBottom: "8px"}}>{year}</div>{books.map(b => <div key={b.id} className="entry" style={{borderLeft: "2px solid var(--line)", paddingLeft: "10px", marginLeft: "4px", marginBottom: "8px"}}>Finished {b.title} &middot; {new Date(b.finishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</div>)}</div>)}</div></section></div></div></Shell>;
}
function DeparturesPage() { const navigate = useNavigate(); const { departures } = useLibrary(); return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><h2 className="pageTitle">The Ledger of Departures</h2><p className="pageSubtitle">Books that left the collection permanently.</p><div className="departuresGrid">{departures.map(d => <div key={d.id} className="departureCard"><BookCover label={d.status} coverUrl={d.coverUrl} small muted /><div><h4>{d.title}</h4><p>{d.status}</p><div className="tags"><span>{d.status}</span><span>Archived</span></div></div></div>)}</div></div></Shell> }
function CatalogPage() { const navigate = useNavigate(); const { allBooks } = useLibrary(); const [query, setQuery] = React.useState(''); const [typeFilter, setTypeFilter] = React.useState('All'); const [statusFilter, setStatusFilter] = React.useState('All'); const filtered = allBooks.filter(i => { const matchesQuery = `${i.title} ${i.author} ${(i.tags||[]).join(' ')}`.toLowerCase().includes(query.toLowerCase()); const matchesType = typeFilter === 'All' || i.type === typeFilter; const matchesStatus = statusFilter === 'All' || i.status === statusFilter || (statusFilter === 'Queue' && i.inQueue); return matchesQuery && matchesType && matchesStatus; }); return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Back</button><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2 className="pageTitle">Detailed Catalog</h2><div style={{display: "flex", gap: "10px"}}><GoodreadsImporter /><Link to="/add-book" className="primaryBtn">Add Book</Link></div></div><p className="pageSubtitle">A complete inventory view of the collection.</p><div className="searchBar" style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px'}}><input style={{flex: '1 1 250px'}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the full catalog..." /><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{flex: '0 1 auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: '#fffaf6', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', outline: 'none'}}><option value="All">All Formats</option><option value="Physical">Physical</option><option value="Ebook">Ebook</option><option value="Audiobook">Audiobook</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{flex: '0 1 auto', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '999px', background: '#fffaf6', font: 'inherit', color: 'var(--ink)', cursor: 'pointer', outline: 'none'}}><option value="All">All Statuses</option><option value="Owned">Owned</option><option value="Queue">In Queue</option><option value="Currently Reading">Currently Reading</option><option value="On Loan">On Loan</option><option value="Borrowed">Borrowed</option><option value="Sold">Sold</option><option value="Donated">Donated</option><option value="Gifted">Gifted</option></select></div><div className="detailList">{filtered.map(item => <BookCard key={item.id} item={item} />)}</div></div></Shell> }
function BookPage() { 
  const navigate = useNavigate(); 
  const location = useLocation();
  const { allBooks } = useLibrary();
  const { title } = useParams(); 
  const decoded = decodeURIComponent(title || ''); 
  const item = allBooks.find(b => b.title === decoded) || { author: 'Unknown Author', status: 'Unknown', location: 'Unassigned', cataloged: 'Unknown', provenance: 'No notes.', reading: 'No log.', ownership: 'Unknown.' }; 
  
  const fromPath = location.state?.from || '';
  let backLabel = '← Back';
  if (fromPath.includes('/stacks')) backLabel = '← Back to The Stacks';
  else if (fromPath.includes('/archives')) backLabel = '← Back to The Archives';
  else if (fromPath.includes('/circulation')) backLabel = '← Back to Circulation';
  else if (fromPath.includes('/reading-ledger')) backLabel = '← Back to Ledger';
  else if (fromPath.includes('/catalog')) backLabel = '← Back to Catalog';
  else if (fromPath === '/') backLabel = '← Back to Home';
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

  return <Shell><div className="pageView"><button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>{backLabel}</button><div className="bookHero"><BookCover label={decoded || 'Book'} coverUrl={item.coverUrl} /><div className="bookHeroText"><div style={{display:'flex',justifyContent:'space-between'}}><h2 className="pageTitle">{decoded}</h2><div style={{display:'flex',gap:'10px'}}>{item.status === 'Currently Reading' && <button onClick={handleFinish} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center'}}>Finish Book</button>}{item.status === 'On Loan' && <button onClick={handleReturn} className="primaryBtn" style={{padding:'4px 10px',fontSize:'10px',height:'fit-content',alignSelf:'center',backgroundColor:'#a05252',border:'none',cursor:'pointer'}}>Return Book</button>}{item.id && <Link to={`/edit-book/${item.id}`} className="backLink" style={{alignSelf:'center',marginBottom:0}}>Edit</Link>}</div></div><div className="author bookHeroAuthor">{item.author}</div>{item.series && <div style={{marginBottom:'8px',fontSize:'14px',color:'var(--blue)',fontStyle:'italic'}}><strong>{item.series}</strong> {item.seriesNumber ? `· Book ${item.seriesNumber}` : ''}</div>}<div className="tags"><span>{item.status}</span><span>{item.location || 'Unassigned'}</span></div><div className="bookMetaGrid"><div><span>Status</span><strong>{item.status}</strong></div><div><span>Location</span><strong>{item.location || 'Unassigned'}</strong></div><div><span>Cataloged</span><strong>{item.cataloged}</strong></div></div></div></div>{((item.status === 'On Loan' && item.borrower) || (Array.isArray(item.loans) && item.loans.length > 0)) && (<div className="panel" style={{ marginTop: '14px', background: '#fffcf7', border: '1px solid #d8c6ad', padding: '16px', borderRadius: '12px' }}><h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '24px', margin: '0 0 10px 0', color: 'var(--blue)' }}>Lending Registry</h3>{item.status === 'On Loan' && (<div style={{ marginBottom: '14px', background: '#fff0eb', border: '1px solid #ffcbb3', padding: '12px 14px', borderRadius: '8px', color: '#b34700', fontSize: '13px' }}><strong>Currently Lent To:</strong> <span style={{fontSize: '14px', fontWeight: 'bold'}}>{item.borrower}</span><div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}><span><strong>Date Lent:</strong> {item.lentAt ? new Date(item.lentAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'Unrecorded'}</span><span><strong>Date Due:</strong> {item.dueAt ? new Date(item.dueAt).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No due date / Open loan'}</span></div></div>)}{Array.isArray(item.loans) && item.loans.length > 0 && (<div><h4 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', margin: '0 0 8px 0', color: 'var(--muted)' }}>Past Circulations</h4><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{item.loans.map((loan, idx) => (<div key={idx} style={{ borderLeft: '2px solid var(--line)', paddingLeft: '10px', marginLeft: '4px', fontSize: '12px', color: 'var(--muted)' }}>Lent to <strong>{loan.borrower}</strong> &middot;{' '}{loan.lentAt ? new Date(loan.lentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unrecorded'}{' '}to{' '}{loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'Unrecorded'}</div>))}</div></div>)}</div>)}<div className="bookDetailSections"><section className="bookDetailSection"><h3>Provenance</h3><p>{item.provenance}</p></section><section className="bookDetailSection"><h3>Reading Log</h3><div style={{marginBottom:'10px',fontSize:'13px',color:'var(--muted)'}}>{item.startedAt && <div style={{marginBottom:'4px'}}><strong>Started:</strong> {new Date(item.startedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</div>}{item.finishedAt && <div><strong>Finished:</strong> {new Date(item.finishedAt).toLocaleDateString('en-US', {timeZone: 'UTC'})}</div>}</div><p>{item.reading}</p></section><section className="bookDetailSection"><h3>Ownership</h3><p>{item.ownership}</p></section></div></div></Shell> 
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

  // 4. Tag/Subject Cloud
  const tagTally = allBooks.reduce((acc, b) => {
    const tags = Array.isArray(b.tags) ? b.tags : (typeof b.tags === 'string' ? b.tags.split(',').map(t => t.trim()) : []);
    tags.forEach(t => {
      if (t) acc[t] = (acc[t] || 0) + 1;
    });
    return acc;
  }, {});
  const sortedTags = Object.entries(tagTally).sort((a, b) => b[1] - a[1]).slice(0, 10);

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
                    <div style={{ height: '8px', background: '#efe4d0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--blue)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
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
              <div className="panelPill">Physical holdings</div>
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

          {/* Subject Frequency */}
          <section className="ledgerPanel" style={{ minHeight: 'auto' }}>
            <div className="panelTop">
              <h3>Top Collected Subjects</h3>
              <div className="panelPill">Tag tally</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              {sortedTags.length === 0 ? (
                <p className="pageSubtitle" style={{ margin: 0 }}>No tags cataloged yet.</p>
              ) : (
                sortedTags.map(([tag, count]) => (
                  <div key={tag} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
                    <span style={{ fontWeight: '500', background: '#efe4d0', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>{tag}</span>
                    <div style={{ flex: 1, borderBottom: '1px dotted var(--line)', margin: '0 8px' }} />
                    <strong style={{ color: 'var(--blue)' }}>{count} times</strong>
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
        </Routes>
      </BrowserRouter>
    </BookContext.Provider>
  ); 
}








