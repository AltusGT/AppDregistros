import re

# 1. Fix Code.gs
with open('/tmp/Code-old.gs', 'r') as f:
    code_gs = f.read()

# Make Code.gs serve index.html (it already does, but check if we need to modify)
with open('Code.gs', 'w') as f:
    f.write(code_gs)

# 2. Fix index.html
with open('index.html', 'r') as f:
    html = f.read()

# Remove Supabase script tags
html = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2"></script>\s*', '', html)
html = re.sub(r'<!-- Supabase Logic -->', '<!-- Google Apps Script Logic -->', html)
html = re.sub(r'// CONFIGURACIÓN SUPABASE[\s\S]*?(?=// State)', '', html)

# Replace loadInitialData
new_load_initial_data = """        function loadInitialData() {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((data) => {
                    // Extract contents from educational items if they have it, or just empty list as Code.gs doesn't send unique contents natively
                    data.contents = [];
                    populateFields(data);
                }).withFailureHandler(err => {
                    Swal.fire({ icon: 'error', title: 'Error', text: err.message });
                }).getData();
            } else {
                console.log('Running locally, mocking data');
            }
        }
"""
html = re.sub(r'async function loadInitialData\(\) \{[\s\S]*?function populateFields', new_load_initial_data + '\n        function populateFields', html, flags=re.DOTALL)

# Replace saveSession
new_save_session = """        function saveSession() {
            if (currentSession.length === 0) return;

            Swal.fire({
                title: 'Sincronizando...',
                text: 'Guardando datos en Google Sheets...',
                allowOutsideClick: false,
                background: '#fff',
                borderRadius: '1.5rem',
                didOpen: () => { Swal.showLoading(); }
            });

            // Combine contenido & ocp to avoid breaking Google Sheets column positions
            const recordsToSave = currentSession.map(r => {
                let finalOcp = r.ocp || '';
                if (r.contenido && r.contenido !== '-') {
                    finalOcp = r.contenido + ' - ' + finalOcp;
                }
                return { ...r, ocp: finalOcp };
            });

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((res) => {
                    Swal.fire({ icon: 'success', title: '¡Hecho!', text: 'Sesión guardada y sincronizada correctamente.', borderRadius: '1.5rem' });
                    currentSession = [];
                    renderTempTable();
                    sessionId = 'SES-' + Date.now();
                }).withFailureHandler((err) => {
                    Swal.fire({ icon: 'error', title: 'Error servidor', text: err.message, borderRadius: '1.5rem' });
                }).saveSession(recordsToSave);
            }
        }
"""
html = re.sub(r'async function saveSession\(\) \{[\s\S]*?function switchView', new_save_session + '\n        function switchView', html, flags=re.DOTALL)

# Replace updateDashboardFilter
new_update_dash = """        function updateDashboardFilter() {
            const student = document.getElementById('dash-student').value;
            const program = document.getElementById('dash-program').value;
            const start = document.getElementById('dash-start').value;
            const end = document.getElementById('dash-end').value;

            if (!student) return;
            Swal.showLoading();

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((res) => {
                    Swal.close();
                    if (res.error) {
                        Swal.fire('Error', res.error, 'error');
                        return;
                    }
                    const data = res.records;
                    
                    if (!data || data.length === 0) {
                        Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No se encontraron registros para este filtro.', timer: 2000, showConfirmButton: false });
                        chartInstance.data.labels = [];
                        chartInstance.data.datasets[0].data = [];
                        chartInstance.data.datasets[1].data = [];
                        chartInstance.update();
                        return;
                    }

                    // records format: [Timestamp, ID_Sesion, Fecha (C), Estudiante (D), Tipo (E), Grado (F), Materia (G), OCP (H), UAC (I), UAI (J)...]
                    const labels = data.map(r => {
                        const d = r[2] instanceof Date ? r[2] : new Date(r[2]);
                        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                    });

                    chartInstance.data.labels = labels;
                    chartInstance.data.datasets[0].data = data.map(r => parseFloat(r[8]) || 0); // UAC is col I (index 8)
                    chartInstance.data.datasets[1].data = data.map(r => parseFloat(r[9]) || 0); // UAI is col J (index 9)
                    chartInstance.update();

                    renderRecommendationsFromGS(res.recommendations);
                }).withFailureHandler((err) => {
                    Swal.fire('Error', err.message, 'error');
                }).getDashboardData(student, start, end, program);
            }
        }
        
        function renderRecommendationsFromGS(recs) {
            const list = document.getElementById('rec-list');
            list.innerHTML = '';
            if (!recs || recs.length === 0) {
                list.innerHTML = '<p class="text-xs text-center text-gray-400 py-8">Sin notas para este estudiante.</p>';
                return;
            }

            recs.forEach(r => {
                const li = document.createElement('li');
                li.className = 'bg-gray-50 p-4 rounded-2xl border-l-4 border-corp-primary shadow-sm';
                const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
                li.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[10px] font-black uppercase text-corp-primary">${r[2] || 'Supervisora'}</span>
                        <span class="text-[9px] text-gray-400">${d.toLocaleDateString()}</span>
                    </div>
                    <p class="text-sm font-medium text-gray-700">${r[3]}</p>
                `;
                list.appendChild(li);
            });
        }
"""
html = re.sub(r'async function updateDashboardFilter\(\) \{[\s\S]*?async function saveRecommendation\(\) \{', new_update_dash + '\n        function saveRecommendation() {', html, flags=re.DOTALL)

# Replace saveRecommendation
new_save_rec = """        function saveRecommendation() {
            const text = document.getElementById('recommendation-text').value;
            const student = document.getElementById('dash-student').value;
            const supervisor = document.getElementById('supervisor-name').value;

            if (!text || !student || !supervisor) {
                Swal.fire({ icon: 'warning', title: 'Faltan datos', text: 'Estudiante, Supervisora y Texto son obligatorios.' });
                return;
            }

            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler((res) => {
                    document.getElementById('recommendation-text').value = '';
                    Swal.fire({ icon: 'success', title: 'Nota Guardada', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                    // To refresh notes, we can trigger the dash update
                    updateDashboardFilter();
                }).saveRecommendation(student, text, supervisor);
            }
        }
"""
html = re.sub(r'function saveRecommendation\(\) \{[\s\S]*?</script>', new_save_rec + '    </script>', html)

# Fix the text in the HTML about Sincronización Supabase
html = html.replace('Sincronización con Supabase BD', 'Sincronización con Google Sheets')

with open('index.html', 'w') as f:
    f.write(html)
print("Done")
