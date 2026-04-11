import re
with open('index.html', 'r') as f:
    html = f.read()

new_load = """        function loadInitialData() {
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
                console.log('Running locally, mocking data');
            }
        }"""
html = re.sub(r'function loadInitialData\(\) \{[\s\S]*?function populateFields', new_load + '\n\n        function populateFields', html, flags=re.DOTALL)

with open('index.html', 'w') as f:
    f.write(html)
