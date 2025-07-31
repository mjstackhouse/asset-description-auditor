import { useEffect, useState, useRef, useLayoutEffect, type ChangeEvent, type FormEvent } from 'react'
import { AssetModels, createManagementClient, LanguageModels } from '@kontent-ai/management-sdk';
import './App.css'
import Select from 'react-select';
import * as XLSX from 'xlsx';

interface Map {
  [key: string]: any;
}

// Helper to export overview data to Excel
interface OverviewRow {
  id: string;
  name: string;
  percent: number;
  withDescription: number;
  total: number;
  fullyDescribed: number;
  isDefault: boolean;
}

function App() {
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [languages, setLanguages] = useState<Array<LanguageModels.LanguageModel>>();
  const [assets, setAssets] = useState<Array<AssetModels.Asset>>();
  const [filteredAssets, setFilteredAssets] = useState<Array<AssetModels.Asset>>();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [initialTableHeight, setInitialTableHeight] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState<string>('Fetching assets...');
  const [apiKeyErrorText, setAPIKeyErrorText] = useState<string>('');
  const [environmentIdErrorText, setEnvironmentIdErrorText] = useState<string>('');
  const [isExportOverviewLoading, setIsExportOverviewLoading] = useState(false);
  const [isExportAssetsLoading, setIsExportAssetsLoading] = useState(false);
  const [pageBeforeSearch, setPageBeforeSearch] = useState<number>(1);


  function exportOverviewToExcel(overviewData: OverviewRow[], totalAssets?: number, fullyDescribed?: number) {
    if (!overviewData || overviewData.length === 0) return;
    const wsData = [
      [
        'Total assets:', totalAssets ?? overviewData[0]?.total ?? 0
      ],
      [
        'Described in all selected languages:', fullyDescribed ?? overviewData[0]?.fullyDescribed ?? 0
      ],
      [], // Empty row for spacing
      [
        'Language',
        'Percentage with Description',
        'Number with Description',
        'Default Language',
      ],
      ...overviewData.map((lang: OverviewRow) => [
        lang.name,
        `${lang.percent}%`,
        `${lang.withDescription}`,
        lang.isDefault ? 'Yes' : 'No',
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Overview');
    XLSX.writeFile(wb, `${environmentId}-overview.xlsx`);
  }
  
  // Helper to export asset table data to Excel
  function exportAssetsToExcel({
    assets,
    languages,
    selectedLanguages,
    environmentId
  }: {
    assets: AssetModels.Asset[];
    languages: LanguageModels.LanguageModel[];
    selectedLanguages: string[];
    environmentId: string;
  }) {
    if (!assets || assets.length === 0) return;
    const langHeaders = languages.filter((lang: LanguageModels.LanguageModel) => selectedLanguages.includes(lang.id));
    const wsData = [
      [
        'Edit Link',
        'Title',
        ...langHeaders.map((lang: LanguageModels.LanguageModel) => lang.name)
      ],
      ...assets.map((asset: AssetModels.Asset) => [
        `https://app.kontent.ai/${environmentId}/content-inventory/assets/asset/${asset.id}`,
        asset.title && asset.title.trim() !== '' ? asset.title : asset.fileName,
        ...langHeaders.map((lang: LanguageModels.LanguageModel) => {
          const desc = asset.descriptions.find((d: any) => d.language.id === lang.id);
          return desc && desc.description ? desc.description : 'None';
        })
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `${environmentId}-assets.xlsx`);
  }
  
  // Helper: check if asset is an image
  function isImageAsset(asset: any) {
    return asset.type && asset.type.startsWith('image/');
  }

  // Add this function to handle Kontent.ai API errors (now inside App)
  function handleAPIError(error: any) {
    // Try to extract error code/message from Kontent.ai API error response
    let errorCode = error?.response?.data?.error || error?.code || error.errorCode;
    let message = error?.response?.data?.message || error?.message || 'An error occurred.';

    if (typeof errorCode === 'number') {
      const apiKeyError = document.getElementById('api-key-error');
      
      if (apiKeyError) {
        apiKeyError.style.display = 'block';
        apiKeyError.innerText = 'Invalid or unauthorized API key. Please check your API key and its permissions.';
      }
    }

    const environmentIdError = document.getElementById('environment-id-error');

    if (error === 'no assets') {
      if (environmentIdError) {
        environmentIdError.style.display = 'block';
        environmentIdError.innerText = 'Your environment contains no assets. Please choose a different environment.';
      }
    }

    if (errorCode === 400 || errorCode === 403 || errorCode === 404 || message === 'Network Error') {
      if (environmentIdError) {
        environmentIdError.style.display = 'block';
        environmentIdError.innerText = 'Invalid environment ID. Please check your environment ID.';
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setLoadingText('Fetching assets...');

    const loadingContainer = document.getElementById('loading-container') as HTMLElement;
    if (loadingContainer) loadingContainer.style.display = 'flex';

    const environmentIdInput = document.getElementById('environment-id') as HTMLInputElement;
    const keyInput = document.getElementById('api-key') as HTMLInputElement;
    const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
    const environmentIdError = document.getElementById('environment-id-error') as HTMLElement;

    if (environmentIdInput && keyInput) {
      if (environmentIdInput.value !== '' && keyInput.value !== '') {

        setEnvironmentId(environmentIdInput.value);
      }
      else {
        if (environmentIdInput.value === '') {
          if (loadingContainer) loadingContainer.style.display = 'none';
          if (environmentIdError) environmentIdError.style.display = 'block';
          setEnvironmentIdErrorText('Please provide an environment ID.');
        }
        
        if (keyInput.value === '') {
          if (loadingContainer) loadingContainer.style.display = 'none';
          if (apiKeyError) apiKeyError.style.display = 'block';
          setAPIKeyErrorText('Please provide an API key.');
        }
      }
    }

    setEnvironmentId(environmentIdInput.value);

    const client = createManagementClient({
      environmentId: environmentIdInput.value,
      apiKey: keyInput.value
    });

    client
        .listAssets()
        .toAllPromise()
        .then((assetsResponse) => {
          if (assetsResponse.data.items.length > 0) {
            setLoadingText('Fetching languages...');
            client.listLanguages()
              .toPromise()
              .then((langResponse) => {
                if (langResponse.data.items.length > 0) {
                  if (loadingContainer) loadingContainer.style.display = 'none';
                  if (apiKeyError) apiKeyError.style.display = 'none';
                  if (environmentIdError) environmentIdError.style.display = 'none';

                  const activeLanguages = langResponse.data.items.filter((lang) => lang.isActive === true);
                  const map: Map = {};
                  
                  activeLanguages.map((lang) => {
                    map[lang.id] = lang.name;
                  })

                  let pages = 0;

                  for (let i = 0; i < assetsResponse.data.items.length; i += 10) {
                    pages++;
                  }

                  setLanguages(activeLanguages);
                  setAssets(assetsResponse.data.items);
                  setFilteredAssets(assetsResponse.data.items);
                  setSelectedLanguages(activeLanguages.map(lang => lang.id));
                  setIsLoading(false);
                }
              })
              .catch((error) => {
                // Error handling for Languages endpoint
                if (loadingContainer) loadingContainer.style.display = 'none';
                handleAPIError(error);
                setIsLoading(false);
              });
          } 
          else {
            if (loadingContainer) loadingContainer.style.display = 'none';
            handleAPIError('no assets');
            setIsLoading(false);
          }
        })
        .catch((error) => {
          console.log('error in assets: ', error);
          // Error handling for Assets endpoint
          if (loadingContainer) loadingContainer.style.display = 'none';
          handleAPIError(error);
          setIsLoading(false);
        });
  }

  function handleShowOnlyMissing(e: ChangeEvent<HTMLInputElement>) {
    setShowOnlyMissing(e.target.checked);
  }

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300); // 300ms debounce for responsive UX
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Track the initial table height before searching
  useLayoutEffect(() => {
    if (tableContainerRef.current && !searchQuery && initialTableHeight === null) {
      setInitialTableHeight(tableContainerRef.current.offsetHeight);
    }
    // Optionally, update the height if the table grows (e.g., after clearing search)
    if (tableContainerRef.current && !searchQuery && initialTableHeight !== null) {
      if (tableContainerRef.current.offsetHeight > initialTableHeight) {
        setInitialTableHeight(tableContainerRef.current.offsetHeight);
      }
    }
  }, [searchQuery, filteredAssets, debouncedQuery]);

  // Filter assets by search query (title or file name) using debouncedQuery
  const searchFilteredAssets = filteredAssets
    ? filteredAssets.filter(asset => {
        // Use the same logic as the table display: title if available, otherwise file name
        const displayTitle = asset.title && asset.title.trim() !== '' ? asset.title : asset.fileName;
        // Check all descriptions for a match
        const descriptions = Array.isArray(asset.descriptions)
          ? asset.descriptions.map((d: any) => d.description || '').join(' ') : '';
        const query = debouncedQuery.toLowerCase();
        return (
          displayTitle.toLowerCase().includes(query) ||
          descriptions.toLowerCase().includes(query)
        );
      })
    : [];

  // Filter by language and missing descriptions
  const filteredAssetsByLanguage = searchFilteredAssets
    ? searchFilteredAssets.filter(asset => {
        if (!showOnlyMissing) return true;
        return selectedLanguages.some(langId => {
          const desc = asset.descriptions.find((d: any) => d.language.id === langId);
          return !desc || !desc.description;
        });
      })
    : [];

  const paginatedAssets = filteredAssetsByLanguage.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const computedPageCount = Math.ceil(filteredAssetsByLanguage.length / pageSize);

  // Track when search starts and manage page restoration
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.trim() !== '') {
      // Search is active - store current page and reset to page 1
      setPageBeforeSearch(currentPage);
      setCurrentPage(1);
    } else if (debouncedQuery === '' && pageBeforeSearch !== 1) {
      // Search was cleared - restore the page user was on before searching
      setCurrentPage(pageBeforeSearch);
    } else if (debouncedQuery === '') {
      // Search was cleared but no previous page to restore, or user was already on page 1
      setCurrentPage(1);
    }
  }, [debouncedQuery]);

  // Auto-scroll to left when search returns no results
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    // If there are no results and the user is scrolled horizontally, scroll back to left
    if (paginatedAssets.length === 0 && tableContainer.scrollLeft > 0) {
      tableContainer.scrollTo({
        left: 0,
        behavior: 'auto'
      });
    }
  }, [paginatedAssets]);

  // Reset page when languages or missing filter changes
  useEffect(() => {
    setCurrentPage(1);
    setPageBeforeSearch(1);
  }, [selectedLanguages, showOnlyMissing]);

  // Select all and unselect all handlers
  function handleSelectAllLanguages() {
    if (languages) {
      setSelectedLanguages(languages.map(lang => lang.id));
    }
  }

  function handleBackBtn() {
    setEnvironmentId('');
    setLanguages([]);
    setAssets([]);
    setFilteredAssets([]);
    setSelectedLanguages([]);
    setShowOnlyMissing(false);
    setCurrentPage(1);
    setPageBeforeSearch(1);
    setSearchQuery('');
    setDebouncedQuery('');
    setInitialTableHeight(null);
    setIsLoading(false);
    setAPIKeyErrorText('');
    setEnvironmentIdErrorText('');
  }

  // Calculate overview metrics for selected languages
  const overviewData = (languages && filteredAssets)
    ? languages
        .filter(lang => selectedLanguages.includes(lang.id))
        .map(lang => {
          const total = filteredAssets.length;
          const withDescription = filteredAssets.filter(asset => {
            const desc = asset.descriptions.find((d: any) => d.language.id === lang.id);
            return desc && desc.description && desc.description.trim() !== '';
          }).length;
          const percent = total > 0 ? Math.round((withDescription / total) * 100) : 0;
          // Fully described: assets that have a description in ALL selected languages
          const fullyDescribed = filteredAssets.filter(asset =>
            selectedLanguages.every(selLangId => {
              const desc = asset.descriptions.find((d: any) => d.language.id === selLangId);
              return desc && desc.description && desc.description.trim() !== '';
            })
          ).length;
          return {
            id: lang.id,
            name: lang.name,
            percent,
            withDescription,
            total,
            fullyDescribed,
            isDefault: lang.isDefault || false
          };
        })
        // Sort by withDescription descending
        .sort((a, b) => b.withDescription - a.withDescription)
  : [];

  function handleExportOverview() {
    setIsExportOverviewLoading(true);
    exportOverviewToExcel(overviewData, filteredAssets?.length ?? 0, overviewData[0]?.fullyDescribed ?? 0);
    setTimeout(() => setIsExportOverviewLoading(false), 1000);
  }

  function handleExportAssets() {
    setIsExportAssetsLoading(true);
    exportAssetsToExcel({
      assets: filteredAssetsByLanguage,
      languages: languages || [],
      selectedLanguages,
      environmentId
    });
    setTimeout(() => setIsExportAssetsLoading(false), 1000);
  }

  useEffect(() => {
    const summary = document.getElementById('assets-summary');
    if (summary) {
      summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Handle wheel events to prevent accidental table scrolling
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const handleWheel = (e: WheelEvent) => {
      // Only allow table scrolling if the user is explicitly trying to scroll the table
      // or if the table content is actually scrollable
      const isTableScrollable = tableContainer.scrollHeight > tableContainer.clientHeight;
      const isScrollingDown = e.deltaY > 0;
      const isScrollingUp = e.deltaY < 0;
      
      const isAtTop = tableContainer.scrollTop === 0;
      const isAtBottom = tableContainer.scrollTop + tableContainer.clientHeight >= tableContainer.scrollHeight;
      
      // Allow table scrolling if:
      // 1. Table is not scrollable (no need to prevent anything)
      // 2. User is scrolling down and not at bottom, or scrolling up and not at top
      // 3. User is scrolling horizontally (deltaX)
      if (!isTableScrollable || 
          (isScrollingDown && !isAtBottom) || 
          (isScrollingUp && !isAtTop) ||
          Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return; // Allow the table scroll
      }
      
      // When at boundaries, don't prevent the scroll - let it bubble up to the page
      // This allows the page to scroll when the user hits the table boundaries
      return; // Let the scroll event bubble up naturally
    };

    tableContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      tableContainer.removeEventListener('wheel', handleWheel);
    };
  }, [paginatedAssets, languages, selectedLanguages]);

  // Distribute row heights evenly when there are fewer than pageSize results
  useEffect(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer || paginatedAssets.length >= pageSize) return;

    const table = tableContainer.querySelector('table');
    if (!table) return;

    // Measure the actual header height dynamically
    const thead = table.querySelector('thead');
    const actualHeaderHeight = thead ? thead.offsetHeight : 60;
    
    // Calculate available height more precisely
    const availableHeight = tableContainer.clientHeight - actualHeaderHeight;
    const rowHeight = Math.max(availableHeight / paginatedAssets.length, 80); // Minimum 80px per row

    // Set equal height on all table rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      (row as HTMLElement).style.height = `${rowHeight}px`;
    });

    // Cleanup function to reset heights when component unmounts or dependencies change
    return () => {
      rows.forEach(row => {
        (row as HTMLElement).style.height = '';
      });
    };
  }, [paginatedAssets, pageSize]);

  return (
    <>
      <p id='app-title' className='absolute top-0 right-0 left-0 py-4 pl-[3rem] text-left text-white z-10'>Asset description auditor</p>
      {/* <h1 className='app-header'>Asset description auditor</h1> */}
    <div>
      <div id='loading-container' className='basis-full fixed bg-white z-10 top-0 bottom-0 left-0 right-0 flex place-items-center'>
        <div className='basis-full flex flex-wrap'>
          <div className='basis-full flex flex-wrap place-content-center'>
            <div id='loading-general-text' className='basis-full mb-3'>{loadingText}</div>
            <span id='loading-general' className='loading-span text-6xl'></span>
          </div>
        </div>
      </div>
      {
        (!languages || languages.length === 0) && (
          <form onSubmit={(e) => handleSubmit(e)} className='basis-full flex flex-wrap place-content-start'>
            <div className='basis-full relative flex flex-wrap mb-6'>
              <label id='environment-id-label' htmlFor='environment-id' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
                Environment ID
              <span className='tooltip-icon' title="The environment ID of the environment where your assets are located. This can be found under 'Environment settings', or as the value in the URL as shown: app.kontent.ai/<environment-id>.">ⓘ</span>
              </label>
                <input type='text' id='environment-id' name='environment-id' />
                <p id='environment-id-error' className='error absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-0 left-[160px]'>
                {environmentIdErrorText}
                </p>
            </div>
            <div className='basis-full relative flex flex-wrap'>
              <label id='api-key-label' htmlFor='api-key' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
                Management API Key
                  <span className='tooltip-icon' title="You can find your Management API key from the left-hand navigation bar under 'Project settings' -> 'API keys'. Be sure that it has the 'Read assets' permission selected.">ⓘ</span>
              </label>
                <input type='text' id='api-key' name='api-key' className='mb-6' />
                <p id='api-key-error' className='error absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-0 left-[230px]'>
                {apiKeyErrorText}
                </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '1rem' }}>
              <button type='submit' className='btn continue-btn' disabled={isLoading}>
                Get assets
              </button>
            </div>
          </form>
        )
      }
        {(assets && assets.length > 0 && languages && languages.length > 0) && (
          <>
            {/* <hr className='form-divider' /> */}
            <details open>
              <summary className='text-[16px] text-left font-bold cursor-pointer'>
                <div style={{ marginLeft: '12px', display: 'inline' }}>Languages</div>
              </summary>
              <div className='mb-6 mt-6' style={{ marginLeft: '24px' }}>
                <Select
                  id='lang-selector'
                  isMulti
                  options={languages?.map(lang => ({ value: lang.id, label: lang.name })) || []}
                  value={languages?.filter(lang => selectedLanguages.includes(lang.id)).map(lang => ({ value: lang.id, label: lang.name })) || []}
                  onChange={options => setSelectedLanguages(options.map((opt: any) => opt.value))}
                  className='basic-multi-select mb-6'
                  classNamePrefix='select'
                  placeholder='Select languages...'
                  closeMenuOnSelect={false}
                  styles={{
                    menu: base => ({ ...base, zIndex: 9999 }),
                    menuList: base => ({
                      ...base,
                      padding: 16
                    }),
                    valueContainer: base => ({
                      ...base,
                      padding: 0
                    }),
                    control: (base, state) => ({
                      ...base,
                      fontSize: '14px',
                      borderColor: 'transparent',
                      backgroundColor: 'var(--color-gray-100)',
                      padding: 16,
                      boxShadow: state.isFocused ? '0 0 0 1px var(--orange)' : 'none',
                      borderRadius: '8px',
                      '&:hover': {
                        backgroundColor: 'rgba(21, 21, 21, 0.1)'
                      }
                    }),
                    input: (base) => ({
                      ...base,
                      fontSize: '14px',
                      border: 'none',
                      boxShadow: 'none',
                      outline: 'none',
                    }),
                    placeholder: (base) => ({
                      ...base,
                      fontSize: '14px',
                    }),
                    singleValue: (base) => ({
                      ...base,
                      fontSize: '14px',
                    }),
                    option: (base, state) => ({
                      ...base,
                      fontSize: '14px',
                      textAlign: 'left',
                      backgroundColor: state.isFocused ? 'rgba(21, 21, 21, 0.1)' : base.backgroundColor,
                      color: base.color,
                    }),
                    multiValue: (base) => ({
                      ...base,
                      fontSize: '14px',
                      backgroundColor: 'var(--lighter-purple)',
                      color: 'var(--purple)',
                      borderRadius: '9999px',
                      margin: '2px 4px',
                      marginBottom: '6px',
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      fontSize: '14px',
                      color: 'var(--lighter-black)',
                      paddingRight: '4px',
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      fontSize: '14px',
                      color: 'var(--color-gray-400)',
                      cursor: 'pointer',
                      borderRadius: '50%',
                      padding: '0 4px',
                      transition: 'color 0.2s',
                      ':hover': {
                        color: 'var(--red)',
                      },
                      '& svg': {
                        display: 'none'
                      },
                      '&::after': {
                        content: '""',
                        display: 'block',
                        width: '21px',
                        height: '21px',
                        margin: '0 0 1px 0',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1' stroke='%23a3a3a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 18 18 6M6 6l12 12' /%3E%3C/svg%3E")`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        transition: 'background-image 0.2s'
                      },
                      ':hover::after': {
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1' stroke='%23db0000'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 18 18 6M6 6l12 12' /%3E%3C/svg%3E")`
                      }
                    }),
                    noOptionsMessage: (base) => ({
                      ...base,
                      fontSize: '14px',
                      textAlign: 'left',
                    }),
                    clearIndicator: (base) => ({
                      ...base,
                      color: 'var(--color-gray-400)',
                      cursor: 'pointer',
                      ':hover': {
                        color: 'var(--red)'
                      },
                      '& svg': {
                        display: 'none'
                      },
                      '&::after': {
                        content: '""',
                        display: 'block',
                        width: '28px',
                        height: '28px',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 28 28' stroke-width='1' stroke='%23a3a3a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M7 7l14 14M21 7l-14 14' /%3E%3C/svg%3E")`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        transition: 'background-image 0.2s'
                      },
                      ':hover::after': {
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 28 28' stroke-width='1' stroke='%23db0000'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M7 7l14 14M21 7l-14 14' /%3E%3C/svg%3E")`
                      }
                    }),
                    dropdownIndicator: (base) => ({
                      ...base,
                      color: 'var(--color-gray-400)',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      ':hover': {
                        color: 'var(--lighter-black)'
                      },
                      '& svg': {
                        display: 'none'
                      },
                      '&::after': {
                        content: '""',
                        display: 'block',
                        width: '24px',
                        height: '24px',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1' stroke='%23a3a3a3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
                        backgroundSize: 'contain',
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        transition: 'background-image 0.2s'
                      },
                      ':hover::after': {
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1' stroke='%23151515'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`
                      }
                    }),
                  }}
                />
                <div className='mt-2 w-full flex items-center justify-end mb-12'>
                  <button type='button' onClick={handleSelectAllLanguages} className='btn continue-btn'>Select All</button>
                </div>
              </div>
            </details>
            <hr className='assets-divider' />
            {overviewData.length > 0 && (
              <details open>
                <summary className='text-[16px] text-left font-bold cursor-pointer'>
                  <div style={{ marginLeft: '12px', display: 'inline' }}>Overview</div>
                </summary>
                <div
                  style={{
                    background: 'none',
                    color: 'var(--lighter-black)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-gray-300)',
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: 500,
                    margin: '18px 24px',
                    width: 'calc(100% - 24px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    lineHeight: 1.7
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ minWidth: '243.5px', textAlign: 'left' }}>Total assets</span>
                    <strong style={{ color: 'var(--purple)' }}>{filteredAssets?.length ?? 0}</strong>
                  </div>
                  <hr className='assets-divider' />
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ minWidth: '225px', textAlign: 'left' }}>
                      Described in all selected languages
                      <span className='tooltip-icon-small' title="This tells you how many assets have a description in all languages selected in the 'Languages' section above. For example, if you have English and Spanish selected, the following value will tell you how many assets have a description in both English and Spanish.">ⓘ</span>
                      </span>
                    <strong style={{ color: 'var(--purple)' }}>{overviewData[0]?.fullyDescribed ?? 0}</strong>
                  </div>
                </div>
                <table
                  className='table-modern mb-6 mt-4'
                  style={{ maxWidth: '100%', width: 'calc(100% - 24px)', margin: '24px' }}
                >
                  <thead>
                    <tr>
                      <th>Language</th>
                      <th>Percentage with Description</th>
                      <th>Number with Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewData.map(lang => (
                      <tr key={lang.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {lang.name}
                            {lang.isDefault && (
                              <span
                                style={{
                                  backgroundColor: 'var(--lighter-purple)',
                                  color: 'var(--purple)',
                                  borderRadius: '9999px',
                                  padding: '2px 8px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                Default
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{lang.percent}%</td>
                        <td>
                          {lang.withDescription}
                          <span className="overview-total-fraction"> / {filteredAssets?.length ?? 0}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className='w-full flex justify-end mb-12'>
                  <button
                    className='btn continue-btn'
                    onClick={handleExportOverview}
                    disabled={isExportOverviewLoading}
                  >
                    <span id='loading-export-overview' className={isExportOverviewLoading ? 'loading-span' : 'hidden'}></span>
                    Export Overview
                  </button>
            </div>
              </details>
            )}
            <hr className='assets-divider' />
            {/* Main Asset Table Section */}
            <details open>
              <summary id='assets-summary' className='text-[16px] text-left font-bold cursor-pointer'>
                <div style={{ marginLeft: '12px', display: 'inline' }}>Assets</div>
              </summary>
              {/* Search input and filter controls moved here, above the main asset table */}
              <div className='mb-6 mt-4' style={{ marginLeft: '24px' }}>
                <div className='mb-4'>
                  <div className='search-input-wrapper' style={{ position: 'relative', width: '100%' }}>
                    <input
                      type='text'
                      placeholder='Search assets by title or description...'
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className='search-input'
                      style={{ width: '100%', height: '29px', padding: '3px 6px' }}
                    />
                    {searchQuery && (
                      <button
                        id='clear-search-btn'
                        type='button'
                        onClick={() => setSearchQuery('')}
                        title='Clear search'
                        aria-label='Clear search'
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: 0,
                          bottom: 0,
                          margin: 'auto 0',
                          height: '29px', // 21px height + 3px top + 3px bottom padding
                          width: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-gray-400)',
                          fontSize: 20,
                          cursor: 'pointer',
                          lineHeight: 1,
                          padding: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-gray-400)')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-7">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className='flex items-center justify-start'>
                  <label className='flex items-center'>
                    <input
                      type='checkbox'
                      checked={showOnlyMissing}
                      onChange={handleShowOnlyMissing}
                    />
                    <span className='show-only-checkbox-label ml-2'>Show only assets missing descriptions in selected languages</span>
                  </label>
                </div>
              </div>
              {/* Table container with navigation buttons */}
              <div
                id='table-container'
                className={`table-container mb-6 ${paginatedAssets.length < pageSize ? 'has-few-results' : ''}`}
                ref={tableContainerRef}
                style={{
                  width: 'calc(100% - 24px)',
                  marginLeft: '24px',
                  minHeight: debouncedQuery ? initialTableHeight || undefined : undefined,
                  position: 'relative'
                }}
              >
                <table className='table-modern' style={{ minWidth: '1200px' }}>
        <colgroup>
          <col id='asset-visual' style={{ width: 64 }} />
          <col id='title' style={{ width: 200 }} />
                    {languages?.filter(lang => selectedLanguages.includes(lang.id)).map(lang => (
                      <col key={lang.id} id={lang.codename}></col>
                    ))}
        </colgroup>
        <thead>
          <tr>
            <th className='sticky-col first-col title-header'></th>
            <th className='sticky-col second-col title-header'>Title</th>
            {languages?.filter(lang => selectedLanguages.includes(lang.id)).map(lang => (
              <th key={lang.id} className='lang-header'>
                {lang.name}
                {lang.isDefault && (
                  <div style={{
                    backgroundColor: 'var(--lighter-purple)',
                    color: 'var(--purple)',
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'inline-block',
                    marginLeft: '8px'
                  }}>
                    Default
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
                    {paginatedAssets.length > 0 ?
                      paginatedAssets.map((asset) => (
                        <tr key={asset.id}>
                          <td className='sticky-col first-col'>
                            <div style={{ position: 'relative', width: 64, height: 64, display: 'inline-block' }}>
                              {isImageAsset(asset)
                                ? ((asset.size < 50000000 &&
                                    ((asset.imageWidth ?? 0) <= 12000 && (asset.imageHeight ?? 0) <= 12000))
                                  ? (
                                    <a href={asset.url} target='_blank' rel='noopener noreferrer' title='View full size'>
                                      <img
                                        src={`${asset.url}?w=128&h=128`}
                                        alt={asset.title || asset.fileName}
                                        className='asset-thumbnail'
                                        loading='lazy'
                                      />
                                    </a>
                                  ) : (
                                    <a href={asset.url} target='_blank' rel='noopener noreferrer' title='View full size'>
                                      <div
                                        className='asset-thumbnail asset-placeholder-thumbnail'
                                        title='No preview available'
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          height: '100%',
                                          width: '100%',
                                          fontWeight: 600,
                                          fontSize: '14px',
                                          color: 'var(--color-gray-500)',
                                          background: 'rgb(248, 248, 248)',
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                          userSelect: 'none',
                                          textAlign: 'center',
                                        }}
                                      >
                                        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--color-gray-400)', textTransform: 'none', marginTop: 2 }}>
                                          No preview available
                                        </span>
                                      </div>
                                    </a>
                                  )
                                )
                                : (
                                  <div
                                    className='asset-thumbnail asset-placeholder-thumbnail'
                                    title={asset.type || 'File'}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '100%',
                                      width: '100%',
                                      fontWeight: 600,
                                      fontSize: '11px',
                                      color: 'var(--color-gray-500)',
                                                                                background: 'rgb(248, 248, 248)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.5px',
                                      userSelect: 'none',
                                      textAlign: 'center',
                                      padding: '0 2px'
                                    }}
                                  >
                                    <span>
                                      {(() => {
                                        if (!asset.type) return 'FILE';

                                        const type = asset.type.toLowerCase();

                                        if (type.includes('pdf')) return 'PDF';
                                        if (type.startsWith('video/')) return 'VIDEO';
                                        if (type.startsWith('audio/')) return 'AUDIO';
                                        if (type.includes('word')) return 'DOC';
                                        if (type.includes('excel')) return 'XLS';
                                        if (type.includes('powerpoint')) return 'PPT';
                                        if (type.includes('zip') || type.includes('compressed') || type.includes('archive')) return 'ARCHIVE';
                                        if (type.includes('text')) return 'TEXT';
                                        if (type.startsWith('model')) return 'MODEL';
                                        if (type.includes('font')) return 'FONT';
                                        
                                        // Handle application types systematically
                                        if (type.startsWith('application/')) {
                                          // Archives and compressed files
                                          if (type.includes('zip') || type.includes('rar') || type.includes('7z') || 
                                              type.includes('gzip') || type.includes('tar') || type.includes('bzip2') ||
                                              type.includes('compressed')) return 'ARCHIVE';
                                          
                                          // Executable and installer files
                                          if (type.includes('executable') || type.includes('x-executable') ||
                                              type.includes('msdownload') || type.includes('msi') ||
                                              type.includes('apple-diskimage') || type.includes('android.package-archive')) return 'EXE';
                                          
                                          // Script and code files
                                          if (type.includes('javascript') || type.includes('ecmascript') ||
                                              type.includes('python') || type.includes('php') ||
                                              type.includes('ruby') || type.includes('shellscript')) return 'SCRIPT';
                                          
                                          // Browser plugins and extensions
                                          if (type.includes('shockwave-flash') || type.includes('java-applet') ||
                                              type.includes('browser-extension')) return 'PLUGIN';
                                          
                                          // Structured data files
                                          if (type.includes('json') || type.includes('xml') || type.includes('yaml') ||
                                              type.includes('csv') || type.includes('sql') || type.includes('geo+json')) return 'DATA';
                                          
                                          // Generic binary files
                                          if (type.includes('octet-stream') || type.includes('binary') || type.includes('unknown')) return 'BINARY';
                                          
                                          // Default: treat as document (covers Office files, PDFs, RTF, etc.)
                                          return 'DOCUMENT';
                                        }
                                        
                                        return 'FILE';
                                      })()}
                                    </span>
                                    <span style={{
                                      fontWeight: 400,
                                      fontSize: '10px',
                                      color: 'var(--color-gray-400)',
                                      textTransform: 'none',
                                      lineHeight: 1.2
                                    }}>
                                      No preview
                                    </span>
                                  </div>
                                )}
                              <a
                                href={`https://app.kontent.ai/${environmentId}/content-inventory/assets/asset/${asset.id}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='asset-edit-link'
                                title='Edit asset in Kontent.ai'
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" className="size-7">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                              </a>
                            </div>
                          </td>
                          <td className='sticky-col second-col'>
                            {asset.title && asset.title.trim() !== '' ? asset.title : asset.fileName}
                          </td>
                          {languages?.filter(lang => selectedLanguages.includes(lang.id)).map(lang => {
                            const desc = asset.descriptions.find((d: any) => d.language.id === lang.id);
                            return (
                              <td key={lang.id} className={desc && desc.description ? 'cell bg-green-100' : 'cell bg-red-100'}>
                                {desc && desc.description ? desc.description : 'None'}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                      : (
                        <tr>
                          <td colSpan={2 + (languages?.filter(lang => selectedLanguages.includes(lang.id)).length || 0)} style={{ textAlign: 'left', padding: '2.5rem 24px', color: 'var(--color-gray-500)', fontSize: 16 }}>
                            No assets found matching your search.
                          </td>
                        </tr>
                      )
                    }
                  </tbody>
                </table>
                

              </div>
              

              

              
              <div className='mt-4 mb-12 pagination-row'>
                <div className='pagination-center'>
                  {computedPageCount > 1 && (
                    <>
                      {/* Previous button */}
                      <button
                        className='page-btn'
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        style={{ marginRight: 4 }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 mb-0.5 inline size-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                        Previous
                      </button>
                      {/* Page numbers with ellipsis */}
                      {(() => {
                        const pages = [];
                        const total = computedPageCount;
                        const curr = currentPage;
                        // Always show first and last
                        // Show 2 before and after current
                        // Use ellipsis where needed
                        const pageWindow = 2;
                        let left = Math.max(2, curr - pageWindow);
                        let right = Math.min(total - 1, curr + pageWindow);
                        if (curr - 1 <= pageWindow) {
                          right = Math.min(total - 1, right + (pageWindow - (curr - 2)));
                        }
                        if (total - curr <= pageWindow) {
                          left = Math.max(2, left - (pageWindow - (total - curr - 1)));
                        }
                        // First page
                        pages.push(
                          <button
                            key={1}
                            className={`page-btn${curr === 1 ? ' page-btn-active' : ''}`}
                            onClick={() => setCurrentPage(1)}
                            style={{ margin: 0 }}
                            disabled={curr === 1}
                          >
                            1
                          </button>
                        );
                        // Ellipsis after first page
                        if (left > 2) {
                          pages.push(<span key='start-ellipsis' style={{ padding: '0 8px' }}>…</span>);
                        }
                        // Page window
                        for (let i = left; i <= right; i++) {
                          pages.push(
                            <button
                              key={i}
                              className={`page-btn${curr === i ? ' page-btn-active' : ''}`}
                              onClick={() => setCurrentPage(i)}
                              style={{ margin: 0 }}
                              disabled={curr === i}
                            >
                              {i}
                            </button>
                          );
                        }
                        // Ellipsis before last page
                        if (right < total - 1) {
                          pages.push(<span key='end-ellipsis' style={{ padding: '0 8px' }}>…</span>);
                        }
                        // Last page
                        if (total > 1) {
                          pages.push(
                            <button
                              key={total}
                              className={`page-btn${curr === total ? ' page-btn-active' : ''}`}
                              onClick={() => setCurrentPage(total)}
                              style={{ margin: 0 }}
                              disabled={curr === total}
                            >
                              {total}
                            </button>
                          );
                        }
                        return pages;
                      })()}
                      {/* Next button */}
                      <button
                        className='page-btn'
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === computedPageCount}
                        style={{ marginLeft: 4 }}
                      >
                        Next
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="ml-2 mb-0.5 inline size-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
                <button
                  className='btn continue-btn'
                  onClick={handleExportAssets}
                  disabled={isExportAssetsLoading}
                >
                  <span id='loading-export-assets' className={isExportAssetsLoading ? 'loading-span' : 'hidden'}></span>
                  Export Assets
                </button>
              </div>
            </details>
            <hr className='assets-divider' />
            <div className='w-full flex justify-start mt-12 mb-12'>
              <button id='back-btn' type='button' className='btn back-btn' onClick={() => handleBackBtn()}>
                Change settings
              </button>
            </div>
          </>
        )}
    </div>
    </>
  )
}

export default App