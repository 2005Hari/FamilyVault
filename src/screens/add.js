/* ============================================================
   FAMILY VAULT — Add Document Screen
   ============================================================ */
import { store, CATEGORIES, getCategoryIcon } from '../store.js';
import { router } from '../router.js';
import { showToast, showModal } from '../app.js';
import { uploadDocumentFile } from '../drive.js';
import { extractTextFromImage, extractTextFromPdf } from '../ocr.js';
import { analyzeDocumentText, generateFilename } from '../analyzer.js';

let uploadedFile = null;
let extractedFields = {};
let selectedCategory = '';
let locationData = { room: '', cupboard: '', folder: '', pocket: '' };
let tags = [];
let scanPhase = 'idle'; // idle | scanning | extracted | saving

export function renderAdd(container) {
  // Reset state
  uploadedFile = null;
  extractedFields = {};
  selectedCategory = '';
  locationData = { room: '', cupboard: '', folder: '', pocket: '' };
  tags = [];
  scanPhase = 'idle';

  container.innerHTML = `
    <div class="page-header">
      <p class="eyebrow">Add document</p>
      <h1 style="font-size:22px; margin-top:3px;">Bring in a document</h1>
    </div>
    <div class="screen-inner">

      <!-- Upload methods -->
      <div class="upload-grid" id="upload-grid">
        <div class="upload-opt" id="opt-scan">
          <svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 011-1h3M4 16v3a1 1 0 001 1h3M20 8V5a1 1 0 00-1-1h-3M20 16v3a1 1 0 01-1 1h-3"/><circle cx="12" cy="12" r="3.5"/></svg>
          <div class="t">Scan with camera</div>
          <div class="s">Auto-crop & enhance</div>
        </div>
        <div class="upload-opt" id="opt-photo">
          <svg viewBox="0 0 24 24"><path d="M4 16l4.5-6 3.5 4.5 2.5-3L20 16"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>
          <div class="t">Photo library</div>
          <div class="s">Choose existing image</div>
        </div>
        <div class="upload-opt" id="opt-pdf">
          <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><path d="M14 3v6h6"/></svg>
          <div class="t">Import PDF</div>
          <div class="s">From Files</div>
        </div>
        <div class="upload-opt" id="opt-file">
          <svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M4 21h16"/></svg>
          <div class="t">Files picker</div>
          <div class="s">Any file type</div>
        </div>
      </div>

      <!-- Hidden file input -->
      <input type="file" id="file-input" accept="image/*,application/pdf" style="display:none;" />

      <!-- File preview -->
      <div class="scan-preview" id="scan-preview" style="display:none;">
        <div class="scan-preview-placeholder" id="preview-placeholder">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M4 16l4-5 3 4 2-2.5L20 16"/></svg>
          <span>Document preview</span>
        </div>
      </div>

      <!-- Scanning progress -->
      <div class="scan-progress" id="scan-progress" style="display:none;">
        <div class="row"><div class="spinner"></div><span>Analysing document…</span></div>
        <div class="row muted" id="row-ocr"><span class="check-icon">◌</span><span>Extracting text (OCR)</span></div>
        <div class="row muted" id="row-cat"><span class="check-icon">◌</span><span>Detecting category</span></div>
        <div class="row muted" id="row-fields"><span class="check-icon">◌</span><span>Mapping key fields</span></div>
      </div>

      <!-- AI extracted fields -->
      <div id="extract-section" style="display:none;">
        <div class="card" style="margin-top:20px;">
          <p class="eyebrow" style="margin-bottom:12px;">Document details</p>

          <div class="form-group">
            <label class="form-label">Document Type</label>
            <input class="form-input" id="doc-type" type="text" placeholder="e.g. Aadhaar Card" />
          </div>

          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="doc-title" type="text" placeholder="e.g. Dad's Passport" />
          </div>

          <div class="form-group">
            <label class="form-label">Document Number <span style="color:var(--text-lo-2);">(optional)</span></label>
            <input class="form-input" id="doc-number" type="text" placeholder="e.g. ABCDE1234F" />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-select" id="doc-category">
              <option value="">Select category…</option>
              ${CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Owner</label>
            <select class="form-select" id="doc-owner">
              ${store.members.map(m => `<option value="${m.id}" ${m.id === store.currentMemberId ? 'selected' : ''}>${m.name}</option>`).join('')}
            </select>
          </div>
          
          <div style="display:flex; gap:12px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Issue date <span style="color:var(--text-lo-2);">(optional)</span></label>
              <input class="form-input" id="doc-issue" type="date" />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Expiry date <span style="color:var(--text-lo-2);">(optional)</span></label>
              <input class="form-input" id="doc-expiry" type="date" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tags <span style="color:var(--text-lo-2);">(press Enter to add)</span></label>
            <input class="form-input" id="doc-tags-input" type="text" placeholder="e.g. passport, travel" />
            <div class="tag-list" id="tag-list"></div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Notes <span style="color:var(--text-lo-2);">(optional)</span></label>
            <textarea class="form-input" id="doc-notes" rows="2" placeholder="Any additional information..."></textarea>
          </div>
        </div>

        <!-- AI confidence note -->
        <div class="ai-note" id="ai-note" style="margin-top:12px; display:none;">
          <svg viewBox="0 0 24 24"><path d="M12 2l2.4 5.5L20 9l-4.5 3.9L17 19l-5-3.2L7 19l1.5-6.1L4 9l5.6-1.5z"/></svg>
          <span id="ai-note-text">AI detected document type and filled key fields. Please verify before saving.</span>
        </div>

        <!-- Physical location -->
        <div style="margin-top:20px;">
          <p class="eyebrow" style="margin-bottom:12px;">Where is the original stored?</p>
          <div id="location-builder"></div>
        </div>
      </div>

      <!-- CTA -->
      <div id="cta-area" style="margin-top:20px; display:none;">
        <button class="btn-primary" id="save-btn">
          <svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0110 0v3"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg>
          Save to Vault
        </button>
        <button class="btn-ghost" id="cancel-btn" style="margin-top:10px;">Cancel</button>
      </div>

    </div>
  `;

  bindUploadEvents(container);
}

function bindUploadEvents(container) {
  const fileInput = container.querySelector('#file-input');

  // All upload options trigger file picker or camera
  ['opt-scan', 'opt-photo', 'opt-pdf', 'opt-file'].forEach(id => {
    container.querySelector('#' + id).addEventListener('click', () => {
      if (id === 'opt-scan' && navigator.mediaDevices?.getUserMedia) {
        triggerCamera(container);
      } else {
        fileInput.accept = id === 'opt-pdf' ? 'application/pdf' : 'image/*,application/pdf';
        fileInput.click();
      }
    });
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(container, file);
  });
}

function triggerCamera(container) {
  // Fallback to file input if camera not available
  container.querySelector('#file-input').accept = 'image/*';
  container.querySelector('#file-input').capture = 'environment';
  container.querySelector('#file-input').click();
}

function handleFile(container, file) {
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    showFilePreview(container, dataUrl, file.type);
    startScan(container, file, dataUrl);
  };
  reader.readAsDataURL(file);
}

function showFilePreview(container, dataUrl, mimeType) {
  const preview = container.querySelector('#scan-preview');
  const placeholder = container.querySelector('#preview-placeholder');
  preview.style.display = 'flex';

  if (mimeType.startsWith('image/')) {
    placeholder.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
  } else {
    placeholder.innerHTML = `
      <svg viewBox="0 0 24 24" width="48" height="48"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" stroke="#8a7a55" stroke-width="1.4" fill="none"/><path d="M14 3v6h6" stroke="#8a7a55" stroke-width="1.4" fill="none"/></svg>
      <span style="color:var(--text-lo); font-size:12px; margin-top:8px;">${uploadedFile?.name || 'PDF Document'}</span>
    `;
  }
}

async function startScan(container, file, dataUrl) {
  scanPhase = 'scanning';
  container.querySelector('#upload-grid').style.display = 'none';
  container.querySelector('#scan-progress').style.display = 'block';
  container.querySelector('#extract-section').style.display = 'none';
  container.querySelector('#cta-area').style.display = 'none';

  let rawText = '';
  try {
    const rowOcr = container.querySelector('#row-ocr');
    if (file.type === 'application/pdf') {
      const buffer = await file.arrayBuffer();
      rawText = await extractTextFromPdf(buffer);
    } else {
      rawText = await extractTextFromImage(dataUrl);
    }
    if (rowOcr) { rowOcr.querySelector('.check-icon').textContent = '✓'; rowOcr.classList.remove('muted'); rowOcr.style.color = 'var(--teal)'; }
  } catch(e) {
    console.error(e);
  }

  const rowCat = container.querySelector('#row-cat');
  if (rowCat) { rowCat.querySelector('.check-icon').textContent = '✓'; rowCat.classList.remove('muted'); rowCat.style.color = 'var(--teal)'; }

  // Analyze the extracted text
  const metadata = analyzeDocumentText(rawText, store.members);

  const rowFields = container.querySelector('#row-fields');
  if (rowFields) { rowFields.querySelector('.check-icon').textContent = '✓'; rowFields.classList.remove('muted'); rowFields.style.color = 'var(--teal)'; }

  setTimeout(() => {
    container.querySelector('#scan-progress').style.display = 'none';
    showExtractedForm(container, metadata, file.name);
  }, 400);
}

function showExtractedForm(container, metadata, fileName) {
  scanPhase = 'extracted';
  extractedFields = metadata;

  // Try to guess from filename if OCR failed to find type
  let guessedTitle = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  let guessedCategory = metadata.category !== 'Other' ? metadata.category : 'Identity';
  
  if (metadata.category === 'Other') {
    const name = fileName.toLowerCase();
    if (name.includes('insurance') || name.includes('policy')) guessedCategory = 'Insurance';
    else if (name.includes('car') || name.includes('vehicle') || name.includes('puc')) guessedCategory = 'Vehicles';
    else if (name.includes('medical') || name.includes('health')) guessedCategory = 'Medical';
    else if (name.includes('bank') || name.includes('passbook')) guessedCategory = 'Banking';
    else if (name.includes('property') || name.includes('deed') || name.includes('sale')) guessedCategory = 'Property';
    else if (name.includes('marksheet') || name.includes('degree') || name.includes('certificate')) guessedCategory = 'Education';
    else if (name.includes('bill') || name.includes('receipt')) guessedCategory = 'Bills';
  }

  const extractSection = container.querySelector('#extract-section');
  extractSection.style.display = 'block';

  // Pre-fill fields
  container.querySelector('#doc-type').value = metadata.documentType !== 'Other' ? metadata.documentType : '';
  container.querySelector('#doc-title').value = metadata.ownerName ? `${metadata.ownerName.split(' ')[0]}'s ${metadata.documentType}` : guessedTitle;
  container.querySelector('#doc-number').value = metadata.documentNumber;
  container.querySelector('#doc-category').value = guessedCategory;
  if (metadata.ownerId) {
    container.querySelector('#doc-owner').value = metadata.ownerId;
  }
  container.querySelector('#doc-issue').value = metadata.issueDate;
  container.querySelector('#doc-expiry').value = metadata.expiryDate;
  
  selectedCategory = guessedCategory;

  // Show AI note
  const aiNote = container.querySelector('#ai-note');
  aiNote.style.display = 'flex';
  if (metadata.documentType !== 'Other') {
    container.querySelector('#ai-note-text').innerHTML =
      `AI detected <b>${metadata.documentType}</b>. Verify all fields before saving.`;
  } else {
    container.querySelector('#ai-note-text').innerHTML =
      `OCR extracted some text, but could not determine document type. Please verify fields.`;
  }

  // Build location picker
  buildLocationPicker(container);

  // CTA
  container.querySelector('#cta-area').style.display = 'block';

  // Tags input
  const tagInput = container.querySelector('#doc-tags-input');
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim().replace(/,$/, '');
      if (val && !tags.includes(val)) {
        tags.push(val);
        renderTagList(container);
      }
      tagInput.value = '';
    }
  });

  // Save button
  container.querySelector('#save-btn').addEventListener('click', () => saveDocument(container));
  container.querySelector('#cancel-btn').addEventListener('click', () => router.navigate('dashboard'));
}

function renderTagList(container) {
  const list = container.querySelector('#tag-list');
  list.innerHTML = tags.map(tag => `
    <div class="tag-item">
      ${tag}
      <button data-tag="${tag}">×</button>
    </div>
  `).join('');
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      tags = tags.filter(t => t !== btn.dataset.tag);
      renderTagList(container);
    });
  });
}

function buildLocationPicker(container) {
  const locations = store.locations;
  const rooms = locations.map(l => l.room);

  function updatePicker() {
    const builder = container.querySelector('#location-builder');
    const currentRoom = locationData.room;
    const roomLoc = locations.find(l => l.room === currentRoom);
    const cupboards = roomLoc?.cupboards?.map(c => c.name) || [];
    const currentCupboard = locationData.cupboard;
    const cupboardObj = roomLoc?.cupboards?.find(c => c.name === currentCupboard);
    const folders = cupboardObj?.folders?.map(f => f.name) || [];
    const currentFolder = locationData.folder;
    const folderObj = cupboardObj?.folders?.find(f => f.name === currentFolder);
    const pockets = folderObj?.pockets || [];

    builder.innerHTML = `
      ${buildStep(1, 'Room', currentRoom, rooms, 'loc-room')}
      ${currentRoom ? buildStep(2, 'Cupboard / Drawer', currentCupboard, cupboards, 'loc-cupboard') : ''}
      ${currentCupboard ? buildStep(3, 'Folder', currentFolder, folders, 'loc-folder') : ''}
      ${currentFolder ? buildStep(4, 'Pocket / Slot', locationData.pocket, pockets, 'loc-pocket') : ''}
    `;

    // Bind selects
    const roomSel = builder.querySelector('#loc-room');
    if (roomSel) roomSel.addEventListener('change', () => {
      locationData = { room: roomSel.value, cupboard: '', folder: '', pocket: '' };
      updatePicker();
    });

    const cupSel = builder.querySelector('#loc-cupboard');
    if (cupSel) cupSel.addEventListener('change', () => {
      locationData.cupboard = cupSel.value;
      locationData.folder = '';
      locationData.pocket = '';
      updatePicker();
    });

    const fldSel = builder.querySelector('#loc-folder');
    if (fldSel) fldSel.addEventListener('change', () => {
      locationData.folder = fldSel.value;
      locationData.pocket = '';
      updatePicker();
    });

    const pktSel = builder.querySelector('#loc-pocket');
    if (pktSel) pktSel.addEventListener('change', () => {
      locationData.pocket = pktSel.value;
    });
  }

  updatePicker();
}

function buildStep(num, label, value, options, id) {
  return `
    <div class="bc-step" style="cursor:default; margin-bottom:8px;">
      <div class="bc-num">${num}</div>
      <div class="lab">${label}</div>
      <select class="form-select" id="${id}" style="width:auto; padding:6px 10px; font-size:12px; flex:0 0 auto; max-width:160px;">
        <option value="">Choose…</option>
        ${options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}
        <option value="__new__">+ Add new</option>
      </select>
    </div>
  `;
}

async function saveDocument(container) {
  const title    = container.querySelector('#doc-title').value.trim();
  const category = container.querySelector('#doc-category').value;
  const ownerId  = container.querySelector('#doc-owner').value;
  const expiry   = container.querySelector('#doc-expiry').value;
  
  const docType  = container.querySelector('#doc-type').value.trim() || 'Document';
  const docNum   = container.querySelector('#doc-number').value.trim();
  const issue    = container.querySelector('#doc-issue').value;
  const notes    = container.querySelector('#doc-notes').value.trim();

  if (!title)    { showToast('Please enter a document title', 'error'); return; }
  if (!category) { showToast('Please select a category', 'error'); return; }

  const btn = container.querySelector('#save-btn');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  try {
    let driveFileId = null;
    if (uploadedFile) {
      btn.textContent = 'Uploading to Drive…';
      const ownerName = store.members.find(m => m.id === ownerId)?.name || 'Owner';
      
      const genMetadata = {
        documentType: docType,
        ownerName: ownerName,
        issueDate: issue
      };
      
      const fileExt = uploadedFile.name.split('.').pop();
      const standardFilename = generateFilename(genMetadata) + '.' + fileExt;

      driveFileId = await uploadDocumentFile(uploadedFile, standardFilename);
    }

    const newDoc = store.addDocument({
      title,
      category,
      owner: ownerId,
      tags,
      fields: extractedFields,
      expiresAt: expiry ? new Date(expiry).toISOString() : null,
      location: { ...locationData },
      driveFileId: driveFileId,
      mimeType: uploadedFile ? uploadedFile.type : null,
      fileData: null,
      documentType: docType,
      documentNumber: docNum,
      issueDate: issue ? new Date(issue).toISOString() : null,
      notes: notes
    });

    showToast('Document saved to vault!', 'success');
    router.navigate('detail/' + newDoc.id);
  } catch (e) {
    console.error(e);
    showToast('Failed to save document', 'error');
    btn.textContent = 'Save to Vault';
    btn.disabled = false;
  }
}
