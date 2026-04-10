function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('ALTUS - Registro Educativo y Terapéutico')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

/**
 * Debug: Inspect Database Content
 */
function inspectDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registros');
  if (!sheet) return { error: 'No existe la hoja Registros' };
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { error: 'Hoja vacía (Solo cabeceras o nada)' };
  
  const headers = data[0];
  const rows = data.slice(1, 6).map(row => {
    return row.map(cell => {
      if (cell instanceof Date) return `[DATE] ${cell.toISOString()}`;
      return `[${typeof cell}] ${cell}`;
    });
  });
  
  const stats = {};
  data.slice(1).forEach(r => {
    const s = String(r[3] || 'Desconocido').trim();
    stats[s] = (stats[s] || 0) + 1;
  });
  
  return {
    totalRows: data.length,
    headers: headers,
    sampleRows: rows,
    stats: stats // New: { "Antonio Garcia": 5, ... }
  };
}

/**
 * Fetches data for dropdowns from Sheets.
 * Returns an object: { students: [], educational: [], therapeutic: [] }
 */
function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Get Students
  const studentsSheet = ss.getSheetByName('Estudiantes');
  let students = [];
  if (studentsSheet && studentsSheet.getLastRow() > 1) {
    students = studentsSheet.getRange(2, 1, studentsSheet.getLastRow() - 1, 1).getValues().flat().filter(String);
  }

  // Get Educational Base
  const eduSheet = ss.getSheetByName('Base_Educativa');
  // Grado (A), Materia (B), OCP (C)
  let educational = [];
  if (eduSheet && eduSheet.getLastRow() > 1) {
    const eduData = eduSheet.getRange(2, 1, eduSheet.getLastRow() - 1, 3).getValues().filter(row => row[0]);
    educational = eduData.map(row => ({
      grado: row[0],
      materia: row[1],
      ocp: row[2]
    }));
  }

  // Get Therapeutic Base - Try common variations
  let theraSheet = ss.getSheetByName('Base_Terapeutica');
  if (!theraSheet) theraSheet = ss.getSheetByName('Base Terapeutica');
  if (!theraSheet) theraSheet = ss.getSheetByName('Base_Terapéutica');
  
  let therapeutic = [];
  if (theraSheet && theraSheet.getLastRow() > 1) {
    // Get all values from Col A (Row 2 to End)
    // Using flat().filter(String) to remove empty rows
    therapeutic = theraSheet.getRange(2, 1, theraSheet.getLastRow() - 1, 1)
                  .getValues().flat()
                  .filter(cell => cell !== "" && cell !== null);
  }

  return {
    students: students,
    educational: educational,
    therapeutic: therapeutic
  };
}

/**
 * Saves a session (array of records) to the 'Registros' sheet.
 */
function saveSession(records) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Registros');
  if (!sheet) throw new Error('Hoja "Registros" no encontrada.');

  // "Registros": A: Marca Temporal, B: ID_Sesion, C: Fecha_Sesion, D: Estudiante, 
  // E: Tipo_Registro, F: Grado_Nivel, G: Materia_Programa, H: OCP, I: UAC, 
  // J: UAI, K: Nivel_Ayuda, L: Reforzador, M: Programa_Reforzamiento, N: Profesional.

  const timestamp = new Date();
  const rows = records.map(r => [
    timestamp,
    r.idSesion,
    r.fechaSesion, // Should be passed as string or date object
    r.estudiante,
    r.tipoRegistro, // 'Educativo' or 'Terapeutico'
    r.grado || '',
    r.materia || '', // Or Program Name if therapeutic? Requirement says G is Materia_Programa
    r.ocp || '',
    r.uac,
    r.uai,
    r.nivelAyuda,
    r.reforzador,
    r.programaReforzamiento,
    Session.getActiveUser().getEmail() // Profesional
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { success: true, message: 'Sesión guardada exitosamente.' };
}

/**
 * Gets data for the dashboard.
 */
function getDashboardData(studentName, startDateStr, endDateStr, program) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const regSheet = ss.getSheetByName('Registros');
    const recSheet = ss.getSheetByName('Recomendaciones');
    
    if (!regSheet) return { error: 'Hoja "Registros" no encontrada en el Google Sheet.' };

    const data = regSheet.getDataRange().getValues();
    if (data.length === 0) return { records: [], recommendations: [], totalRows: 0, debugStudents: [] };
    
    const headers = data.shift(); // Remove headers
    
    // Normalize inputs
    const targetStudent = studentName ? String(studentName).trim().toLowerCase() : "";
    const targetProgram = (program && program.toLowerCase() !== "todos") ? String(program).trim().toLowerCase() : "";
    
    // Get unique students for debugging
    const uniqueStudents = [...new Set(data.filter(r => r && r.length > 3).map(r => String(r[3]).trim()))];

    // Filter logic
    let filtered = data.filter(row => {
      if (!row || row.length < 4) return false;
      
      // Student Filter (Case Insensitive)
      if (targetStudent) {
        const rowStudent = String(row[3]).trim().toLowerCase();
        if (rowStudent !== targetStudent) return false;
      }
      
      // Program/Materia Filter (Case Insensitive)
      if (targetProgram) {
        if (row.length <= 6) return false;
        const rowProgram = String(row[6]).trim().toLowerCase();
        if (rowProgram !== targetProgram) return false;
      }
      
      // Date Filtering using String Comparison (YYYYMMDD) to avoid TimeZone hell
      // Row val could be Date object or String
      let rowDate = row[2];
      let rowDateStr = "";
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), "yyyyMMdd");
      } else if (typeof rowDate === 'string') {
         // Assuming format could be roughly parsed or user saves as YYYY-MM-DD
         // Try to parse to date first to standardize
         let d = new Date(rowDate);
         if (!isNaN(d.getTime())) {
           rowDateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyyMMdd");
         } else {
           // Fallback for raw strings if they match YYYY-MM-DD
           rowDateStr = rowDate.replace(/[^0-9]/g, "").substring(0,8);
         }
      }

      if (!rowDateStr || rowDateStr.length !== 8) return false;

      if (startDateStr) {
         // Input is YYYY-MM-DD
         const startStr = startDateStr.replace(/-/g, "");
         if (rowDateStr < startStr) return false;
      }

      if (endDateStr) {
         const endStr = endDateStr.replace(/-/g, "");
         if (rowDateStr > endStr) return false;
      }
      
      return true;
    });
    
    // Sort by Date (oldest first) using strings
    filtered.sort((a, b) => {
       // ... same sort logic but carefully ...
       const dA = new Date(a[2]); 
       const dB = new Date(b[2]);
       return dA - dB;
    });

    const recommendations = recSheet ? recSheet.getDataRange().getValues().slice(1)
        .filter(row => row && row.length > 1 && String(row[1]).trim() === targetStudent) : [];
        
    recommendations.sort((a, b) => new Date(b[0]) - new Date(a[0]));

    return {
      records: filtered, 
      recommendations: recommendations,
      totalRows: data.length, 
      filterStudent: targetStudent,
      debugStudents: uniqueStudents
    };
    
  } catch (e) {
    return { error: 'Error DETECTADO en Code.gs: ' + e.toString() + e.stack };
  }
}

/**
 * Saves a recommendation.
 */
function saveRecommendation(student, recommendation, supervisor) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Recomendaciones');
  if (!sheet) return { success: false, message: 'Hoja "Recomendaciones" no encontrada' };
  
  // Columns: A: Fecha, B: Estudiante, C: Supervisora, D: Recomendacion
  sheet.appendRow([
    new Date(), 
    student, 
    supervisor || Session.getActiveUser().getEmail(), 
    recommendation
  ]);
  return { success: true };
}
