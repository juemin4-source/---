import os
h = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'map_report.html'), encoding='utf-8').read()
print('html len', len(h))
print('topo bar ok:', '4门 十字' in h)
print('room blocks:', h.count('class="room"'))
print('svg pairs:', h.count('<svg'), h.count('</svg>'))
print('ends with html:', h.rstrip().endswith('</html>'))
print('biome table rows:', h.count('<tr><td>'))
