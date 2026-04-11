import re

with open('index.html', 'r') as f:
    html = f.read()

# Add SCRIPT_URL constant
script_url_code = """    <script>
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyQqFTFFUGkU10cUC9vXBlnq7xQ2FvyKZVE4TdNcGMIbpIpE8mL527NV34f-VlYgfwEDQ/exec";
"""
html = html.replace("    <script>", script_url_code, 1)

# Replace loadInitialData
new_load = """        async function loadInitialData() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((data) => {
                    try {
                        if (!data) throw new Error("Data from Google Sheets is null or undefined");
                        data.contents = [];
                        populateFields(data);
                    } catch (e) {
                        Swal.fire({ icon: 'error', title: 'Client Error', text: e.message });
                    }
                }).withFailureHandler(err => {
                    Swal.fire({ icon: 'error', title: 'Server Error', text: err.message || err.toString() });
                }).getData();
            } else {
                // FETCH FROM GITHUB PAGES
                try {
                    const res = await fetch(`${SCRIPT_URL}?api=true&action=getData`);
                    const data = await res.json();
                    data.contents = [];
                    populateFields(data);
                } catch(e) {
                    Swal.fire('Error', 'Error conectando al servidor Apps Script. Revisa que el enlace sea correcto y público.', 'error');
                }
            }
        }"""
html = re.sub(r'function loadInitialData\(\) \{[\s\S]*?\}\s*\}\s*function populateFields', new_load + '\n\n        function populateFields', html)

# Replace saveSession
new_save = """        async function saveSession() {
            if (currentSession.length === 0) return;

            Swal.fire({
                title: 'Sincronizando...',
                text: 'Guardando datos en Google Sheets...',
                allowOutsideClick: false,
                background: '#fff',
                borderRadius: '1.5rem',
                didOpen: () => { Swal.showLoading(); }
            });

            const recordsToSave = currentSession.map(r => {
                let finalOcp = r.ocp || '';
                if (r.contenido && r.contenido !== '-') {
                    finalOcp = r.contenido + ' - ' + finalOcp;
                }
                return { ...r, ocp: finalOcp };
            });

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((res) => {
                    Swal.fire({ icon: 'success', title: '¡Hecho!', text: 'Sesión guardada correctamente.', borderRadius: '1.5rem' });
                    currentSession = []; renderTempTable(); sessionId = 'SES-' + Date.now();
                }).withFailureHandler((err) => {
                    Swal.fire({ icon: 'error', title: 'Error', text: err.message, borderRadius: '1.5rem' });
                }).saveSession(recordsToSave);
            } else {
                try {
                    const res = await fetch(SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'saveSession', records: recordsToSave })
                    });
                    const d = await res.json();
                    if(d.error) throw new Error(d.error);
                    Swal.fire({ icon: 'success', title: '¡Hecho!', text: 'Sesión guardada correctamente.', borderRadius: '1.5rem' });
                    currentSession = []; renderTempTable(); sessionId = 'SES-' + Date.now();
                } catch(e) {
                    Swal.fire('Error', e.message, 'error');
                }
            }
        }"""
html = re.sub(r'function saveSession\(\) \{[\s\S]*?function switchView', new_save + '\n\n        function switchView', html)

# Replace updateDashboardFilter
new_dash = """        async function updateDashboardFilter() {
            const student = document.getElementById('dash-student').value;
            const program = document.getElementById('dash-program').value;
            const start = document.getElementById('dash-start').value;
            const end = document.getElementById('dash-end').value;

            if (!student) return;
            Swal.showLoading();

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler(res => handleDashboardRes(res))
                  .withFailureHandler(err => Swal.fire('Error', err.message, 'error'))
                  .getDashboardData(student, start, end, program);
            } else {
                try {
                    const url = `${SCRIPT_URL}?api=true&action=getDashboardData&student=${encodeURIComponent(student)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&program=${encodeURIComponent(program)}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    handleDashboardRes(data);
                } catch(e) {
                    Swal.fire('Error', e.message, 'error');
                }
            }
        }

        function handleDashboardRes(res) {
            Swal.close();
            if (res.error) return Swal.fire('Error', res.error, 'error');
            const data = res.records;
            if (!data || data.length === 0) {
                Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros', timer: 2000, showConfirmButton: false });
                chartInstance.data.labels = []; chartInstance.data.datasets[0].data = []; chartInstance.data.datasets[1].data = []; chartInstance.update();
                renderRecommendationsFromGS(res.recommendations);
                return;
            }
            chartInstance.data.labels = data.map(r => new Date(r[2]).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
            chartInstance.data.datasets[0].data = data.map(r => parseFloat(r[8]) || 0);
            chartInstance.data.datasets[1].data = data.map(r => parseFloat(r[9]) || 0);
            chartInstance.update();
            renderRecommendationsFromGS(res.recommendations);
        }"""
html = re.sub(r'function updateDashboardFilter\(\) \{[\s\S]*?function renderRecommendationsFromGS', new_dash + '\n\n        function renderRecommendationsFromGS', html)

# Replace saveRecommendation
new_rec = """        async function saveRecommendation() {
            const text = document.getElementById('recommendation-text').value;
            const student = document.getElementById('dash-student').value;
            const supervisor = document.getElementById('supervisor-name').value;
            if (!text || !student || !supervisor) return Swal.fire('Faltan datos', '', 'warning');

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler(() => {
                    document.getElementById('recommendation-text').value = '';
                    Swal.fire({ icon: 'success', title: 'Nota Guardada', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    updateDashboardFilter();
                }).saveRecommendation(student, text, supervisor);
            } else {
                try {
                    const res = await fetch(SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ action: 'saveRecommendation', student, text, supervisor })
                    });
                    document.getElementById('recommendation-text').value = '';
                    Swal.fire({ icon: 'success', title: 'Nota Guardada', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    updateDashboardFilter();
                } catch(e) { Swal.fire('Error', e.message, 'error'); }
            }
        }"""
html = re.sub(r'function saveRecommendation\(\) \{[\s\S]*?</script>', new_rec + '\n    </script>', html)

with open('index.html', 'w') as f:
    f.write(html)

