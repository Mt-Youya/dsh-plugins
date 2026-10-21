import json, os, re, sys

base = '.scratch/market-submission/'
p = base + 'Mt-Youya__dsh-plugins--plugins-context-insight.yml'
raw = open(p, encoding='utf-8').read()
body = [l for l in raw.split(chr(10)) if l != '']

fails = []
def check(name, cond):
    print(('PASS ' if cond else 'FAIL ') + name)
    if not cond:
        fails.append(name)

check('raw_ends_newline', raw.endswith(chr(10)))
check('no_tabs', chr(9) not in raw)
check('exactly_6_lines', len(body) == 6)
check('url_line', body[0] == 'url: https://github.com/Mt-Youya/dsh-plugins/tree/main/plugins/context-insight')
check('name_line', body[1] == 'name: Mt-Youya/dsh-plugins#context-insight')
check('category_line', body[2] == 'category: usage')
check('description_key', body[3] == 'description:')
check('en_quoted', re.match(r"^  en: '[^']+'$", body[4]) is not None)
check('zh_quoted', re.match(r"^  zh: '[^']+\u3002'$", body[5]) is not None)
# the real YAML rule: only the KEY separator may be unquoted
check('url_single_separator', body[0].count(': ') == 1)
check('name_single_separator', body[1].count(': ') == 1)
check('category_single_separator', body[2].count(': ') == 1)
check('quotes_balanced', all(l.count("'") % 2 == 0 for l in body))

en = body[4][body[4].index("'") + 1:-1]
zh = body[5][body[5].index("'") + 1:-1]
check('en_ends_period', en.endswith('.'))
check('zh_ends_period', zh.endswith(chr(0x3002)))
check('en_has_no_apostrophe', "'" not in en)
check('zh_has_no_apostrophe', "'" not in zh)
print('EN=', en)
print('ZH=', zh)

s = json.load(open(base + 'screenshots.json', encoding='utf-8'))
check('shots_1_to_8', 1 <= len(s) <= 8)
check('shots_relative_non_escaping', all(not x.startswith('/') and '..' not in x for x in s))
check('shots_exist_on_disk', all(os.path.isfile('plugins/context-insight/' + x) for x in s))

print('RESULT=', 'ALL_PASS' if not fails else 'FAILED: ' + ', '.join(fails))
sys.exit(0 if not fails else 2)
