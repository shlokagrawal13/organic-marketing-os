"""Pinned, verified test fonts only. Runtime fonts are administrator configured."""
from pathlib import Path
import argparse,hashlib,json,urllib.request
p=argparse.ArgumentParser();p.add_argument('--destination',default='.local/test-cjk-fonts');a=p.parse_args()
metadata=json.loads((Path(__file__).resolve().parents[1]/'tests/fixtures/cjk-fonts.json').read_text())
root=Path(a.destination);root.mkdir(parents=True,exist_ok=True)
base='https://raw.githubusercontent.com/notofonts/noto-cjk/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/OTF/'
for key,info in metadata.items():
 target=root/info['file'];url=base+info['region']+'/'+info['file']
 data=target.read_bytes() if target.exists() else b''
 if len(data)!=info['bytes'] or hashlib.sha256(data).hexdigest()!=info['sha256']:
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=60) as response:data=response.read(16*1024*1024+1)
    assert len(data)==info['bytes'] and hashlib.sha256(data).hexdigest()==info['sha256'],'Pinned CJK font hash/length mismatch'
    target.write_bytes(data);break
   except Exception:
    if attempt==2:raise
 print(json.dumps({'font':key,**info,'url':url,'verified':True}),flush=True)
