import React, { useState } from 'react';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

export default function DataTransferTool({ allBooks, onComplete }) {
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [importMode, setImportMode] = useState('merge'); // 'merge' or 'replace'

  const handleExport = () => {
    try {
      if (!allBooks || allBooks.length === 0) {
        alert('No books to export.');
        return;
      }
      // Export all books. Strip out the Firestore document ID to allow clean importing
      const exportData = allBooks.map(({ id, ...rest }) => ({
        ...rest,
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `benedict_library_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export library data.');
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setTransferring(true);
    setProgress('Reading file...');

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      if (!Array.isArray(importedData)) {
        alert('Invalid export file. Expected a JSON array of books.');
        setTransferring(false);
        return;
      }

      // If user chose to replace/clear existing library catalog
      if (importMode === 'replace') {
        const confirmClear = window.confirm("WARNING: This will permanently delete ALL books currently in your catalog before importing. Are you sure you want to proceed?");
        if (!confirmClear) {
          setTransferring(false);
          return;
        }
        setProgress('Clearing existing books...');
        const querySnapshot = await getDocs(collection(db, 'books'));
        const deleteBatch = writeBatch(db);
        querySnapshot.forEach(docSnap => {
          deleteBatch.delete(doc(db, 'books', docSnap.id));
        });
        await deleteBatch.commit();
      }

      setProgress(`Uploading ${importedData.length} books...`);

      // Upload imported books in batches of 500 (Firestore writeBatch limit)
      const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
      let batch = writeBatch(db);
      let count = 0;
      let batchSize = 0;

      for (const book of importedData) {
        // Build document data, making sure user ID is assigned if logged in
        const bookData = {
          ...book,
          createdAt: book.createdAt ? new Date(book.createdAt?.seconds ? book.createdAt.seconds * 1000 : book.createdAt) : new Date()
        };

        if (currentUserId) {
          bookData.userId = currentUserId; // Associate with current user in multi-user version
        }

        const docRef = doc(collection(db, 'books'));
        batch.set(docRef, bookData);
        count++;
        batchSize++;

        if (batchSize === 500) {
          setProgress(`Uploading (${count}/${importedData.length})...`);
          await batch.commit();
          batch = writeBatch(db);
          batchSize = 0;
        }
      }

      if (batchSize > 0) {
        setProgress(`Uploading (${count}/${importedData.length})...`);
        await batch.commit();
      }

      alert(`Successfully imported ${count} books!`);
      if (onComplete) onComplete();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Error during import. Please ensure the file is a valid JSON export.');
    } finally {
      setTransferring(false);
      setProgress('');
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button 
        type="button" 
        className="primaryBtn" 
        style={{ background: 'var(--blue)', cursor: transferring ? 'wait' : 'pointer' }}
        onClick={() => setShowModal(true)}
        disabled={transferring}
      >
        {transferring ? progress : 'Export / Import JSON'}
      </button>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--cream)', border: '8px double var(--line)', maxWidth: '420px', width: '100%', padding: '24px', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '4px', fontFamily: 'Cormorant Garamond, serif', color: 'var(--ink)' }}>
            <button 
              style={{ position: 'absolute', top: '10px', right: '14px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'inherit' }} 
              onClick={() => setShowModal(false)}
            >
              ×
            </button>
            <h3 style={{ fontSize: '24px', margin: '0 0 12px 0', borderBottom: '1px solid var(--line)', paddingBottom: '6px', color: 'var(--blue)' }}>Data Transfer Deck</h3>
            
            {/* Export Section */}
            <div style={{ marginBottom: '20px', borderBottom: '1px dashed var(--line)', paddingBottom: '16px' }}>
              <h4 style={{ fontSize: '18px', margin: '0 0 6px 0', color: 'var(--ink)' }}>Export Library</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontFamily: 'Inter, sans-serif', color: 'var(--muted)', lineHeight: '1.4' }}>
                Download a complete backup of all cataloged volumes, reading logs, queue order, and reflections in a single JSON file.
              </p>
              <button 
                type="button" 
                className="primaryBtn" 
                onClick={handleExport}
                style={{ width: '100%', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}
              >
                Export Library JSON
              </button>
            </div>

            {/* Import Section */}
            <div>
              <h4 style={{ fontSize: '18px', margin: '0 0 6px 0', color: 'var(--ink)' }}>Import Library</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontFamily: 'Inter, sans-serif', color: 'var(--muted)', lineHeight: '1.4' }}>
                Upload a previously exported JSON backup to populate your library.
              </p>
              
              <div style={{ margin: '14px 0', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>Import Mode:</span>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="importMode" 
                      value="merge" 
                      checked={importMode === 'merge'} 
                      onChange={() => setImportMode('merge')} 
                      style={{ accentColor: 'var(--blue)' }}
                    />
                    Merge (Append new)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#a05252' }}>
                    <input 
                      type="radio" 
                      name="importMode" 
                      value="replace" 
                      checked={importMode === 'replace'} 
                      onChange={() => setImportMode('replace')} 
                      style={{ accentColor: '#a05252' }}
                    />
                    Replace (Clear first)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    padding: '6px 14px', 
                    margin: 0, 
                    borderRadius: '999px', 
                    fontWeight: 'bold', 
                    background: 'var(--muted)', 
                    color: '#ffffff', 
                    border: 'none',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Cancel
                </button>
                
                <label 
                  style={{ 
                    cursor: 'pointer', 
                    fontSize: '12px', 
                    padding: '6px 14px', 
                    margin: 0, 
                    borderRadius: '999px', 
                    fontWeight: 'bold', 
                    background: 'var(--blue)', 
                    color: '#ffffff', 
                    border: 'none', 
                    display: 'inline-flex', 
                    alignItems: 'center',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Choose JSON File
                  <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    onChange={handleFileChange}
                    disabled={transferring}
                  />
                </label>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
