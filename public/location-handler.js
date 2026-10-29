(function () {
  const LOCATION_STORAGE_KEY = 'billix-invoice-location';
  const PROFILE_STORAGE_KEY = 'billix-invoice-location-profiles';
  const COMPANY_SELECTION_KEY = 'billix-invoice-company-selections';

  // Each location/company pair selects a template and its own saved form state.
  const companyConfigs = {
    avneesh: { label: 'AVNEESH CORPORATION', template: 'standard', authorizedName: 'AVNEESH CORPORATION' },
    shreeKedarnath: {
      label: 'SHREE KEDARNATH STEEL',
      template: 'sks',
      authorizedName: 'SHREE KEDARNATH STEEL',
      defaults: {
        sellerName: 'SHREE KEDARNATH STEEL',
        dispatchFrom: '',
        sellerAddress: '132 Ganesh Dham Colony Sanwer Road, Indore (452015)',
        sellerGST: '23DJAPR4723R1ZR',
        sellerState: '23',
        sellerStateCode: '23',
        invoiceNo: 'SKS/26-27/36',
        invoiceDate: '',
        transportName: '',
        lorryNo: '',
        biltyNo: '',
        buyerName: '',
        buyerAddress: '',
        buyerGST: '',
        buyerState: '',
        buyerStateCode: '',
        shipToName: '',
        shipToAddress: '',
        shipToGST: '',
        shipToState: '',
        shipToStateCode: '',
        bankHolder: 'SHREE KEDARNATH STEEL',
        bankName: 'HDFC BANK',
        bankAccount: '50200086052840',
        bankIFSC: 'HDFC0009403',
        bankAddress: 'INDORE SANWER ROAD BRANCH',
        cgst: '9',
        sgst: '9',
        igst: '18'
      }
    }
  };

  const companiesByLocation = {
    indore: ['avneesh', 'shreeKedarnath'],
    pune: ['avneesh']
  };

  const puneDefaults = {
    sellerName: 'AVNEESH CORPORATION',
    dispatchFrom: '',
    sellerAddress: 'GAT NO 125/1 Jejuri Station Nagar Purandhar, Jejuri, Pune, Maharashtra (412303)',
    sellerGST: '27CAEPR5751F1ZI',
    sellerState: '27',
    sellerStateCode: '27',
    invoiceNo: 'AC/26-27/05',
    buyerName: '',
    buyerAddress: '',
    buyerGST: '',
    buyerState: '',
    buyerStateCode: '',
    shipToName: '',
    shipToAddress: '',
    shipToGST: '',
    shipToState: '',
    shipToStateCode: '',
    bankHolder: 'AVNEESH CORPORATION',
    bankName: 'BANK OF BARODA',
    bankAccount: '05000500000161',
    bankIFSC: 'BARB0INDIND',
    cgst: '9',
    sgst: '9',
    igst: '18'
  };

  function readJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (_) {
      return fallback;
    }
  }

  function readLocationProfiles() {
    const profiles = readJSON(PROFILE_STORAGE_KEY, {});
    let migrated = false;

    // Preserve the location-only profiles created by the earlier location selector.
    if (profiles.indore && !profiles['indore:avneesh']) {
      profiles['indore:avneesh'] = profiles.indore;
      migrated = true;
    }
    if (profiles.pune && !profiles['pune:avneesh']) {
      profiles['pune:avneesh'] = profiles.pune;
      migrated = true;
    }

    const pune = profiles['pune:avneesh'];
    if (pune?.sellerName === 'AGNESH CORPORATION') {
      pune.sellerName = 'AVNEESH CORPORATION';
      migrated = true;
    }
    if (pune?.bankHolder === 'AGNESH CORPORATION') {
      pune.bankHolder = 'AVNEESH CORPORATION';
      migrated = true;
    }
    if (pune && (!pune.invoiceNo || pune.invoiceNo === 'AC/26-27/04')) {
      pune.invoiceNo = 'AC/26-27/05';
      migrated = true;
    }

    if (migrated) localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    return profiles;
  }

  function initInvoiceLocationSelector() {
    const locationSelector = document.getElementById('invoiceLocation');
    const companySelector = document.getElementById('invoiceCompany');
    const form = document.getElementById('invoiceForm');
    const products = document.getElementById('productBody');
    const invoicePreview = document.getElementById('invoicePreview');
    const sksTemplate = document.getElementById('sksInvoiceTemplate');
    if (!locationSelector || !companySelector || !form || !products || !invoicePreview || !sksTemplate) return;

    const profiles = readLocationProfiles();
    const companySelections = readJSON(COMPANY_SELECTION_KEY, {});
    const standardTemplateMarkup = invoicePreview.innerHTML;
    let activeLocation = localStorage.getItem(LOCATION_STORAGE_KEY) === 'pune' ? 'pune' : 'indore';
    let activeCompany = 'avneesh';

    const getProfileKey = (location, companyId) => `${location}:${companyId}`;
    const getCompanyConfig = (companyId) => companyConfigs[companyId] || companyConfigs.avneesh;

    const captureProfile = () => {
      const values = {};
      form.querySelectorAll('input, select, .rich-editable').forEach((field) => {
        if (!field.id || field.id === 'invoiceLocation' || field.id === 'invoiceCompany') return;
        values[field.id] = field.classList.contains('rich-editable') ? field.innerHTML : field.value;
      });
      values.sameAsBillTo = document.getElementById('sameAsBillTo')?.checked ?? true;
      values.products = Array.from(products.children).map((row) => ({
        desc: row.querySelector('.product-desc')?.innerHTML || '',
        hsn: row.querySelector('.product-hsn')?.innerHTML || '',
        qty: row.querySelector('.product-qty')?.value || '0',
        rate: row.querySelector('.product-rate')?.value || '0',
        qtyUnit: row.querySelector('.product-unit')?.value || 'KGS',
        rateUnit: row.querySelector('.product-rate-unit')?.value || 'Per KGS'
      }));
      return values;
    };

    const saveActiveProfile = (companyId = activeCompany) => {
      profiles[getProfileKey(activeLocation, companyId)] = captureProfile();
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    };

    const refreshStatePreviews = () => {
      form.querySelectorAll('.state-selector[data-target]').forEach((stateSelector) => {
        stateSelector.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    const setCompanyOptions = (location, selectedCompany) => {
      const allowedCompanies = companiesByLocation[location] || companiesByLocation.indore;
      companySelector.replaceChildren();
      allowedCompanies.forEach((companyId) => {
        const option = document.createElement('option');
        option.value = companyId;
        option.textContent = getCompanyConfig(companyId).label;
        companySelector.appendChild(option);
      });
      const companyId = allowedCompanies.includes(selectedCompany) ? selectedCompany : 'avneesh';
      companySelector.value = allowedCompanies.includes(companyId) ? companyId : allowedCompanies[0];
      companySelections[location] = companySelector.value;
      localStorage.setItem(COMPANY_SELECTION_KEY, JSON.stringify(companySelections));
    };

    const seedProfile = (location, companyId) => {
      const company = getCompanyConfig(companyId);
      const defaults = location === 'pune' ? puneDefaults : company.defaults;
      if (!defaults) return;

      Object.entries(defaults).forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (!field) return;
        if (field.classList.contains('rich-editable')) field.innerHTML = value;
        else field.value = value;
      });

      if (location === 'indore' && companyId === 'shreeKedarnath') {
        const dateField = document.getElementById('invoiceDate');
        if (dateField) dateField.value = new Date().toISOString().split('T')[0];
      }

      products.innerHTML = '';
      if (typeof window.addNewRow === 'function') window.addNewRow();
      refreshStatePreviews();

      const sameAsBillTo = document.getElementById('sameAsBillTo');
      if (sameAsBillTo) {
        sameAsBillTo.checked = true;
        sameAsBillTo.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const restoreProfile = (location, companyId) => {
      const values = profiles[getProfileKey(location, companyId)];
      if (!values) {
        seedProfile(location, companyId);
        return;
      }

      Object.entries(values).forEach(([id, value]) => {
        if (id === 'products' || id === 'sameAsBillTo') return;
        const field = document.getElementById(id);
        if (!field) return;
        if (field.classList.contains('rich-editable')) field.innerHTML = value;
        else field.value = value;
      });

      // Keep the seller identity tied to the selected company if an older saved
      // Shree profile captured the previously active Avneesh name.
      if (companyId === 'shreeKedarnath') {
        const sellerName = companyConfigs.shreeKedarnath.label;
        const sellerNameField = document.getElementById('sellerName');
        if (sellerNameField) sellerNameField.innerHTML = sellerName;
        let profileChanged = values.sellerName !== sellerName;
        values.sellerName = sellerName;

        const bankDefaults = companyConfigs.shreeKedarnath.defaults;
        ['bankName', 'bankAccount', 'bankIFSC', 'bankHolder', 'bankAddress'].forEach((id) => {
          const value = bankDefaults[id];
          const field = document.getElementById(id);
          if (field) field.innerHTML = value;
          if (values[id] !== value) profileChanged = true;
          values[id] = value;
        });

        if (profileChanged) {
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
        }
      }
      refreshStatePreviews();

      const sameAsBillTo = document.getElementById('sameAsBillTo');
      if (sameAsBillTo) {
        sameAsBillTo.checked = companyId === 'shreeKedarnath'
          ? true
          : (typeof values.sameAsBillTo === 'boolean' ? values.sameAsBillTo : true);
        if (companyId === 'shreeKedarnath' && values.sameAsBillTo !== true) {
          values.sameAsBillTo = true;
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
        }
        sameAsBillTo.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (Array.isArray(values.products)) {
        products.innerHTML = '';
        values.products.forEach((product) => {
          if (typeof window.addNewRow === 'function') window.addNewRow();
          const row = products.lastElementChild;
          if (!row) return;
          row.querySelector('.product-desc').innerHTML = product.desc || '';
          row.querySelector('.product-hsn').innerHTML = product.hsn || '';
          row.querySelector('.product-qty').value = product.qty || '0';
          row.querySelector('.product-rate').value = product.rate || '0';
          row.querySelector('.product-unit').value = product.qtyUnit || 'KGS';
          row.querySelector('.product-rate-unit').value = product.rateUnit || 'Per KGS';
        });
        if (!values.products.length && typeof window.addNewRow === 'function') window.addNewRow();
      }
    };

    const renderTemplate = (location, companyId) => {
      const company = getCompanyConfig(companyId);
      invoicePreview.classList.remove('pune-invoice', 'sks-invoice');
      if (company.template === 'sks') {
        invoicePreview.innerHTML = '';
        invoicePreview.appendChild(sksTemplate.content.cloneNode(true));
        invoicePreview.classList.add('sks-invoice');
      } else {
        invoicePreview.innerHTML = standardTemplateMarkup;
        if (location === 'pune') invoicePreview.classList.add('pune-invoice');
      }
      document.getElementById('bankAddressGroup')?.classList.toggle('hidden', company.template !== 'sks');
    };

    const updateFirmHeading = (location, companyId) => {
      const company = getCompanyConfig(companyId);
      const authorizedCompany = document.getElementById('preview-authorized-company');
      const jurisdiction = document.getElementById('jurisdictionText');
      if (authorizedCompany) authorizedCompany.textContent = `FOR ${company.authorizedName}`;
      if (jurisdiction) {
        const note = `ALL SUBJECT TO ${location === 'pune' ? 'PUNE' : 'INDORE'} JURISDICTION`;
        if (company.template === 'sks') jurisdiction.innerHTML = `<strong>NOTE :</strong><br>${note}`;
        else jurisdiction.textContent = `NOTE : ${note}`;
      }
      locationSelector.setAttribute('aria-label', `e-Invoice Location: ${locationSelector.options[locationSelector.selectedIndex].text}`);
      companySelector.setAttribute('aria-label', `Company: ${company.label}`);
    };

    const refreshActivePreview = () => {
      updateFirmHeading(activeLocation, companySelector.value);
      if (typeof window.syncAllToPreview === 'function') window.syncAllToPreview();
      const sameAsBillTo = document.getElementById('sameAsBillTo');
      if (getCompanyConfig(companySelector.value).template === 'sks' && sameAsBillTo?.checked) {
        // syncAllToPreview writes saved Ship To fields too; reapply the checked
        // Same as Bill To setting last so the visible Shree preview matches.
        sameAsBillTo.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (typeof window.updatePreviewTable === 'function') window.updatePreviewTable();
      else if (typeof window.calculateTotals === 'function') window.calculateTotals();
      const copyText = document.getElementById('copyText');
      const copySelector = document.getElementById('copySelector');
      if (copyText && copySelector) copyText.textContent = `(${copySelector.value})`;
    };

    const initialIndoreProfile = captureProfile();
    profiles['indore:avneesh'] = profiles['indore:avneesh'] || initialIndoreProfile;
    activeLocation = ['indore', 'pune'].includes(activeLocation) ? activeLocation : 'indore';
    locationSelector.value = activeLocation;
    const savedSelections = readJSON(COMPANY_SELECTION_KEY, companySelections);
    setCompanyOptions(activeLocation, savedSelections[activeLocation] || 'avneesh');
    activeCompany = companySelector.value;
    renderTemplate(activeLocation, companySelector.value);
    restoreProfile(activeLocation, companySelector.value);
    refreshActivePreview();

    locationSelector.addEventListener('change', () => {
      if (locationSelector.value === activeLocation) return;
      saveActiveProfile();
      activeLocation = locationSelector.value === 'pune' ? 'pune' : 'indore';
      localStorage.setItem(LOCATION_STORAGE_KEY, activeLocation);
      setCompanyOptions(activeLocation, companySelections[activeLocation] || 'avneesh');
      activeCompany = companySelector.value;
      renderTemplate(activeLocation, companySelector.value);
      restoreProfile(activeLocation, companySelector.value);
      refreshActivePreview();
    });

    companySelector.addEventListener('change', () => {
      if (!companiesByLocation[activeLocation]?.includes(companySelector.value)) return;
      saveActiveProfile(activeCompany);
      activeCompany = companySelector.value;
      companySelections[activeLocation] = companySelector.value;
      localStorage.setItem(COMPANY_SELECTION_KEY, JSON.stringify(companySelections));
      renderTemplate(activeLocation, companySelector.value);
      restoreProfile(activeLocation, companySelector.value);
      refreshActivePreview();
    });
  }

  const routeMap = {
    home: 'home',
    dashboard: 'dashboard',
    create: 'create',
    ledger: 'ledger',
    downloads: 'pdf-downloads',
    'pdf-downloads': 'pdf-downloads',
    help: 'help',
    profile: 'profile'
  };

  function applyRoute() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
    const view = routeMap[raw] || 'home';
    if (typeof window.switchView === 'function') window.switchView(view);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initInvoiceLocationSelector();
      applyRoute();
    }, { once: true });
  } else {
    initInvoiceLocationSelector();
    applyRoute();
  }

  window.addEventListener('hashchange', applyRoute);
})();
