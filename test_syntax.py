import re
with open('index.html', 'r') as f:
    text = f.read()

scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
for i, s in enumerate(scripts):
    with open(f'script_{i}.js', 'w') as out:
        out.write(s)
