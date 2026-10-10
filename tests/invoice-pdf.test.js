const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.join(__dirname, '..');
const scriptSource = fs.readFileSync(path.join(projectRoot, 'script.js'), 'utf8');
const styleSource = fs.readFileSync(path.join(projectRoot, 'style.css'), 'utf8');
const functionStart = scriptSource.indexOf('async function generatePDF(');
const functionEnd = scriptSource.indexOf('async function saveToHistory', functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, 'generatePDF function should be present');
const generatePDFSource = scriptSource.slice(functionStart, functionEnd);
const savedInvoiceStart = scriptSource.indexOf('async function downloadLatestSavedInvoice(');
const savedInvoiceEnd = scriptSource.indexOf('// Automatic Image Slider Logic', savedInvoiceStart);
assert.ok(savedInvoiceStart >= 0 && savedInvoiceEnd > savedInvoiceStart, 'saved invoice download function should be present');
const savedInvoiceSource = scriptSource.slice(savedInvoiceStart, savedInvoiceEnd);
const setupStart = scriptSource.indexOf('function setupEventListeners()');
const dropdownStart = scriptSource.indexOf('    // Dropdown Toggle', setupStart);
const dropdownEnd = scriptSource.indexOf('    // State Selector Logic', dropdownStart);
assert.ok(dropdownStart >= 0 && dropdownEnd > dropdownStart, 'invoice download dropdown handlers should be present');
const dropdownSource = scriptSource.slice(dropdownStart, dropdownEnd);
const requestStart = scriptSource.indexOf('function requestPDFDownload(');
const renderRequestsStart = scriptSource.indexOf('function renderPDFDownloadsView(', requestStart);
const requestEnd = scriptSource.lastIndexOf('/**', renderRequestsStart);
assert.ok(requestStart >= 0 && requestEnd > requestStart, 'PDF request capture function should be present');
const requestSource = scriptSource.slice(requestStart, requestEnd);
const downloadRequestHandlerStart = scriptSource.indexOf('window.downloadRequestedPDF', renderRequestsStart);
const renderRequestsEnd = scriptSource.lastIndexOf('/**', downloadRequestHandlerStart);
assert.ok(renderRequestsStart >= 0 && renderRequestsEnd > renderRequestsStart, 'PDF Downloads renderer should be present');
const renderRequestsSource = scriptSource.slice(renderRequestsStart, renderRequestsEnd);
const locationDividerStart = scriptSource.indexOf('function syncInvoiceLocationDivider(');
const syncAllStart = scriptSource.indexOf('function syncAllToPreview(', locationDividerStart);
assert.ok(locationDividerStart >= 0 && syncAllStart > locationDividerStart, 'Pune divider color handler should be present');
const locationDividerSource = scriptSource.slice(locationDividerStart, syncAllStart);

function createPDFHarness({ generatorAvailable = true, failGeneration = false } = {}) {
    const writtenDocuments = [];
    const generatedOptions = [];
    let iframeCount = 0;
    let activeIframes = 0;

    class FakeFrameDocument {
        readyState = 'complete';
        open() {}
        write(content) { this.content = content; writtenDocuments.push(content); }
        close() {}
        getElementById() { return {}; }
    }

    const document = {
        baseURI: 'https://billix.example/',
        body: {
            appendChild(element) { element.parentNode = this; activeIframes += 1; },
            removeChild(element) { element.parentNode = null; activeIframes -= 1; }
        },
        querySelectorAll() { return [{ outerHTML: '<link rel="stylesheet" href="style.css">' }]; },
        createElement(tagName) {
            if (tagName === 'iframe') {
                iframeCount += 1;
                return {
                    style: {},
                    contentWindow: { document: new FakeFrameDocument() },
                    parentNode: null
                };
            }
            return {
                style: {},
                appendChild(child) { this.child = child; },
                get outerHTML() {
                    return `<div class="${this.className}" style="${this.style.cssText}">${this.child?.copyText?.innerText || ''}</div>`;
                }
            };
        },
        getElementById(id) {
            if (id === 'invoicePreview') {
                return {
                    classList: { contains: () => false },
                    cloneNode() {
                        return {
                            style: {},
                            copyText: { innerText: '' },
                            removeAttribute() {},
                            querySelector(selector) { return selector === '#copyText' ? this.copyText : null; }
                        };
                    }
                };
            }
            return null;
        }
    };

    const sandbox = {
        document,
        window: { setTimeout, clearTimeout },
        console: { error() {} },
        getFieldVal: id => id === 'invoiceNo' ? 'AC/26-27:07' : '',
        showToast() {},
        html2pdf: generatorAvailable ? () => ({
            set(options) { generatedOptions.push(options); return this; },
            from() { return this; },
            async outputPdf() {
                if (failGeneration) throw new Error('mock PDF render failure');
                return new Blob(['test-pdf'], { type: 'application/pdf' });
            },
            async save() {}
        }) : undefined
    };

    vm.runInNewContext(`${generatePDFSource}\nglobalThis.runGeneratePDF = generatePDF;`, sandbox);
    return { sandbox, writtenDocuments, generatedOptions, getIframeCount: () => iframeCount, getActiveIframes: () => activeIframes };
}

test('each individual copy keeps its label and gets an uncut, flowing PDF page', async () => {
    const copyTypes = [
        'ORIGINAL FOR RECIPIENT',
        'DUPLICATE FOR TRANSPORTER',
        'SUPPLIER COPY'
    ];

    for (const copyType of copyTypes) {
        const harness = createPDFHarness();
        const blob = await harness.sandbox.runGeneratePDF(copyType, { returnBlob: true });
        assert.equal(blob.type, 'application/pdf');
        assert.ok(blob.size > 0);
        assert.match(harness.writtenDocuments[0], new RegExp(`\\(${copyType}\\)`));
        assert.match(harness.writtenDocuments[0], /overflow: visible/);
        assert.doesNotMatch(harness.writtenDocuments[0], /height: 296\.8mm|overflow: hidden/);
        assert.deepEqual(Array.from(harness.generatedOptions[0].pagebreak.avoid), ['tr']);
        assert.equal(harness.generatedOptions[0].filename, 'Invoice_AC_26-27_07.pdf');
        assert.equal(harness.getIframeCount(), 1);
        assert.equal(harness.getActiveIframes(), 0);
    }
});

test('combined download creates Original, Duplicate, and Supplier copies in order', async () => {
    const harness = createPDFHarness();
    await harness.sandbox.runGeneratePDF('ALL', { returnBlob: true });
    const output = harness.writtenDocuments[0];
    const labels = [
        '(ORIGINAL FOR RECIPIENT)',
        '(DUPLICATE FOR TRANSPORTER)',
        '(SUPPLIER COPY)'
    ];
    let lastIndex = -1;
    for (const label of labels) {
        const index = output.indexOf(label);
        assert.ok(index > lastIndex, `${label} should be present in copy order`);
        lastIndex = index;
    }
    assert.equal((output.match(/class="pdf-page"/g) || []).length, 3);
});

test('PDF generation reports a missing library instead of silently succeeding', async () => {
    const harness = createPDFHarness({ generatorAvailable: false });
    await assert.rejects(
        harness.sandbox.runGeneratePDF('ORIGINAL FOR RECIPIENT', { returnBlob: true }),
        /PDF generator is not available/
    );
});

test('failed PDF rendering is reported and removes its temporary iframe', async () => {
    const harness = createPDFHarness({ failGeneration: true });
    await assert.rejects(
        harness.sandbox.runGeneratePDF('SUPPLIER COPY', { returnBlob: true }),
        /mock PDF render failure/
    );
    assert.equal(harness.getActiveIframes(), 0);
});

test('saved invoice product descriptions refresh before PDF generation and after form restoration', () => {
    const lastProductValueAssignment = "row.querySelector('.product-rate-unit').value = p.rateUnit || 'Per KGS';";
    const assignmentIndexes = [...savedInvoiceSource.matchAll(new RegExp(lastProductValueAssignment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
        .map(match => match.index);
    assert.equal(assignmentIndexes.length, 2, 'saved and current product rows should each be restored');

    for (const assignmentIndex of assignmentIndexes) {
        const previewRefreshIndex = savedInvoiceSource.indexOf('updatePreviewTable();', assignmentIndex);
        const previewSyncIndex = savedInvoiceSource.indexOf('syncAllToPreview();', assignmentIndex);
        assert.ok(previewRefreshIndex > assignmentIndex, 'product preview should refresh after restored product values');
        assert.ok(previewSyncIndex > previewRefreshIndex, 'preview fields should sync after product rows refresh');
    }
});

test('browser print rules scope output to the invoice and allow table pagination', () => {
    assert.match(styleSource, /body\.printing-invoice #invoicePreview/);
    assert.match(styleSource, /height:\s*auto\s*!important/);
    assert.match(styleSource, /overflow:\s*visible\s*!important/);
    assert.match(styleSource, /body\.printing-invoice #invoicePreview tr[\s\S]*?break-inside:\s*avoid/);
});

test('download dropdown is layered above the invoice preview', () => {
    const headerRule = styleSource.match(/\n\.app-header\s*\{([^}]*)\}/);
    const menuRule = styleSource.match(/\n\.dropdown-menu\s*\{([^}]*)\}/);
    assert.ok(headerRule, 'app header styles should be present');
    assert.match(headerRule[1], /position:\s*relative/);
    assert.match(headerRule[1], /z-index:\s*20/);
    assert.ok(menuRule, 'download menu styles should be present');
    assert.match(menuRule[1], /z-index:\s*100/);
});

test('selected invoice copies appear in PDF Downloads with their own download action', () => {
    const storage = new Map();
    const localStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value)
    };
    const requestSandbox = {
        PDF_REQUESTS_KEY: 'billix-pdf-requests',
        invoiceForm: { querySelectorAll: () => [] },
        productBody: { children: [] },
        document: { getElementById: () => null },
        localStorage,
        getFieldVal: id => ({ invoiceNo: 'INV-42', buyerName: 'Test Buyer' })[id] || '',
        captureFormFieldValue: () => '',
        showToast() {},
        console: { error() {} }
    };
    vm.runInNewContext(`${requestSource}\nglobalThis.runRequestPDFDownload = requestPDFDownload;`, requestSandbox);
    assert.equal(requestSandbox.runRequestPDFDownload('SUPPLIER COPY'), true);

    const requests = JSON.parse(storage.get('billix-pdf-requests'));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].invNo, 'INV-42');
    assert.equal(requests[0].copyType, 'SUPPLIER COPY');
    assert.equal(requests[0].status, 'Pending');

    const list = { innerHTML: '' };
    const renderSandbox = {
        PDF_REQUESTS_KEY: 'billix-pdf-requests',
        localStorage,
        document: { getElementById: id => id === 'pdfRequestsList' ? list : null }
    };
    vm.runInNewContext(`${renderRequestsSource}\nglobalThis.runRenderPDFDownloadsView = renderPDFDownloadsView;`, renderSandbox);
    renderSandbox.runRenderPDFDownloadsView();
    assert.match(list.innerHTML, /INV-42/);
    assert.match(list.innerHTML, /Supplier Copy/);
    assert.match(list.innerHTML, /downloadRequestedPDF\('/);
});

test('only the invoice-details divider switches between Pune orange and the default blue', () => {
    const dividerChanges = [];
    const location = { value: 'pune' };
    const divider = {
        style: {
            setProperty(property, value, priority) {
                dividerChanges.push({ property, value, priority });
            }
        }
    };
    const sandbox = {
        document: {
            getElementById: id => id === 'invoiceLocation' ? location : id === 'invoiceDetailsDivider' ? divider : null
        }
    };
    vm.runInNewContext(`${locationDividerSource}\nglobalThis.runSyncInvoiceLocationDivider = syncInvoiceLocationDivider;`, sandbox);

    sandbox.runSyncInvoiceLocationDivider();
    location.value = 'indore';
    sandbox.runSyncInvoiceLocationDivider();

    assert.deepEqual(dividerChanges, [
        { property: 'border-bottom-color', value: '#D04E2A', priority: 'important' },
        { property: 'border-bottom-color', value: '#1e40af', priority: 'important' }
    ]);
    assert.match(scriptSource, /invoiceLocationSelector\?\.addEventListener\('change', syncInvoiceLocationDivider\)/);
    assert.match(scriptSource, /syncBillToToShipToPreview\(\);\s*syncInvoiceLocationDivider\(\);/);
});

test('download dropdown queues each selected copy, blocks rapid duplicates, and works repeatedly', () => {
    const handlers = new Map();
    const windowHandlers = new Map();
    const timers = [];
    const queuedTypes = [];
    const options = [
        'ORIGINAL FOR RECIPIENT',
        'DUPLICATE FOR TRANSPORTER',
        'SUPPLIER COPY',
        'ALL'
    ].map(type => ({
        disabled: false,
        getAttribute: () => type,
        addEventListener: (name, handler) => handlers.set(`${type}:${name}`, handler)
    }));
    const dropdown = {
        open: false,
        classList: {
            toggle(_name, value) { dropdown.open = value; },
            contains: () => dropdown.open
        },
        contains: target => target !== 'outside'
    };
    const button = {
        disabled: false,
        attrs: {},
        closest: () => dropdown,
        setAttribute(name, value) { this.attrs[name] = value; },
        addEventListener: (name, handler) => handlers.set(`button:${name}`, handler),
        focus() { this.focused = true; }
    };
    const window = {
        addEventListener: (name, handler) => windowHandlers.set(name, handler),
        setTimeout: callback => { timers.push(callback); return timers.length; }
    };
    const sandbox = {
        downloadBtn: button,
        dropdownItems: options,
        window,
        requestPDFDownload: type => { queuedTypes.push(type); return true; },
        console: { error() {} },
        showToast() {},
        isRaisingPDFRequest: false
    };
    vm.runInNewContext(`function bindDropdown() { ${dropdownSource} }\nglobalThis.runBindDropdown = bindDropdown;`, sandbox);
    sandbox.runBindDropdown();

    const stopEvent = { stopPropagation() {} };
    const toggleHandler = handlers.get('button:click');
    toggleHandler(stopEvent);
    assert.equal(dropdown.open, true);
    assert.equal(button.attrs['aria-expanded'], 'true');
    windowHandlers.get('click')({ target: 'outside' });
    assert.equal(dropdown.open, false);

    for (const type of ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'SUPPLIER COPY', 'ALL']) {
        const itemHandler = handlers.get(`${type}:click`);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            toggleHandler(stopEvent);
            itemHandler();
            assert.equal(dropdown.open, false);
            assert.equal(button.disabled, true);
            assert.equal(options.every(option => option.disabled), true);
            itemHandler();
            assert.equal(queuedTypes.filter(value => value === type).length, attempt + 1,
                'rapid duplicate selections should be ignored');
            timers.shift()();
            assert.equal(button.disabled, false);
            assert.equal(options.every(option => option.disabled), false);
        }
    }

    toggleHandler(stopEvent);
    windowHandlers.get('keydown')({ key: 'Escape' });
    assert.equal(dropdown.open, false);
    assert.equal(button.focused, true);
});
