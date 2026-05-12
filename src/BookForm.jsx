import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

function Shell({ children }) { 
  return (
    <div className="page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="titleRow">
          <span className="ornament" />
          <h1>Benedict Library</h1>
          <span className="ornament" />
        </div>
      </div>
      {children}
    </div>
  ); 
}

const defaultBook = {
  title: '',
  author: '',
  type: 'Physical',
  status: 'Owned',
  location: '',
  tags: '',
  cataloged: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  startedAt: '',
  finishedAt: '',
  provenance: '',
  reading: '',
  ownership: '',
  coverUrl: '',
  isbn: ''
};

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(defaultBook);
  const [loading, setLoading] = useState(!!id);
  const [fetchingCover, setFetchingCover] = useState(false);
  const [customLocations, setCustomLocations] = useState(() => {
    try { return JSON.parse(localStorage.getItem('benedict_locations')) || []; } catch(e) { return []; }
  });
  const [showOtherLocation, setShowOtherLocation] = useState(false);
  const [saveNewLocation, setSaveNewLocation] = useState(true);

  const allLocations = Array.from(new Set(['Living Room Shelf', 'Office', 'Bedroom', ...customLocations]));

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'books', id)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            ...data,
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : ''
          });
          if (data.location && !allLocations.includes(data.location)) {
            setShowOtherLocation(true);
          }
        }
        setLoading(false);
      });
    } else {
      setFormData(prev => ({ ...prev, location: allLocations[0] }));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFetchCover = async () => {
    if (!formData.title && !formData.isbn) return alert('Please enter a title or ISBN first.');
    setFetchingCover(true);
    try {
      let url = null;

      // 1. If ISBN is provided, try OpenLibrary directly for the highest quality cover
      if (formData.isbn) {
        const cleanIsbn = formData.isbn.replace(/-/g, '').trim();
        const olRes = await fetch(`https://openlibrary.org/search.json?isbn=${cleanIsbn}`);
        const olData = await olRes.json();
        const coverId = olData.docs?.[0]?.cover_i;
        if (coverId) url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
        
        // Try Google Books by ISBN if OL fails
        if (!url) {
          const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`);
          const gbData = await gbRes.json();
          url = gbData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
        }
      }

      // 2. Try Google Books with a relaxed text search (much better hit rate than intitle:)
      if (!url && formData.title) {
        const q = `${formData.title} ${formData.author || ''}`.trim();
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`);
        const data = await res.json();
        url = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      }

      // 3. Try OpenLibrary text search as a final fallback
      if (!url && formData.title) {
        const olRes = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(formData.title)}${formData.author ? '&author='+encodeURIComponent(formData.author) : ''}&limit=1`);
        if (olRes.ok) {
          const olData = await olRes.json();
          const coverId = olData.docs?.[0]?.cover_i;
          if (coverId) url = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
        }
      }

      if (url) {
        setFormData(prev => ({ ...prev, coverUrl: url.replace('http:', 'https:') }));
      } else {
        alert('No cover found on Google Books or OpenLibrary. You may need to paste an image URL manually.');
      }
    } catch (e) {
      alert('Error fetching cover. Check your connection or try entering an ISBN.');
    }
    setFetchingCover(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (showOtherLocation && saveNewLocation && formData.location && !allLocations.includes(formData.location)) {
      const newLocations = [...customLocations, formData.location];
      setCustomLocations(newLocations);
      localStorage.setItem('benedict_locations', JSON.stringify(newLocations));
    }
    const dataToSave = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
    };

    if (id) {
      await setDoc(doc(db, 'books', id), dataToSave, { merge: true });
    } else {
      await addDoc(collection(db, 'books'), { ...dataToSave, createdAt: new Date() });
    }
    navigate(-1);
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to permanently delete this book?")) {
      await deleteDoc(doc(db, 'books', id));
      navigate('/');
    }
  };

  if (loading) return <Shell><div className="pageView" style={{textAlign: 'center'}}>Loading...</div></Shell>;

  return (
    <Shell>
      <div className="pageView">
        <button type="button" className="backLink" onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'var(--blue)' }}>← Cancel</button>
        <h2 className="pageTitle">{id ? 'Edit Book' : 'Catalog New Book'}</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          <div className="panel" style={{ display: 'grid', gap: '15px' }}>
            <div className="searchBar" style={{ margin: 0 }}>
              <div style={{display:"flex", justifyContent:"space-between"}}><label style={{display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--muted)"}}>Title</label><button type="button" onClick={handleFetchCover} disabled={fetchingCover} style={{fontSize:"10px", padding:"2px 6px", borderRadius:"4px", background:fetchingCover?"#d8c6ad":"#efe4d0", border:"1px solid #d8c6ad", cursor:fetchingCover?"wait":"pointer", color:"#6d5d48"}}>{fetchingCover ? 'Fetching...' : 'Fetch Cover API'}</button></div>
              <input name="title" value={formData.title} onChange={handleChange} required />
            </div>
            
            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Author</label>
              <input name="author" value={formData.author} onChange={handleChange} required />
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>ISBN (Optional - highly recommended for accurate covers)</label>
              <input name="isbn" value={formData.isbn || ''} onChange={handleChange} placeholder="e.g. 9780143127550" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Format Type</label>
                <select name="type" value={formData.type} onChange={handleChange} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }}>
                  <option>Physical</option>
                  <option>Ebook</option>
                  <option>Audiobook</option>
                </select>
              </div>

              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }}>
                  <option>Owned</option>
                  <option>Borrowed</option>
                  <option>On Loan</option>
                  <option>Currently Reading</option>
                  <option>Queue</option>
                  <option>Gifted</option>
                  <option>Sold</option>
                  <option>Donated</option>
                </select>
              </div>
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Location</label>
              <select value={showOtherLocation || (formData.location && !allLocations.includes(formData.location)) ? 'Other...' : (formData.location || allLocations[0])} onChange={(e) => { if (e.target.value === 'Other...') { setShowOtherLocation(true); if (allLocations.includes(formData.location)) setFormData(prev => ({...prev, location: ''})); } else { setShowOtherLocation(false); setFormData(prev => ({...prev, location: e.target.value})); } }} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }}>
                {allLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                <option value="Other...">Other...</option>
              </select>
              {showOtherLocation && <div style={{ marginTop: '10px' }}><input name="location" value={formData.location} onChange={handleChange} placeholder="Enter new location..." autoFocus /><label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--muted)' }}><input type="checkbox" checked={saveNewLocation} onChange={e => setSaveNewLocation(e.target.checked)} />Save this location to dropdown options</label></div>}
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Tags (comma separated)</label>
              <input name="tags" value={formData.tags} onChange={handleChange} placeholder="e.g. First Edition, Signed, Hardcover" />
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--muted)"}}>Cover Image URL (optional)</label>
              <input name="coverUrl" value={formData.coverUrl || ""} onChange={handleChange} placeholder="https://..." />
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Cataloged Date</label>
              <input name="cataloged" value={formData.cataloged} onChange={handleChange} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Date Started</label>
                <input type="date" name="startedAt" value={formData.startedAt || ''} onChange={handleChange} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
              </div>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Date Finished</label>
                <input type="date" name="finishedAt" value={formData.finishedAt || ''} onChange={handleChange} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
              </div>
            </div>
          </div>

          <div className="panel" style={{ display: 'grid', gap: '15px' }}>
            <div>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Provenance & Notes</label>
              <textarea name="provenance" value={formData.provenance} onChange={handleChange} style={{ width: '100%', minHeight: '80px', border: '1px solid var(--line)', borderRadius: '12px', background: '#fffefb', padding: '10px', font: 'inherit', color: 'var(--ink)' }} />
            </div>
            <div>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Reading Log</label>
              <textarea name="reading" value={formData.reading} onChange={handleChange} style={{ width: '100%', minHeight: '80px', border: '1px solid var(--line)', borderRadius: '12px', background: '#fffefb', padding: '10px', font: 'inherit', color: 'var(--ink)' }} />
            </div>
            <div>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Ownership Details</label>
              <textarea name="ownership" value={formData.ownership} onChange={handleChange} style={{ width: '100%', minHeight: '80px', border: '1px solid var(--line)', borderRadius: '12px', background: '#fffefb', padding: '10px', font: 'inherit', color: 'var(--ink)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
            {id && <button type="button" onClick={handleDelete} className="backLink" style={{ background: '#a05252' }}>Delete Book</button>}
            <button type="submit" className="primaryBtn">Save Book</button>
          </div>
        </form>
      </div>
    </Shell>
  );
}

