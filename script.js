document.addEventListener('DOMContentLoaded', () => {
    // --- Configuração Supabase ---
    const SUPABASE_URL = 'https://oabaoyvzlmbhutuzddrn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmFveXZ6bG1iaHV0dXpkZHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNDYyMzksImV4cCI6MjA1ODgyMjIzOX0.8u_EZbFaZUqEtFR4VkJnkMmZbhMbo6muZzKB9JkVknA';
    //const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hYmFveXZ6bG1iaHV0dXpkZHJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzI0NjIzOSwiZXhwIjoyMDU4ODIyMjM5fQ.kGGhb3ka2DFjkcOtlcnaTeBeKs7Pvb0HuYySuDQkdQU'; // No longer needed
    
    // Create client with anon key for all operations
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Create a separate client with service role key for operations that need elevated privileges
    // const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY); // Removed

    // Global calculator object to expose functions
    window.calculatorApp = {
        loadRecord: null,
        clearForm: null,
        fetchAllCalculations: null,
        updateCalculations: null
    };

    // Initialize auth state
    const initializeAuth = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Auth initialization error:', error);
                return;
            }
            if (!session) {
                console.log('No active session');
                return;
            }
            console.log('Session initialized:', session.user.email);
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    };

    // Call initializeAuth when the page loads
    initializeAuth();

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
    });

    // --- Elementos DOM ---
    const sidebarLinks = document.querySelectorAll('.sidebar a');
    const dataSections = document.querySelectorAll('.data-section');
    const loadingIndicator = document.getElementById('loading-indicator');
    const materialFilters = document.querySelectorAll('.material-filter');
    // Add references for the new search elements
    // const materiaisImpressaoSearchInput = document.getElementById('materiais_impressao-search-input');
    // const materiaisImpressaoSearchButton = document.getElementById('materiais_impressao-search-button');
    // ADD references for tabela_precos search elements
    const tabelaPrecosSearchInput = document.getElementById('tabela_precos-search-input');
    const tabelaPrecosSearchButton = document.getElementById('tabela_precos-search-button');

    // --- Estado ---
    let currentSection = 'materiais_impressao'; // Seção inicial
    let chartInstances = {}; // Armazena instâncias de gráficos para destruição
    let tableDataCache = {}; // Cache para dados das tabelas
    let tableFilteredData = {}; // Cache para dados filtrados
    let sortState = {}; // Armazena estado de ordenação por tabela { tableName: { column: 'col_name', direction: 'asc' | 'desc' } }
    let filterState = {}; // Armazena estado de filtro por tabela { tableName: { material: 'value' } }
    let allCalculations = [];
    // Add state for search term
    let searchState = {}; // Armazena estado de busca por tabela { tableName: { term: 'value' } }

    // --- Constantes e Configurações ---
    const ACCENT_COLOR = '#FF7F00';
    const ACCENT_GLOW = 'rgba(255, 127, 0, 0.5)';
    const POSITIVE_COLOR = '#4CAF50';
    const NEGATIVE_COLOR = '#F44336';
    const TEXT_SECONDARY_COLOR = '#a0a0a0';
    const GRID_COLOR = 'rgba(255, 255, 255, 0.1)';

    const TABLE_CONFIG = {
        materiais_impressao: {
            columns: [
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'caracteristica', label: 'Característica' },
                { key: 'cor', label: 'Cor' },
                { key: 'quantidade_2023', label: 'Qtd 2023', type: 'number', align: 'right' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                { key: 'percentual_variacao_quantidade', label: 'Var Qtd %', type: 'percentage', align: 'right' },
                { key: 'valor_2023', label: 'Valor 2023', type: 'currency', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'percentual_variacao_valor', label: 'Var Valor %', type: 'percentage', align: 'right' },
                { key: 'media_m2_2023', label: 'Média m² 2023', type: 'currency', align: 'right' },
                { key: 'media_m2_2024', label: 'Média m² 2024', type: 'currency', align: 'right' },
                { key: 'percentual_variacao_media_m2', label: 'Var Média %', type: 'percentage', align: 'right' },
            ],
            charts: ['volume', 'valor']
        },
        cola: {
            columns: [
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'quantidade_2023', label: 'Qtd 2023', type: 'number', align: 'right' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                // Excluindo percentuais conforme solicitado
                { key: 'valor_2023', label: 'Valor 2023', type: 'currency', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
            ],
             charts: ['volume', 'valor']
        },
        embalamento: {
            columns: [
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'caracteristica', label: 'Característica' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'media_vl_unit_2024', label: 'Média Unit 2024', type: 'currency', align: 'right' },
            ],
            charts: ['2024']
        },
        fitas_adesivas: {
            columns: [
                 { key: 'tipo', label: 'Tipo' },
                 { key: 'material', label: 'Material' },
                 { key: 'caracteristica', label: 'Característica' },
                 { key: 'cor', label: 'Cor' },
                 { key: 'quantidade_2023', label: 'Qtd 2023', type: 'number', align: 'right' },
                 { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                 { key: 'percentual_variacao_quantidade', label: 'Var Qtd %', type: 'percentage', align: 'right' },
                 { key: 'valor_2023', label: 'Valor 2023', type: 'currency', align: 'right' },
                 { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                 { key: 'percentual_variacao_valor', label: 'Var Valor %', type: 'percentage', align: 'right' },
                 { key: 'media_ml_2023', label: 'Média ml 2023', type: 'currency', align: 'right' },
                 { key: 'media_ml_2024', label: 'Média ml 2024', type: 'currency', align: 'right' },
                 { key: 'percentual_variacao_media_ml', label: 'Var Média %', type: 'percentage', align: 'right' },
            ],
             charts: ['volume', 'valor']
        },
        outros: {
             columns: [
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'caracteristica', label: 'Característica' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'media_vl_unit_2024', label: 'Média Unit 2024', type: 'currency', align: 'right' },
             ],
             charts: ['2024']
        },
        tabela_precos: {
            columns: [
                { key: 'calculation_id', label: 'ID', type: 'number' },
                // Combined material description
                { 
                    key: 'material_descricao',
                    label: 'Materiais',
                    render: (row) => {
                        let desc = [];
                        if (row.material1_material) desc.push(`${row.material1_material} (${row.material1_caracteristica || ''}, ${row.material1_cor || ''})`);
                        if (row.material2_material) desc.push(`${row.material2_material} (${row.material2_caracteristica || ''}, ${row.material2_cor || ''})`);
                        if (row.material3_material) desc.push(`${row.material3_material} (${row.material3_caracteristica || ''}, ${row.material3_cor || ''})`);
                        return desc.join(' + ');
                    }
                },
                { key: 'margem_percentual', label: 'Margem %', type: 'percentage', align: 'right' },
                { key: 'preco_atual', label: 'Preço Atual', type: 'currency', align: 'right' },
                { key: 'preco_final', label: 'Preço Final (Calculado)', type: 'currency', align: 'right' },
                // Add actions column
                { 
                    key: 'actions', 
                    label: 'Ações', 
                    align: 'center', 
                    sortable: false, // Actions column is not sortable
                    render: (row) => {
                        return `
                            <button class="action-button edit-button" data-id="${row.calculation_id}" title="Editar Cálculo">
                                <i data-feather="edit"></i>
                            </button>
                            <button class="action-button delete-button" data-id="${row.calculation_id}" title="Eliminar Cálculo">
                                <i data-feather="trash-2"></i>
                            </button>
                        `;
                    }
                }
            ],
            charts: [] 
        }
    };

    // --- Funções Auxiliares ---
    const showLoading = () => loadingIndicator.style.display = 'block';
    const hideLoading = () => loadingIndicator.style.display = 'none';

    const formatValue = (value, type) => {
        if (value === null || value === undefined) return '-';
        switch (type) {
            case 'currency':
                return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' }); // Ajuste a moeda se necessário
            case 'number':
                return parseInt(value).toLocaleString('pt-BR');
            case 'percentage':
                const numValue = parseFloat(value);
                if (isNaN(numValue)) return '-'; // Handle NaN
                const className = numValue > 0 ? 'positive-change' : (numValue < 0 ? 'negative-change' : '');
                return `<span class="percentage-change ${className}">${numValue.toFixed(2)}%</span>`;
            case 'datetime': // Add datetime formatting
                try {
                    return new Date(value).toLocaleString('pt-BR');
                } catch (e) {
                    return '-';
                }
            default:
                return value;
        }
    };

    const destroyChart = (chartId) => {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    };

    const getChartBaseOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: TEXT_SECONDARY_COLOR,
                    font: { family: "'Poppins', sans-serif" }
                }
            },
            title: {
                display: true,
                text: title,
                color: TEXT_SECONDARY_COLOR, // Cor do título principal do gráfico
                font: { size: 16, family: "'Poppins', sans-serif" }
            },
             tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { family: "'Poppins', sans-serif" },
                bodyFont: { family: "'Poppins', sans-serif" },
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            // Detectar se é valor monetário ou quantidade para formatar tooltip
                            const isCurrency = context.dataset.label?.toLowerCase().includes('valor');
                            if (isCurrency) {
                                label += parseFloat(context.parsed.y).toLocaleString('pt-BR', { style: 'currency', currency: 'EUR' });
                            } else {
                                 label += parseInt(context.parsed.y).toLocaleString('pt-BR');
                            }
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: TEXT_SECONDARY_COLOR, font: { family: "'Poppins', sans-serif" } },
                grid: { color: GRID_COLOR }
            },
            y: {
                ticks: { color: TEXT_SECONDARY_COLOR, font: { family: "'Poppins', sans-serif" } },
                grid: { color: GRID_COLOR },
                beginAtZero: true
            }
        },
        animation: {
            duration: 1000, // Duração da animação em ms
            easing: 'easeInOutQuart' // Tipo de animação
        }
    });

    // --- Funções de Filtro ---
    const setupFilters = (tableName, data) => {
        if (!data || data.length === 0) return;
        
        const filterSelect = document.getElementById(`${tableName}-filter`);
        if (!filterSelect) return;
        
        // Clear existing options except the "All" option
        while (filterSelect.options.length > 1) {
            filterSelect.remove(1);
        }
        
        // Get unique material values for filter
        const uniqueMaterials = [...new Set(data.map(item => item.material))].sort();
        
        // Add options to the select
        uniqueMaterials.forEach(material => {
            if (material) { // Only add non-null/non-empty values
                const option = document.createElement('option');
                option.value = material;
                option.textContent = material;
                filterSelect.appendChild(option);
            }
        });
        
        // Set event listener for filter change
        filterSelect.addEventListener('change', () => {
            applyFilter(tableName, filterSelect.value);
        });
        
        // Apply any existing filter
        if (filterState[tableName] && filterState[tableName].material) {
            filterSelect.value = filterState[tableName].material;
        }
    };
    
    const applyFilter = (tableName, materialValue) => {
        // Store the filter state
        filterState[tableName] = { material: materialValue };
        
        // Get the data
        const data = tableDataCache[tableName];
        if (!data) return;
        
        // Apply filter if not "all"
        if (materialValue && materialValue !== 'all') {
            tableFilteredData[tableName] = data.filter(item => item.material === materialValue);
        } else {
            tableFilteredData[tableName] = [...data]; // Use all data
        }
        
        // Apply any existing sort
        if (sortState[tableName]) {
            const { column, direction } = sortState[tableName];
            sortData(tableName, tableFilteredData[tableName], column, direction);
        }
        
        // Render table and charts with filtered data
        renderTable(tableName, tableFilteredData[tableName]);
        renderCharts(tableName, tableFilteredData[tableName]);
    };
    
    const sortData = (tableName, data, columnKey, direction) => {
        if (!data) return;
        
        const columnConfig = TABLE_CONFIG[tableName].columns.find(c => c.key === columnKey);
        const sortType = columnConfig?.type || 'string';
        
        data.sort((a, b) => {
            let valA = a[columnKey];
            let valB = b[columnKey];
            
            // Handle null or undefined values
            if (valA == null) valA = sortType === 'number' || sortType === 'currency' || sortType === 'percentage' ? (direction === 'asc' ? Infinity : -Infinity) : '';
            if (valB == null) valB = sortType === 'number' || sortType === 'currency' || sortType === 'percentage' ? (direction === 'asc' ? Infinity : -Infinity) : '';
            
            if (sortType === 'number' || sortType === 'currency' || sortType === 'percentage') {
                valA = parseFloat(valA) || 0; // Attempt to convert, default to 0 if NaN
                valB = parseFloat(valB) || 0;
                return direction === 'asc' ? valA - valB : valB - valA;
            } else {
                // String comparison (case-insensitive)
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            }
        });
    };

    // --- Funções Principais ---

    const fetchData = async (tableName) => {
        console.log(`[fetchData] Called for section: ${tableName}`); // Log entry
        // Special handling for calculator - no initial fetch needed
        if (tableName === 'calculadora') {
            console.log(`[fetchData] Calculator section, skipping fetch.`);
            return null; // Indicate no data fetched
        }

        // Determine the actual database table to query
        const dbTableName = (tableName === 'tabela_precos') ? 'calculadora_materiais' : tableName;
        console.log(`[fetchData] Determined DB table: ${dbTableName}`); // Log db table name
        
        // Check cache first using the original section name (tableName)
        // Let's temporarily disable cache for debugging tabela_precos
        // if (tableDataCache[tableName]) {
        //     console.log(`[fetchData] Using cached data for ${tableName}`);
        //     return tableDataCache[tableName];
        // }

        console.log(`[fetchData] Fetching data for ${tableName} from DB table ${dbTableName}...`);
        showLoading();
        try {
            let query = supabase.from(dbTableName).select('*'); // Use dbTableName here

            // Add specific ordering if needed, e.g., for tabela_precos (which queries calculadora_materiais)
            if (tableName === 'tabela_precos') { 
                console.log(`[fetchData] Applying ordering for ${tableName}`);
                query = query.order('created_at', { ascending: false });
            }

            console.log(`[fetchData] Executing query...`);
            const { data, error, status } = await query;
            console.log(`[fetchData] Query completed. Status: ${status}`); // Log status

            if (error) {
                console.error(`[fetchData] Error fetching ${tableName} (from ${dbTableName}):`, error); // Log error
                alert(`Erro ao buscar dados para ${tableName}: ${error.message}`);
                hideLoading();
                return null;
            }
            
            if (!data) {
                 console.warn(`[fetchData] Query successful but no data received for ${tableName}.`); // Log no data
            } else {
                 console.log(`[fetchData] Data received for ${tableName}:`, data); // Log received data
            }

            tableDataCache[tableName] = data; // Store in cache using the section name
            // setupFilters(tableName, data); // Filters likely not needed for tabela_precos
            hideLoading();
            return data;
        } catch (error) {
            console.error(`[fetchData] Exception fetching ${tableName} (from ${dbTableName}):`, error); // Log exception
            alert(`Erro inesperado ao buscar dados para ${tableName}.`);
            hideLoading();
            return null;
        }
    };

    const renderTable = (tableName, data) => {
        const table = document.getElementById(`${tableName}-table`);
        const tableBody = table.querySelector('tbody');
        const tableHead = table.querySelector('thead');
        const config = TABLE_CONFIG[tableName];

        if (!tableBody || !tableHead || !config) {
            console.error(`Table or config not found for ${tableName}`);
            return;
        }

        // Clear previous content
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            // Update colspan calculation to include the new actions column if it exists
            const colspan = config.columns.length; 
            tableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;">Sem dados para mostrar.</td></tr>`;
            return;
        }

        // Generate Header
        const headerRow = document.createElement('tr');
        config.columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.label;
            if (col.align) {
                th.style.textAlign = col.align;
            }
            
            // Only add sorting functionality if the column is sortable
            if (col.sortable !== false) { 
                th.dataset.column = col.key;
                const sortIndicator = document.createElement('span');
                sortIndicator.className = 'sort-indicator';
                th.appendChild(sortIndicator);
                th.addEventListener('click', () => handleSort(tableName, col.key));
                th.style.cursor = 'pointer'; // Indicate sortable
            } else {
                 th.style.cursor = 'default'; // Indicate non-sortable
            }
            headerRow.appendChild(th);
        });
        tableHead.appendChild(headerRow);
        updateSortIndicators(tableName); // Initial indicator update

        // Generate Rows
        data.forEach(row => {
            const tr = document.createElement('tr');
            config.columns.forEach(col => {
                const td = document.createElement('td');
                let cellValue;
                
                // Use custom render function if provided
                if (col.render && typeof col.render === 'function') {
                    cellValue = col.render(row);
                    td.innerHTML = cellValue; // Render function provides HTML
                } else {
                    cellValue = row[col.key];
                    td.innerHTML = formatValue(cellValue, col.type); // Format standard values
                }
                
                if (col.align) {
                    td.style.textAlign = col.align;
                }
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
        
        // Re-initialize Feather Icons for the newly added buttons
        feather.replace(); 

        // Add event listener for action buttons (using delegation)
        tableBody.removeEventListener('click', handleTableActions); // Remove previous listener if any
        tableBody.addEventListener('click', handleTableActions); 
    };

     const handleSort = (tableName, columnKey) => {
        const currentSort = sortState[tableName] || {};
        let direction = 'asc';

        if (currentSort.column === columnKey && currentSort.direction === 'asc') {
            direction = 'desc';
        }

        sortState[tableName] = { column: columnKey, direction };

        // Sort the filtered data
        const data = tableFilteredData[tableName] || tableDataCache[tableName];
        if (!data) return;

        sortData(tableName, data, columnKey, direction);
        renderTable(tableName, data); // Re-render table with sorted data
        updateSortIndicators(tableName); // Update visual indicators
    };

    const updateSortIndicators = (tableName) => {
        const table = document.getElementById(`${tableName}-table`);
        if (!table) return;
        const headers = table.querySelectorAll('thead th');
        const currentSort = sortState[tableName];

        headers.forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;

            if (currentSort && th.dataset.column === currentSort.column) {
                indicator.textContent = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
                th.classList.add('sorted'); // Optional: Add class for styling sorted header
            } else {
                indicator.textContent = ''; // Clear indicator
                 th.classList.remove('sorted');
            }
        });
    };


    const renderCharts = (tableName, data) => {
        const config = TABLE_CONFIG[tableName];
        if (!config || !data || data.length === 0) {
             //console.log(`No data or config to render charts for ${tableName}`);
             // Optionally clear previous charts if needed
             config.charts.forEach(chartType => {
                 const chartId = `${tableName}-chart-${chartType}`;
                 destroyChart(chartId);
             });
             return;
        }

        // Create more descriptive labels that include both material and caracteristica
        const labels = data.map(item => {
            const material = item.material || '';
            const caracteristica = item.caracteristica || '';
            return material + (caracteristica ? ` - ${caracteristica}` : '');
        });

        // Destroy previous charts for this section
         config.charts.forEach(chartType => {
            const chartId = `${tableName}-chart-${chartType}`;
            destroyChart(chartId);
         });


        // --- Specific Chart Logic ---
        if (config.charts.includes('volume')) {
            const chartId = `${tableName}-chart-volume`;
            const ctx = document.getElementById(chartId)?.getContext('2d');
            if (!ctx) { console.error(`Canvas not found for ${chartId}`); return; }

            chartInstances[chartId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Quantidade 2023',
                            data: data.map(item => item.quantidade_2023),
                            backgroundColor: 'rgba(255, 255, 255, 0.2)', // Lighter bar for past data
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1
                        },
                        {
                            label: 'Quantidade 2024',
                            data: data.map(item => item.quantidade_2024),
                            backgroundColor: ACCENT_GLOW, // Neon orange for current data
                            borderColor: ACCENT_COLOR,
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    ...getChartBaseOptions('Volume (Quantidade) 2023 vs 2024'),
                    scales: {
                        x: {
                            ticks: { 
                                color: TEXT_SECONDARY_COLOR, 
                                font: { family: "'Poppins', sans-serif" },
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: { color: GRID_COLOR }
                        },
                        y: {
                            ticks: { color: TEXT_SECONDARY_COLOR, font: { family: "'Poppins', sans-serif" } },
                            grid: { color: GRID_COLOR },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

         if (config.charts.includes('valor')) {
            const chartId = `${tableName}-chart-valor`;
            const ctx = document.getElementById(chartId)?.getContext('2d');
             if (!ctx) { console.error(`Canvas not found for ${chartId}`); return; }

             chartInstances[chartId] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Valor 2023 (€)',
                            data: data.map(item => item.valor_2023),
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                            borderWidth: 1
                        },
                        {
                            label: 'Valor 2024 (€)',
                            data: data.map(item => item.valor_2024),
                            backgroundColor: ACCENT_GLOW,
                            borderColor: ACCENT_COLOR,
                            borderWidth: 1
                        }
                    ]
                },
                 options: {
                    ...getChartBaseOptions('Valor (€) 2023 vs 2024'),
                     scales: { // Specific scale config for currency
                        x: {
                            ticks: { 
                                color: TEXT_SECONDARY_COLOR, 
                                font: { family: "'Poppins', sans-serif" },
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: { color: GRID_COLOR }
                        },
                        y: {
                            ticks: {
                                color: TEXT_SECONDARY_COLOR,
                                font: { family: "'Poppins', sans-serif" },
                                // Format Y-axis ticks as currency
                                callback: function(value, index, values) {
                                    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                                }
                             },
                            grid: { color: GRID_COLOR },
                            beginAtZero: true
                        }
                    }
                 }
            });
        }

         if (config.charts.includes('2024')) { // For embalamento and outros
             const chartId = `${tableName}-chart-2024`;
             const ctx = document.getElementById(chartId)?.getContext('2d');
             if (!ctx) { console.error(`Canvas not found for ${chartId}`); return; }

             // Determine which average value column to use
             const avgValueKey = tableName === 'embalamento' ? 'media_vl_unit_2024' : 'media_vl_unit_2024'; // Assume 'outros' also has 'media_vl_unit_2024'

             chartInstances[chartId] = new Chart(ctx, {
                type: 'bar', // Could also use 'line' or combine types if needed
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Quantidade 2024',
                            data: data.map(item => item.quantidade_2024),
                            backgroundColor: ACCENT_GLOW,
                            borderColor: ACCENT_COLOR,
                            borderWidth: 1,
                            yAxisID: 'yQuant', // Assign to quantity axis
                            order: 2 // Render behind value bars if needed
                        },
                        {
                            label: 'Valor 2024 (€)',
                            data: data.map(item => item.valor_2024),
                             backgroundColor: 'rgba(255, 255, 255, 0.3)',
                             borderColor: 'rgba(255, 255, 255, 0.6)',
                            borderWidth: 1,
                            yAxisID: 'yValor', // Assign to value axis
                            order: 1
                        },
                        {
                            label: 'Média Unitária 2024 (€)',
                            data: data.map(item => item[avgValueKey]), // Use dynamic key
                            type: 'line', // Show average as a line
                            borderColor: POSITIVE_COLOR, // Use a different color like green
                            backgroundColor: POSITIVE_COLOR,
                            tension: 0.3,
                            yAxisID: 'yValor', // Can share the value axis or have its own
                            order: 0 // Draw line on top
                        }
                    ]
                },
                 options: {
                    ...getChartBaseOptions('Dados 2024'),
                    scales: {
                        x: {
                            ticks: { 
                                color: TEXT_SECONDARY_COLOR, 
                                font: { family: "'Poppins', sans-serif" },
                                autoSkip: false,
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: { color: GRID_COLOR }
                        },
                        // Define two Y axes
                        yQuant: { // Axis for Quantity
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            title: { display: true, text: 'Quantidade', color: ACCENT_COLOR },
                            ticks: { color: ACCENT_COLOR, font: { family: "'Poppins', sans-serif" }},
                            grid: { drawOnChartArea: false } // Optional: only show grid for one axis
                        },
                        yValor: { // Axis for Value and Average Value
                             type: 'linear',
                             position: 'right',
                             beginAtZero: true,
                             title: { display: true, text: 'Valor / Média (€)', color: TEXT_SECONDARY_COLOR },
                             ticks: {
                                color: TEXT_SECONDARY_COLOR,
                                font: { family: "'Poppins', sans-serif" },
                                callback: function(value) {
                                     return value.toLocaleString('pt-BR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                                }
                             },
                            grid: { color: GRID_COLOR }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const index = context[0].dataIndex;
                                    const material = data[index].material;
                                    const caracteristica = data[index].caracteristica || '';
                                    return `${material}${caracteristica ? ' - ' + caracteristica : ''}`;
                                },
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        // Detect if it's currency value or quantity to format tooltip
                                        const isCurrency = context.dataset.label?.toLowerCase().includes('valor') || 
                                                           context.dataset.label?.toLowerCase().includes('média');
                                        if (isCurrency) {
                                            label += parseFloat(context.parsed.y).toLocaleString('pt-BR', 
                                                { style: 'currency', currency: 'EUR' });
                                        } else {
                                            label += parseInt(context.parsed.y).toLocaleString('pt-BR');
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            });
        }
         //console.log(`Charts rendered for ${tableName}`);
    };

    // --- Funções Específicas da Calculadora ---
    const initializeCalculator = () => {
        console.log('[Calculator] Initializing...');
        const sectionElement = document.getElementById('calculadora-section');
        if (sectionElement.classList.contains('calculator-initialized')) {
            console.log('[Calculator] Already initialized.');
            return;
        }

        // --- Cache calculator elements ---
        const prevButton = document.getElementById('prev-record');
        const nextButton = document.getElementById('next-record');
        const recordIndicator = document.getElementById('record-indicator');
        const clearMaterialButtons = document.querySelectorAll('#calculadora-section .clear-button[data-material-num]');
        const clearMachineButton = document.getElementById('clear-machine');
        const searchInput = document.getElementById('search-calc-id');
        const searchButton = document.getElementById('search-button');
        const saveButton = document.getElementById('save-calculation');
        const notesTextarea = document.querySelector('#calculadora-section textarea[name="notes"]');
        const materialSelectors = {
            1: { tipo: document.getElementById('material1-tipo'), material: document.getElementById('material1-material'), caracteristica: document.getElementById('material1-caracteristica'), cor: document.getElementById('material1-cor'), price: document.getElementById('material1-price') },
            2: { tipo: document.getElementById('material2-tipo'), material: document.getElementById('material2-material'), caracteristica: document.getElementById('material2-caracteristica'), cor: document.getElementById('material2-cor'), price: document.getElementById('material2-price') },
            3: { tipo: document.getElementById('material3-tipo'), material: document.getElementById('material3-material'), caracteristica: document.getElementById('material3-caracteristica'), cor: document.getElementById('material3-cor'), price: document.getElementById('material3-price') }
        };
        const machineSelect = document.getElementById('machine-select');
        const machinePrice = document.getElementById('machine-price');
        const marginInput = document.getElementById('margin-input');
        const currentPriceInput = document.getElementById('current-price-input');
        const totalMaterialsCostEl = document.getElementById('total-materials-cost');
        const totalMachineCostEl = document.getElementById('total-machine-cost');
        const totalNetCostEl = document.getElementById('total-net-cost');
        const finalPriceEl = document.getElementById('final-price');
        const priceDifferenceEl = document.getElementById('price-difference');

        // --- Calculator state ---
        let calculatorState = { materials: { 1: {}, 2: {}, 3: {} }, machine: {}, area: 1, margin: 0, currentPrice: 0, notes: '' };
        const resetCalculatorState = () => {
             calculatorState = {
                materials: {
                    1: { tipo: '', material: '', caracteristica: '', cor: '', price: 0, id: null },
                    2: { tipo: '', material: '', caracteristica: '', cor: '', price: 0, id: null },
                    3: { tipo: '', material: '', caracteristica: '', cor: '', price: 0, id: null }
                },
                machine: { id: null, nome: '', price: 0 },
                area: 1, margin: 0, currentPrice: 0, notes: ''
            };
        }
        resetCalculatorState(); // Initialize state
        
        let currentCalcRecordIndex = -1;

        // --- Calculator helper functions (defined within initializeCalculator scope) ---
        const initializeDropdowns = async () => {
             try {
                console.log('[Calculator] Initializing dropdowns...');
                const { data: materialTypesData, error: materialError } = await supabase.from('materiais_impressao').select('tipo');
                if (materialError) throw materialError;
                const materialTypes = [...new Set(materialTypesData.map(item => item.tipo).filter(tipo => tipo && tipo.trim() !== '' && tipo.toUpperCase() !== 'MAQUINA'))].sort();

                const { data: machinesData, error: machinesError } = await supabase.from('maquinas').select('id, maquina, valor_m2');
                if (machinesError) throw machinesError;

                machineSelect.innerHTML = '<option value="">Selecione a Máquina</option>';
                machinesData.forEach(machine => { const option = document.createElement('option'); option.value = machine.id; option.textContent = machine.maquina; machineSelect.appendChild(option); });

                [1, 2, 3].forEach(num => {
                    const dropdown = materialSelectors[num].tipo;
                    dropdown.innerHTML = '<option value="">Selecione o Tipo</option>';
                    materialTypes.forEach(tipo => { const option = document.createElement('option'); option.value = tipo; option.textContent = tipo; dropdown.appendChild(option); });
                });
                console.log('[Calculator] Dropdowns populated.');
            } catch (error) { console.error('[Calculator] Error initializing dropdowns:', error); alert('Erro ao inicializar opções da calculadora.'); }
        };

        // --- Record Navigation Functions ---
        const updateCalcNavigation = () => {
             if (!recordIndicator || !prevButton || !nextButton) return;
             const totalRecords = allCalculations.length;
             recordIndicator.textContent = totalRecords === 0 ? 'Nenhum cálculo' : (currentCalcRecordIndex === -1 ? `Novo / ${totalRecords}` : `${currentCalcRecordIndex + 1} / ${totalRecords}`);
             prevButton.disabled = currentCalcRecordIndex <= 0;
             nextButton.disabled = currentCalcRecordIndex === -1 ? totalRecords === 0 : currentCalcRecordIndex >= totalRecords - 1;
             searchInput.value = currentCalcRecordIndex >= 0 ? allCalculations[currentCalcRecordIndex].calculation_id : '';
             feather.replace();
        };
        
        const loadCalcRecord = async (index) => {
            if (index < 0 || index >= allCalculations.length) {
                console.warn(`[Calculator] Invalid index: ${index}`);
                clearForm(); return;
            }
            currentCalcRecordIndex = index;
            const record = allCalculations[index];
            console.log(`[Calculator] Loading record ${index}:`, record);
            clearForm(false); 

            const selectDropdownValue = async (dropdown, valueToSelect) => {
                 if (!dropdown || valueToSelect === null || valueToSelect === undefined) return;
                 if (Array.from(dropdown.options).some(opt => opt.value == valueToSelect)) dropdown.value = valueToSelect;
                 else console.warn(`Value "${valueToSelect}" not found in dropdown ${dropdown.id}.`);
             };

            // --- Load Materials Sequentially ---
            if (record.material1_id) {
                 await selectDropdownValue(materialSelectors[1].tipo, record.material1_tipo);
                 await handleMaterialChange(1, 'tipo', record.material1_tipo, false);
                 await selectDropdownValue(materialSelectors[1].material, record.material1_material);
                 await handleMaterialChange(1, 'material', record.material1_material, false);
                 await selectDropdownValue(materialSelectors[1].caracteristica, record.material1_caracteristica);
                 await handleMaterialChange(1, 'caracteristica', record.material1_caracteristica, false);
                 await selectDropdownValue(materialSelectors[1].cor, record.material1_cor);
                 await handleMaterialChange(1, 'cor', record.material1_cor, true);
            }
             if (record.material2_id) {
                  await selectDropdownValue(materialSelectors[2].tipo, record.material2_tipo);
                  await handleMaterialChange(2, 'tipo', record.material2_tipo, false);
                  await selectDropdownValue(materialSelectors[2].material, record.material2_material);
                  await handleMaterialChange(2, 'material', record.material2_material, false);
                  await selectDropdownValue(materialSelectors[2].caracteristica, record.material2_caracteristica);
                  await handleMaterialChange(2, 'caracteristica', record.material2_caracteristica, false);
                  await selectDropdownValue(materialSelectors[2].cor, record.material2_cor);
                  await handleMaterialChange(2, 'cor', record.material2_cor, true);
             }
             if (record.material3_id) {
                   await selectDropdownValue(materialSelectors[3].tipo, record.material3_tipo);
                   await handleMaterialChange(3, 'tipo', record.material3_tipo, false);
                   await selectDropdownValue(materialSelectors[3].material, record.material3_material);
                   await handleMaterialChange(3, 'material', record.material3_material, false);
                   await selectDropdownValue(materialSelectors[3].caracteristica, record.material3_caracteristica);
                   await handleMaterialChange(3, 'caracteristica', record.material3_caracteristica, false);
                   await selectDropdownValue(materialSelectors[3].cor, record.material3_cor);
                   await handleMaterialChange(3, 'cor', record.material3_cor, true);
             }
            // --- Load Machine ---
            if (record.maquina_id) { await selectDropdownValue(machineSelect, record.maquina_id); await handleMachineChange(record.maquina_id, true); }
            // --- Load Other Fields ---
            marginInput.value = record.margem_percentual || 0;
            currentPriceInput.value = record.preco_atual ? String(record.preco_atual).replace('.', ',') : '';
            if (notesTextarea) { notesTextarea.value = record.notas || ''; }
            updateCalculations(); updateCalcNavigation(); console.log('[Calculator] Record loaded.');
        };

        // --- Clear Functions ---
         const clearMaterialSection = (materialNum, triggerCalcUpdate = true) => {
             const sel = materialSelectors[materialNum];
             sel.tipo.value = '';
             sel.material.innerHTML = '<option value="">Selecione...</option>'; sel.material.disabled = true;
             sel.caracteristica.innerHTML = '<option value="">Selecione...</option>'; sel.caracteristica.disabled = true;
             sel.cor.innerHTML = '<option value="">Selecione...</option>'; sel.cor.disabled = true;
             sel.price.textContent = '0.00€';
             calculatorState.materials[materialNum] = { tipo: '', material: '', caracteristica: '', cor: '', price: 0, id: null };
             if (triggerCalcUpdate) updateCalculations();
         };
         const clearMachineSection = (triggerCalcUpdate = true) => {
             machineSelect.value = ''; machinePrice.textContent = '0.00€';
             calculatorState.machine = { id: null, nome: '', price: 0 };
             if (triggerCalcUpdate) updateCalculations();
         };
         const clearForm = (updateNav = true) => {
             console.log('[Calculator] Clearing form.');
             clearMaterialSection(1, false); clearMaterialSection(2, false); clearMaterialSection(3, false);
             clearMachineSection(false);
             marginInput.value = 0; currentPriceInput.value = '';
             if (notesTextarea) notesTextarea.value = '';
             resetCalculatorState(); // Reset the state object fully
             currentCalcRecordIndex = -1;
             if (updateNav) updateCalcNavigation();
             updateCalculations(); // Update display based on cleared state
         };

        // --- Data Handling ---
         const handleMaterialChange = async (materialNum, field, value, triggerCalcUpdate = true) => {
             const sel = materialSelectors[materialNum];
             calculatorState.materials[materialNum][field] = value;
             let query = supabase.from('materiais_impressao');
             let targetDropdown, dependentDropdowns, queryField;

             if (field === 'tipo') {
                 clearMaterialSection(materialNum, false); calculatorState.materials[materialNum].tipo = value; 
                 sel.material.disabled = !value; targetDropdown = sel.material; dependentDropdowns = [sel.caracteristica, sel.cor];
                 if (value) query = query.select('material').eq('tipo', value); queryField = 'material';
             } else if (field === 'material') {
                  calculatorState.materials[materialNum].caracteristica=''; calculatorState.materials[materialNum].cor='';
                  sel.caracteristica.disabled = !value; sel.cor.disabled = true;
                  sel.caracteristica.innerHTML='<option value="">Selecione...</option>'; sel.cor.innerHTML='<option value="">Selecione...</option>';
                  targetDropdown = sel.caracteristica; dependentDropdowns = [sel.cor];
                  if (value) query = query.select('caracteristica').eq('tipo', calculatorState.materials[materialNum].tipo).eq('material', value); queryField = 'caracteristica';
             } else if (field === 'caracteristica') {
                  calculatorState.materials[materialNum].cor='';
                  sel.cor.disabled = !value; sel.cor.innerHTML='<option value="">Selecione...</option>';
                  targetDropdown = sel.cor; dependentDropdowns = [];
                  if (value) query = query.select('cor').eq('tipo', calculatorState.materials[materialNum].tipo).eq('material', calculatorState.materials[materialNum].material).eq('caracteristica', value); queryField = 'cor';
             } else if (field === 'cor') {
                  if (value) {
                     try {
                          const { data, error } = await supabase.from('materiais_impressao').select('id, media_m2_2024, media_m2_2023')
                             .eq('tipo', calculatorState.materials[materialNum].tipo).eq('material', calculatorState.materials[materialNum].material)
                             .eq('caracteristica', calculatorState.materials[materialNum].caracteristica).eq('cor', value).single();
                         if (error) throw error;
                         calculatorState.materials[materialNum].id = data.id;
                         calculatorState.materials[materialNum].price = data.media_m2_2024 ?? data.media_m2_2023 ?? 0;
                         sel.price.textContent = `${calculatorState.materials[materialNum].price.toFixed(2)}€`;
                     } catch (error) { console.error('Error fetching material price:', error); calculatorState.materials[materialNum].price = 0; sel.price.textContent = '0.00€'; calculatorState.materials[materialNum].id = null; }
                  } else { calculatorState.materials[materialNum].price = 0; sel.price.textContent = '0.00€'; calculatorState.materials[materialNum].id = null; }
                  if (triggerCalcUpdate) updateCalculations();
                  return;
             }

             if (value && targetDropdown) {
                 try {
                     const { data, error } = await query;
                     if (error) throw error;
                     const uniqueValues = [...new Set(data.map(item => item[queryField]).filter(Boolean))].sort();
                     targetDropdown.innerHTML = `<option value="">Selecione o ${queryField.charAt(0).toUpperCase() + queryField.slice(1)}</option>`;
                     uniqueValues.forEach(val => { const option = document.createElement('option'); option.value = val; option.textContent = val; targetDropdown.appendChild(option); });
                 } catch (error) { console.error(`Error fetching ${queryField}s:`, error); }
             } else if (targetDropdown) {
                  targetDropdown.innerHTML = `<option value="">Selecione o ${queryField.charAt(0).toUpperCase() + queryField.slice(1)}</option>`;
             }
             dependentDropdowns?.forEach(dd => { dd.innerHTML = '<option value="">Selecione...</option>'; dd.disabled = true; });
             if (field !== 'cor') { sel.price.textContent = '0.00€'; calculatorState.materials[materialNum].price = 0; calculatorState.materials[materialNum].id = null; }
             if (triggerCalcUpdate) updateCalculations();
         };

        const handleMachineChange = async (machineId, triggerCalcUpdate = true) => {
             if (machineId) {
                 try {
                     const { data, error } = await supabase.from('maquinas').select('maquina, valor_m2').eq('id', machineId).single();
                     if (error) throw error;
                     calculatorState.machine = { id: machineId, nome: data.maquina, price: data.valor_m2 || 0 };
                     machinePrice.textContent = `${calculatorState.machine.price.toFixed(2)}€`;
                 } catch (error) { console.error('Error fetching machine price:', error); clearMachineSection(false); }
             } else { clearMachineSection(false); }
             if (triggerCalcUpdate) updateCalculations();
         };

        // --- Calculation Update ---
        const updateCalculations = () => {
             const margin = Number(marginInput.value) || 0; const currentPrice = parseFloat(currentPriceInput.value.replace(',', '.')) || 0;
             calculatorState.margin = margin; calculatorState.currentPrice = currentPrice; calculatorState.notes = notesTextarea?.value || '';
             const materialsCostPerM2 = Object.values(calculatorState.materials).reduce((sum, mat) => sum + (Number(mat.price) || 0), 0);
             const area = 1; calculatorState.area = area;
             const totalMaterialsCostValue = materialsCostPerM2 * area;
             const machineCostValue = (Number(calculatorState.machine.price) || 0) * area;
             const netCostValue = totalMaterialsCostValue + machineCostValue;
             const finalPriceValue = netCostValue * (1 + margin / 100);
             totalMaterialsCostEl.textContent = `${totalMaterialsCostValue.toFixed(2)}€`; totalMachineCostEl.textContent = `${machineCostValue.toFixed(2)}€`; totalNetCostEl.textContent = `${netCostValue.toFixed(2)}€`; finalPriceEl.textContent = `${finalPriceValue.toFixed(2)}€`;
             if (currentPrice > 0) { const diff = ((finalPriceValue - currentPrice) / currentPrice) * 100; priceDifferenceEl.textContent = `${diff.toFixed(2)}%`; priceDifferenceEl.className = `price-value-box ${diff > 0 ? 'positive-change' : diff < 0 ? 'negative-change' : ''}`; } 
             else { priceDifferenceEl.textContent = '0%'; priceDifferenceEl.className = 'price-value-box'; }
         };

        // --- Save Calculation ---
        const saveCalculation = async () => {
             try {
                 if (!calculatorState.materials[1].id || !calculatorState.machine.id) { alert('Selecione Material 1 e Máquina.'); return; }
                 const calculationData = {
                     material1_id: calculatorState.materials[1].id, material1_tipo: calculatorState.materials[1].tipo, material1_material: calculatorState.materials[1].material, material1_caracteristica: calculatorState.materials[1].caracteristica, material1_cor: calculatorState.materials[1].cor, material1_valor_m2: calculatorState.materials[1].price,
                     material2_id: calculatorState.materials[2].id || null, material2_tipo: calculatorState.materials[2].tipo || null, material2_material: calculatorState.materials[2].material || null, material2_caracteristica: calculatorState.materials[2].caracteristica || null, material2_cor: calculatorState.materials[2].cor || null, material2_valor_m2: calculatorState.materials[2].price || null,
                     material3_id: calculatorState.materials[3].id || null, material3_tipo: calculatorState.materials[3].tipo || null, material3_material: calculatorState.materials[3].material || null, material3_caracteristica: calculatorState.materials[3].caracteristica || null, material3_cor: calculatorState.materials[3].cor || null, material3_valor_m2: calculatorState.materials[3].price || null,
                     maquina_id: calculatorState.machine.id, maquina_nome: calculatorState.machine.nome, maquina_valor_m2: calculatorState.machine.price,
                     metros_quadrados: calculatorState.area, margem_percentual: calculatorState.margin, preco_atual: calculatorState.currentPrice || null, notas: calculatorState.notes || null
                 };
                 saveButton.disabled = true; saveButton.textContent = 'Guardando...';
                 let existingRecordId = (currentCalcRecordIndex !== -1 && allCalculations[currentCalcRecordIndex]) ? allCalculations[currentCalcRecordIndex].calculation_id : null;
                 let savedData, error;
                 if (existingRecordId) { ({ data: savedData, error } = await supabase.from('calculadora_materiais').update(calculationData).eq('calculation_id', existingRecordId).select().single()); }
                 else { ({ data: savedData, error } = await supabase.from('calculadora_materiais').insert([calculationData]).select().single()); }
                 if (error) throw error;
                 console.log('Calculation saved:', savedData); alert('Cálculo guardado!');
                 await fetchAllCalculations();
                 const savedIndex = allCalculations.findIndex(c => c.calculation_id === savedData.calculation_id);
                 if (savedIndex !== -1) { loadCalcRecord(savedIndex); } else { clearForm(); }
             } catch (error) { console.error('Error saving calc:', error); alert(`Erro ao guardar: ${error.message}`); }
             finally { saveButton.disabled = false; saveButton.textContent = 'Guardar Cálculo'; feather.replace(); }
         };

        // --- Search Function ---
         const handleSearch = () => {
             const searchId = parseInt(searchInput.value);
             if (isNaN(searchId)) { alert('Insira um ID.'); return; }
             const recordIndex = allCalculations.findIndex(calc => calc.calculation_id === searchId);
             if (recordIndex === -1) { alert(`ID ${searchId} não encontrado.`); } else { loadCalcRecord(recordIndex); }
         };

        // --- Event Listeners Setup ---
        prevButton.addEventListener('click', () => {
             if (currentCalcRecordIndex > 0) { loadCalcRecord(currentCalcRecordIndex - 1); } 
             else if (currentCalcRecordIndex <= 0) { if (allCalculations.length > 0) loadCalcRecord(allCalculations.length - 1); else clearForm(); }
        });
        nextButton.addEventListener('click', () => {
             if (currentCalcRecordIndex === -1) { if (allCalculations.length > 0) loadCalcRecord(0); }
             else if (currentCalcRecordIndex < allCalculations.length - 1) { loadCalcRecord(currentCalcRecordIndex + 1); }
             else { clearForm(); }
        });
         clearMaterialButtons.forEach(button => { button.addEventListener('click', () => { clearMaterialSection(parseInt(button.dataset.materialNum)); }); });
         clearMachineButton.addEventListener('click', () => clearMachineSection());
         searchButton.addEventListener('click', handleSearch);
         searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
         Object.entries(materialSelectors).forEach(([num, sel]) => {
             sel.tipo.addEventListener('change', (e) => handleMaterialChange(num, 'tipo', e.target.value));
             sel.material.addEventListener('change', (e) => handleMaterialChange(num, 'material', e.target.value));
             sel.caracteristica.addEventListener('change', (e) => handleMaterialChange(num, 'caracteristica', e.target.value));
             sel.cor.addEventListener('change', (e) => handleMaterialChange(num, 'cor', e.target.value));
         });
         machineSelect.addEventListener('change', (e) => handleMachineChange(e.target.value));
         marginInput.addEventListener('input', updateCalculations);
         currentPriceInput.addEventListener('input', updateCalculations);
         if (notesTextarea) notesTextarea.addEventListener('input', updateCalculations);
         saveButton.addEventListener('click', saveCalculation);

        // --- Initial Load for Calculator ---
        initializeDropdowns().then(() => {
            fetchAllCalculations().catch(err => {
                console.error("Initial fetch for calculator failed:", err);
                alert('Falha ao carregar cálculos iniciais.');
            }).finally(() => {
                 updateCalcNavigation(); 
            });
        });

        sectionElement.classList.add('calculator-initialized');
        console.log('[Calculator] Initialized successfully.');

        // Add event listener for new calculation button
        document.getElementById('new-calculation').addEventListener('click', () => {
            clearForm(false);
            document.getElementById('record-indicator').textContent = 'Novo Cálculo';
        });

        // Expose calculator functions globally through calculatorApp
        window.calculatorApp.loadRecord = loadCalcRecord;
        window.calculatorApp.clearForm = clearForm;
        window.calculatorApp.fetchAllCalculations = fetchAllCalculations;
        window.calculatorApp.updateCalculations = updateCalculations;
    };

    // --- Funções Específicas da Seção Máquinas ---
    let allMaquinasData = []; 
    let currentEditingMaquinaId = null;
    let currentMaquinaRecordIndex = -1; 
    const maquinaSelect = document.getElementById('maquina-select-edit');
    const maquinaForm = document.getElementById('maquina-form');
    const maquinaRecordIndicator = document.getElementById('maquina-record-indicator');
    const maquinaPrevButton = document.getElementById('maquina-prev-button');  // Fixed ID
    const maquinaNextButton = document.getElementById('maquina-next-button');  // Fixed ID
    const maquinaNovoButton = document.getElementById('maquina-novo-button');  // Added
    const maquinaStatus = document.getElementById('maquinas-status'); // Status message element

    const updateMaquinaNavigation = () => {
        if (!maquinaRecordIndicator || !maquinaPrevButton || !maquinaNextButton) return;
        const totalRecords = allMaquinasData.length;
        if (totalRecords === 0) {
            maquinaRecordIndicator.textContent = 'Nenhuma máquina';
            maquinaSelect.innerHTML = '<option value="">Nenhuma máquina</option>'; // Update select
            maquinaSelect.disabled = true;
        } else {
            maquinaRecordIndicator.textContent = (currentMaquinaRecordIndex === -1) 
                ? `Nova / ${totalRecords}` 
                : `${currentMaquinaRecordIndex + 1} / ${totalRecords}`;
            maquinaSelect.disabled = false;
            const currentSelection = maquinaSelect.value;
            maquinaSelect.innerHTML = '<option value="">Selecionar/Nova Máquina</option>';
            allMaquinasData.forEach((maquina, index) => {
                const option = document.createElement('option');
                option.value = maquina.id;
                option.textContent = maquina.maquina; 
                if (maquina.id == currentSelection) {
                    option.selected = true;
                }
                maquinaSelect.appendChild(option);
            });
            if (currentMaquinaRecordIndex !== -1 && allMaquinasData[currentMaquinaRecordIndex]) {
                 maquinaSelect.value = allMaquinasData[currentMaquinaRecordIndex].id;
            }
        }
        maquinaPrevButton.disabled = currentMaquinaRecordIndex <= 0 && totalRecords > 0;
        maquinaNextButton.disabled = currentMaquinaRecordIndex === -1 || currentMaquinaRecordIndex >= totalRecords - 1;
        feather.replace();
    };

    const populateMaquinaSelectAndFetchAll = async () => {
        console.log('[Maquinas] Fetching all maquinas data...');
        try {
            const { data, error } = await supabase
                .from('maquinas')
                .select('*')
                .order('maquina', { ascending: true });
            if (error) throw error;
            allMaquinasData = data || [];
            console.log(`[Maquinas] Fetched ${allMaquinasData.length} machines.`);
            currentMaquinaRecordIndex = -1;
            clearMaquinaForm(false);
            updateMaquinaNavigation();
            if (maquinaStatus) maquinaStatus.textContent = '';
        } catch (error) {
            console.error('Error fetching maquinas:', error);
            if (maquinaStatus) { maquinaStatus.textContent = 'Erro ao carregar máquinas.'; maquinaStatus.style.color = NEGATIVE_COLOR; }
            allMaquinasData = [];
            updateMaquinaNavigation();
        }
    };

    const loadMaquinaRecord = (index) => {
        if (index < 0 || index >= allMaquinasData.length) {
            console.warn(`[Maquinas] Invalid index: ${index}`);
            clearMaquinaForm();
            return;
        }
        currentMaquinaRecordIndex = index;
        const maquina = allMaquinasData[index];
        console.log(`[Maquinas] Loading record ${index}:`, maquina);
        loadMaquinaDataToForm(maquina);
        updateMaquinaNavigation();
    };

    const clearMaquinaForm = (updateNav = true) => {
        console.log('[Maquinas] Clearing form.');
        if (maquinaForm) maquinaForm.reset();
        currentEditingMaquinaId = null;
        currentMaquinaRecordIndex = -1;
        if (maquinaStatus) maquinaStatus.textContent = '';
        document.getElementById('maquina-id-display').textContent = 'Novo Registo';
        maquinaSelect.value = '';
        if (updateNav) updateMaquinaNavigation();
    };

    const loadMaquinaDataToForm = (maquinaData) => {
        if (!maquinaForm || !maquinaData) return;
        maquinaForm.elements['maquina'].value = maquinaData.maquina || '';
        maquinaForm.elements['valor_m2'].value = maquinaData.valor_m2 || '';
        document.getElementById('maquina-id-display').textContent = `ID: ${maquinaData.id}`;
        currentEditingMaquinaId = maquinaData.id;
        if (maquinaStatus) maquinaStatus.textContent = '';
    };

    const handleSaveMaquina = async (event) => {
        event.preventDefault();
        console.log('[Maquinas] Attempting to save...');
        if (!maquinaForm) return;

        const formData = new FormData(maquinaForm);
        const maquinaData = Object.fromEntries(formData.entries());

        maquinaData.valor_m2 = maquinaData.valor_m2 ? parseFloat(maquinaData.valor_m2) : null;
        
        delete maquinaData.id; 

        const saveButton = maquinaForm.querySelector('button[type="submit"]');
        if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Guardando...'; }
        if (maquinaStatus) { maquinaStatus.textContent = 'Guardando...'; maquinaStatus.style.color = TEXT_SECONDARY_COLOR; }

        try {
            let savedData, error;
            if (currentEditingMaquinaId) {
                console.log('[Maquinas] Updating record ID:', currentEditingMaquinaId, 'with data:', maquinaData);
                ({ data: savedData, error } = await supabase
                    .from('maquinas')
                    .update(maquinaData)
                    .eq('id', currentEditingMaquinaId)
                    .select()
                    .single());
            } else {
                console.log('[Maquinas] Inserting new record with data:', maquinaData);
                ({ data: savedData, error } = await supabase
                    .from('maquinas')
                    .insert([maquinaData])
                    .select()
                    .single());
            }

            if (error) throw error;

            console.log('[Maquinas] Save successful:', savedData);
            if (maquinaStatus) { maquinaStatus.textContent = 'Máquina guardada com sucesso!'; maquinaStatus.style.color = POSITIVE_COLOR; }
            
            await populateMaquinaSelectAndFetchAll();
            const savedIndex = allMaquinasData.findIndex(m => m.id === savedData.id);
            if (savedIndex !== -1) {
                loadMaquinaRecord(savedIndex);
            } else {
                clearMaquinaForm();
            }

        } catch (error) {
            console.error('[Maquinas] Error saving maquina:', error);
            if (maquinaStatus) { maquinaStatus.textContent = `Erro ao guardar: ${error.message}`; maquinaStatus.style.color = NEGATIVE_COLOR; }
        } finally {
            if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Guardar Máquina'; }
        }
    };

    const handleMaquinaPrev = () => {
        if (currentMaquinaRecordIndex > 0) {
            loadMaquinaRecord(currentMaquinaRecordIndex - 1);
        } else if (currentMaquinaRecordIndex <= 0 && allMaquinasData.length > 0) {
            loadMaquinaRecord(allMaquinasData.length - 1); 
        } else {
            clearMaquinaForm();
        }
    };

    const handleMaquinaNext = () => {
        if (currentMaquinaRecordIndex === -1) {
             if (allMaquinasData.length > 0) {
                 loadMaquinaRecord(0);
             }
        } else if (currentMaquinaRecordIndex < allMaquinasData.length - 1) {
            loadMaquinaRecord(currentMaquinaRecordIndex + 1);
        } else {
            clearMaquinaForm();
        }
    };
    
     const handleMaquinaSelectChange = (event) => {
        const selectedId = event.target.value;
        if (selectedId) {
            const index = allMaquinasData.findIndex(m => m.id == selectedId);
            if (index !== -1) {
                loadMaquinaRecord(index);
            } else {
                console.warn(`[Maquinas] Selected ID ${selectedId} not found in data.`);
                clearMaquinaForm();
            }
        } else {
            clearMaquinaForm();
        }
    };

    const initializeMaquinasSection = async () => {
        console.log('[Maquinas] Initializing section...');
        const sectionElement = document.getElementById('maquinas-section');
        if (sectionElement.classList.contains('maquinas-initialized')) {
            console.log('[Maquinas] Already initialized.');
             updateMaquinaNavigation();
            return;
        }

        if (maquinaForm) maquinaForm.addEventListener('submit', handleSaveMaquina);
        if (maquinaPrevButton) maquinaPrevButton.addEventListener('click', handleMaquinaPrev);
        if (maquinaNextButton) maquinaNextButton.addEventListener('click', handleMaquinaNext);
        if (maquinaSelect) maquinaSelect.addEventListener('change', handleMaquinaSelectChange);
        
        if (maquinaNovoButton) {
            maquinaNovoButton.addEventListener('click', () => clearMaquinaForm());
        }

        await populateMaquinaSelectAndFetchAll();

        sectionElement.classList.add('maquinas-initialized');
        console.log('[Maquinas] Section initialized successfully.');
    };
    // --- Fim das Funções Específicas da Seção Máquinas ---

    // --- Funções de Navegação e Inicialização --- 
    const switchSection = async (targetSection) => {
        if (targetSection === currentSection && document.getElementById(`${targetSection}-section`)?.classList.contains('active-section')) {
            console.log(`Already on section: ${targetSection}`);
            hideLoading(); 
            return; 
        }
        
        console.log(`Switching to section: ${targetSection}`);
        currentSection = targetSection;
        showLoading(); 
        
        sidebarLinks.forEach(link => { link.classList.toggle('active', link.dataset.section === targetSection); });
        dataSections.forEach(section => { section.classList.remove('active-section'); });
        const sectionElement = document.getElementById(`${targetSection}-section`);
        if (!sectionElement) {
            console.error(`Section element not found: ${targetSection}`); 
            hideLoading(); 
            return;
        }
        sectionElement.classList.add('active-section');
        Object.keys(chartInstances).forEach(destroyChart);

        try {
            if (targetSection === 'maquinas') {
                await initializeMaquinasSection(); 
            } else if (targetSection === 'calculadora') {
                if (!sectionElement.classList.contains('calculator-initialized')) {
                    initializeCalculator(); 
                } else {
                    console.log('Calculator already initialized. Ensuring data is fresh.');
                    await fetchAllCalculations();
                    updateCalcNavigation();
                }
            } else {
                 const config = TABLE_CONFIG[targetSection];
                 if (!config) {
                     console.error(`Config not found for standard section: ${targetSection}`); 
                     hideLoading(); 
                     return; 
                 }
                 
                 const data = tableDataCache[targetSection] || await fetchData(targetSection);
                 
                 if (data) {
                     tableDataCache[targetSection] = data;
                     
                     const currentFilterValue = filterState[targetSection]?.material || 'all';
                     
                     const hasMaterialColumn = config.columns.some(col => col.key === 'material');
                     if (hasMaterialColumn) {
                         setupFilters(targetSection, data);
                         const filterSelect = document.getElementById(`${targetSection}-filter`);
                         if (filterSelect) filterSelect.value = currentFilterValue;
                     }
                     
                     applyFilter(targetSection, currentFilterValue); 
                     updateSortIndicators(targetSection);
                     
                 } else {
                     console.error(`Failed data load or no data for ${targetSection}.`);
                     const tableBody = document.querySelector(`#${targetSection}-table tbody`); 
                     if (tableBody) { 
                         const colspan = config.columns.length || 1;
                         tableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; color: ${NEGATIVE_COLOR};">Erro ao carregar dados.</td></tr>`;
                     } else {
                         console.error(`Table body not found for section ${targetSection} to display error.`);
                     }
                     // Destroy any lingering charts for this section
                     if (config.charts) config.charts.forEach(type => destroyChart(`${targetSection}-chart-${type}`));
                 }
            }
        } catch (error) {
             console.error(`Error loading section ${targetSection}:`, error);
             // Optionally display a general error message to the user
        } finally {
            hideLoading(); 
        }
    };

    // --- Initialize sidebar link listeners ---
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) switchSection(section);
            else console.warn('Link missing data-section');
        });
    });

    // --- Initial Page Load Logic ---
    // (Make sure this is the ONLY definition)
    const initialActiveLink = document.querySelector('.sidebar a.active');
    const initialSection = initialActiveLink ? initialActiveLink.getAttribute('data-section') : 'calculadora'; 
    currentSection = initialSection; // Set global state BEFORE async logic
    const initialSectionElement = document.getElementById(`${initialSection}-section`);
    dataSections.forEach(section => { section.classList.remove('active-section'); });
    if(initialSectionElement) initialSectionElement.classList.add('active-section');
    else console.error(`Initial element #${initialSection}-section not found!`);

    // Simplified Initial Page Load: Just call switchSection
    (async () => { 
        await switchSection(initialSection);
    })();

    // --- Function to handle actions within tables (Edit/Delete) ---
    const handleTableActions = async (event) => {
        const button = event.target.closest('.action-button');
        if (!button) return; // Click wasn't on an action button

        const id = button.dataset.id;
        if (!id) {
            console.error('Action button is missing data-id');
            return;
        }
        const calculationId = parseInt(id);

        if (button.classList.contains('edit-button')) {
            handleEditCalculation(calculationId);
        } else if (button.classList.contains('delete-button')) {
            handleDeleteCalculation(calculationId);
        }
    };

    // --- Function to handle Editing a Calculation ---
    const handleEditCalculation = async (calculationId) => { // Make the function async
        console.log(`[Edit] Request to edit calculation ID: ${calculationId}`);
        try {
            // Navigate to the calculator section and WAIT for it to finish loading
            await switchSection('calculadora'); 
            
            // Now that the section is switched and likely initialized, find and load the record
            // Ensure allCalculations is available (it should be fetched by initializeCalculator called within switchSection)
            if (!allCalculations || allCalculations.length === 0) {
                 console.warn('[Edit] allCalculations array is not populated yet or is empty after section switch.');
                 // Maybe try fetching again explicitly if needed, though switchSection should handle it.
                 await fetchAllCalculations(); // Explicitly fetch if might be needed
                 if (!allCalculations || allCalculations.length === 0) {
                     throw new Error('Não foi possível carregar os dados da calculadora.');
                 }
            }

            const recordIndex = allCalculations.findIndex(calc => calc.calculation_id === calculationId);
            if (recordIndex !== -1) {
                console.log(`[Edit] Found record at index ${recordIndex}. Loading...`);
                // loadCalcRecord is synchronous or handles its own async needs internally
                window.calculatorApp.loadRecord(recordIndex); // Use the globally exposed function
            } else {
                console.error(`[Edit] Calculation ID ${calculationId} not found in fetched data.`);
                alert(`Erro: Cálculo com ID ${calculationId} não encontrado para edição.`);
                clearForm(); // Clear form if record not found
            }
        } catch (error) {
             console.error(`[Edit] Error during edit process:`, error);
             alert(`Erro ao editar cálculo: ${error.message || 'Erro desconhecido'}`);
        }
    };

    // --- Function to handle Deleting a Calculation ---
    const handleDeleteCalculation = async (calculationId) => {
        console.log(`[Delete] Request to delete calculation ID: ${calculationId}`);
        if (confirm(`Tem a certeza que deseja eliminar o cálculo com ID ${calculationId}? Esta ação não pode ser desfeita.`)) {
            console.log(`[Delete] Confirmed deletion for ID: ${calculationId}`);
            showLoading();
            try {
                const { error } = await supabase
                    .from('calculadora_materiais')
                    .delete()
                    .eq('calculation_id', calculationId);

                if (error) {
                    throw error;
                }

                console.log(`[Delete] Successfully deleted calculation ID: ${calculationId}`);
                alert('Cálculo eliminado com sucesso!');

                // --- Modification Start ---
                // Find the index of the deleted item in the cache
                const activeTable = document.querySelector('.data-section.active-section')?.id?.replace('-section', '');
                let itemRemovedFromCache = false;

                if (activeTable === 'tabela_precos' && tableDataCache['tabela_precos']) {
                    const indexToRemove = tableDataCache['tabela_precos'].findIndex(item => item.calculation_id === calculationId);
                    
                    if (indexToRemove !== -1) {
                        // Remove the item from the cached array
                        tableDataCache['tabela_precos'].splice(indexToRemove, 1);
                        itemRemovedFromCache = true;
                        console.log(`[Delete] Removed item with ID ${calculationId} from tableDataCache['tabela_precos']`);
                        
                        // Re-render the table with the modified cache
                        renderTable('tabela_precos', tableDataCache['tabela_precos']);
                    } else {
                         console.warn(`[Delete] Item with ID ${calculationId} not found in tableDataCache['tabela_precos'] after deletion.`);
                         // Optional: Force refetch if item not found in cache (fallback)
                         delete tableDataCache['tabela_precos']; 
                         await fetchData('tabela_precos');
                         if (tableDataCache['tabela_precos']) {
                            renderTable('tabela_precos', tableDataCache['tabela_precos']);
                         } else {
                            renderTable('tabela_precos', []);
                         }
                    }
                } else if (activeTable === 'tabela_precos') {
                     // Cache was empty or table not active, attempt refetch just in case
                     console.log(`[Delete] Cache for 'tabela_precos' was initially empty or section not active. Refetching.`);
                     delete tableDataCache['tabela_precos']; 
                     await fetchData('tabela_precos');
                      if (tableDataCache['tabela_precos']) {
                        renderTable('tabela_precos', tableDataCache['tabela_precos']);
                     } else {
                        renderTable('tabela_precos', []);
                     }
                }
                // --- Modification End ---


                // Also refresh the calculator's data in the background (keep this)
                await fetchAllCalculations(); 

            } catch (error) {
                console.error(`[Delete] Error deleting calculation ID ${calculationId}:`, error);
                alert(`Erro ao eliminar o cálculo: ${error.message}`);
            } finally {
                hideLoading();
            }
        } else {
            console.log(`[Delete] Deletion cancelled for ID: ${calculationId}`);
        }
    };

    // ---> Move fetchAllCalculations function definition here <----
    const fetchAllCalculations = async () => {
         console.log('[Calculator] Fetching all calculations...');
         try {
             const { data, error } = await supabase.from('calculadora_materiais').select('*').order('calculation_id', { ascending: true });
             if (error) throw error;
             allCalculations = data || []; // Update the globally accessible variable
             console.log(`[Calculator] Fetched ${allCalculations.length} calculations.`);
             // Reset index and clear form needs to happen within calculator's context if needed
             // currentCalcRecordIndex = -1;
             // clearForm(false);
             // updateCalcNavigation();
         } catch (err) {
            console.error('Exception fetching calculations:', err);
            // Avoid alert here, let the calling function handle UI feedback if needed
            // alert('Erro ao carregar cálculos existentes.'); 
            allCalculations = []; // Ensure it's an empty array on error
            throw err; // Re-throw the error so the caller knows something went wrong
        }
    };

    // --- Funções de Renderização e Filtragem ---

    const filterDataAndRender = (tableName) => {
        if (!tableDataCache[tableName]) return; // No data cached yet

        const filterValue = filterState[tableName]?.material || 'all';
        const searchTerm = (searchState[tableName]?.term || '').toLowerCase().trim(); // Get search term

        let filteredData = tableDataCache[tableName];

        // Apply dropdown filter (if applicable to this table)
        const tableConfig = TABLE_CONFIG[tableName];
        const hasMaterialFilter = tableConfig && tableConfig.columns.some(col => col.key === 'material') && document.getElementById(`${tableName}-filter`);
        
        if (hasMaterialFilter && filterValue !== 'all') {
            filteredData = filteredData.filter(item => item.material === filterValue);
        }

        // Apply search term filter (if search term exists)
        if (searchTerm) {
            if (tableName === 'tabela_precos') {
                // Specific search logic for Tabela de Preços (ID or Material Description)
                 filteredData = filteredData.filter(item => {
                    const idString = String(item.calculation_id);
                    const materialDesc = tableConfig.columns.find(col => col.key === 'material_descricao').render(item).toLowerCase();
                    return idString.includes(searchTerm) || materialDesc.includes(searchTerm);
                 });
            } else {
                // Generic search logic for other tables
                filteredData = filteredData.filter(item => {
                    // Search across relevant text fields (adjust as needed)
                    const searchFields = [item.tipo, item.material, item.caracteristica, item.cor];
                    return searchFields.some(field => field && String(field).toLowerCase().includes(searchTerm));
                });
            }
        }

        tableFilteredData[tableName] = filteredData; // Update filtered cache
        renderTable(tableName, filteredData);
    };

    // --- Event Listeners ---

    // Navegação Sidebar
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) switchSection(section);
            else console.warn('Link missing data-section');
        });
    });

    // Filtros de Material (Dropdowns)
    materialFilters.forEach(filterSelect => {
        const tableName = filterSelect.id.replace('-filter', '');
        filterSelect.addEventListener('change', (event) => {
            filterState[tableName] = { material: event.target.value };
            // Reset search term when dropdown changes? Optional, maybe keep search active
            // searchState[tableName] = { term: '' };
            // const searchInput = document.getElementById(`${tableName}-search-input`);
            // if (searchInput) searchInput.value = '';
            filterDataAndRender(tableName);
        });
    });

    // Add Event Listener for Tabela de Preços Search Button
    if (tabelaPrecosSearchButton && tabelaPrecosSearchInput) {
        tabelaPrecosSearchButton.addEventListener('click', () => {
            const tableName = 'tabela_precos';
            searchState[tableName] = { term: tabelaPrecosSearchInput.value };
            filterDataAndRender(tableName);
        });

        // Optional: Trigger search on Enter key press in the input field
        tabelaPrecosSearchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const tableName = 'tabela_precos';
                searchState[tableName] = { term: tabelaPrecosSearchInput.value };
                filterDataAndRender(tableName);
            }
        });
    }

    // Add Event Listener for Table Actions (Edit/Delete) - **NEW LISTENER**
    const mainContent = document.querySelector('main.content');
    if (mainContent) {
        mainContent.addEventListener('click', handleTableActions);
    } else {
        console.error("Could not find main content area to attach table action listener.");
    }


    // Ordenação das Tabelas
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('sort-indicator')) {
            const column = target.closest('th').dataset.column;
            //const direction = target.classList.contains('asc') ? 'asc' : 'desc'; // Direction logic handled in handleSort
            handleSort(target.closest('table').id.replace('-table',''), column); // Pass table name and column
        }
        // Note: Moved action button handling to the specific listener above
    });

}); // Fim do DOMContentLoaded