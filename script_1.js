
        // State
        let studentsList = [];
        let educationalBase = [];
        let therapeuticBase = [];
        let currentSession = [];
        let sessionId = null;
        let chartInstance = null;

        document.addEventListener('DOMContentLoaded', init);

        function init() {
            // Fix: Use local date instead of UTC to avoid timezone issues
            const today = new Date().toLocaleDateString('en-CA'); 
            document.getElementById('fecha-sesion').value = today;
            sessionId = 'SES-' + Date.now();

            updateDateDisplay();
            loadInitialData();
            setupListeners();
            initDashboardDates();
        }

        function initDashboardDates() {
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);

            document.getElementById('dash-start').value = start.toISOString().split('T')[0];
            document.getElementById('dash-end').value = end.toISOString().split('T')[0];
        }

        function updateDateDisplay() {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateStr = new Date().toLocaleDateString('es-ES', options);
            document.getElementById('current-date-display').textContent = dateStr;
        }

                function loadInitialData() {
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

        function populateFields(data) {
            studentsList = data.students || [];
            educationalBase = data.educational || [];
            therapeuticBase = data.therapeutic || [];
            const contentsList = data.contents || [];

            const studentSelect = document.getElementById('estudiante');
            const dashStudent = document.getElementById('dash-student');

            studentSelect.innerHTML = '<option value="">Seleccione estudiante...</option>';
            dashStudent.innerHTML = '<option value="">Todos</option>';

            studentsList.forEach(s => {
                const opt = new Option(s, s);
                studentSelect.add(opt);
                dashStudent.add(opt.cloneNode(true));
            });

            // Populate Contenido Datalist
            const contenidoDatalist = document.getElementById('contenido-list');
            contenidoDatalist.innerHTML = '';
            contentsList.sort().forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                contenidoDatalist.appendChild(opt);
            });

            // Dash Programs
            const dashProg = document.getElementById('dash-program');
            dashProg.innerHTML = '<option value="">Todos</option>';
            const allPrograms = new Set([...educationalBase.map(e => e.materia), ...therapeuticBase.map(t => t.Programa || t.programa)]);
            [...allPrograms].sort().forEach(p => dashProg.add(new Option(p, p)));
        }

        function setupListeners() {
            document.getElementById('type-toggle').addEventListener('change', (e) => {
                const isTherapeutic = e.target.checked;
                const eduFields = document.getElementById('educational-fields');
                const therFields = document.getElementById('therapeutic-fields');

                if (isTherapeutic) {
                    eduFields.classList.add('hidden');
                    therFields.classList.remove('hidden');
                    loadTherapeuticPrograms();
                } else {
                    eduFields.classList.remove('hidden');
                    therFields.classList.add('hidden');
                }
            });

            document.getElementById('grado').addEventListener('change', updateOCP);
            document.getElementById('materia').addEventListener('change', updateOCP);
            document.getElementById('programa-terapeutico').addEventListener('input', updateOCPTerapeutico);
            document.getElementById('programa-terapeutico').addEventListener('change', updateOCPTerapeutico);
            document.getElementById('btn-add-temp').addEventListener('click', addToTemp);
            document.getElementById('btn-save-session').addEventListener('click', saveSession);
            document.getElementById('btn-verify-pin').addEventListener('click', verifyPin);
            document.getElementById('btn-update-dash').addEventListener('click', updateDashboardFilter);
            document.getElementById('btn-save-rec').addEventListener('click', saveRecommendation);

            // Mobile Sidebar Toggles
            const sidebar = document.getElementById('main-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            const toggle = document.getElementById('mobile-menu-toggle');

            const closeSidebar = () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            };

            toggle.addEventListener('click', () => {
                sidebar.classList.add('open');
                overlay.classList.add('active');
            });

            overlay.addEventListener('click', closeSidebar);

            // Close sidebar when clicking a link on mobile
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 1024) closeSidebar();
                });
            });

            // Handle Prog Ref Selectable Cards
            document.querySelectorAll('.prog-ref-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.prog-ref-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    document.getElementById('prog-ref').value = btn.dataset.value;
                });
            });
        }

        function loadTherapeuticPrograms() {
            const list = document.getElementById('programa-terapeutico-list');
            if (list.options.length > 0) return;
            
            // Get unique programs
            const programs = [...new Set(therapeuticBase.map(t => t.Programa || t.programa).filter(Boolean))].sort();
            programs.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                list.appendChild(opt);
            });
        }

        function updateOCPTerapeutico() {
            const program = document.getElementById('programa-terapeutico').value;
            const ocpInput = document.getElementById('ocp-terapeutico');
            const ocpList = document.getElementById('ocp-terapeutico-list');
            
            ocpList.innerHTML = '';
            ocpInput.value = '';

            if (!program) {
                ocpInput.disabled = true;
                ocpInput.placeholder = 'Primero seleccione programa';
                ocpInput.classList.add('opacity-50', 'border-dashed');
                return;
            }

            // Always enable to allow manual entry once program is selected
            ocpInput.disabled = false;
            ocpInput.placeholder = 'Escriba o seleccione criterio...';
            ocpInput.classList.remove('opacity-50', 'border-dashed');

            const matches = therapeuticBase.filter(t => (t.Programa || t.programa) === program);
            if (matches.length > 0) {
                matches.forEach(m => {
                    if (m.ocp) {
                        const opt = document.createElement('option');
                        opt.value = m.ocp;
                        ocpList.appendChild(opt);
                    }
                });
            }
        }

        function updateOCP() {
            const grado = document.getElementById('grado').value;
            const materia = document.getElementById('materia').value;
            const ocpInput = document.getElementById('ocp');
            const ocpList = document.getElementById('ocp-list');
            
            ocpList.innerHTML = '';
            ocpInput.value = '';

            if (!grado || !materia) {
                ocpInput.disabled = true;
                ocpInput.placeholder = 'Primero seleccione grado/materia';
                ocpInput.classList.add('opacity-50', 'border-dashed');
                return;
            }

            // Always enable to allow manual entry once grado/materia are selected
            ocpInput.disabled = false;
            ocpInput.placeholder = 'Escriba o seleccione criterio...';
            ocpInput.classList.remove('opacity-50', 'border-dashed');

            const matches = educationalBase.filter(item => item.grado === grado && item.materia === materia);
            if (matches.length > 0) {
                matches.forEach(m => {
                    if (m.ocp) {
                        const opt = document.createElement('option');
                        opt.value = m.ocp;
                        ocpList.appendChild(opt);
                    }
                });
            }
        }

        function addToTemp() {
            const isTherapeutic = document.getElementById('type-toggle').checked;
            const student = document.getElementById('estudiante').value;

            if (!student) {
                Swal.fire({ icon: 'warning', title: 'Falta información', text: 'Debe seleccionar un estudiante para registrar.' });
                return;
            }

            const record = {
                idSesion: sessionId,
                fechaSesion: document.getElementById('fecha-sesion').value,
                estudiante: student,
                tipoRegistro: isTherapeutic ? 'Terapéutico' : 'Educativo',
                grado: isTherapeutic ? '-' : document.getElementById('grado').value,
                materia: isTherapeutic ? document.getElementById('programa-terapeutico').value : document.getElementById('materia').value,
                contenido: isTherapeutic ? '-' : document.getElementById('contenido').value,
                ocp: isTherapeutic ? document.getElementById('ocp-terapeutico').value : document.getElementById('ocp').value,
                programaTerapeutico: isTherapeutic ? document.getElementById('programa-terapeutico').value : '',
                uac: document.getElementById('uac').value || 0,
                uai: document.getElementById('uai').value || 0,
                nivelAyuda: document.getElementById('nivel-ayuda').value,
                reforzador: document.getElementById('reforzador').value,
                programaReforzamiento: document.getElementById('prog-ref').value
            };

            if (isTherapeutic && !record.programaTerapeutico) {
                Swal.fire('Error', 'Seleccione programa terapéutico', 'error'); return;
            }
            if (isTherapeutic && !record.ocp) {
                Swal.fire('Error', 'Seleccione o escriba Criterio terapéutico', 'error'); return;
            }
            if (!isTherapeutic && (!record.grado || !record.materia)) {
                Swal.fire('Error', 'Seleccione grado y materia', 'error'); return;
            }
            if (!isTherapeutic && !record.ocp) {
                Swal.fire('Error', 'Seleccione o escriba Criterio (OCP)', 'error'); return;
            }

            currentSession.push(record);
            renderTempTable();

            // Clean inputs for next
            document.getElementById('uac').value = '';
            document.getElementById('uai').value = '';
            document.getElementById('contenido').value = '';

            // Animation feedback
            const btn = document.getElementById('btn-add-temp');
            btn.innerHTML = '<span>¡Agregado!</span>';
            setTimeout(() => {
                btn.innerHTML = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg><span>Añadir Registro</span>';
            }, 1000);
        }

        function renderTempTable() {
            const container = document.getElementById('temp-table-container');
            const emptyEl = document.getElementById('temp-table-empty');
            const saveArea = document.getElementById('save-session-area');
            const list = document.getElementById('temp-list');
            const countEl = document.getElementById('session-count');

            list.innerHTML = '';
            countEl.textContent = currentSession.length;

            if (currentSession.length === 0) {
                container.classList.add('hidden');
                saveArea.classList.add('hidden');
                emptyEl.classList.remove('hidden');
                return;
            }

            container.classList.remove('hidden');
            saveArea.classList.remove('hidden');
            emptyEl.classList.add('hidden');

            currentSession.forEach((r, idx) => {
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const detail = r.tipoRegistro === 'Educativo' ? `${r.materia} · ${r.contenido || ''} · ${r.ocp}` : r.materia;

                const item = `
                    <div class="bg-gray-50 border rounded-2xl p-4 flex items-center justify-between group animate__animated animate__fadeInRight">
                        <div class="flex-1 overflow-hidden">
                            <div class="flex items-center space-x-2 mb-1">
                                <span class="text-[10px] font-black uppercase text-gray-400">${time}</span>
                                <span class="w-1 h-1 bg-gray-300 rounded-full"></span>
                                <span class="text-[10px] font-black uppercase ${r.tipoRegistro === 'Educativo' ? 'text-corp-primary' : 'text-corp-secondary'}">${r.tipoRegistro}</span>
                            </div>
                            <h4 class="font-bold text-sm text-corp-text truncate" title="${detail}">${detail}</h4>
                            <p class="text-[10px] font-bold text-gray-400 italic">LOGRO: ${r.uac} / ${r.uai}</p>
                        </div>
                        <button onclick="removeRecord(${idx})" class="w-10 h-10 rounded-xl bg-white border text-gray-300 hover:text-corp-accent hover:border-corp-accent transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
                list.insertAdjacentHTML('afterbegin', item);
            });
        }

        function removeRecord(idx) {
            currentSession.splice(idx, 1);
            renderTempTable();
        }

                function saveSession() {
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

        function switchView(view) {
            const views = ['registros', 'dashboard'];
            views.forEach(v => {
                document.getElementById('view-' + v).classList.add('hidden');
                document.getElementById('nav-' + v).classList.remove('active');
            });

            document.getElementById('view-' + view).classList.remove('hidden');
            document.getElementById('nav-' + view).classList.add('active');

            const title = document.getElementById('view-title');
            const subtitle = document.getElementById('view-subtitle');

            if (view === 'registros') {
                title.textContent = 'Registros de Sesión';
                subtitle.textContent = 'Gestión académica y terapéutica';
            } else {
                title.textContent = 'Supervisión Clínica';
                subtitle.textContent = 'Análisis de evolución y logros';
            }
        }

        function verifyPin() {
            const pin = document.getElementById('pin-input').value;
            if (pin === '1234') {
                document.getElementById('pin-screen').classList.add('hidden');
                document.getElementById('dashboard-content').classList.remove('hidden');
                initChart();
            } else {
                Swal.fire('Error', 'PIN Incorrecto', 'error');
            }
            document.getElementById('pin-input').value = '';
        }

        function initChart() {
            const ctx = document.getElementById('evolutionChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'UAC', data: [], borderColor: '#385da9', backgroundColor: 'rgba(56, 93, 169, 0.1)', tension: 0.4, fill: false, pointRadius: 5 },
                        { label: 'UAI', data: [], borderColor: '#e5442a', backgroundColor: 'transparent', tension: 0.4, borderDash: [5, 5], pointRadius: 3 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f1f1' }, ticks: { font: { weight: 'bold' } } },
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                    }
                }
            });
        }

                function updateDashboardFilter() {
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

                function saveRecommendation() {
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
    