export const recent = ['Sula', 'The Bee Sting', 'Pachinko', 'The Covenant of Water', 'Dune']
export const queue = ['TBR', 'TBR', 'TBR', 'TBR']

export const stacks = [
  { title: 'Moby Dick', author: 'Herman Melville', tags: ['Living Room Shelf', 'First Edition', 'Signed'], status: 'Owned - Physical' },
  { title: 'Middlemarch', author: 'George Eliot', tags: ['Study Shelf', 'Hardcover'], status: 'Owned - Physical' },
  { title: 'The Goldfinch', author: 'Donna Tartt', tags: ['On Loan', 'Hardcover'], status: 'Owned - Physical' },
  { title: 'The Road', author: 'Cormac McCarthy', tags: ['Bedroom Shelf', 'Paperback'], status: 'Owned - Physical' }
]

export const archives = [
  { title: 'Dune', author: 'Frank Herbert', tags: ['Ebook', 'EPUB'], status: 'Owned - Ebook' },
  { title: 'Project Hail Mary', author: 'Andy Weir', tags: ['Audiobook', 'MP3'], status: 'Owned - Audiobook' },
  { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', tags: ['Ebook', 'PDF'], status: 'Owned - Ebook' }
]

export const departures = [
  { title: 'Beloved', status: 'Gifted to Elena · Feb 2026', tag: 'Gifted' },
  { title: 'Snow Crash', status: 'Sold · Jan 2026', tag: 'Sold' },
  { title: 'The Road', status: 'Donated · Dec 2025', tag: 'Donated' }
]

export const allBooks = [...stacks, ...archives]

export const detailData = {
  'Moby Dick': { author: 'Herman Melville', status: 'Owned - Physical', location: 'Living Room Shelf', cataloged: 'Apr 2026', provenance: 'Picked up at the Strand rare book room.', reading: 'Started Apr 10, 2026 · Notes and quotes are stored here.', ownership: 'Currently owned and shelved in the main collection.' },
  'Middlemarch': { author: 'George Eliot', status: 'Owned - Physical', location: 'Study Shelf', cataloged: 'Mar 2026', provenance: 'Gift from a friend, with an old bookplate inside.', reading: 'A slow, reflective reread with notes.', ownership: 'Currently owned and shelved in the main collection.' },
  'The Goldfinch': { author: 'Donna Tartt', status: 'Owned - Physical', location: 'Bedroom Shelf', cataloged: 'Feb 2026', provenance: 'Bought used with a dust jacket in good shape.', reading: 'Currently on loan to Marcus.', ownership: 'On loan from the physical collection.' },
  'The Road': { author: 'Cormac McCarthy', status: 'Owned - Physical', location: 'Bedroom Shelf', cataloged: 'Feb 2026', provenance: 'Added to the shelf after a recent reread.', reading: 'Finished Dec 2025.', ownership: 'Currently owned and shelved in the main collection.' },
  'Dune': { author: 'Frank Herbert', status: 'Owned - Ebook', location: 'Private Digital Archive', cataloged: 'Jan 2026', provenance: 'Imported from personal EPUB library.', reading: 'Digital version used for travel reading.', ownership: 'Available in the archives.' },
  'Project Hail Mary': { author: 'Andy Weir', status: 'Owned - Audiobook', location: 'Private Digital Archive', cataloged: 'Jan 2026', provenance: 'Synced from audiobook library.', reading: 'Best heard on long walks.', ownership: 'Available in the archives.' },
  'Klara and the Sun': { author: 'Kazuo Ishiguro', status: 'Owned - Ebook', location: 'Private Digital Archive', cataloged: 'Jan 2026', provenance: 'Added from ebook collection.', reading: 'Marked for later reread.', ownership: 'Available in the archives.' }
}
