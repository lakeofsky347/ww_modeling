import re
STMT = re.compile(r'(?:const|export const)\s+(\w+)\s*=\s*(?:new\s+)?(\w+)\(\s*"([^"]+)"\s*,\s*\{', re.M)
def parse(text):
    lines = text.split('\n'); out = []
    for m in STMT.finditer(text):
        ln = text.count('\n', 0, m.start())
        # contiguous comment block directly above
        j = ln - 1; block = []
        while j >= 0 and (lines[j].strip().startswith(('//', '/*', '*')) or lines[j].strip().endswith('*/')):
            block.append(lines[j].strip()); j -= 1
        ph = any('PLACEHOLDER' in b for b in block)
        # find the object body up to matching paren
        depth = 0; i = m.end() - 1
        for i in range(m.end() - 1, len(text)):
            ch = text[i]
            if ch in '{([': depth += 1
            elif ch in '})]':
                depth -= 1
                if depth == 0: break
        body = text[m.end() - 1:i + 1]
        # top-level animFrames only (exclude nested bullets)
        top = re.sub(r'bullets:\s*\[.*?\]\s*(?=[,}])', '', body, flags=re.S)
        af = re.search(r'\banimFrames:\s*(\d+)', top)
        out.append({'const': m.group(1), 'fn': m.group(2), 'name': m.group(3), 'line': ln + 1, 'placeholder': ph,
                    'animFrames': int(af.group(1)) if af else None,
                    'node': (re.search(r'node:\s*Node\.(\w+)', top) or [None, None])[1],
                    'cast': (re.search(r'cast:\s*Cast\.(\w+)', top) or [None, None])[1]})
    return out
if __name__ == '__main__':
    import sys, glob
    for f in sys.argv[1:]:
        print('==', f)
        for r in parse(open(f).read()):
            if r['animFrames'] is not None: print(' ', r)
