import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useLibrary, Header } from './App';

function Shell({ children }) { 
  return (
    <div className="page" style={{ position: 'relative' }}>
      <Header />
      {children}
    </div>
  ); 
}

const defaultBook = {
  title: '',
  author: '',
  type: 'Physical',
  status: 'Owned',
  inQueue: false,
  location: '',
  tags: '',
  series: '',
  seriesNumber: '',
  cataloged: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
  startedAt: '',
  finishedAt: '',
  provenance: '',
  reading: '',
  ownership: '',
  coverUrl: '',
  isbn: '',
  borrower: '',
  lentAt: '',
  dueAt: '',
  loans: [],
  rating: 0,
  price: '',
  purchaseUrl: '',
  quotes: [],
  currentPage: '',
  totalPages: '',
  readingSessions: []
};

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { allBooks } = useLibrary();
  const [formData, setFormData] = useState(defaultBook);
  const [loading, setLoading] = useState(!!id);
  const [fetchingCover, setFetchingCover] = useState(false);
  const [showOtherLocation, setShowOtherLocation] = useState(false);
  const [showOtherSeries, setShowOtherSeries] = useState(false);
  
  // Barcode scanner states
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState(null);

  // Clean up scanner camera stream on component unmount
  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.stop().catch(err => console.error("Error stopping scanner on unmount:", err));
      }
    };
  }, [scanner]);

  const startScanner = () => {
    setScanning(true);
    // Give DOM a millisecond to render the scanner container div
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode("scanner-reader");
      setScanner(html5QrCode);
      
      html5QrCode.start(
        { facingMode: "environment" }, // Rear camera
        {
          fps: 10,
          qrbox: { width: 260, height: 160 } // Optimized rectangle bounding box for 1D barcodes
        },
        (decodedText) => {
          // Barcode detected successfully
          handleBarcodeDecoded(decodedText, html5QrCode);
        },
        (errorMessage) => {
          // Verbose frame decoding errors can be ignored
        }
      ).catch(err => {
        alert("Camera access denied or device error: " + err);
        setScanning(false);
        setScanner(null);
      });
    }, 100);
  };

  const stopScanner = () => {
    if (scanner) {
      scanner.stop().then(() => {
        setScanner(null);
        setScanning(false);
      }).catch(err => {
        console.error("Failed to stop scanner cleanly:", err);
        setScanning(false);
      });
    } else {
      setScanning(false);
    }
  };

  const handleBarcodeDecoded = async (isbnCode, qrScannerInstance) => {
    const cleanIsbn = isbnCode.trim().replace(/-/g, '');
    if (!cleanIsbn) return;
    
    // Stop the scanner stream immediately to prevent duplicate runs
    if (qrScannerInstance) {
      try {
        await qrScannerInstance.stop();
      } catch (e) {
        console.error(e);
      }
    }
    setScanning(false);
    setScanner(null);
    
    // Fetch details
    await handleFetchMetadataByIsbn(cleanIsbn);
  };

  const handleFetchMetadataByIsbn = async (cleanIsbn) => {
    setFetchingCover(true);
    try {
      let title = '';
      let author = '';
      let pageCount = '';
      let coverUrl = '';
      let description = '';

      // 1. Google Books API query
      const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`);
      if (gbRes.ok) {
        const gbData = await gbRes.json();
        if (gbData.items && gbData.items.length > 0) {
          const info = gbData.items[0].volumeInfo;
          title = info.title || '';
          if (info.subtitle) title += `: ${info.subtitle}`;
          author = info.authors ? info.authors.join(', ') : '';
          pageCount = info.pageCount ? String(info.pageCount) : '';
          coverUrl = info.imageLinks?.thumbnail ? info.imageLinks.thumbnail.replace('http:', 'https:') : '';
          description = info.description || '';
        }
      }

      // 2. Open Library API fallback
      if (!title) {
        const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
        if (olRes.ok) {
          const olData = await olRes.json();
          const bookKey = `ISBN:${cleanIsbn}`;
          if (olData[bookKey]) {
            const book = olData[bookKey];
            title = book.title || '';
            author = book.authors ? book.authors.map(a => a.name).join(', ') : '';
            pageCount = book.number_of_pages ? String(book.number_of_pages) : '';
            coverUrl = book.cover?.large || book.cover?.medium || '';
            description = book.notes || '';
          }
        }
      }

      if (title) {
        setFormData(prev => ({
          ...prev,
          title: title || prev.title,
          author: author || prev.author,
          isbn: cleanIsbn,
          totalPages: pageCount || prev.totalPages,
          coverUrl: coverUrl || prev.coverUrl,
          provenance: description ? `Automatic Import: ${description}\n\n${prev.provenance}` : prev.provenance
        }));
        alert(`Successfully scanned and loaded details for: "${title}"`);
      } else {
        setFormData(prev => ({ ...prev, isbn: cleanIsbn }));
        alert(`Scanned ISBN: ${cleanIsbn}, but no cataloged book details were found online. The ISBN has been auto-filled.`);
      }
    } catch (err) {
      console.error(err);
      setFormData(prev => ({ ...prev, isbn: cleanIsbn }));
      alert(`Scanned ISBN: ${cleanIsbn}, but an error occurred fetching details. The ISBN has been auto-filled.`);
    }
    setFetchingCover(false);
  };

  const allLocations = Array.from(new Set([
    'Living Room Shelf', 
    'Office', 
    'Bedroom', 
    ...allBooks.map(b => b.location).filter(Boolean)
  ]));

  const allSeries = Array.from(new Set(
    allBooks.map(b => b.series).filter(Boolean)
  )).sort();

  const allBorrowers = Array.from(new Set(
    allBooks.flatMap(b => {
      const active = b.borrower ? [b.borrower] : [];
      const past = Array.isArray(b.loans) ? b.loans.map(l => l.borrower) : [];
      return [...active, ...past];
    }).filter(Boolean)
  )).sort();

  useEffect(() => {
    if (id) {
      getDoc(doc(db, 'books', id)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Backward compatibility for old "Queue" status
          if (data.status === 'Queue') {
            data.status = 'Owned';
            data.inQueue = true;
          }
          setFormData({
            rating: 0,
            price: '',
            purchaseUrl: '',
            quotes: [],
            currentPage: '',
            totalPages: '',
            readingSessions: [],
            ...data,
            tags: Array.isArray(data.tags) ? data.tags.join(', ') : ''
          });
          if (data.location && !allLocations.includes(data.location)) {
            setShowOtherLocation(true);
          }
          if (data.series && !allSeries.includes(data.series)) {
            setShowOtherSeries(true);
          }
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [id, allBooks]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setFormData(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'status' && value === 'Queue') {
        next.inQueue = true;
      }
      if (name === 'status' && value === 'On Loan') {
        if (!next.lentAt) {
          next.lentAt = new Date().toISOString().split('T')[0];
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clean up lending and wishlist fields if the book is not active in those states
    const cleanedFormData = { ...formData };
    if (cleanedFormData.status !== 'On Loan') {
      cleanedFormData.borrower = '';
      cleanedFormData.lentAt = '';
      cleanedFormData.dueAt = '';
    }
    if (cleanedFormData.status !== 'Wishlist') {
      cleanedFormData.price = '';
      cleanedFormData.purchaseUrl = '';
    }

    const dataToSave = {
      ...cleanedFormData,
      currentPage: cleanedFormData.currentPage === '' ? '' : parseInt(cleanedFormData.currentPage, 10),
      totalPages: cleanedFormData.totalPages === '' ? '' : parseInt(cleanedFormData.totalPages, 10),
      tags: cleanedFormData.tags.split(',').map(t => t.trim()).filter(t => t)
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>ISBN (Optional - scans physical barcode)</label>
                <input name="isbn" value={formData.isbn || ''} onChange={handleChange} placeholder="e.g. 9780143127550" />
              </div>
              <button 
                type="button" 
                onClick={scanning ? stopScanner : startScanner}
                style={{ 
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '999px',
                  background: scanning ? '#a05252' : 'var(--blue)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  outline: 'none',
                  userSelect: 'none'
                }}
              >
                📷 {scanning ? 'Stop Scan' : 'Scan Barcode'}
              </button>
            </div>

            {scanning && (
              <div className="panel" style={{ background: '#000', padding: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div id="scanner-reader" style={{ width: '100%', maxWidth: '360px', background: '#000' }}></div>
                <div style={{ textAlign: 'center', color: '#8ea6d2', fontSize: '11px', marginTop: '8px', fontWeight: 'bold' }}>
                  Center the book's barcode inside the frame.
                </div>
              </div>
            )}

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Rating</label>
              <div style={{ display: 'flex', gap: '6px', fontSize: '24px', cursor: 'pointer', color: '#efe4d0', userSelect: 'none' }}>
                {[1, 2, 3, 4, 5, 6, 7].map(star => (
                  <span 
                    key={star} 
                    onClick={() => setFormData(prev => ({ ...prev, rating: star }))} 
                    style={{ color: star <= formData.rating ? '#dca842' : '#efe4d0', transition: 'color 0.2s' }}
                  >
                    ★
                  </span>
                ))}
                {formData.rating > 0 && (
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ ...prev, rating: 0 }))} 
                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '11px', alignSelf: 'center', marginLeft: '10px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '15px' }}>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Series (Optional)</label>
                <select value={showOtherSeries || (formData.series && !allSeries.includes(formData.series)) ? 'Other...' : (formData.series || '')} onChange={(e) => { 
                  if (e.target.value === 'Other...') { 
                    setShowOtherSeries(true); 
                    if (allSeries.includes(formData.series)) setFormData(prev => ({...prev, series: ''})); 
                  } else { 
                    setShowOtherSeries(false); 
                    setFormData(prev => ({...prev, series: e.target.value})); 
                  } 
                }} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)', marginBottom: showOtherSeries ? '8px' : 0 }}>
                  <option value="">None</option>
                  {allSeries.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="Other...">Other...</option>
                </select>
                {showOtherSeries && (
                  <input name="series" value={formData.series} onChange={handleChange} placeholder="Enter series name..." style={{ marginTop: '8px' }} />
                )}
              </div>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Series #</label>
                <input name="seriesNumber" value={formData.seriesNumber || ''} onChange={handleChange} placeholder="e.g. 1" />
              </div>
            </div>

            <div className="form-grid-2col">
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
                  <option>Queue</option>
                  <option>Wishlist</option>
                  <option>Borrowed</option>
                  <option>On Loan</option>
                  <option>Currently Reading</option>
                  <option>Gifted</option>
                  <option>Sold</option>
                  <option>Donated</option>
                </select>
              </div>
            </div>
            
            {formData.status === 'Wishlist' && (
              <div className="panel" style={{ display: 'grid', gap: '15px', background: '#fffcf7', border: '1px solid #d8c6ad', padding: '16px', borderRadius: '12px', marginTop: '10px' }}>
                <h4 style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'var(--blue)' }}>Acquisition Details (Wishlist)</h4>
                <div className="form-grid-price-url">
                  <div className="searchBar" style={{ margin: 0 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)' }}>Planned Price</label>
                    <input name="price" value={formData.price || ''} onChange={handleChange} placeholder="e.g. $19.99" />
                  </div>
                  <div className="searchBar" style={{ margin: 0 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)' }}>Purchase URL (Optional)</label>
                    <input name="purchaseUrl" value={formData.purchaseUrl || ''} onChange={handleChange} placeholder="e.g. https://..." />
                  </div>
                </div>
              </div>
            )}

            {formData.status === 'On Loan' && (
              <div className="panel" style={{ display: 'grid', gap: '15px', background: '#fffcf7', border: '1px solid #d8c6ad', padding: '16px', borderRadius: '12px', marginTop: '10px' }}>
                <h4 style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', color: 'var(--blue)' }}>Lending Registry Details</h4>
                
                <div className="form-grid-2col">
                  <div className="searchBar" style={{ margin: 0 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)' }}>Borrower Name</label>
                    <input name="borrower" value={formData.borrower || ''} onChange={handleChange} list="borrowers-list" required placeholder="Who is borrowing this book?" />
                    <datalist id="borrowers-list">
                      {allBorrowers.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>

                  <div className="searchBar" style={{ margin: 0 }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)' }}>Date Lent</label>
                    <input type="date" name="lentAt" value={formData.lentAt || ''} onChange={handleChange} required style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
                  </div>
                </div>

                <div className="searchBar" style={{ margin: 0 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)' }}>Date Due (Optional)</label>
                  <input type="date" name="dueAt" value={formData.dueAt || ''} onChange={handleChange} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
                </div>
              </div>
            )}

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: '14px', background: formData.inQueue ? '#eef4fd' : '#fffaf3', transition: 'background 0.2s'}}>
                <input type="checkbox" checked={formData.inQueue} onChange={e => setFormData(prev => ({...prev, inQueue: e.target.checked}))} style={{width:'18px',height:'18px',accentColor:'var(--blue)'}} />
                <span style={{fontSize: '14px', color: 'var(--ink)'}}><strong>Add to Reading Queue</strong> — keep track of this book on the Reading Ledger.</span>
              </label>
            </div>

            <div className="searchBar" style={{ margin: 0 }}>
              <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Location</label>
              <select value={showOtherLocation || (formData.location && !allLocations.includes(formData.location)) ? 'Other...' : (formData.location || '')} onChange={(e) => { if (e.target.value === 'Other...') { setShowOtherLocation(true); if (allLocations.includes(formData.location)) setFormData(prev => ({...prev, location: ''})); } else { setShowOtherLocation(false); setFormData(prev => ({...prev, location: e.target.value})); } }} style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }}>
                <option value="">Unassigned / Queue</option>
                {allLocations.map(loc => loc && <option key={loc} value={loc}>{loc}</option>)}
                <option value="Other...">Other...</option>
              </select>
              {showOtherLocation && <div style={{ marginTop: '10px' }}><input name="location" value={formData.location} onChange={handleChange} placeholder="Enter new location..." autoFocus /></div>}
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

            <div className="form-grid-2col">
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Current Page</label>
                <input type="number" name="currentPage" value={formData.currentPage ?? ''} onChange={handleChange} placeholder="e.g. 142" min="0" style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
              </div>
              <div className="searchBar" style={{ margin: 0 }}>
                <label style={{display: 'block', marginBottom: '4px', fontSize: '12px', color: 'var(--muted)'}}>Total Pages</label>
                <input type="number" name="totalPages" value={formData.totalPages ?? ''} onChange={handleChange} placeholder="e.g. 400" min="1" style={{ width: '100%', border: '1px solid var(--line)', background: '#fffaf6', borderRadius: '999px', padding: '12px 16px', font: 'inherit', color: 'var(--ink)' }} />
              </div>
            </div>

            <div className="form-grid-2col">
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

