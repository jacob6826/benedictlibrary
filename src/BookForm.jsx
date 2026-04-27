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
  coverUrl: ''
};

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(defaultBook);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'books', id)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            ...data,
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : ''
          });
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleFetchCover = async () => {
    if (!formData.title) return alert('Please enter a title first.');
    try {
      const q = `intitle:${formData.title}${formData.author ? '+inauthor:'+formData.author : ''}`;
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`);
      const data = await res.json();
      const url = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
      if (url) {
        setFormData(prev => ({ ...prev, coverUrl: url.replace('http:', 'https:') }));
      } else {
        alert('No cover found on Google Books.');
      }
    } catch (e) {
      alert('Error fetching cover.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
    };

    if (id) {
      await setDoc(doc(db, 'books', id), dataToSave, { merge: true });
    } else {
      await addDoc(collection(db, 'books'), { ...dataToSave, createdAt: new Date() });
    }
    navigate('/');
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
        <Link className="backLink" to="/">← Cancel</Link>
        <h2 className="pageTitle">{id ? 'Edit Book' : 'Catalog New Book'}</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          <div className="panel" style={{ display: 'grid', gap: '15px' }}>
            <div className="searchBar" style={{ margin: 0 }}>
              <div style={{display:"flex", justifyContent:"space-between"}}><label style={{display: "block", marginBottom: "4px", fontSize: "12px", color: "var(--muted)"}}>Title</label><button type="button" onClick={handleFetchCover} style={{fontSize:"10px", padding:"2px 6px", borderRadius:"4px", background:"#efe4d0", border:"1px solid #d8c6ad", cursor:"pointer", color:"#6d5d48"}}>Fetch Cover API</button></div>
              <input name="title" value={formData.title} onChange={handleChange} required />
            </div>
            
            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Author</label>
              <input name="author" value={formData.author} onChange={handleChange} required />
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
              <input name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Living Room Shelf" />
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

