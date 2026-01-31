function doGet() {
  return HtmlService.createTemplateFromFile('FULL_INDEX').evaluate()
    .setTitle('ALTUS - Sistema de Gestión')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// YA NO USAMOS GOOGLE SHEETS. 
// TODA LA LÓGICA ESTÁ EN FULL_INDEX.html CONECTADO A SUPABASE.
