import React, { useState } from 'react';
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

function parseCSV(text) {
  let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p) row[i] += l;
      s = !s;
    } else if (',' === l && s) l = row[++i] = '';
    else if ('\n' === l && s) {
      if ('\r' === p) row[i] = row[i].slice(0, -1);
      row = ret[++r] = [l = '']; i = 0;
    } else row[i] += l;
    p = l;
  }
  return ret.filter(r => r.length > 1 || r[0].trim() !== ''); // remove empty rows
}

export default function GoodreadsImporter({ onComplete }) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [forceAudiobook, setForceAudiobook] = useState(true);
  const [forceFinished, setForceFinished] = useState(true);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setProgress('Reading file...');

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      alert('CSV seems empty or invalid.');
      setImporting(false);
      return;
    }

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

    setProgress(`Parsing ${dataRows.length} books...`);

    const batch = writeBatch(db);
    let count = 0;

    for (const row of dataRows) {
      const getVal = (colName) => {
        const idx = headers.indexOf(colName);
        return idx !== -1 && row[idx] ? row[idx].trim() : '';
      };

      const title = getVal('Title');
      const author = getVal('Author');
      if (!title) continue;

      let type = 'Physical';
      if (forceAudiobook) {
        type = 'Audiobook';
      } else {
        const binding = getVal('Binding').toLowerCase();
        if (binding.includes('kindle') || binding.includes('ebook')) type = 'Ebook';
        if (binding.includes('audio')) type = 'Audiobook';
      }

      let status = 'Owned';
      if (forceFinished) {
        status = 'Owned';
      } else {
        const shelf = getVal('Exclusive Shelf').toLowerCase();
        if (shelf === 'read') status = 'Owned';
        if (shelf === 'currently-reading') status = 'Currently Reading';
        if (shelf === 'to-read') status = 'Queue';
      }

      let finishedAt = getVal('Date Read');
      if (finishedAt) {
        // Goodreads uses YYYY/MM/DD, input type="date" needs YYYY-MM-DD
        finishedAt = finishedAt.replace(/\//g, '-');
      } else if (forceFinished) {
        const dateAdded = getVal('Date Added');
        finishedAt = dateAdded ? dateAdded.replace(/\//g, '-') : new Date().toISOString().split('T')[0];
      }

      let cataloged = getVal('Date Added');
      if (!cataloged) {
         cataloged = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      let readingLog = getVal('My Review');
      if (getVal('My Rating')) {
        readingLog = `Rating: ${getVal('My Rating')}/5\n${readingLog}`.trim();
      }

      const series = getVal('Series') || getVal('sereies');
      const seriesNumber = getVal('Series Number') || getVal('number of the book in the sereies') || getVal('Book Number');

      const bookData = {
        title,
        author,
        type,
        status,
        location: 'Imported',
        tags: getVal('Bookshelves').split(',').map(t => t.trim()).filter(t => t),
        cataloged,
        startedAt: '',
        finishedAt,
        provenance: getVal('Private Notes'),
        reading: readingLog,
        ownership: '',
        coverUrl: '',
        series,
        seriesNumber,
        createdAt: new Date()
      };

      const docRef = doc(collection(db, 'books'));
      batch.set(docRef, bookData);
      count++;
    }

    setProgress(`Uploading ${count} books to the library...`);
    
    try {
      await batch.commit();
      alert(`Successfully imported ${count} books!`);
    } catch (err) {
      console.error(err);
      alert('Error saving to database. See console.');
    }

    setImporting(false);
    setProgress('');
    if (onComplete) onComplete();
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <label className="primaryBtn" style={{ background: 'var(--muted)', cursor: importing ? 'wait' : 'pointer', margin: 0 }}>
        {importing ? progress : 'Import Goodreads CSV'}
        <input 
          type="file" 
          accept=".csv" 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
          disabled={importing}
        />
      </label>
      
      {!importing && (
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'Inter, sans-serif' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={forceAudiobook} 
              onChange={e => setForceAudiobook(e.target.checked)} 
              style={{ accentColor: 'var(--blue)', width: '13px', height: '13px', cursor: 'pointer' }}
            />
            Force Audiobook
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
            <input 
              type="checkbox" 
              checked={forceFinished} 
              onChange={e => setForceFinished(e.target.checked)} 
              style={{ accentColor: 'var(--blue)', width: '13px', height: '13px', cursor: 'pointer' }}
            />
            Mark Completed
          </label>
        </div>
      )}
    </div>
  );
}
