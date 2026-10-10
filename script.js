// All DOM references - declared as let so they can be re-assigned inside DOMContentLoaded
let productBody, addRowBtn, downloadBtn, downloadMenu, dropdownItems;
let sameAsBillTo, shipToFields, invoiceForm;
let darkModeIcon, darkModeBtn, copySelector;
let searchOldBtn, historyModal, closeModal, historyResults;
let loginOverlay, loginBtn, logoutBtn, loginUserId, loginPassword, loginError;
let sidebarBtns, dashboardView, createInvoiceView, totalInvoicesCount, dashboardTableBody;
let dashboardFilters, resetFiltersBtn, sidebar, sidebarToggle, btnDownloadExcel;
let homeView, helpView, queryListContainer, queryModal, btnOpenQueryForm, closeQueryModal, btnCancelQuery, btnSubmitQuery, queryText, successToast, toastMessage;

let activeEditor = null;
let invoiceDateEditedByUser = false;

function getLocalDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setInvoiceDateDefault(forceToday = false) {
    const dateInput = document.getElementById('invoiceDate');
    if (!dateInput || (!forceToday && (invoiceDateEditedByUser || dateInput.value === getLocalDateInputValue()))) return;

    dateInput.value = getLocalDateInputValue();
    updatePreviewText('invoice-date', formatDate(new Date(`${dateInput.value}T00:00:00`)));
}

let invoicePreviewFitFrame = null;

function fitInvoicePreviewToViewport() {
    const previewPane = document.querySelector('.preview-pane');
    const invoicePreview = document.getElementById('invoicePreview');
    if (!previewPane || !invoicePreview || !invoicePreview.offsetWidth) return;

    if (window.innerWidth > 1024) {
        ['transform', 'transform-origin', 'min-width', 'width', 'margin-left', 'margin-bottom'].forEach(property => {
            invoicePreview.style.removeProperty(property);
        });
        return;
    }

    invoicePreview.style.minWidth = '0';
    invoicePreview.style.width = '210mm';

    const paneStyle = window.getComputedStyle(previewPane);
    const availableWidth = previewPane.clientWidth -
        parseFloat(paneStyle.paddingLeft) - parseFloat(paneStyle.paddingRight);
    const naturalWidth = invoicePreview.offsetWidth;
    const naturalHeight = invoicePreview.offsetHeight;
    const scale = Math.min(1, availableWidth / naturalWidth);

    invoicePreview.style.transformOrigin = 'top left';
    invoicePreview.style.transform = `scale(${scale})`;
    invoicePreview.style.marginLeft = `${Math.max(0, (availableWidth - naturalWidth * scale) / 2)}px`;
    invoicePreview.style.marginBottom = `${-naturalHeight * (1 - scale)}px`;
}

function scheduleInvoicePreviewFit() {
    if (invoicePreviewFitFrame !== null) cancelAnimationFrame(invoicePreviewFitFrame);
    invoicePreviewFitFrame = requestAnimationFrame(() => {
        invoicePreviewFitFrame = null;
        fitInvoicePreviewToViewport();
    });
}

function setupInvoicePreviewFit() {
    const previewPane = document.querySelector('.preview-pane');
    const invoicePreview = document.getElementById('invoicePreview');
    if (!previewPane || !invoicePreview) return;

    window.addEventListener('resize', scheduleInvoicePreviewFit);
    if (typeof ResizeObserver !== 'undefined') {
        const resizeObserver = new ResizeObserver(scheduleInvoicePreviewFit);
        resizeObserver.observe(previewPane);
        resizeObserver.observe(invoicePreview);
    }

    const contentObserver = new MutationObserver(scheduleInvoicePreviewFit);
    contentObserver.observe(invoicePreview, { childList: true, characterData: true, subtree: true });
    scheduleInvoicePreviewFit();
}

// Utility to get value from either input or rich-editable div
function getFieldVal(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.classList.contains('rich-editable')) {
        // textContent is used as fallback because innerText is empty for hidden elements (display:none)
        return (el.innerText && el.innerText.trim() !== '') ? el.innerText : (el.textContent || '');
    }
    return el.value || '';
}

// Initialize
function initApp() {
    try {
        // Resolve all selectors after DOM is ready
        productBody = document.getElementById('productBody');
        addRowBtn = document.getElementById('addRow');
        downloadBtn = document.getElementById('downloadBtn');
        downloadMenu = document.getElementById('downloadMenu');
        dropdownItems = document.querySelectorAll('.dropdown-item');
        sameAsBillTo = document.getElementById('sameAsBillTo');
        shipToFields = document.getElementById('shipToFields');
        invoiceForm = document.getElementById('invoiceForm');
        darkModeIcon = document.getElementById('darkModeIcon');
        darkModeBtn = document.getElementById('darkModeBtn');
        copySelector = document.getElementById('copySelector');
        searchOldBtn = document.getElementById('searchOldBtn');
        historyModal = document.getElementById('historyModal');
        closeModal = document.getElementById('closeModal');
        historyResults = document.getElementById('historyResults');
        loginOverlay = document.getElementById('loginOverlay');
        loginBtn = document.getElementById('loginBtn');
        logoutBtn = document.getElementById('logoutBtn');
        loginUserId = document.getElementById('loginUserId');
        loginPassword = document.getElementById('loginPassword');
        loginError = document.getElementById('loginError');

        // Sidebar & Views
        sidebarBtns = document.querySelectorAll('.sidebar-btn');
        dashboardView = document.getElementById('dashboardView');
        createInvoiceView = document.getElementById('createInvoiceView');
        totalInvoicesCount = document.getElementById('totalInvoicesCount');
        dashboardTableBody = document.getElementById('dashboardTableBody');
        dashboardFilters = document.querySelectorAll('.dashboard-filter');
        resetFiltersBtn = document.getElementById('resetFilters');
        sidebar = document.getElementById('sidebar');
        sidebarToggle = document.getElementById('sidebarToggle');
        btnDownloadExcel = document.getElementById('btnDownloadExcel');

        // Views
        homeView = document.getElementById('homeView');
        helpView = document.getElementById('helpView');
        queryListContainer = document.getElementById('queryListContainer');
        queryModal = document.getElementById('queryModal');
        btnOpenQueryForm = document.getElementById('btnOpenQueryForm');
        closeQueryModal = document.getElementById('closeQueryModal');
        btnCancelQuery = document.getElementById('btnCancelQuery');
        btnSubmitQuery = document.getElementById('btnSubmitQuery');
        queryText = document.getElementById('queryText');
        successToast = document.getElementById('successToast');
        toastMessage = document.getElementById('toastMessage');

        // Check Auth
        checkAuth();

        // Add 1 default row
        if (productBody && productBody.children.length === 0) addNewRow();

        // Default to today's local date while allowing the user to change it.
        // Override browser-restored form values on a fresh page load. The user
        // can still edit the date after initialization.
        setInvoiceDateDefault(true);

        // Setup event listeners
        setupEventListeners();
        setupInvoicePreviewFit();

        // Initial sync of all default values
        syncAllToPreview();

        // Check Dark Mode Preference
        if (typeof initDarkMode === 'function') initDarkMode();


        // Migrate old localStorage data to MongoDB
        migrateOldData();

        console.log("App Initialized Successfully");
    } catch (err) {
        console.error("Initialization error:", err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Migration Script
async function migrateOldData() {
    const history = JSON.parse(localStorage.getItem('billix-history') || '[]');
    if (history.length > 0) {
        showToast("Migrating old invoices to database...", "🔄");
        for (const inv of history) {
            try {
                // Ensure proper ID mapping if needed, otherwise backend auto-generates _id
                delete inv.id;
                await fetch('/api/invoices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inv)
                });
            } catch (err) {
                console.error("Migration error", err);
            }
        }
        localStorage.removeItem('billix-history');
        showToast("Migration complete!", "✅");
        if (typeof initDashboard === 'function') initDashboard();
    }

    const queries = JSON.parse(localStorage.getItem('billix-queries') || '[]');
    if (queries.length > 0) {
        for (const q of queries) {
            try {
                await fetch('/api/queries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(q)
                });
            } catch (err) {
                console.error("Migration error", err);
            }
        }
        localStorage.removeItem('billix-queries');
    }
}


// Editor sync utility
function syncEditorToPreview(editor) {
    const syncKey = editor.getAttribute('data-sync');
    if (syncKey) {
        updatePreviewText(syncKey, editor.innerHTML, true);
        if (sameAsBillTo && sameAsBillTo.checked && syncKey.startsWith('bill-to-')) {
            const shipKey = syncKey.replace('bill-to-', 'ship-to-');
            updatePreviewText(shipKey, editor.innerHTML, true);
        }
    }
}

function attachEditorListeners(editor) {
    if (!editor) return;
    editor.addEventListener('input', () => {
        syncEditorToPreview(editor);
    });
    // Prevent enter key and handle paste on single-line editors
    if (editor.classList.contains('single-line')) {
        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault();
        });
        editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const cleanText = text.replace(/\r?\n|\r/g, " ");
            document.execCommand('insertText', false, cleanText);
        });
    }
}

function initDarkMode() {
    try {
        const savedTheme = localStorage.getItem('billix-theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-mode');
            if (darkModeIcon) {
                darkModeIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1.1rem" height="1.1rem"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;
            }
        }
    } catch (e) {
        console.error("Dark mode init failed", e);
    }
}


function setupEventListeners() {
    // Helper to get value from either input or contenteditable
    const getVal = (id) => {
        const el = document.getElementById(id);
        if (!el) return '';
        return el.classList.contains('rich-editable') ? el.innerText : el.value;
    };

    // Checkbox for Ship To
    if (sameAsBillTo) {
        sameAsBillTo.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (shipToFields) shipToFields.classList.add('hidden');
                // Sync Ship To with Bill To in preview
                const previewName = document.getElementById('preview-ship-to-name');
                const previewAddr = document.getElementById('preview-ship-to-address');
                const previewGST = document.getElementById('preview-ship-to-gst');
                const previewState = document.getElementById('preview-ship-to-state');
                const previewStateName = document.getElementById('preview-ship-to-state-name');
                if (previewName) previewName.textContent = getVal('buyerName');
                if (previewAddr) previewAddr.textContent = getVal('buyerAddress');
                if (previewGST) previewGST.textContent = getVal('buyerGST');
                if (previewState) previewState.textContent = getVal('buyerStateCode');
                if (previewStateName) {
                    const buyerStateSelect = document.getElementById('buyerState');
                    if (buyerStateSelect && buyerStateSelect.selectedIndex >= 0) {
                        previewStateName.textContent = buyerStateSelect.options[buyerStateSelect.selectedIndex].text.toUpperCase();
                    }
                }
            } else {
                if (shipToFields) shipToFields.classList.remove('hidden');
            }
        });
    }

    // Dark Mode Toggle
    if (darkModeBtn) {
        darkModeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            if (darkModeIcon) {
                darkModeIcon.innerHTML = isDark
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1.1rem" height="1.1rem"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="1.1rem" height="1.1rem"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;
            }
            localStorage.setItem('billix-theme', isDark ? 'dark' : 'light');
        });
    }

    // Copy Type Selector
    if (copySelector) {
        copySelector.addEventListener('change', (e) => {
            const copyText = document.getElementById('copyText');
            if (copyText) copyText.textContent = `(${e.target.value})`;
        });
    }



    // Row management
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            addNewRow();
            calculateTotals();
        });
    }

    // Live Sync & Calculations
    if (invoiceForm) {
        invoiceForm.addEventListener('input', (e) => {
            if (e.target.id === 'invoiceDate') invoiceDateEditedByUser = true;
            const syncKey = e.target.getAttribute('data-sync');

            if (syncKey) {
                let isRich = e.target.classList.contains('rich-editable');
                let val = isRich ? e.target.innerHTML : e.target.value;
                if (e.target.type === 'date') val = formatDate(new Date(val));
                updatePreviewText(syncKey, val, isRich);

                // If Ship To is synced with Bill To
                if (sameAsBillTo && sameAsBillTo.checked && syncKey.startsWith('bill-to-')) {
                    const shipKey = syncKey.replace('bill-to-', 'ship-to-');
                    updatePreviewText(shipKey, val, isRich);
                }
            }

            // Trigger calculations if numerical inputs change
            if (e.target.type === 'number' || e.target.classList.contains('calc-trigger')) {
                const row = e.target.closest('tr');
                if (row) calculateRow(row);
                calculateTotals();
            }
        });
        invoiceForm.addEventListener('change', (e) => {
            if (e.target.id === 'invoiceDate') invoiceDateEditedByUser = true;
        });
    }

    // Dropdown Toggle
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadBtn.parentElement.classList.toggle('open');
        });

        // Dropdown item selection (Raises PDF Download Request for selected option)
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                const copyType = item.getAttribute('data-copy');
                requestPDFDownload(copyType);
                downloadBtn.parentElement.classList.remove('open');
            });
        });

        // Close dropdown clicking outside
        window.addEventListener('click', () => {
            downloadBtn.parentElement.classList.remove('open');
        });
    }

    // State Selector Logic
    const stateSelectors = document.querySelectorAll('.state-selector');
    stateSelectors.forEach(select => {
        select.addEventListener('change', (e) => {
            const targetId = select.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                if (targetInput.classList.contains('rich-editable')) {
                    targetInput.innerHTML = select.value;
                } else {
                    targetInput.value = select.value;
                }
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));

                // Sync the state name to the preview if a name element exists
                const syncKey = targetInput.getAttribute('data-sync');
                if (syncKey) {
                    const nameId = `preview-${syncKey}-name`;
                    const nameEl = document.getElementById(nameId);
                    if (nameEl) {
                        nameEl.textContent = select.options[select.selectedIndex].text.toUpperCase();
                    }

                    // If 'Same as Bill To' is checked and this is the buyer state, sync to ship-to preview as well
                    const sameAsBillTo = document.getElementById('sameAsBillTo');
                    if (sameAsBillTo && sameAsBillTo.checked && syncKey === 'bill-to-state') {
                        const shipToNameEl = document.getElementById('preview-ship-to-state-name');
                        const shipToCodeEl = document.getElementById('preview-ship-to-state');
                        if (shipToNameEl) shipToNameEl.textContent = select.options[select.selectedIndex].text.toUpperCase();
                        if (shipToCodeEl) shipToCodeEl.textContent = select.value;
                    }
                }
            }
        });
    });

    // History Search
    if (searchOldBtn) {
        searchOldBtn.addEventListener('click', () => {
            const day = document.getElementById('searchDay').value;
            const month = document.getElementById('searchMonth').value;
            const year = document.getElementById('searchYear').value;
            searchHistory(day, month, year);
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            if (historyModal) historyModal.classList.add('hidden');
        });
    }

    window.addEventListener('click', (e) => {
        if (historyModal && e.target === historyModal) historyModal.classList.add('hidden');
    });

    // Login Logic
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    }

    // Logout Logic
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('billix-auth');
            window.location.reload();
        });
    }

    // Sidebar Navigation
    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            switchView(view);
        });
    });

    // Dashboard Filters
    dashboardFilters.forEach(filter => {
        filter.addEventListener('change', () => {
            renderDashboardRecords();
        });
    });

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            dashboardFilters.forEach(f => f.value = '');
            renderDashboardRecords();
        });
    }

    if (btnDownloadExcel) {
        btnDownloadExcel.addEventListener('click', downloadExcel);
    }

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Help View Events
    if (btnOpenQueryForm) {
        btnOpenQueryForm.addEventListener('click', () => {
            if (queryModal) queryModal.classList.remove('hidden');
        });
    }

    if (closeQueryModal) {
        closeQueryModal.addEventListener('click', () => {
            if (queryModal) queryModal.classList.add('hidden');
        });
    }

    if (btnCancelQuery) {
        btnCancelQuery.addEventListener('click', () => {
            if (queryModal) queryModal.classList.add('hidden');
        });
    }

    if (btnSubmitQuery) {
        btnSubmitQuery.addEventListener('click', submitQuery);
    }

    // Clear PDF Requests button
    const clearPDFRequestsBtn = document.getElementById('clearPDFRequestsBtn');
    if (clearPDFRequestsBtn) {
        clearPDFRequestsBtn.addEventListener('click', clearAllPDFRequests);
    }
}

function toggleSidebar() {
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');

    // Update icon ☰ → ✖
    if (sidebarToggle) {
        sidebarToggle.innerHTML = sidebar.classList.contains('collapsed')
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        sidebarToggle.title = sidebar.classList.contains('collapsed') ? 'Expand Sidebar' : 'Collapse Sidebar';
    }
}

function switchView(view) {
    if (sidebarBtns) {
        sidebarBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === view));
    }

    if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.add('hidden');
        if (helpView) helpView.classList.add('hidden');
        initDashboard();
    } else if (view === 'home') {
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.remove('hidden');
        if (helpView) helpView.classList.add('hidden');
    } else if (view === 'help') {
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.add('hidden');
        if (helpView) {
            helpView.classList.remove('hidden');
            initHelp();
        }
        const profileView = document.getElementById('profileView');
        if (profileView) profileView.classList.add('hidden');
    } else if (view === 'profile') {
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.add('hidden');
        if (helpView) helpView.classList.add('hidden');
        const profileView = document.getElementById('profileView');
        const pdfDownloadsView = document.getElementById('pdfDownloadsView');
        if (pdfDownloadsView) pdfDownloadsView.classList.add('hidden');
        if (profileView) {
            profileView.classList.remove('hidden');
            initProfile();
        }
    } else if (view === 'pdf-downloads') {
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.add('hidden');
        if (helpView) helpView.classList.add('hidden');
        const profileView = document.getElementById('profileView');
        if (profileView) profileView.classList.add('hidden');
        const ledgerView = document.getElementById('ledgerView');
        if (ledgerView) ledgerView.classList.add('hidden');
        const pdfDownloadsView = document.getElementById('pdfDownloadsView');
        if (pdfDownloadsView) {
            pdfDownloadsView.classList.remove('hidden');
            renderPDFDownloadsView();
        }
    } else if (view === 'ledger') {
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.add('hidden');
        if (homeView) homeView.classList.add('hidden');
        if (helpView) helpView.classList.add('hidden');
        const profileView = document.getElementById('profileView');
        if (profileView) profileView.classList.add('hidden');
        const pdfDownloadsView = document.getElementById('pdfDownloadsView');
        if (pdfDownloadsView) pdfDownloadsView.classList.add('hidden');
        const ledgerView = document.getElementById('ledgerView');
        if (ledgerView) {
            ledgerView.classList.remove('hidden');
            initLedgerModule();
        }
    } else {
        setInvoiceDateDefault();
        dashboardView.classList.add('hidden');
        createInvoiceView.classList.remove('hidden');
        scheduleInvoicePreviewFit();
        if (homeView) homeView.classList.add('hidden');
        if (helpView) helpView.classList.add('hidden');
        const profileView = document.getElementById('profileView');
        if (profileView) profileView.classList.add('hidden');
        const pdfDownloadsViewEl = document.getElementById('pdfDownloadsView');
        if (pdfDownloadsViewEl) pdfDownloadsViewEl.classList.add('hidden');
        const ledgerViewEl = document.getElementById('ledgerView');
        if (ledgerViewEl) ledgerViewEl.classList.add('hidden');
        autoPopulateCompanyDetails();
    }
}

function initHelp() {
    renderHelpQueries();
}

async function submitQuery() {
    const text = queryText.value.trim();
    if (!text) {
        showToast("Please enter a query first", "❌");
        return;
    }

    const newQuery = {
        id: Date.now(),
        text: text,
        status: 'Pending',
        date: new Date().toISOString(),
        replies: []
    };

    try {
        await fetch('/api/queries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newQuery)
        });

        queryText.value = '';
        queryModal.classList.add('hidden');

        showToast("Your query has been posted successfully", "✅");
        renderHelpQueries();
    } catch (err) {
        console.error(err);
        showToast("Error submitting query", "❌");
    }
}

async function renderHelpQueries() {
    if (!queryListContainer) return;

    try {
        const response = await fetch('/api/queries');
        const queries = await response.json();
        queryListContainer.innerHTML = '';

        if (queries.length === 0) {
            queryListContainer.innerHTML = '<div class="empty-state"><p>No queries posted yet.</p></div>';
            return;
        }

        queries.forEach(q => {
            const div = document.createElement('div');
            div.className = 'query-item';

            let repliesHtml = '';
            if (q.replies && q.replies.length > 0) {
                repliesHtml = `
                    <div class="query-replies">
                        ${q.replies.map(r => `
                            <div class="reply-item reply-${r.sender.toLowerCase()}">
                                <div class="reply-header">
                                    <span class="sender-name">${r.sender}</span>
                                    <span class="reply-date">${formatDate(new Date(r.date))}</span>
                                </div>
                                <div class="reply-content">${r.text}</div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            const isCompleted = q.status === 'Completed';

            div.innerHTML = `
                <div class="query-header">
                    <span class="query-date">${formatDate(new Date(q.date))}</span>
                    <span class="query-status status-${q.status.toLowerCase()}">${q.status}</span>
                </div>
                <div class="query-content">${q.text}</div>
                
                ${repliesHtml}

                <div class="query-actions">
                    <button class="btn btn-secondary btn-inline" onclick="toggleReplyInput(${q.id})" style="display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Reply
                    </button>
                    <button class="btn btn-secondary btn-inline" onclick="markQueryCompleted(${q.id})" ${isCompleted ? 'disabled' : ''} style="display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ${isCompleted ? 'Completed' : 'Mark as Completed'}
                    </button>
                </div>

                <div id="reply-container-${q.id}" class="reply-input-container hidden">
                    <textarea id="reply-text-${q.id}" class="reply-textarea" rows="3" placeholder="Type your reply..."></textarea>
                    <div style="text-align: right;">
                        <button class="btn btn-secondary btn-sm" onclick="toggleReplyInput(${q.id})">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="submitReply(${q.id})">Send Reply</button>
                    </div>
                </div>
            `;
            queryListContainer.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        queryListContainer.innerHTML = '<div class="empty-state"><p>Error loading queries.</p></div>';
    }
}

window.toggleReplyInput = (id) => {
    const container = document.getElementById(`reply-container-${id}`);
    if (container) container.classList.toggle('hidden');
};

window.markQueryCompleted = async (id) => {
    try {
        await fetch(`/api/queries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Completed' })
        });
        showToast("Query marked as completed", "✅");
        renderHelpQueries();
    } catch (err) {
        console.error(err);
        showToast("Error updating query", "❌");
    }
};

window.submitReply = async (id) => {
    const textEl = document.getElementById(`reply-text-${id}`);
    const text = textEl.value.trim();
    if (!text) return;

    try {
        const response = await fetch('/api/queries');
        const queries = await response.json();
        const q = queries.find(item => item.id === id);
        if (q) {
            if (!q.replies) q.replies = [];
            q.replies.push({
                id: Date.now(),
                text: text,
                sender: 'User',
                date: new Date().toISOString()
            });
            await fetch(`/api/queries/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ replies: q.replies })
            });
            textEl.value = '';
            toggleReplyInput(id);
            showToast("Reply sent successfully", "✅");
            renderHelpQueries();
        }
    } catch (err) {
        console.error(err);
        showToast("Error sending reply", "❌");
    }
};

function showToast(message, icon = '✅') {
    if (!successToast || !toastMessage) return;

    toastMessage.textContent = message;
    const iconSpan = successToast.querySelector('.toast-icon');
    if (iconSpan) {
        if (icon === '✅') {
            iconSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: #22c55e;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (icon === '❌') {
            iconSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: #ef4444;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        } else if (icon === '⚠️') {
            iconSpan.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20" style="color: #f59e0b;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        } else {
            iconSpan.textContent = icon;
        }
    }

    successToast.classList.remove('hidden');

    setTimeout(() => {
        successToast.classList.add('hidden');
    }, 4000);
}

window.globalHistory = [];

async function initDashboard() {
    try {
        const res = await fetch('/api/invoices');
        window.globalHistory = await res.json();
    } catch (err) {
        console.error(err);
        window.globalHistory = [];
    }

    if (totalInvoicesCount) totalInvoicesCount.textContent = window.globalHistory.length;

    populateDashboardFilters(window.globalHistory);
    renderDashboardRecords();
}

function populateDashboardFilters(history) {
    const filters = {
        filterBillToName: new Set(),
        filterShipToName: new Set(),
        filterBillToGST: new Set(),
        filterShipToGST: new Set(),
        filterBillToState: new Set(),
        filterShipToState: new Set(),
        filterYear: new Set(),
        filterMonth: new Set()
    };

    history.forEach(inv => {
        if (inv.buyer) filters.filterBillToName.add(inv.buyer);

        // Ship To Name might be in form data
        const shipName = inv.form['shipToName'] || inv.buyer;
        if (shipName) filters.filterShipToName.add(shipName);

        if (inv.form['buyerGST']) filters.filterBillToGST.add(inv.form['buyerGST']);
        if (inv.form['shipToGST']) filters.filterShipToGST.add(inv.form['shipToGST']);

        if (inv.form['buyerStateCode']) filters.filterBillToState.add(inv.form['buyerStateCode']);
        if (inv.form['shipToStateCode']) filters.filterShipToState.add(inv.form['shipToStateCode']);

        if (inv.date) {
            const d = new Date(inv.date);
            if (!isNaN(d.getTime())) {
                filters.filterYear.add(d.getFullYear().toString());
                filters.filterMonth.add((d.getMonth() + 1).toString().padStart(2, '0'));
            }
        }
    });

    // Populate dropdowns
    for (const [id, values] of Object.entries(filters)) {
        const select = document.getElementById(id);
        if (!select) continue;

        const currentValue = select.value;
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        Array.from(values).sort().forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            if (id === 'filterMonth') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                opt.textContent = months[parseInt(val) - 1];
            }
            select.appendChild(opt);
        });
        select.value = currentValue;
    }
}

function renderDashboardRecords() {
    if (!dashboardTableBody) return;

    const history = window.globalHistory || [];
    const filters = {};
    dashboardFilters.forEach(f => {
        if (f.value) filters[f.id] = f.value;
    });

    const filtered = history.filter(inv => {
        const d = new Date(inv.date);
        const invYear = d.getFullYear().toString();
        const invMonth = (d.getMonth() + 1).toString().padStart(2, '0');

        if (filters.filterBillToName && inv.buyer !== filters.filterBillToName) return false;
        if (filters.filterShipToName && (inv.form['shipToName'] || inv.buyer) !== filters.filterShipToName) return false;
        if (filters.filterBillToGST && inv.form['buyerGST'] !== filters.filterBillToGST) return false;
        if (filters.filterShipToGST && inv.form['shipToGST'] !== filters.filterShipToGST) return false;
        if (filters.filterBillToState && inv.form['buyerStateCode'] !== filters.filterBillToState) return false;
        if (filters.filterShipToState && inv.form['shipToStateCode'] !== filters.filterShipToState) return false;
        if (filters.filterYear && invYear !== filters.filterYear) return false;
        if (filters.filterMonth && invMonth !== filters.filterMonth) return false;

        return true;
    });

    dashboardTableBody.innerHTML = '';

    if (filtered.length === 0) {
        dashboardTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No records found matching filters.</td></tr>';
        return;
    }

    filtered.forEach(inv => {
        // Calculate total amount for display
        let total = 0;
        if (inv.products) {
            inv.products.forEach(p => total += (parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0));
        }
        // Add taxes from form if available
        const cgst = parseFloat(inv.form['cgst']) || 0;
        const sgst = parseFloat(inv.form['sgst']) || 0;
        const igst = parseFloat(inv.form['igst']) || 0;
        total = total + (total * (cgst + sgst + igst) / 100);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(new Date(inv.date))}</td>
            <td><strong>${inv.invNo}</strong></td>
            <td>${inv.buyer}</td>
            <td><span class="badge-amount">₹ ${formatNumber(total)}</span></td>
        `;
        dashboardTableBody.appendChild(tr);
    });
}

function downloadExcel() {
    const history = window.globalHistory || [];
    const filters = {};
    dashboardFilters.forEach(f => {
        if (f.value) filters[f.id] = f.value;
    });

    const filtered = history.filter(inv => {
        const d = new Date(inv.date);
        const invYear = d.getFullYear().toString();
        const invMonth = (d.getMonth() + 1).toString().padStart(2, '0');

        if (filters.filterBillToName && inv.buyer !== filters.filterBillToName) return false;
        if (filters.filterShipToName && (inv.form['shipToName'] || inv.buyer) !== filters.filterShipToName) return false;
        if (filters.filterBillToGST && inv.form['buyerGST'] !== filters.filterBillToGST) return false;
        if (filters.filterShipToGST && inv.form['shipToGST'] !== filters.filterShipToGST) return false;
        if (filters.filterBillToState && inv.form['buyerStateCode'] !== filters.filterBillToState) return false;
        if (filters.filterShipToState && inv.form['shipToStateCode'] !== filters.filterShipToState) return false;
        if (filters.filterYear && invYear !== filters.filterYear) return false;
        if (filters.filterMonth && invMonth !== filters.filterMonth) return false;

        return true;
    });

    if (filtered.length === 0) {
        showToast("No data available for selected filters", "⚠️");
        return;
    }

    showToast("Generating Excel file...", "🔄");

    try {
        const excelData = filtered.map(inv => {
            // Calculate total amount
            let subTotal = 0;
            let productDetails = '';
            if (inv.products) {
                inv.products.forEach(p => {
                    const lineTotal = (parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0);
                    subTotal += lineTotal;
                    productDetails += `${p.desc} (${p.qty} ${p.qtyUnit} @ ${p.rate}), `;
                });
            }
            const cgst = parseFloat(inv.form['cgst']) || 0;
            const sgst = parseFloat(inv.form['sgst']) || 0;
            const igst = parseFloat(inv.form['igst']) || 0;
            const total = subTotal + (subTotal * (cgst + sgst + igst) / 100);

            return {
                'Invoice Number': inv.invNo,
                'Date': formatDate(new Date(inv.date)),
                'Bill To Name': inv.buyer,
                'Ship To Name': inv.form['shipToName'] || inv.buyer,
                'Bill To GSTIN': inv.form['buyerGST'] || '',
                'Ship To GSTIN': inv.form['shipToGST'] || '',
                'Bill To State': inv.form['buyerStateCode'] || '',
                'Ship To State': inv.form['shipToStateCode'] || '',
                'Bill To Address': inv.form['buyerAddress'] || '',
                'Ship To Address': inv.form['shipToAddress'] || '',
                'Transport': inv.form['transportName'] || '',
                'Vehicle No': inv.form['lorryNo'] || '',
                'Subtotal': subTotal,
                'CGST %': cgst,
                'SGST %': sgst,
                'IGST %': igst,
                'Total Amount': total,
                'Items': productDetails.slice(0, -2) // Remove trailing comma
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

        // Format column widths
        const wscols = [
            { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 25 }, { wch: 18 }, { wch: 18 },
            { wch: 15 }, { wch: 15 }, { wch: 35 }, { wch: 35 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 50 }
        ];
        worksheet['!cols'] = wscols;

        const fileName = `Invoices_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        showToast("Excel downloaded successfully", "✅");
    } catch (error) {
        console.error("Excel generation failed:", error);
        showToast("Failed to generate Excel", "❌");
    }
}

function checkAuth() {
    const isAuth = sessionStorage.getItem('billix-auth') === 'true';
    if (isAuth) {
        loginOverlay.classList.add('hidden');
        switchView('home');
    } else {
        loginOverlay.classList.remove('hidden');
    }
}

function handleLogin() {
    const userEl = document.getElementById('loginUserId');
    const passEl = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    const overlayEl = document.getElementById('loginOverlay');

    if (!userEl || !passEl) {
        console.error("Login elements missing");
        return;
    }

    const userId = userEl.value.trim();
    const password = passEl.value.trim();

    // Hardcoded Credentials - Case insensitive for User ID
    if (userId.toLowerCase() === 'avneesh.co' && password === 'Avneesh@2026') {
        try {
            sessionStorage.setItem('billix-auth', 'true');
        } catch (e) {
            console.error("Session storage blocked:", e);
        }

        if (overlayEl) {
            overlayEl.style.opacity = '0';
            setTimeout(() => {
                overlayEl.style.display = 'none';
                overlayEl.classList.add('hidden');
                // Redirect to Home
                if (typeof switchView === 'function') {
                    switchView('home');
                } else {
                    window.location.reload(); // Fallback
                }
            }, 500);
        }
    } else {
        if (errorEl) {
            errorEl.classList.remove('hidden');
            setTimeout(() => {
                errorEl.classList.add('hidden');
            }, 3000);
        }
    }
}

function updatePreviewText(key, value, isRich = false) {
    const el = document.getElementById(`preview-${key}`) || document.getElementById(`p-${key}`);
    if (el) {
        if (isRich) {
            el.innerHTML = value || '';
        } else {
            el.textContent = value || '';
        }
    }
}

function syncAllToPreview() {
    const inputs = invoiceForm.querySelectorAll('[data-sync]');
    inputs.forEach(input => {
        let isRich = input.classList.contains('rich-editable');
        let val = isRich ? input.innerHTML : input.value;
        if (input.type === 'date') val = formatDate(new Date(val));
        updatePreviewText(input.getAttribute('data-sync'), val, isRich);
    });
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function addNewRow() {
    const rowCount = productBody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="sn-cell">${rowCount}.</td>
        <td><div class="rich-editable single-line product-desc calc-trigger" contenteditable="true" data-placeholder="e.g. MS SKULL"></div></td>
        <td><div class="rich-editable single-line product-hsn calc-trigger center-text" contenteditable="true" data-placeholder="HSN/SAC"></div></td>
        <td>
            <input type="number" class="product-qty calc-trigger right-text" value="0" step="0.001">
            <select class="product-unit calc-trigger" style="font-size: 0.65rem; padding: 2px; margin-top: 2px; width: 100%;">
                <option value="KGS" selected>Kg</option>
                <option value="NOS">Nos</option>
                <option value="PCS">Pcs</option>
                <option value="GRAM">Gram</option>
                <option value="TON">Ton</option>
                <option value="MT">Metric Ton</option>
                <option value="LITRE">Litre</option>
                <option value="ML">Ml</option>
                <option value="METER">Meter</option>
                <option value="FEET">Feet</option>
                <option value="BOX">Box</option>
                <option value="PACK">Pack</option>
                <option value="DOZEN">Dozen</option>
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
                <option value="UNITS">Units</option>
                <option value="OTHER">Other</option>
            </select>
        </td>
        <td>
            <input type="number" class="product-rate calc-trigger right-text" value="0" step="0.01">
            <select class="product-rate-unit calc-trigger" style="font-size: 0.65rem; padding: 2px; margin-top: 2px; width: 100%;">
                <option value="Per KGS" selected>Per Kg</option>
                <option value="Per NOS">Per Nos</option>
                <option value="Per PCS">Per Pcs</option>
                <option value="Per GRAM">Per Gram</option>
                <option value="Per TON">Per Ton</option>
                <option value="Per MT">Per Metric Ton</option>
                <option value="Per LITRE">Per Litre</option>
                <option value="Per ML">Per Ml</option>
                <option value="Per METER">Per Meter</option>
                <option value="Per FEET">Per Feet</option>
                <option value="Per BOX">Per Box</option>
                <option value="Per PACK">Per Pack</option>
                <option value="Per DOZEN">Per Dozen</option>
                <option value="Per HOURS">Per Hour</option>
                <option value="Per DAYS">Per Day</option>
                <option value="Per UNITS">Per Unit</option>
                <option value="OTHER">Other</option>
            </select>
        </td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row" style="padding: 0.2rem 0.5rem; font-size: 0.9rem;">×</button></td>
    `;

    const qtyUnit = tr.querySelector('.product-unit');
    const rateUnit = tr.querySelector('.product-rate-unit');

    qtyUnit.addEventListener('change', () => {
        rateUnit.value = "Per " + qtyUnit.value;
        updatePreviewTable();
    });

    tr.querySelector('.remove-row').addEventListener('click', () => {
        if (productBody.children.length > 1) {
            tr.remove();
            updateRowNumbers();
            calculateTotals();
        }
    });

    productBody.appendChild(tr);

    // Attach listeners to new rich-editable fields
    tr.querySelectorAll('.rich-editable').forEach(editor => attachEditorListeners(editor));

    updatePreviewTable();
}

function updateRowNumbers() {
    Array.from(productBody.children).forEach((row, index) => {
        row.cells[0].textContent = (index + 1) + '.';
    });
}

function calculateRow(row) {
    // This function is kept for legacy but calculations are now centralized in updatePreviewTable
    updatePreviewTable();
}

function updatePreviewTable() {
    const previewBody = document.getElementById('preview-product-body');
    previewBody.innerHTML = '';

    let subTotal = 0;
    const rows = Array.from(productBody.children);

    rows.forEach((row, index) => {
        const descEl = row.querySelector('.product-desc');
        const hsnEl = row.querySelector('.product-hsn');
        const desc = descEl.classList.contains('rich-editable') ? descEl.innerHTML : descEl.value;
        const hsn = hsnEl.classList.contains('rich-editable') ? hsnEl.innerHTML : hsnEl.value;
        const qty = parseFloat(row.querySelector('.product-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.product-rate').value) || 0;
        const qtyUnit = row.querySelector('.product-unit').value;
        const rateUnit = row.querySelector('.product-rate-unit').value;
        const amount = qty * rate;
        subTotal += amount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="center">${index + 1}.</td>
            <td>${desc || '---'}</td>
            <td class="center">${hsn || '---'}</td>
            <td class="center">${formatNumber(qty)}<br>${qtyUnit}</td>
            <td class="center">${formatNumber(rate)} /-<br>${rateUnit}</td>
            <td class="right">${formatNumber(amount)}</td>
        `;
        previewBody.appendChild(tr);
    });

    // Add spacer row if items are few
    if (rows.length < 5) {
        const spacer = document.createElement('tr');
        spacer.className = 'spacer-row';
        spacer.innerHTML = `<td colspan="6"></td>`;
        previewBody.appendChild(spacer);
    }

    calculateTotals(subTotal);
}

function calculateTotals(subTotalValue) {
    let subTotal = subTotalValue;
    if (subTotal === undefined) {
        subTotal = 0;
        Array.from(productBody.children).forEach(row => {
            const qty = parseFloat(row.querySelector('.product-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.product-rate').value) || 0;
            subTotal += (qty * rate);
        });
    }

    const cgstRate = parseFloat(document.getElementById('cgst').value) || 0;
    const sgstRate = parseFloat(document.getElementById('sgst').value) || 0;
    const igstRate = parseFloat(document.getElementById('igst').value) || 0;

    const cgstVal = (subTotal * cgstRate) / 100;
    const sgstVal = (subTotal * sgstRate) / 100;
    const igstVal = (subTotal * igstRate) / 100;
    const grossTotal = subTotal + cgstVal + sgstVal + igstVal;

    // Update Preview
    document.getElementById('preview-subtotal').textContent = formatNumber(subTotal);

    document.getElementById('preview-cgst-rate').textContent = cgstRate;
    document.getElementById('preview-cgst-val').textContent = cgstVal > 0 ? formatNumber(cgstVal) : '-';

    document.getElementById('preview-sgst-rate').textContent = sgstRate;
    document.getElementById('preview-sgst-val').textContent = sgstVal > 0 ? formatNumber(sgstVal) : '-';

    document.getElementById('preview-igst-rate').textContent = igstRate;
    document.getElementById('preview-igst-val').textContent = igstVal > 0 ? formatNumber(igstVal) : '-';

    document.getElementById('preview-total-amount').textContent = formatNumber(grossTotal);

    const words = numberToWords(Math.round(grossTotal * 100) / 100);
    document.getElementById('preview-amount-words').textContent = words ? (words + " ONLY") : "ZERO RUPEES ONLY";
}

function formatNumber(num) {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Indian Number System Converter
function numberToWords(num) {
    if (num === 0) return '';
    const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
    const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

    const convert_less_than_thousand = (n) => {
        if (n === 0) return '';
        if (n < 20) return a[n];
        const res = b[Math.floor(n / 10)] + a[n % 10];
        return res;
    };

    const convert_with_suffix = (n, suffix) => {
        if (n === 0) return '';
        if (n < 100) return convert_less_than_thousand(n) + suffix;
        return a[Math.floor(n / 100)] + 'HUNDRED ' + convert_less_than_thousand(n % 100) + suffix;
    };

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let str = '';
    str += convert_with_suffix(Math.floor(integerPart / 10000000), 'CRORE ');
    str += convert_with_suffix(Math.floor((integerPart / 100000) % 100), 'LAKH ');
    str += convert_with_suffix(Math.floor((integerPart / 1000) % 100), 'THOUSAND ');
    str += convert_with_suffix(integerPart % 1000, '');

    let result = str.trim();

    if (decimalPart > 0) {
        const paiseStr = convert_with_suffix(decimalPart, '').trim();
        if (result !== '') {
            result += ' AND ' + paiseStr + ' PAISE';
        } else {
            result = paiseStr + ' PAISE';
        }
    }

    return result;
}

// PDF Generation Logic
async function generatePDF(copyType, { returnBlob = false } = {}) {
    showToast("Preparing High-Fidelity PDF...", "🔄");

    const invoicePreview = document.getElementById('invoicePreview');
    if (!invoicePreview) {
        console.error("Invoice preview not found");
        return;
    }

    // A saved invoice restore can sync blank Ship To form fields over the
    // checked Same as Bill To preview. Reapply that setting before cloning the
    // Shree preview so its downloaded copy matches what the user sees.
    const sameAsBillTo = document.getElementById('sameAsBillTo');
    if (invoicePreview.classList.contains('sks-invoice') && sameAsBillTo?.checked) {
        if (typeof window.syncAllToPreview === 'function') window.syncAllToPreview();
        sameAsBillTo.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const invNo = getFieldVal('invoiceNo') || 'Draft';
    const copies = copyType === 'ALL' ?
        ["ORIGINAL FOR RECIPIENT", "DUPLICATE FOR TRANSPORTER", "SUPPLIER COPY"] :
        [copyType];

    // 1. Create a hidden iframe for 100% style and layout isolation
    const iframe = document.createElement('iframe');
    // Hide but keep it "visible" to the browser for rendering
    iframe.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        visibility: hidden; pointer-events: none; z-index: -9999;
    `;
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow.document;

    // 2. Extract all current document styles to maintain pixel-perfect matching
    let stylesHtml = '';
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => {
        stylesHtml += el.outerHTML;
    });

    // 3. Build the isolated content for the PDF
    let contentHtml = '';
    copies.forEach((title, index) => {
        const clone = invoicePreview.cloneNode(true);
        clone.removeAttribute('id');

        // Update the copy text (Original, Duplicate, etc.)
        const copyTextEl = clone.querySelector('#copyText');
        if (copyTextEl) copyTextEl.innerText = `(${title})`;

        // Wrap each copy in a clean container
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page'; // Use class for CSS-based breaks
        pageWrapper.style.cssText = `
            width: 210mm; 
            height: 296.8mm; 
            overflow: hidden;
            padding: 10mm; 
            margin: 0 auto; 
            background: #ffffff; 
            box-sizing: border-box;
            position: relative;
            display: flex;
            flex-direction: column;
        `;

        // Reset invoice-container specific UI styles
        clone.style.cssText = `
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            display: block !important;
            visibility: visible !important;
            flex-grow: 1;
        `;

        pageWrapper.appendChild(clone);
        contentHtml += pageWrapper.outerHTML;
    });

    // 4. Inject the content into the iframe inside a specific target div
    frameDoc.open();
    frameDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            ${stylesHtml}
            <style>
                html, body { 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    background: #ffffff !important; 
                }
                * { 
                    -webkit-print-color-adjust: exact !important; 
                    color-adjust: exact !important; 
                    margin-bottom: 0 !important; /* Prevent bottom-heavy overflow */
                }
                #pdf-render-target { width: 210mm; margin: 0 auto; }
                .pdf-page { break-after: page; }
                .pdf-page:last-child { break-after: avoid; }
                .invoice-footer { margin-top: 5mm !important; margin-bottom: 0 !important; }
            </style>
        </head>
        <body>
            <div id="pdf-render-target">${contentHtml}</div>
        </body>
        </html>
    `);
    frameDoc.close();

    // 5. Wait for the iframe and all its resources (CSS, fonts) to load fully
    await new Promise(resolve => {
        if (frameDoc.readyState === 'complete') resolve();
        else iframe.onload = resolve;
    });

    // Safe delay to ensure Google Fonts and layout reflows are stabilized
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        const target = frameDoc.getElementById('pdf-render-target');

        const opt = {
            margin: 0,
            filename: `Invoice_${invNo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                letterRendering: true,
                scrollY: 0,
                scrollX: 0
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
            pagebreak: { mode: 'css', avoid: '.pdf-page' }
        };

        const pdfWorker = html2pdf().set(opt).from(target);
        if (returnBlob) return await pdfWorker.outputPdf('blob');

        await pdfWorker.save();
        await saveToHistory(copyType);
        showToast("PDF Generated Successfully", "✅");
    } catch (error) {
        console.error("Critical Isolated PDF Failure:", error);
        if (returnBlob) throw error;
        showToast("PDF Generation Failed", "❌");
    } finally {
        // Cleanup the isolation layer
        if (iframe.parentNode) document.body.removeChild(iframe);
    }
}


async function saveToHistory(copyType) {
    const invNo = getFieldVal('invoiceNo') || 'Draft';
    const date = document.getElementById('invoiceDate').value || new Date().toISOString();
    const buyer = getFieldVal('buyerName');

    const state = {
        invNo,
        date,
        buyer,
        form: {},
        products: Array.from(productBody.children).map(row => {
            const descEl = row.querySelector('.product-desc');
            const hsnEl = row.querySelector('.product-hsn');
            return {
                desc: descEl.classList.contains('rich-editable') ? descEl.innerHTML : descEl.value,
                hsn: hsnEl.classList.contains('rich-editable') ? hsnEl.innerHTML : hsnEl.value,
                qty: row.querySelector('.product-qty').value,
                rate: row.querySelector('.product-rate').value,
                qtyUnit: row.querySelector('.product-unit').value,
                rateUnit: row.querySelector('.product-rate-unit').value
            };
        })
    };

    const inputs = invoiceForm.querySelectorAll('input, select, .rich-editable');
    inputs.forEach(el => {
        if (el.id) {
            state.form[el.id] = el.classList.contains('rich-editable') ? el.innerHTML : el.value;
        }
    });

    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        
        if (!response.ok) {
            const errData = await response.json();
            console.error("Server Error:", errData);
            showToast("Failed to save to database!", "❌");
        } else {
            if (typeof initDashboard === 'function') initDashboard();
        }
    } catch (err) {
        console.error("Failed to save invoice to DB:", err);
        showToast("Network error saving to database!", "❌");
    }
}

function searchHistory(day, month, year) {
    const history = window.globalHistory || [];
    const filtered = history.filter(inv => {
        const d = new Date(inv.date);
        const invDay = String(d.getDate()).padStart(2, '0');
        const invMonth = String(d.getMonth() + 1).padStart(2, '0');
        const invYear = String(d.getFullYear());

        return (!day || day === invDay) &&
            (!month || month === invMonth) &&
            (!year || year === invYear);
    });

    displayHistoryResults(filtered);
}

function displayHistoryResults(results) {
    historyResults.innerHTML = '';
    if (results.length === 0) {
        historyResults.innerHTML = '<p style="text-align: center; padding: 20px;">No invoices found for the selected criteria.</p>';
    } else {
        results.forEach(inv => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-info">
                    <p><strong>Inv: ${inv.invNo}</strong> | ${formatDate(new Date(inv.date))}</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${inv.buyer}</p>
                </div>
                <div class="history-actions">
                    <button class="btn-icon" onclick="downloadOldInvoiceById('${inv._id}')" style="display: flex; align-items: center; gap: 5px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        PDF
                    </button>
                </div>
            `;
            historyResults.appendChild(div);
        });
    }
    historyModal.classList.remove('hidden');
}

window.downloadOldInvoiceById = (id) => {
    const history = window.globalHistory || [];
    const inv = history.find(i => i._id === id);
    if (inv) {
        downloadLatestSavedInvoice(inv);
        historyModal.classList.add('hidden');
    }
};

function saveCurrentStateAsLatest(copyType) {
    const state = {
        copyType: copyType,
        form: {}
    };

    // Capture all inputs with data-sync
    const inputs = invoiceForm.querySelectorAll('input, select, .rich-editable');
    inputs.forEach(el => {
        if (el.id) {
            state.form[el.id] = el.classList.contains('rich-editable') ? el.innerHTML : el.value;
        }
    });

    // Capture products
    state.products = Array.from(productBody.children).map(row => {
        const descEl = row.querySelector('.product-desc');
        const hsnEl = row.querySelector('.product-hsn');
        return {
            desc: descEl.classList.contains('rich-editable') ? descEl.innerHTML : descEl.value,
            hsn: hsnEl.classList.contains('rich-editable') ? hsnEl.innerHTML : hsnEl.value,
            qty: row.querySelector('.product-qty').value,
            rate: row.querySelector('.product-rate').value,
            qtyUnit: row.querySelector('.product-unit').value,
            rateUnit: row.querySelector('.product-rate-unit').value
        };
    });

    localStorage.setItem('billix-latest-invoice', JSON.stringify(state));
}

async function downloadLatestSavedInvoice(state, { returnBlob = false } = {}) {
    // To generate the PDF, we need the DOM to have the data.
    // We'll backup current state, load saved state, generate, then restore.
    const backup = {
        products: Array.from(productBody.children).map(row => {
            const descEl = row.querySelector('.product-desc');
            const hsnEl = row.querySelector('.product-hsn');
            return {
                desc: descEl.classList.contains('rich-editable') ? descEl.innerHTML : descEl.value,
                hsn: hsnEl.classList.contains('rich-editable') ? hsnEl.innerHTML : hsnEl.value,
                qty: row.querySelector('.product-qty').value,
                rate: row.querySelector('.product-rate').value,
                qtyUnit: row.querySelector('.product-unit').value,
                rateUnit: row.querySelector('.product-rate-unit').value
            };
        }),
        form: {}
    };

    const inputs = invoiceForm.querySelectorAll('input, select, .rich-editable');
    inputs.forEach(el => {
        if (el.id) {
            backup.form[el.id] = el.classList.contains('rich-editable') ? el.innerHTML : el.value;
        }
    });

    // Load saved state
    for (const [id, val] of Object.entries(state.form)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.classList.contains('rich-editable')) el.innerHTML = val;
            else el.value = val;
        }
    }

    // Load products
    productBody.innerHTML = '';
    state.products.forEach(p => {
        addNewRow();
        const row = productBody.lastElementChild;
        row.querySelector('.product-desc').value = p.desc;
        row.querySelector('.product-hsn').value = p.hsn;
        row.querySelector('.product-qty').value = p.qty;
        row.querySelector('.product-rate').value = p.rate;
        row.querySelector('.product-unit').value = p.qtyUnit;
        row.querySelector('.product-rate-unit').value = p.rateUnit;
    });

    // Trigger sync and generation
    syncAllToPreview();
    calculateTotals();

    let generatedBlob;
    let generationError;
    try {
        generatedBlob = await generatePDF(state.copyType, { returnBlob });
    } catch (error) {
        generationError = error;
    }

    // Restore backup
    for (const [id, val] of Object.entries(backup.form)) {
        const el = document.getElementById(id);
        if (el) {
            if (el.classList.contains('rich-editable')) el.innerHTML = val;
            else el.value = val;
        }
    }

    productBody.innerHTML = '';
    backup.products.forEach(p => {
        addNewRow();
        const row = productBody.lastElementChild;
        const descEl = row.querySelector('.product-desc');
        const hsnEl = row.querySelector('.product-hsn');

        if (descEl.classList.contains('rich-editable')) descEl.innerHTML = p.desc;
        else descEl.value = p.desc;

        if (hsnEl.classList.contains('rich-editable')) hsnEl.innerHTML = p.hsn;
        else hsnEl.value = p.hsn;

        row.querySelector('.product-qty').value = p.qty;
        row.querySelector('.product-rate').value = p.rate;
        row.querySelector('.product-unit').value = p.qtyUnit;
        row.querySelector('.product-rate-unit').value = p.rateUnit;
    });

    syncAllToPreview();
    calculateTotals();

    if (generationError) throw generationError;
    return generatedBlob;
}



// Automatic Image Slider Logic
function initPromoSlider() {
    const wrapper = document.querySelector('.slider-wrapper');
    const dots = document.querySelectorAll('.slider-dots .dot');
    if (!wrapper || dots.length === 0) return;

    let currentIndex = 0;
    const totalSlides = dots.length;
    let autoSlideInterval;

    function updateSlider() {
        wrapper.style.transform = `translateX(-${(currentIndex * 100) / totalSlides}%)`;
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateSlider();
    }

    function startAutoSlide() {
        stopAutoSlide();
        autoSlideInterval = setInterval(nextSlide, 5000);
    }

    function stopAutoSlide() {
        if (autoSlideInterval) clearInterval(autoSlideInterval);
    }

    // Click on dots to change slide
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentIndex = index;
            updateSlider();
            startAutoSlide(); // Reset timer on manual click
        });
    });

    // Start auto slide
    startAutoSlide();

    // Pause on hover
    const container = document.querySelector('.slider-container');
    if (container) {
        container.addEventListener('mouseenter', stopAutoSlide);
        container.addEventListener('mouseleave', startAutoSlide);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromoSlider);
} else {
    initPromoSlider();
}

// --- User Profile Logic ---

function initProfile() {
    loadProfile();
    setupProfileListeners();
}

function setupProfileListeners() {
    const saveBtn = document.getElementById('saveProfileBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveProfile);
    }

    // Image Upload Handlers
    setupImageUpload('profilePicInput', 'profilePicPreview');
    setupImageUpload('logoInput', 'logoPreview');
    setupImageUpload('signInput', 'signPreview');
}

function setupImageUpload(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                preview.innerHTML = `<img src="${base64}" alt="Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                preview.setAttribute('data-base64', base64);
            };
            reader.readAsDataURL(file);
        }
    });
}

function saveProfile() {
    const profile = {
        identity: {
            name: document.getElementById('profName').value,
            email: document.getElementById('profEmail').value,
            phone: document.getElementById('profPhone').value,
            role: document.getElementById('profRole').value,
            pic: document.getElementById('profilePicPreview').getAttribute('data-base64') || ''
        },
        company: {
            name: document.getElementById('profCompName').value,
            gst: document.getElementById('profGST').value,
            address: document.getElementById('profAddress').value,
            bankName: document.getElementById('profBankName').value,
            bankAcc: document.getElementById('profBankAcc').value,
            ifsc: document.getElementById('profIFSC').value,
            logo: document.getElementById('logoPreview').getAttribute('data-base64') || '',
            sign: document.getElementById('signPreview').getAttribute('data-base64') || ''
        }
    };

    localStorage.setItem('billix-user-profile', JSON.stringify(profile));

    showToast("Profile settings saved successfully", "✅");

    // Update company details in current invoice form if empty
    autoPopulateCompanyDetails();
}

function loadProfile() {
    const profileData = localStorage.getItem('billix-user-profile');
    if (!profileData) return;

    try {
        const profile = JSON.parse(profileData);

        // Load Identity
        if (profile.identity) {
            const nameEl = document.getElementById('profName');
            const emailEl = document.getElementById('profEmail');
            const phoneEl = document.getElementById('profPhone');
            const roleEl = document.getElementById('profRole');

            if (nameEl) nameEl.value = profile.identity.name || '';
            if (emailEl) emailEl.value = profile.identity.email || '';
            if (phoneEl) phoneEl.value = profile.identity.phone || '';
            if (roleEl) roleEl.value = profile.identity.role || 'Admin';

            if (profile.identity.pic) {
                const preview = document.getElementById('profilePicPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${profile.identity.pic}" alt="Profile">`;
                    preview.setAttribute('data-base64', profile.identity.pic);
                }
            }
        }

        // Load Company
        if (profile.company) {
            const compNameEl = document.getElementById('profCompName');
            const gstEl = document.getElementById('profGST');
            const addressEl = document.getElementById('profAddress');
            const bankNameEl = document.getElementById('profBankName');
            const bankAccEl = document.getElementById('profBankAcc');
            const ifscEl = document.getElementById('profIFSC');

            if (compNameEl) compNameEl.value = profile.company.name || '';
            if (gstEl) gstEl.value = profile.company.gst || '';
            if (addressEl) addressEl.value = profile.company.address || '';
            if (bankNameEl) bankNameEl.value = profile.company.bankName || '';
            if (bankAccEl) bankAccEl.value = profile.company.bankAcc || '';
            if (ifscEl) ifscEl.value = profile.company.ifsc || '';

            if (profile.company.logo) {
                const preview = document.getElementById('logoPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${profile.company.logo}" alt="Logo">`;
                    preview.setAttribute('data-base64', profile.company.logo);
                }
            }
            if (profile.company.sign) {
                const preview = document.getElementById('signPreview');
                if (preview) {
                    preview.innerHTML = `<img src="${profile.company.sign}" alt="Signature">`;
                    preview.setAttribute('data-base64', profile.company.sign);
                }
            }
        }

    } catch (e) {
        console.error("Failed to load profile", e);
    }
}

function autoPopulateCompanyDetails() {
    const profileData = localStorage.getItem('billix-user-profile');
    if (!profileData) return;

    try {
        const profile = JSON.parse(profileData);
        if (!profile.company) return;

        // Map profile fields to invoice form fields
        const mappings = {
            'profCompName': 'sellerName',
            'profGST': 'sellerGST',
            'profAddress': 'sellerAddress',
            'profBankName': 'bankName',
            'profBankAcc': 'bankAccount',
            'profIFSC': 'bankIFSC'
        };

        for (const [profId, formId] of Object.entries(mappings)) {
            const formEl = document.getElementById(formId);

            let val = '';
            if (profId === 'profCompName') val = profile.company.name;
            if (profId === 'profGST') val = profile.company.gst;
            if (profId === 'profAddress') val = profile.company.address;
            if (profId === 'profBankName') val = profile.company.bankName;
            if (profId === 'profBankAcc') val = profile.company.bankAcc;
            if (profId === 'profIFSC') val = profile.company.ifsc;

            if (formEl && val) {
                const currentVal = formEl.classList.contains('rich-editable') ? (formEl.innerText || '').trim() : (formEl.value || '').trim();

                if (!currentVal) {
                    if (formEl.classList.contains('rich-editable')) {
                        formEl.innerHTML = val;
                    } else {
                        formEl.value = val;
                    }
                    formEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }

        // Add Bank Holder if empty
        const holderEl = document.getElementById('bankHolder');
        if (holderEl && profile.company.name) {
            const currentHolder = (holderEl.innerText || '').trim();
            if (!currentHolder) {
                holderEl.innerHTML = profile.company.name;
                holderEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

    } catch (e) {
        console.error("Auto-populate error", e);
    }
}

// ============================================================
// PDF Download Request System (Additive - No existing code modified)
// ============================================================

const PDF_REQUESTS_KEY = 'billix-pdf-requests';

/**
 * Captures the current invoice state and stores it as a PDF download request.
 * Does NOT generate a PDF immediately — raises an on-demand request for the PDF download section.
 */
function requestPDFDownload(requestedCopyType) {
    const copyType = requestedCopyType || document.getElementById('copySelector')?.value || 'ORIGINAL FOR RECIPIENT';
    const invNo = getFieldVal('invoiceNo') || 'Draft';
    const buyer = getFieldVal('buyerName') || 'Unknown Buyer';
    const date = document.getElementById('invoiceDate')?.value || new Date().toISOString().split('T')[0];

    // Capture full form state (same pattern as saveCurrentStateAsLatest)
    const state = {
        requestId: 'req_' + Date.now(),
        requestedAt: new Date().toISOString(),
        invNo,
        buyer,
        invoiceDate: date,
        copyType,
        status: 'Pending',
        form: {},
        products: Array.from(productBody.children).map(row => {
            const descEl = row.querySelector('.product-desc');
            const hsnEl = row.querySelector('.product-hsn');
            return {
                desc: descEl.classList.contains('rich-editable') ? descEl.innerHTML : descEl.value,
                hsn: hsnEl.classList.contains('rich-editable') ? hsnEl.innerHTML : hsnEl.value,
                qty: row.querySelector('.product-qty').value,
                rate: row.querySelector('.product-rate').value,
                qtyUnit: row.querySelector('.product-unit').value,
                rateUnit: row.querySelector('.product-rate-unit').value
            };
        })
    };

    const inputs = invoiceForm.querySelectorAll('input, select, .rich-editable');
    inputs.forEach(el => {
        if (el.id) {
            state.form[el.id] = el.classList.contains('rich-editable') ? el.innerHTML : el.value;
        }
    });

    // Load existing requests and prepend the new one
    const existing = JSON.parse(localStorage.getItem(PDF_REQUESTS_KEY) || '[]');
    existing.unshift(state);
    localStorage.setItem(PDF_REQUESTS_KEY, JSON.stringify(existing));

    const copyLabels = {
        'ORIGINAL FOR RECIPIENT': 'Original',
        'DUPLICATE FOR TRANSPORTER': 'Duplicate',
        'SUPPLIER COPY': 'Supplier Copy',
        'ALL': 'All 3 Copies'
    };
    const label = copyLabels[copyType] || copyType;

    showToast(`PDF Download Request raised for ${invNo} (${label}). Go to PDF Downloads to download.`, '✅');
}

/**
 * Renders the PDF Downloads view from localStorage.
 */
function renderPDFDownloadsView() {
    const container = document.getElementById('pdfRequestsList');
    if (!container) return;

    const requests = JSON.parse(localStorage.getItem(PDF_REQUESTS_KEY) || '[]');

    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 3rem; text-align: center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round" stroke-linejoin="round" width="48" height="48"
                    style="color: var(--text-muted); margin-bottom: 1rem;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <p style="color: var(--text-muted); font-size: 1rem;">No PDF download requests yet.</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.5rem;">Go to <strong>Create Invoice</strong>, fill in your details, and click <strong>Request PDF Download</strong> in the preview pane.</p>
            </div>`;
        return;
    }

    const copyTypeLabels = {
        'ORIGINAL FOR RECIPIENT': 'Original',
        'DUPLICATE FOR TRANSPORTER': 'Duplicate',
        'SUPPLIER COPY': 'Supplier Copy',
        'ALL': 'All 3 Copies'
    };

    container.innerHTML = requests.map((req, idx) => {
        const reqDate = new Date(req.requestedAt);
        const formattedReqDate = `${String(reqDate.getDate()).padStart(2,'0')}/${String(reqDate.getMonth()+1).padStart(2,'0')}/${reqDate.getFullYear()} ${String(reqDate.getHours()).padStart(2,'0')}:${String(reqDate.getMinutes()).padStart(2,'0')}`;
        const copyLabel = copyTypeLabels[req.copyType] || req.copyType;
        const isDownloaded = req.status === 'Downloaded';

        return `
        <div class="pdf-request-item" id="pdf-req-${req.requestId}">
            <div class="pdf-req-info">
                <div class="pdf-req-title">
                    <span class="pdf-req-invno">${req.invNo}</span>
                    <span class="pdf-req-badge ${isDownloaded ? 'badge-downloaded' : 'badge-pending'}">
                        ${isDownloaded ? '✓ Downloaded' : '⏳ Pending'}
                    </span>
                </div>
                <div class="pdf-req-meta">
                    <span>👤 ${req.buyer}</span>
                    <span>📅 Invoice Date: ${req.invoiceDate || '—'}</span>
                    <span>📋 Copy: ${copyLabel}</span>
                    <span>🕐 Requested: ${formattedReqDate}</span>
                </div>
            </div>
            <div class="pdf-req-actions">
                <button class="btn btn-primary btn-sm pdf-download-btn" onclick="downloadRequestedPDF('${req.requestId}')" style="display: flex; align-items: center; gap: 6px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download PDF
                </button>
                <button class="btn btn-secondary btn-sm" onclick="shareRequestedPDF('${req.requestId}')" title="Share this PDF using your phone's share menu and choose WhatsApp" style="display: flex; align-items: center; gap: 6px; color: #128C7E; border-color: #128C7E;">
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
                        <path d="M12.04 2a9.9 9.9 0 0 0-8.48 15.01L2 22l5.16-1.51A9.95 9.95 0 1 0 12.04 2Zm0 18.1a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.06.9.92-2.98-.2-.31a8.12 8.12 0 1 1 6.77 3.7Zm4.46-6.08c-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.4h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.1.16 1.51.1.46-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
                    </svg>
                    Share on WhatsApp
                </button>
                <button class="btn btn-secondary btn-sm" onclick="deletePDFRequest('${req.requestId}')" style="display: flex; align-items: center; gap: 6px; color: #ef4444;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-1 14H6L5 6"></path>
                        <path d="M9 6V4h6v2"></path>
                    </svg>
                    Remove
                </button>
            </div>
        </div>`;
    }).join('');
}

/**
 * Downloads the PDF for a specific request by ID.
 * Calls existing downloadLatestSavedInvoice() — no new PDF logic created.
 */
window.downloadRequestedPDF = async (requestId) => {
    const requests = JSON.parse(localStorage.getItem(PDF_REQUESTS_KEY) || '[]');
    const req = requests.find(r => r.requestId === requestId);
    if (!req) {
        showToast('Request not found', '❌');
        return;
    }

    showToast(`Generating PDF for Invoice ${req.invNo}...`, '🔄');

    try {
        await downloadLatestSavedInvoice(req);

        // Mark as downloaded
        req.status = 'Downloaded';
        localStorage.setItem(PDF_REQUESTS_KEY, JSON.stringify(requests));

        // Refresh the view
        renderPDFDownloadsView();
        showToast(`PDF for Invoice ${req.invNo} downloaded successfully`, '✅');
    } catch (err) {
        console.error('PDF download request error:', err);
        showToast('Failed to generate PDF', '❌');
    }
};

/** Regenerates one requested invoice and shares the PDF through the device share sheet. */
window.shareRequestedPDF = async (requestId) => {
    const requests = JSON.parse(localStorage.getItem(PDF_REQUESTS_KEY) || '[]');
    const req = requests.find(r => r.requestId === requestId);
    if (!req) {
        showToast('Request not found', 'âŒ');
        return;
    }

    showToast(`Preparing Invoice ${req.invNo} to share...`, 'ðŸ”„');

    try {
        const pdfBlob = await downloadLatestSavedInvoice(req, { returnBlob: true });
        if (!(pdfBlob instanceof Blob) || pdfBlob.size === 0) {
            throw new Error('The invoice PDF could not be generated.');
        }

        const safeInvoiceNumber = String(req.invNo || 'Draft').replace(/[^a-z0-9._-]/gi, '_');
        const fileName = `Invoice_${safeInvoiceNumber}.pdf`;
        const file = typeof File === 'function'
            ? new File([pdfBlob], fileName, { type: 'application/pdf' })
            : null;
        let canShareFile = false;
        try {
            canShareFile = Boolean(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
        } catch (shareCheckError) {
            console.warn('File sharing is unavailable in this browser:', shareCheckError);
        }

        if (canShareFile) {
            try {
                await navigator.share({
                    files: [file],
                    title: `Invoice ${req.invNo || ''}`.trim(),
                    text: `Invoice ${req.invNo || ''}`.trim()
                });
                return;
            } catch (shareError) {
                if (shareError?.name === 'AbortError') return;
                console.warn('Native file sharing failed; switching to download fallback:', shareError);
            }
        }

        // Browsers without file sharing still get the PDF and a WhatsApp message
        // window; the user can attach the downloaded file there.
        const objectUrl = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = objectUrl;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

        const whatsappText = encodeURIComponent(`Invoice ${req.invNo || ''} is ready. Please see the attached PDF.`);
        window.open(`https://wa.me/?text=${whatsappText}`, '_blank', 'noopener,noreferrer');
        showToast('PDF downloaded. Attach it in WhatsApp to send.', 'âœ…');
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('PDF share error:', error);
        showToast('Unable to prepare the PDF for sharing', 'âŒ');
    }
};

/**
 * Removes a single PDF request by ID.
 */
window.deletePDFRequest = (requestId) => {
    let requests = JSON.parse(localStorage.getItem(PDF_REQUESTS_KEY) || '[]');
    requests = requests.filter(r => r.requestId !== requestId);
    localStorage.setItem(PDF_REQUESTS_KEY, JSON.stringify(requests));
    renderPDFDownloadsView();
    showToast('Request removed', '✅');
};

/**
 * Clears all PDF download requests.
 */
function clearAllPDFRequests() {
    if (!confirm('Are you sure you want to clear all PDF download requests?')) return;
    localStorage.removeItem(PDF_REQUESTS_KEY);
    renderPDFDownloadsView();
    showToast('All PDF download requests cleared', '✅');
}

/* ==========================================================================
   LEDGER MANAGEMENT MODULE
   ========================================================================== */

let currentLedgersList = [];
let activePreviewLedger = null;
let parsedImportLedgers = [];
let isLedgerInitialized = false;

function initLedgerModule() {
    if (!isLedgerInitialized) {
        setupLedgerEventListeners();
        isLedgerInitialized = true;
    }
    loadAndRenderLedgers();
}

function setupLedgerEventListeners() {
    // Action Bar Buttons
    const btnOpenCreateLedger = document.getElementById('btnOpenCreateLedger');
    if (btnOpenCreateLedger) btnOpenCreateLedger.addEventListener('click', openCreateLedgerModal);

    const btnOpenImportLedger = document.getElementById('btnOpenImportLedger');
    if (btnOpenImportLedger) btnOpenImportLedger.addEventListener('click', openImportLedgerModal);

    const btnDownloadSampleTemplate = document.getElementById('btnDownloadSampleTemplate');
    if (btnDownloadSampleTemplate) btnDownloadSampleTemplate.addEventListener('click', downloadSampleLedgerTemplate);

    const btnOpenDownloadHistory = document.getElementById('btnOpenDownloadHistory');
    if (btnOpenDownloadHistory) btnOpenDownloadHistory.addEventListener('click', openDownloadHistoryModal);

    const ledgerSearchInput = document.getElementById('ledgerSearchInput');
    if (ledgerSearchInput) {
        ledgerSearchInput.addEventListener('input', () => {
            renderLedgersTable(filterLedgersList(ledgerSearchInput.value));
        });
    }

    // Modal Close Buttons
    const closeCreateLedgerModal = document.getElementById('closeCreateLedgerModal');
    if (closeCreateLedgerModal) closeCreateLedgerModal.addEventListener('click', closeCreateLedgerModalFunc);
    const btnCancelCreateLedger = document.getElementById('btnCancelCreateLedger');
    if (btnCancelCreateLedger) btnCancelCreateLedger.addEventListener('click', closeCreateLedgerModalFunc);

    const btnAddLedgerTxRow = document.getElementById('btnAddLedgerTxRow');
    if (btnAddLedgerTxRow) btnAddLedgerTxRow.addEventListener('click', addLedgerTxRow);

    const btnSubmitCreateLedger = document.getElementById('btnSubmitCreateLedger');
    if (btnSubmitCreateLedger) btnSubmitCreateLedger.addEventListener('click', submitCreateLedger);

    // Import Modal Buttons
    const closeImportLedgerModal = document.getElementById('closeImportLedgerModal');
    if (closeImportLedgerModal) closeImportLedgerModal.addEventListener('click', closeImportLedgerModalFunc);
    const btnCancelImportLedger = document.getElementById('btnCancelImportLedger');
    if (btnCancelImportLedger) btnCancelImportLedger.addEventListener('click', closeImportLedgerModalFunc);

    const ledgerFileInput = document.getElementById('ledgerFileInput');
    if (ledgerFileInput) ledgerFileInput.addEventListener('change', handleLedgerFileUpload);

    const btnConfirmImportLedger = document.getElementById('btnConfirmImportLedger');
    if (btnConfirmImportLedger) btnConfirmImportLedger.addEventListener('click', confirmBatchImportLedger);

    // View Modal Buttons
    const closeViewLedgerModal = document.getElementById('closeViewLedgerModal');
    if (closeViewLedgerModal) closeViewLedgerModal.addEventListener('click', closeViewLedgerModalFunc);
    const btnCloseViewLedger = document.getElementById('btnCloseViewLedger');
    if (btnCloseViewLedger) btnCloseViewLedger.addEventListener('click', closeViewLedgerModalFunc);

    const btnDownloadLedgerExcel = document.getElementById('btnDownloadLedgerExcel');
    if (btnDownloadLedgerExcel) btnDownloadLedgerExcel.addEventListener('click', () => {
        if (activePreviewLedger) downloadLedgerExcel(activePreviewLedger);
    });

    const btnDownloadLedgerPDF = document.getElementById('btnDownloadLedgerPDF');
    if (btnDownloadLedgerPDF) btnDownloadLedgerPDF.addEventListener('click', () => {
        if (activePreviewLedger) downloadLedgerPDF(activePreviewLedger);
    });

    // Download History Close
    const closeDownloadHistoryModal = document.getElementById('closeDownloadHistoryModal');
    if (closeDownloadHistoryModal) closeDownloadHistoryModal.addEventListener('click', closeDownloadHistoryModalFunc);
    const btnCloseDownloadHistory = document.getElementById('btnCloseDownloadHistory');
    if (btnCloseDownloadHistory) btnCloseDownloadHistory.addEventListener('click', closeDownloadHistoryModalFunc);
}

async function loadAndRenderLedgers() {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading Ledgers...</td></tr>`;

    try {
        const response = await fetch('/api/ledgers');
        if (!response.ok) throw new Error('Failed to fetch ledgers');
        currentLedgersList = await response.json();
        renderLedgersTable(currentLedgersList);
    } catch (err) {
        console.error('Error fetching ledgers:', err);
        // Fallback to local storage if server offline
        const local = JSON.parse(localStorage.getItem('billix_ledgers') || '[]');
        currentLedgersList = local;
        renderLedgersTable(local);
    }
}

function filterLedgersList(query) {
    if (!query) return currentLedgersList;
    const q = query.toLowerCase();
    return currentLedgersList.filter(l => 
        (l.account && l.account.toLowerCase().includes(q)) ||
        (l.accountNumber && l.accountNumber.toLowerCase().includes(q)) ||
        (l.monthOf && l.monthOf.toLowerCase().includes(q))
    );
}

function renderLedgersTable(ledgers) {
    const tbody = document.getElementById('ledgerTableBody');
    if (!tbody) return;

    if (!ledgers || ledgers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    No ledgers found. Click <strong>Create Ledger</strong> or <strong>Import Ledger</strong> to get started.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ledgers.map(ledger => {
        const dateStr = ledger.createdAt ? new Date(ledger.createdAt).toLocaleDateString('en-IN') : 'N/A';
        const totalDebit = (ledger.totalDebit || 0).toLocaleString('en-IN');
        const totalCredit = (ledger.totalCredit || 0).toLocaleString('en-IN');
        const idStr = ledger._id || ledger.id;

        return `
            <tr>
                <td><strong>${escapeHTML(ledger.account || '')}</strong></td>
                <td>${escapeHTML(ledger.accountNumber || '')}</td>
                <td>${escapeHTML(ledger.monthOf || '')}</td>
                <td>${escapeHTML(ledger.sheetNumber || '1')}</td>
                <td>₹${totalDebit}</td>
                <td>₹${totalCredit}</td>
                <td>${dateStr}</td>
                <td style="text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="viewLedgerById('${idStr}')" title="Preview Ledger">
                            👁️ View
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="downloadExcelById('${idStr}')" title="Download Excel">
                            📊 Excel
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="downloadPDFById('${idStr}')" title="Download PDF">
                            📄 PDF
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Global functions for inline onclick handlers
window.viewLedgerById = (id) => {
    const ledger = currentLedgersList.find(l => (l._id || l.id) === id);
    if (ledger) openViewLedgerModal(ledger);
};

window.downloadExcelById = (id) => {
    const ledger = currentLedgersList.find(l => (l._id || l.id) === id);
    if (ledger) downloadLedgerExcel(ledger);
};

window.downloadPDFById = (id) => {
    const ledger = currentLedgersList.find(l => (l._id || l.id) === id);
    if (ledger) downloadLedgerPDF(ledger);
};

// Create Ledger Handlers
function openCreateLedgerModal() {
    const modal = document.getElementById('createLedgerModal');
    if (!modal) return;

    document.getElementById('createLedgerForm').reset();
    const txBody = document.getElementById('newLedgerTxBody');
    txBody.innerHTML = '';
    addLedgerTxRow(); // Add initial row
    modal.classList.remove('hidden');
}

function closeCreateLedgerModalFunc() {
    const modal = document.getElementById('createLedgerModal');
    if (modal) modal.classList.add('hidden');
}

function addLedgerTxRow() {
    const txBody = document.getElementById('newLedgerTxBody');
    if (!txBody) return;

    const rowId = Date.now() + Math.random().toString(36).substr(2, 4);
    const today = new Date().toISOString().split('T')[0];

    const tr = document.createElement('tr');
    tr.id = `txRow_${rowId}`;
    tr.innerHTML = `
        <td><input type="date" class="form-control tx-date" value="${today}"></td>
        <td><input type="text" class="form-control tx-desc" placeholder="Transaction description"></td>
        <td><input type="text" class="form-control tx-jref" placeholder="Ref no"></td>
        <td><input type="number" class="form-control tx-debit" value="0" step="0.01"></td>
        <td><input type="number" class="form-control tx-credit" value="0" step="0.01"></td>
        <td><input type="number" class="form-control tx-baldebit" value="0" step="0.01"></td>
        <td><input type="number" class="form-control tx-balcredit" value="0" step="0.01"></td>
        <td style="text-align: center;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('txRow_${rowId}').remove()" style="color: #ef4444; padding: 2px 6px;">×</button>
        </td>
    `;
    txBody.appendChild(tr);
}

async function submitCreateLedger() {
    const account = document.getElementById('ledgerAccountName').value.trim();
    const accountNumber = document.getElementById('ledgerAccountNumber').value.trim();
    const monthOf = document.getElementById('ledgerMonthOf').value.trim();
    const sheetNumber = document.getElementById('ledgerSheetNumber').value.trim() || '1';

    if (!account || !accountNumber || !monthOf) {
        showToast('Please fill required fields: Account, Account Number, Month of', '❌');
        return;
    }

    const txRows = document.querySelectorAll('#newLedgerTxBody tr');
    const transactions = [];
    txRows.forEach(tr => {
        const date = tr.querySelector('.tx-date').value;
        const description = tr.querySelector('.tx-desc').value.trim();
        const journalRef = tr.querySelector('.tx-jref').value.trim();
        const debit = parseFloat(tr.querySelector('.tx-debit').value) || 0;
        const credit = parseFloat(tr.querySelector('.tx-credit').value) || 0;
        const balanceDebit = parseFloat(tr.querySelector('.tx-baldebit').value) || 0;
        const balanceCredit = parseFloat(tr.querySelector('.tx-balcredit').value) || 0;

        if (description || debit || credit) {
            transactions.push({ date, description, journalRef, debit, credit, balanceDebit, balanceCredit });
        }
    });

    const payload = { account, accountNumber, monthOf, sheetNumber, transactions };

    try {
        const response = await fetch('/api/ledgers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to save ledger');
        }

        const savedLedger = await response.json();
        showToast(`Ledger for ${savedLedger.account} created successfully!`, '✅');
        closeCreateLedgerModalFunc();
        loadAndRenderLedgers();
    } catch (err) {
        console.error('Error saving ledger:', err);
        showToast(err.message, '❌');
    }
}

// Sample Template Generator
function downloadSampleLedgerTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX library not loaded', '❌');
        return;
    }

    const templateData = [
        ["Account", "Account Number", "Month of", "Sheet Number", "Date", "Description", "Journal Reference", "Debit", "Credit", "Balance Debit", "Balance Credit"],
        ["Sales Account", "ACC-1001", "August 2026", "1", "2026-08-01", "Opening Balance", "OB-01", 0, 0, 5000, 0],
        ["Sales Account", "ACC-1001", "August 2026", "1", "2026-08-05", "Product Sales Invoice AC/26-27/01", "INV-01", 15000, 0, 20000, 0],
        ["Sales Account", "ACC-1001", "August 2026", "1", "2026-08-10", "Payment Received Bank Transfer", "REC-01", 0, 10000, 10000, 0],
        ["Cash Ledger", "ACC-1002", "August 2026", "1", "2026-08-02", "Office Supplies Purchase", "EXP-01", 0, 1200, 0, 1200],
        ["Cash Ledger", "ACC-1002", "August 2026", "1", "2026-08-08", "Cash Sales", "CS-01", 3500, 0, 2300, 0]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger Template");

    XLSX.writeFile(wb, "Billix_Ledger_Import_Template.xlsx");
    showToast('Downloaded sample Excel Ledger template!', '✅');
}

// Excel Import & All-or-Nothing Validation
function openImportLedgerModal() {
    const modal = document.getElementById('importLedgerModal');
    if (!modal) return;

    document.getElementById('ledgerFileInput').value = '';
    document.getElementById('selectedFileName').textContent = '';
    document.getElementById('importValidationContainer').classList.add('hidden');
    document.getElementById('btnConfirmImportLedger').disabled = true;
    parsedImportLedgers = [];

    modal.classList.remove('hidden');
}

function closeImportLedgerModalFunc() {
    const modal = document.getElementById('importLedgerModal');
    if (modal) modal.classList.add('hidden');
}

function handleLedgerFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('selectedFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            validateAndPreviewLedgerData(rawJson);
        } catch (err) {
            console.error('Error reading Excel file:', err);
            showToast('Failed to parse Excel file. Please ensure it is a valid .xlsx file.', '❌');
        }
    };
    reader.readAsArrayBuffer(file);
}

function validateAndPreviewLedgerData(rawRows) {
    const container = document.getElementById('importValidationContainer');
    const errorCard = document.getElementById('importErrorsCard');
    const errorList = document.getElementById('importErrorList');
    const previewBody = document.getElementById('importPreviewBody');
    const confirmBtn = document.getElementById('btnConfirmImportLedger');

    container.classList.remove('hidden');
    errorList.innerHTML = '';
    previewBody.innerHTML = '';

    if (!rawRows || rawRows.length === 0) {
        document.getElementById('summaryTotalRows').textContent = '0';
        document.getElementById('summaryValidRows').textContent = '0';
        document.getElementById('summaryInvalidRows').textContent = '1';
        errorCard.classList.remove('hidden');
        errorList.innerHTML = `<li>The uploaded Excel file contains no data rows.</li>`;
        confirmBtn.disabled = true;
        return;
    }

    const parsedList = [];
    const errors = [];

    rawRows.forEach((row, idx) => {
        const rowNum = idx + 2; // Row 1 is header in Excel
        
        // Flexible key matching for columns
        const getVal = (possibleKeys) => {
            for (let k of possibleKeys) {
                for (let key in row) {
                    if (key.trim().toLowerCase() === k.toLowerCase()) {
                        return String(row[key]).trim();
                    }
                }
            }
            return '';
        };

        const account = getVal(['Account', 'Account Name', 'AccountName']);
        const accountNumber = getVal(['Account Number', 'AccountNumber', 'Account No', 'Acc No', 'AccNo']);
        const monthOf = getVal(['Month of', 'MonthOf', 'Month']);
        const sheetNumber = getVal(['Sheet Number', 'SheetNumber', 'Sheet No', 'Sheet']) || '1';
        const date = getVal(['Date', 'Transaction Date', 'TxDate']) || new Date().toISOString().split('T')[0];
        const description = getVal(['Description', 'Particulars', 'Desc']) || 'Transaction';
        const journalRef = getVal(['Journal Reference', 'JournalRef', 'Journal Ref', 'Ref']);
        const debitRaw = getVal(['Debit', 'Transaction Debit', 'Debit Amount']);
        const creditRaw = getVal(['Credit', 'Transaction Credit', 'Credit Amount']);
        const balDebitRaw = getVal(['Balance Debit', 'Bal Debit']);
        const balCreditRaw = getVal(['Balance Credit', 'Bal Credit']);

        const debit = debitRaw ? parseFloat(debitRaw) : 0;
        const credit = creditRaw ? parseFloat(creditRaw) : 0;
        const balanceDebit = balDebitRaw ? parseFloat(balDebitRaw) : 0;
        const balanceCredit = balCreditRaw ? parseFloat(balCreditRaw) : 0;

        let rowHasError = false;

        if (!account) {
            errors.push(`Row ${rowNum}: Column 'Account' is required`);
            rowHasError = true;
        }
        if (!accountNumber) {
            errors.push(`Row ${rowNum}: Column 'Account Number' is required`);
            rowHasError = true;
        }
        if (!monthOf) {
            errors.push(`Row ${rowNum}: Column 'Month of' is required`);
            rowHasError = true;
        }
        if (debitRaw && isNaN(debit)) {
            errors.push(`Row ${rowNum}: Column 'Debit' contains invalid numeric value ('${debitRaw}')`);
            rowHasError = true;
        }
        if (creditRaw && isNaN(credit)) {
            errors.push(`Row ${rowNum}: Column 'Credit' contains invalid numeric value ('${creditRaw}')`);
            rowHasError = true;
        }

        const item = {
            rowNum,
            account,
            accountNumber,
            monthOf,
            sheetNumber,
            date,
            description,
            journalRef,
            debit,
            credit,
            balanceDebit,
            balanceCredit,
            isValid: !rowHasError
        };

        parsedList.push(item);
    });

    parsedImportLedgers = parsedList;

    const totalRows = rawRows.length;
    const invalidCount = errors.length;
    const validCount = totalRows - invalidCount;

    document.getElementById('summaryTotalRows').textContent = totalRows;
    document.getElementById('summaryValidRows').textContent = validCount;
    document.getElementById('summaryInvalidRows').textContent = invalidCount;

    if (errors.length > 0) {
        errorCard.classList.remove('hidden');
        errorList.innerHTML = errors.map(err => `<li>${escapeHTML(err)}</li>`).join('');
        confirmBtn.disabled = true; // All-or-nothing protection
    } else {
        errorCard.classList.add('hidden');
        confirmBtn.disabled = false;
    }

    // Render Preview
    previewBody.innerHTML = parsedList.map(item => `
        <tr style="${item.isValid ? '' : 'background: #fff5f5;'}">
            <td>${item.rowNum}</td>
            <td><strong>${escapeHTML(item.account)}</strong></td>
            <td>${escapeHTML(item.accountNumber)}</td>
            <td>${escapeHTML(item.monthOf)}</td>
            <td>${escapeHTML(item.date)}</td>
            <td>${escapeHTML(item.description)}</td>
            <td>₹${item.debit.toLocaleString('en-IN')}</td>
            <td>₹${item.credit.toLocaleString('en-IN')}</td>
            <td>
                ${item.isValid 
                    ? `<span style="color: #10b981; font-weight: 600;">Valid</span>` 
                    : `<span style="color: #ef4444; font-weight: 600;">Invalid</span>`}
            </td>
        </tr>
    `).join('');
}

async function confirmBatchImportLedger() {
    if (!parsedImportLedgers || parsedImportLedgers.length === 0) return;

    try {
        const response = await fetch('/api/ledgers/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ledgers: parsedImportLedgers })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Import failed');
        }

        const result = await response.json();
        showToast(`Import Successful! Processed ${result.totalProcessed} rows. Created ${result.createdCount} Ledgers.`, '✅');
        closeImportLedgerModalFunc();
        loadAndRenderLedgers();
    } catch (err) {
        console.error('Import error:', err);
        showToast(err.message, '❌');
    }
}

// View / Preview Ledger Modal
function openViewLedgerModal(ledger) {
    activePreviewLedger = ledger;
    const modal = document.getElementById('viewLedgerModal');
    const host = document.getElementById('ledgerTemplateRenderHost');
    const title = document.getElementById('viewLedgerTitle');

    if (!modal || !host) return;

    title.textContent = `Ledger Preview - ${ledger.account} (${ledger.monthOf})`;
    host.innerHTML = renderLedgerTemplateHTML(ledger);
    modal.classList.remove('hidden');
}

function closeViewLedgerModalFunc() {
    const modal = document.getElementById('viewLedgerModal');
    if (modal) modal.classList.add('hidden');
    activePreviewLedger = null;
}

function renderLedgerTemplateHTML(ledger) {
    const txs = ledger.transactions || [];
    const totalDebit = (ledger.totalDebit || 0).toLocaleString('en-IN');
    const totalCredit = (ledger.totalCredit || 0).toLocaleString('en-IN');
    const totalBalDebit = (ledger.totalBalanceDebit || 0).toLocaleString('en-IN');
    const totalBalCredit = (ledger.totalBalanceCredit || 0).toLocaleString('en-IN');

    const rowsHTML = txs.map(tx => `
        <tr>
            <td style="text-align: center;">${escapeHTML(tx.date || '')}</td>
            <td>${escapeHTML(tx.description || '')}</td>
            <td style="text-align: center;">${escapeHTML(tx.journalRef || '')}</td>
            <td style="text-align: right;">${(tx.debit || 0).toLocaleString('en-IN')}</td>
            <td style="text-align: right;">${(tx.credit || 0).toLocaleString('en-IN')}</td>
            <td style="text-align: right;">${(tx.balanceDebit || 0).toLocaleString('en-IN')}</td>
            <td style="text-align: right;">${(tx.balanceCredit || 0).toLocaleString('en-IN')}</td>
        </tr>
    `).join('');

    return `
        <div class="ledger-banner">LEDGER</div>
        <div class="ledger-info-grid">
            <div class="ledger-info-box">
                <div><strong>Account:</strong> ${escapeHTML(ledger.account)}</div>
                <div><strong>Month of:</strong> ${escapeHTML(ledger.monthOf)}</div>
            </div>
            <div class="ledger-info-box" style="text-align: right;">
                <div><strong>Account Number:</strong> ${escapeHTML(ledger.accountNumber)}</div>
                <div><strong>Sheet Number:</strong> ${escapeHTML(ledger.sheetNumber || '1')}</div>
            </div>
        </div>
        <table class="ledger-table">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 14%;">Date</th>
                    <th rowspan="2" style="width: 32%;">Description</th>
                    <th rowspan="2" style="width: 14%;">Journal Reference</th>
                    <th colspan="2" style="width: 20%;">Transactions</th>
                    <th colspan="2" style="width: 20%;">Balance</th>
                </tr>
                <tr>
                    <th style="width: 10%;">Debit</th>
                    <th style="width: 10%;">Credit</th>
                    <th style="width: 10%;">Debit</th>
                    <th style="width: 10%;">Credit</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML || '<tr><td colspan="7" style="text-align: center;">No transactions recorded</td></tr>'}
                <tr class="total-row">
                    <td colspan="3" style="text-align: right; font-weight: bold;">Total</td>
                    <td style="text-align: right;">${totalDebit}</td>
                    <td style="text-align: right;">${totalCredit}</td>
                    <td style="text-align: right;">${totalBalDebit}</td>
                    <td style="text-align: right;">${totalBalCredit}</td>
                </tr>
            </tbody>
        </table>
        <div class="ledger-footer-shape"></div>
    `;
}

// Download Handlers
function downloadLedgerExcel(ledger) {
    if (typeof XLSX === 'undefined') {
        showToast('XLSX library not loaded', '❌');
        return;
    }

    const data = [
        ["LEDGER"],
        ["Account:", ledger.account, "", "Account Number:", ledger.accountNumber],
        ["Month of:", ledger.monthOf, "", "Sheet Number:", ledger.sheetNumber || '1'],
        [],
        ["Date", "Description", "Journal Reference", "Transactions Debit", "Transactions Credit", "Balance Debit", "Balance Credit"]
    ];

    (ledger.transactions || []).forEach(tx => {
        data.push([
            tx.date || '',
            tx.description || '',
            tx.journalRef || '',
            tx.debit || 0,
            tx.credit || 0,
            tx.balanceDebit || 0,
            tx.balanceCredit || 0
        ]);
    });

    data.push([
        "Total",
        "",
        "",
        ledger.totalDebit || 0,
        ledger.totalCredit || 0,
        ledger.totalBalanceDebit || 0,
        ledger.totalBalanceCredit || 0
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ledger");

    const fileName = `Ledger_${ledger.account.replace(/[^a-zA-Z0-9]/g, '_')}_${ledger.monthOf.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    logDownloadRequest(ledger._id || ledger.id, ledger.account, ledger.accountNumber, 'excel');
    showToast(`Downloaded Excel for ${ledger.account}!`, '✅');
}

function downloadLedgerPDF(ledger) {
    if (typeof window.jspdf === 'undefined') {
        showToast('jsPDF library not loaded', '❌');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // 1. Header Banner
    doc.setFillColor(128, 170, 219); // #80AADB
    doc.rect(14, 12, 182, 16, 'F');
    doc.setTextColor(14, 42, 71);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LEDGER', 105, 22, { align: 'center' });

    // 2. Info Boxes
    doc.setFillColor(229, 240, 245);
    doc.rect(14, 32, 88, 16, 'F');
    doc.rect(108, 32, 88, 16, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(14, 47, 62);
    doc.text('Account:', 18, 38);
    doc.text('Month of:', 18, 44);

    doc.setFont('helvetica', 'normal');
    doc.text(String(ledger.account || ''), 35, 38);
    doc.text(String(ledger.monthOf || ''), 35, 44);

    doc.setFont('helvetica', 'bold');
    doc.text('Account Number:', 112, 38);
    doc.text('Sheet Number:', 112, 44);

    doc.setFont('helvetica', 'normal');
    doc.text(String(ledger.accountNumber || ''), 142, 38);
    doc.text(String(ledger.sheetNumber || '1'), 142, 44);

    // 3. Table
    const head = [
        [
            { content: 'Date', rowSpan: 2 },
            { content: 'Description', rowSpan: 2 },
            { content: 'Journal Reference', rowSpan: 2 },
            { content: 'Transactions', colSpan: 2 },
            { content: 'Balance', colSpan: 2 }
        ],
        ['Debit', 'Credit', 'Debit', 'Credit']
    ];

    const body = (ledger.transactions || []).map(tx => [
        tx.date || '',
        tx.description || '',
        tx.journalRef || '',
        tx.debit ? tx.debit.toLocaleString('en-IN') : '0',
        tx.credit ? tx.credit.toLocaleString('en-IN') : '0',
        tx.balanceDebit ? tx.balanceDebit.toLocaleString('en-IN') : '0',
        tx.balanceCredit ? tx.balanceCredit.toLocaleString('en-IN') : '0'
    ]);

    body.push([
        'Total',
        '',
        '',
        (ledger.totalDebit || 0).toLocaleString('en-IN'),
        (ledger.totalCredit || 0).toLocaleString('en-IN'),
        (ledger.totalBalanceDebit || 0).toLocaleString('en-IN'),
        (ledger.totalBalanceCredit || 0).toLocaleString('en-IN')
    ]);

    doc.autoTable({
        startY: 52,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: {
            fillColor: [14, 47, 62],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8.5
        },
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 24 },
            1: { cellWidth: 54 },
            2: { halign: 'center', cellWidth: 26 },
            3: { halign: 'right', cellWidth: 19 },
            4: { halign: 'right', cellWidth: 19 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 20 }
        },
        didParseCell: function(data) {
            if (data.row.index === body.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [14, 47, 62];
                data.cell.styles.textColor = [255, 255, 255];
            }
        }
    });

    // 4. Footer Banner
    const finalY = doc.lastAutoTable.finalY + 8;
    if (finalY < 270) {
        doc.setFillColor(128, 170, 219);
        doc.rect(14, finalY, 182, 8, 'F');
    }

    const fileName = `Ledger_${ledger.account.replace(/[^a-zA-Z0-9]/g, '_')}_${ledger.monthOf.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    doc.save(fileName);

    logDownloadRequest(ledger._id || ledger.id, ledger.account, ledger.accountNumber, 'pdf');
    showToast(`Downloaded PDF for ${ledger.account}!`, '✅');
}

async function logDownloadRequest(ledgerId, account, accountNumber, fileType) {
    try {
        await fetch('/api/ledgers/download-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ledgerId, account, accountNumber, fileType })
        });
    } catch (err) {
        console.error('Error logging download request:', err);
    }
}

// Download History Modal
async function openDownloadHistoryModal() {
    const modal = document.getElementById('downloadHistoryModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    loadAndRenderDownloadHistory();
}

function closeDownloadHistoryModalFunc() {
    const modal = document.getElementById('downloadHistoryModal');
    if (modal) modal.classList.add('hidden');
}

async function loadAndRenderDownloadHistory() {
    const tbody = document.getElementById('downloadHistoryBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Loading history...</td></tr>`;

    try {
        const res = await fetch('/api/ledgers/download-requests');
        if (!res.ok) throw new Error('Failed to fetch history');
        const requests = await res.json();

        if (!requests || requests.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No download requests logged yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = requests.map(req => `
            <tr>
                <td><strong>${escapeHTML(req.requestId)}</strong></td>
                <td>${escapeHTML(req.account)} (${escapeHTML(req.accountNumber)})</td>
                <td><span style="text-transform: uppercase; font-weight: 600;">${req.fileType}</span></td>
                <td>${new Date(req.requestedAt).toLocaleString('en-IN')}</td>
                <td><span class="pdf-req-badge badge-ready">Ready</span></td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error fetching download history:', err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 1.5rem;">Failed to load history</td></tr>`;
    }
}
