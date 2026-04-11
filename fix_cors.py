import re

# 1. Modify Code.gs to handle doGet and doPost for API access
with open('Code.gs', 'r') as f:
    code = f.read()

doGet_api = """function doGet(e) {
  if (e && e.parameter && e.parameter.api === 'true') {
     if (e.parameter.action === 'getData') {
        const data = getData();
        return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
     }
     if (e.parameter.action === 'getDashboardData') {
        const data = getDashboardData(e.parameter.student, e.parameter.start, e.parameter.end, e.parameter.program);
        return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
     }
  }

  // Si no es API, carga la vista HTML normal
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('ALTUS - Registro Educativo y Terapéutico')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.action === 'saveSession') {
      const res = saveSession(payload.records);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
    if (payload.action === 'saveRecommendation') {
      const res = saveRecommendation(payload.student, payload.text, payload.supervisor);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
"""

# Replace the existing doGet
code = re.sub(r'function doGet\(\) \{[\s\S]*?\}', doGet_api, code)

# Make sure getData tries Base Terapéutica correctly
# In getData() we have:
new_thera = """  let theraSheet = ss.getSheetByName('Base_Terapeutica') 
                || ss.getSheetByName('Base Terapeutica') 
                || ss.getSheetByName('Base_Terapéutica')
                || ss.getSheetByName('Base Terapéutica');"""
code = re.sub(r"let theraSheet = ss\.getSheetByName\('Base_Terapeutica'\);\s+if \(!theraSheet\).*?if \(!theraSheet\).*?;", new_thera, code, flags=re.DOTALL)

with open('Code.gs', 'w') as f:
    f.write(code)

