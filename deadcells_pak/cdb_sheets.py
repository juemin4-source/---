#!/usr/bin/env python3
"""Dump key Dead Cells data.cdb sheets (level generation / room / biome)."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'res_extracted/data.cdb'), encoding='utf-8'))

def dump_sheet(name, maxrows=60, cols=None):
    for s in d['sheets']:
        if s.get('name') == name:
            cols_list = s.get('columns', [])
            lines = s.get('lines', [])
            print('=' * 70)
            print('SHEET', name, '| columns:', cols_list)
            print('rows:', len(lines))
            for ln in lines[:maxrows]:
                if isinstance(ln, list):
                    row = ln
                else:
                    row = [ln]
                vals = []
                for i, c in enumerate(cols_list):
                    v = row[i] if i < len(row) else ''
                    if isinstance(v, dict):
                        v = json.dumps(v, ensure_ascii=False)
                    if len(str(v)) > 60:
                        v = str(v)[:60] + '…'
                    vals.append(str(v))
                print(' | '.join(vals))
            return s
    print('SHEET NOT FOUND', name)
    return None

if __name__ == '__main__':
    for nm in ['roomType', 'room', 'roomMarker', 'biome', 'layer', 'biome@layers', 'level']:
        dump_sheet(nm, maxrows=int(sys.argv[1]) if len(sys.argv) > 1 else 40)
