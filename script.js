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

    // --- Modal Elements ---
    const modalOverlay = document.getElementById('generic-modal');
    const modalContent = modalOverlay?.querySelector('.modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalForm = document.getElementById('generic-modal-form');
    const modalFormFields = document.getElementById('modal-form-fields');
    const modalRecordIdInput = document.getElementById('modal-record-id');
    const modalTableNameInput = document.getElementById('modal-table-name');
    const modalSaveButton = modalForm?.querySelector('.save-button');
    const modalCancelButton = modalForm?.querySelector('.cancel-button');
    const modalCloseButton = modalOverlay?.querySelector('.modal-close-button');
    const modalStatus = document.getElementById('modal-status');

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
                { key: 'id', label: 'ID', type: 'number' }, // Assuming 'id' is the PK
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
                { key: 'actions', label: 'Ações', sortable: false, align: 'center', render: (row) => renderActionButtons(row.id) } // Add Actions
            ],
            charts: ['volume', 'valor']
        },
        cola: {
            columns: [
                { key: 'id', label: 'ID', type: 'number' }, // Assuming 'id' is the PK
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'quantidade_2023', label: 'Qtd 2023', type: 'number', align: 'right' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                // Excluindo percentuais conforme solicitado
                { key: 'valor_2023', label: 'Valor 2023', type: 'currency', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'actions', label: 'Ações', sortable: false, align: 'center', render: (row) => renderActionButtons(row.id) } // Add Actions
            ],
             charts: ['volume', 'valor']
        },
        embalamento: {
            columns: [
                { key: 'id', label: 'ID', type: 'number' }, // Assuming 'id' is the PK
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'caracteristica', label: 'Característica' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'media_vl_unit_2024', label: 'Média Unit 2024', type: 'currency', align: 'right' },
                { key: 'actions', label: 'Ações', sortable: false, align: 'center', render: (row) => renderActionButtons(row.id) } // Add Actions
            ],
            charts: ['2024']
        },
        fitas_adesivas: {
            columns: [
                 { key: 'id', label: 'ID', type: 'number' }, // Assuming 'id' is the PK
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
                 { key: 'actions', label: 'Ações', sortable: false, align: 'center', render: (row) => renderActionButtons(row.id) } // Add Actions
            ],
             charts: ['volume', 'valor']
        },
        outros: {
             columns: [
                { key: 'id', label: 'ID', type: 'number' }, // Assuming 'id' is the PK
                { key: 'tipo', label: 'Tipo' },
                { key: 'material', label: 'Material' },
                { key: 'caracteristica', label: 'Característica' },
                { key: 'quantidade_2024', label: 'Qtd 2024', type: 'number', align: 'right' },
                { key: 'valor_2024', label: 'Valor 2024', type: 'currency', align: 'right' },
                { key: 'media_vl_unit_2024', label: 'Média Unit 2024', type: 'currency', align: 'right' },
                { key: 'actions', label: 'Ações', sortable: false, align: 'center', render: (row) => renderActionButtons(row.id) } // Add Actions
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
                        let combinedMaterials = desc.join(' + ');
                        // Append notes (which contain the machine description) if they exist
                        if (row.notas) {
                            combinedMaterials += ". " + row.notas; 
                        }
                        return combinedMaterials;
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

    // --- Helper function to render standard action buttons ---
    const renderActionButtons = (recordId) => {
        return `
            <button class="action-button edit-button" data-id="${recordId}" title="Editar Registo">
                <i data-feather="edit"></i>
            </button>
            <button class="action-button delete-button" data-id="${recordId}" title="Eliminar Registo">
                <i data-feather="trash-2"></i>
            </button>
        `;
    };

    // --- Functions for Generic Edit/Add Modal ---
    const closeModal = () => {
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            modalFormFields.innerHTML = ''; // Clear dynamic fields
            modalForm.reset(); // Reset form values
            if (modalStatus) modalStatus.textContent = ''; // Clear status message
        }
    };

    const openModal = async (tableName, recordId = null) => {
        if (!modalOverlay || !modalForm || !modalTitle || !modalFormFields || !modalRecordIdInput || !modalTableNameInput) {
            console.error('Modal elements not found!');
            alert('Erro ao abrir o formulário de edição.');
            return;
        }

        const config = TABLE_CONFIG[tableName];
        if (!config) {
            console.error(`Configuration not found for table: ${tableName}`);
            alert(`Erro: Configuração da tabela '${tableName}' não encontrada.`);
            return;
        }

        // Reset form and status
        modalForm.reset();
        modalFormFields.innerHTML = '';
        if (modalStatus) modalStatus.textContent = '';
        modalTableNameInput.value = tableName;
        modalRecordIdInput.value = recordId || '';

        let recordData = {};
        if (recordId) {
            modalTitle.textContent = `Editar Registo (ID: ${recordId})`;
            showLoading(); // Show loading indicator while fetching data
            try {
                // Fetch the specific record to edit
                const { data, error } = await supabase
                    .from(tableName)
                    .select('*')
                    .eq('id', recordId) // Assuming 'id' is the PK for these tables
                    .single();
                if (error) throw error;
                recordData = data || {};
            } catch (error) {
                console.error(`Error fetching record ${recordId} from ${tableName}:`, error);
                alert(`Erro ao carregar dados do registo: ${error.message}`);
                hideLoading();
                return;
            } finally {
                hideLoading();
            }
        } else {
            modalTitle.textContent = `Adicionar Novo Registo a ${tableName}`;
            recordData = {}; // Start with empty data for adding
        }

        // Dynamically generate form fields based on TABLE_CONFIG
        config.columns.forEach(col => {
            // Skip 'id' and 'actions' columns
            if (col.key === 'id' || col.key === 'actions') return;

            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';

            const label = document.createElement('label');
            label.htmlFor = `modal-field-${col.key}`;
            label.textContent = col.label || col.key;

            let inputElement;
            // Basic input type determination (extend as needed)
            if (col.type === 'number' || col.type === 'currency' || col.type === 'percentage') {
                inputElement = document.createElement('input');
                inputElement.type = 'number';
                inputElement.step = 'any'; // Allow decimals for currency/percentage
            } else {
                inputElement = document.createElement('input');
                inputElement.type = 'text';
            }

            inputElement.id = `modal-field-${col.key}`;
            inputElement.name = col.key;
            inputElement.value = recordData[col.key] !== null && recordData[col.key] !== undefined ? recordData[col.key] : '';

            inputGroup.appendChild(label);
            inputGroup.appendChild(inputElement);
            modalFormFields.appendChild(inputGroup);
        });

        modalOverlay.style.display = 'flex'; // Show the modal
        feather.replace(); // Ensure icons in modal are rendered (if any added later)
    };
    
    const handleSaveGenericRecord = async (event) => {
        event.preventDefault();
        if (!modalForm || !modalSaveButton || !modalStatus) return;

        const formData = new FormData(modalForm);
        const recordData = Object.fromEntries(formData.entries());
        const tableName = recordData.tableName;
        const recordId = recordData.id || null; // Get ID from hidden field

        // Remove helper fields from data to be saved
        delete recordData.tableName;
        delete recordData.id;
        
        const config = TABLE_CONFIG[tableName];
        if (!config) {
             console.error(`Save error: Config not found for table: ${tableName}`);
             modalStatus.textContent = `Erro: Configuração da tabela '${tableName}' não encontrada.`;
             modalStatus.style.color = NEGATIVE_COLOR;
             return;
        }

        // --- Data Type Conversion --- 
        // Convert number/currency/percentage fields from string back to number
        config.columns.forEach(col => {
             if (col.type === 'number' || col.type === 'currency' || col.type === 'percentage') {
                 if (recordData[col.key] !== '' && recordData[col.key] !== null && recordData[col.key] !== undefined) {
                     recordData[col.key] = parseFloat(recordData[col.key]);
                 } else {
                      // Handle empty numeric fields - set to null or default?
                      recordData[col.key] = null; 
                 }
             }
        });
        // ---------------------------

        console.log(`[Save] Attempting to save to ${tableName}. ID: ${recordId || 'New'}, Data:`, recordData);
        modalSaveButton.disabled = true;
        modalSaveButton.textContent = 'Guardando...';
        modalStatus.textContent = 'Guardando...';
        modalStatus.style.color = TEXT_SECONDARY_COLOR;

        try {
            let savedData, error;
            if (recordId) { // Update existing record
                // --- DETAILED LOGGING FOR UPDATE --- 
                console.log('[Save][Update] Starting update process.');
                console.log('[Save][Update] recordId from hidden input:', recordId);
                console.log('[Save][Update] tableName from hidden input:', tableName);
                // Log the data *before* potential modifications (like type conversion)
                console.log('[Save][Update] Raw recordData from form:', JSON.stringify(recordData)); 
                // Ensure id and tableName are removed *before* the update payload is logged/sent
                const idForEq = recordId; // Store the ID for the .eq() clause
                delete recordData.tableName; 
                delete recordData.id; 
                console.log('[Save][Update] recordData after deleting tableName and id:', JSON.stringify(recordData));
                // --- END LOGGING ---

                ({ data: savedData, error } = await supabase
                    .from(tableName)
                    .update(recordData) // Send data without id/tableName
                    .eq('id', idForEq)  // Target the correct row using the stored ID
                    .select()
                    .single());
            } else { // Insert new record
                const recordToInsert = { ...recordData }; // Create a copy
                // Ensure ID is not in the object sent for insertion
                delete recordToInsert.id; 
                
                // Log the exact payload being sent for insert
                console.log('[Save] Inserting new record to:', tableName, 'Data:', JSON.stringify(recordToInsert));
                
                ({ data: savedData, error } = await supabase
                    .from(tableName)
                    .insert([recordToInsert]) // Use the copy without id
                    .select()
                    .single());
            }

            if (error) throw error;

            console.log('[Save] Success:', savedData);
            modalStatus.textContent = 'Registo guardado com sucesso!';
            modalStatus.style.color = POSITIVE_COLOR;

            // Refresh table data and close modal after a short delay
            delete tableDataCache[tableName];
            await fetchData(tableName);
            filterDataAndRender(tableName);
            setTimeout(closeModal, 1500); // Close after 1.5 seconds

        } catch (error) {
            console.error('[Save] Error:', error);
            modalStatus.textContent = `Erro ao guardar: ${error.message}`;
            modalStatus.style.color = NEGATIVE_COLOR;
        } finally {
            modalSaveButton.disabled = false;
            modalSaveButton.textContent = 'Guardar';
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
        const prevButton = document.getElementById('prev-record'); // REMOVED
        const nextButton = document.getElementById('next-record'); // REMOVED
        const recordIndicator = document.getElementById('record-indicator'); // REMOVED
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
        const machine4x4Checkbox = document.getElementById('machine-4x4-checkbox'); // Add reference to checkbox
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
                machine: { id: null, nome: '', price: 0, originalPrice: 0 }, // Add originalPrice
                area: 1, margin: 0, currentPrice: 0, notes: ''
            };
        }
        resetCalculatorState(); // Initialize state
        
        let currentCalcRecordIndex = -1; // Still needed to track if editing or new

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
        // const updateCalcNavigation = () => { ... }; // REMOVED ENTIRE FUNCTION
        
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
            updateCalculations(); 
            // updateCalcNavigation(); // REMOVED Call
            console.log('[Calculator] Record loaded.');
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
             machine4x4Checkbox.checked = false; // Uncheck the checkbox
             calculatorState.machine = { id: null, nome: '', price: 0, originalPrice: 0 }; // Reset originalPrice
             if (triggerCalcUpdate) updateCalculations();
         };
         const clearForm = (updateNav = true) => { // updateNav parameter no longer needed but harmless
             console.log('[Calculator] Clearing form.');
             clearMaterialSection(1, false); clearMaterialSection(2, false); clearMaterialSection(3, false);
             clearMachineSection(false);
             marginInput.value = 0; currentPriceInput.value = '';
             if (notesTextarea) notesTextarea.value = '';
             resetCalculatorState(); // Reset the state object fully
             currentCalcRecordIndex = -1;
             // if (updateNav) updateCalcNavigation(); // REMOVED Call
             updateCalculations(); // Update display based on cleared state
             // Clear search input when clearing form for a new calculation
             searchInput.value = ''; 
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
                     const originalPrice = data.valor_m2 || 0;
                     const multiplier = machine4x4Checkbox.checked ? 2 : 1; // Check checkbox state
                     const effectivePrice = originalPrice * multiplier; // Calculate effective price
                     calculatorState.machine = { id: machineId, nome: data.maquina, price: effectivePrice, originalPrice: originalPrice }; // Store both prices
                     machinePrice.textContent = `${effectivePrice.toFixed(2)}€`; // Display effective price
                 } catch (error) { console.error('Error fetching machine price:', error); clearMachineSection(false); }
             } else { clearMachineSection(false); } // Clear section calls updateCalculations if triggerCalcUpdate is true
             // Ensure updateCalculations is called if needed, respecting triggerCalcUpdate
             if (triggerCalcUpdate) updateCalculations(); 
         };

        // --- Calculation Update ---
        const updateCalculations = () => {
             // Store notes and margin/current price from inputs
             calculatorState.notes = notesTextarea?.value || '';
             const margin = Number(marginInput.value) || 0;
             const currentPrice = parseFloat(currentPriceInput.value.replace(',', '.')) || 0;
             calculatorState.margin = margin;
             calculatorState.currentPrice = currentPrice;

             // Calculate costs based on state
             const materialsCostPerM2 = Object.values(calculatorState.materials).reduce((sum, mat) => sum + (Number(mat.price) || 0), 0);
             const area = 1; // Assuming area is always 1 for now
             calculatorState.area = area;

             // Machine cost already reflects the 4/4 doubling if applicable, as it's stored in calculatorState.machine.price
             const totalMaterialsCostValue = materialsCostPerM2 * area;
             const machineCostValue = (Number(calculatorState.machine.price) || 0) * area; // Use the (potentially doubled) price from state
             const netCostValue = totalMaterialsCostValue + machineCostValue;
             const finalPriceValue = netCostValue * (1 + margin / 100);

             // Update UI elements
             totalMaterialsCostEl.textContent = `${totalMaterialsCostValue.toFixed(2)}€`;
             totalMachineCostEl.textContent = `${machineCostValue.toFixed(2)}€`; // Display the (potentially doubled) machine cost
             totalNetCostEl.textContent = `${netCostValue.toFixed(2)}€`;
             finalPriceEl.textContent = `${finalPriceValue.toFixed(2)}€`;

             // Update price difference display
             if (currentPrice > 0) {
                 const diff = ((finalPriceValue - currentPrice) / currentPrice) * 100;
                 priceDifferenceEl.textContent = `${diff.toFixed(2)}%`;
                 priceDifferenceEl.className = `price-value-box ${diff > 0 ? 'positive-change' : diff < 0 ? 'negative-change' : ''}`;
             } else {
                 priceDifferenceEl.textContent = '0%';
                 priceDifferenceEl.className = 'price-value-box';
             }
         };

        // --- Event Listeners ---
        // Add listener for the 4x4 checkbox
        machine4x4Checkbox.addEventListener('change', () => {
            const originalPrice = calculatorState.machine.originalPrice || 0;
            const multiplier = machine4x4Checkbox.checked ? 2 : 1;
            const effectivePrice = originalPrice * multiplier;

            calculatorState.machine.price = effectivePrice; // Update state price
            machinePrice.textContent = `${effectivePrice.toFixed(2)}€`; // Update display price

            updateCalculations(); // Recalculate totals
        });

        // --- Save Calculation ---
        const saveCalculation = async () => {
             try {
                 if (!calculatorState.materials[1].id || !calculatorState.machine.id) { alert('Selecione Material 1 e Máquina.'); return; }
                 const calculationData = {
                     material1_id: calculatorState.materials[1].id, material1_tipo: calculatorState.materials[1].tipo, material1_material: calculatorState.materials[1].material, material1_caracteristica: calculatorState.materials[1].caracteristica, material1_cor: calculatorState.materials[1].cor, material1_valor_m2: calculatorState.materials[1].price,
                     material2_id: calculatorState.materials[2].id || null, material2_tipo: calculatorState.materials[2].tipo || null, material2_material: calculatorState.materials[2].material || null, material2_caracteristica: calculatorState.materials[2].caracteristica || null, material2_cor: calculatorState.materials[2].cor || null, material2_valor_m2: calculatorState.materials[2].price || null,
                     material3_id: calculatorState.materials[3].id || null, material3_tipo: calculatorState.materials[3].tipo || null, material3_material: calculatorState.materials[3].material || null, material3_caracteristica: calculatorState.materials[3].caracteristica || null, material3_cor: calculatorState.materials[3].cor || null, material3_valor_m2: calculatorState.materials[3].price || null,
                     maquina_id: calculatorState.machine.id, maquina_nome: calculatorState.machine.nome, maquina_valor_m2: calculatorState.machine.price,
                     metros_quadrados: calculatorState.area, margem_percentual: calculatorState.margin, preco_atual: calculatorState.currentPrice || null, notas: calculatorState.notes || '' // Ensure notas is at least an empty string
                 };

                // --- Append machine details to notes ---
                let machineNoteString = '';
                const machineName = calculatorState.machine.nome;
                const is4x4 = machine4x4Checkbox.checked;

                if (machineName === 'Sem impressão') {
                    machineNoteString = 'Sem Impressão';
                } else if (machineName === 'Mimaki') {
                    machineNoteString = is4x4 ? '4/4 cores solvente' : '4/0 cores solvente';
                } else if (machineName === 'Mimaki Branco') {
                    machineNoteString = '4+Branco cores UV';
                } else if (machineName === 'Inca' || machineName === 'Fuji') {
                    machineNoteString = is4x4 ? '4/4 cores UV' : '4/0 cores UV';
                }

                if (machineNoteString) {
                    if (calculationData.notas) { // Check if notes already has content
                        calculationData.notas += ", " + machineNoteString;
                    } else {
                        calculationData.notas = machineNoteString;
                    }
                }
                // Ensure notes is null if it ended up empty after logic
                if (!calculationData.notas) {
                    calculationData.notas = null;
                }
                // --- End Append --- 

                 saveButton.disabled = true; saveButton.textContent = 'Guardando...';
                 let existingRecordId = (currentCalcRecordIndex !== -1 && allCalculations[currentCalcRecordIndex]) ? allCalculations[currentCalcRecordIndex].calculation_id : null;
                 let savedData, error;
                 if (existingRecordId) { ({ data: savedData, error } = await supabase.from('calculadora_materiais').update(calculationData).eq('calculation_id', existingRecordId).select().single()); }
                 else { ({ data: savedData, error } = await supabase.from('calculadora_materiais').insert([calculationData]).select().single()); }
                 if (error) throw error;
                 console.log('Calculation saved:', savedData); alert('Cálculo guardado!');
                 await fetchAllCalculations();
                 const savedIndex = allCalculations.findIndex(c => c.calculation_id === savedData.calculation_id);
                 if (savedIndex !== -1) { 
                     // Instead of loading, just update the index if we were editing
                     currentCalcRecordIndex = savedIndex;
                     // Maybe update search input with ID?
                     searchInput.value = savedData.calculation_id;
                 } else { 
                     // If it was a new record, clear form to indicate readiness for another new one
                     clearForm(); 
                 }
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
        // nextButton.addEventListener('click', () => { ... }); // REMOVED LISTENER
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
            fetchAllCalculations().then(() => {
                // Success: Default to the "Novo" state now
                console.log('[Calculator] Starting in Novo state.');
                clearForm(true); // Start in Novo state
            }).catch(err => {
                // Error fetching:
                console.error("[Calculator] Initial fetch failed:", err);
                alert('Falha ao carregar cálculos iniciais.');
                clearForm(true); // Clear form on error
            });
        });

        sectionElement.classList.add('calculator-initialized');
        console.log('[Calculator] Initialized successfully.');

        // Add event listener for new calculation button
        document.getElementById('new-calculation').addEventListener('click', () => {
            clearForm(true); // Still needed to reset the form explicitly
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
        // Keep chart destruction
        // Object.keys(chartInstances).forEach(destroyChart);

        try {
            if (targetSection === 'maquinas') {
                // Always refresh maquinas data on switch
                await initializeMaquinasSection(); // Initializes if needed
                if (sectionElement.classList.contains('maquinas-initialized')) {
                     await populateMaquinaSelectAndFetchAll(); // Explicitly refresh if already initialized
                }
            } else if (targetSection === 'calculadora') {
                // Always refresh calculator data on switch
                if (!sectionElement.classList.contains('calculator-initialized')) {
                    initializeCalculator(); // Initializes if needed (calls fetchAllCalculations internally)
                } else {
                    console.log('Calculator already initialized. Refreshing data...');
                    await fetchAllCalculations(); // Explicitly refresh if already initialized
                    // updateCalcNavigation(); // REMOVED Call - Function no longer exists
                }
            } else { // Standard tables (including tabela_precos)
                 const config = TABLE_CONFIG[targetSection];
                 if (!config) {
                     console.error(`Config not found for standard section: ${targetSection}`); 
                     hideLoading(); 
                     return; 
                 }
                 
                 // --- Force data refresh by clearing cache --- 
                 console.log(`[switchSection] Clearing cache for ${targetSection} to force refresh.`);
                 delete tableDataCache[targetSection]; 
                 // -------------------------------------------

                 const data = await fetchData(targetSection); // fetchData will now always go to DB
                 
                 if (data) {
                     tableDataCache[targetSection] = data; // Re-cache the fresh data
                     
                     const currentFilterValue = filterState[targetSection]?.material || 'all';
                     
                     // Setup filters only if the table has a material column and a filter element exists
                     const hasMaterialColumn = config.columns.some(col => col.key === 'material');
                     const filterSelect = document.getElementById(`${targetSection}-filter`);
                     if (hasMaterialColumn && filterSelect) {
                         setupFilters(targetSection, data); // Setup dropdown options based on fresh data
                         filterSelect.value = currentFilterValue; // Re-apply existing filter selection if possible
                     }
                     
                     // Re-apply filter/sort/render with the fresh data
                     filterDataAndRender(targetSection); // Use the function that handles filter/search/render
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
                      // Destroy any lingering charts for this section if data fails
                      if (config.charts) config.charts.forEach(type => destroyChart(`${targetSection}-chart-${type}`));
                 }
            }
        } catch (error) {
             console.error(`Error loading section ${targetSection}:`, error);
             // Optionally display a general error message to the user
             alert(`Ocorreu um erro ao carregar a seção ${targetSection}. Tente novamente.`);
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
        
        // Determine the table name from the button's context
        const tableElement = button.closest('table');
        if (!tableElement || !tableElement.id) {
            console.error('Could not determine table from action button.');
            return;
        }
        const tableName = tableElement.id.replace('-table', '');
        const recordId = parseInt(id); // Or keep as string if PK is not integer

        if (button.classList.contains('edit-button')) {
            if (tableName === 'tabela_precos') {
                handleEditCalculation(recordId); // Keep specific handler for calculator
            } else {
                openModal(tableName, recordId); // Call openModal for generic edits
            }
        } else if (button.classList.contains('delete-button')) {
            if (tableName === 'tabela_precos') {
                handleDeleteRecord('calculadora_materiais', recordId); // Use DB table name
            } else {
                 handleDeleteRecord(tableName, recordId);
            }
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

    // --- Function to handle Deleting a Generic Record --- 
    const handleDeleteRecord = async (tableName, recordId) => {
        console.log(`[Delete] Request to delete record ID: ${recordId} from table: ${tableName}`);
        if (!tableName || !recordId) {
             console.error('[Delete] Table name or Record ID missing.');
             alert('Erro: Não foi possível identificar o registo a eliminar.');
             return;
        }

        // Use calculation_id for tabela_precos, otherwise assume 'id'
        const idColumn = tableName === 'tabela_precos' ? 'calculation_id' : 'id';

        if (confirm(`Tem a certeza que deseja eliminar o registo com ID ${recordId} da tabela ${tableName}? Esta ação não pode ser desfeita.`)) {
            console.log(`[Delete] Confirmed deletion for ID: ${recordId} from ${tableName}`);
            showLoading();
            try {
                const { error } = await supabase
                    .from(tableName) // Use the actual table name
                    .delete()
                    .eq(idColumn, recordId);

                if (error) throw error;

                console.log(`[Delete] Successfully deleted record ID: ${recordId} from ${tableName}`);
                alert('Registo eliminado com sucesso!');

                // Refresh the data for the current table
                delete tableDataCache[tableName]; // Clear cache for this table
                await fetchData(tableName); // Fetch fresh data
                filterDataAndRender(tableName); // Re-render with fresh data

                // Special case: if deleting from calculadora_materiais, also refresh calculator internal state
                if (tableName === 'calculadora_materiais') {
                     await fetchAllCalculations();
                }

            } catch (error) {
                console.error(`[Delete] Error deleting record ID ${recordId} from ${tableName}:`, error);
                alert(`Erro ao eliminar o registo: ${error.message}`);
            } finally {
                hideLoading();
            }
        } else {
            console.log(`[Delete] Deletion cancelled for ID: ${recordId} from ${tableName}`);
        }
    };

    // --- Function to handle Deleting a Calculation (OBSOLETE - Use handleDeleteRecord now) ---
    // const handleDeleteCalculation = async (calculationId) => { ... };

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
        renderCharts(tableName, filteredData); // Ensure charts are rendered after filtering/sorting
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

        // Add listener for the new Add buttons (delegated)
        mainContent.addEventListener('click', (event) => {
            const button = event.target.closest('.add-new-button');
            if (button) {
                 const tableName = button.dataset.table;
                 if (tableName) {
                     openModal(tableName); // Open modal for adding
                 } else {
                     console.warn('Add new button missing data-table attribute');
                 }
            }
        });
    } else {
        console.error("Could not find main content area to attach table action listener.");
    }

    // Add Modal Event Listeners
    if (modalCloseButton) modalCloseButton.addEventListener('click', closeModal);
    if (modalCancelButton) modalCancelButton.addEventListener('click', closeModal);
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (event) => {
            // Close if clicked directly on the overlay, not the content
            if (event.target === modalOverlay) {
                closeModal();
            }
        });
    }
    if (modalForm) modalForm.addEventListener('submit', handleSaveGenericRecord);

    // Ordenação das Tabelas
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('sort-indicator')) {
            const column = target.closest('th').dataset.column;
            handleSort(target.closest('table').id.replace('-table',''), column);
        }
    });

    // --- Functions for Generic Edit/Add Modal ---  <- REMOVE FROM HERE
    /* 
    const closeModal = () => { ... };

    const openModal = async (tableName, recordId = null) => { ... };
    
    const handleSaveGenericRecord = async (event) => { ... };
    */ // <- TO HERE

    // --- Test Function for Minimal Insert ---
    async function testInsert() {
      console.log('[TestInsert] Running test for \'cola\' table...');
      try {
        // Create a minimal record with only required fields
        const testRecord = {
          // Add the minimum required fields for your cola table
          // For example:
          tipo: 'Test Tipo',
          material: 'Test Material'
          // Do NOT include id
        };
        
        console.log('[TestInsert] Inserting record:', testRecord);
        const { data, error } = await supabase
          .from('cola')
          .insert([testRecord])
          .select(); // Add .select() to see what gets returned
          
        if (error) {
            console.error('[TestInsert] Insert error object:', error);
        } else {
            console.log('[TestInsert] Insert success. Result data:', data);
        }
      } catch (e) {
        console.error('[TestInsert] Test insert caught exception:', e);
      }
    }
    // You can call testInsert() from the console or temporarily attach it to a button for testing
    window.testInsert = testInsert; // Make it callable from console

    // --- Event Listener Setup ---
    // ... (event listeners for modal, sidebar, etc.) ...

}); // Fim do DOMContentLoaded