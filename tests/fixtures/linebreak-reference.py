"""Test-only ICU strict line-break oracle, independent of runtime JS UAX library."""
import ctypes as c,ctypes.util,json,re,sys
name=ctypes.util.find_library('icui18n');lib=c.CDLL(name);suffix=re.search(r'\.so\.(\d+)',name)
def api(name,returns,*args):
 fn=getattr(lib,name+'_'+suffix.group(1) if suffix else name);fn.restype=returns;fn.argtypes=list(args);return fn
ptr=c.c_void_p;i=c.c_int32;u=c.c_uint16
opened=api('ubrk_open',ptr,i,c.c_char_p,c.POINTER(u),i,c.POINTER(i));first=api('ubrk_first',i,ptr);nxt=api('ubrk_next',i,ptr);close=api('ubrk_close',None,ptr)
version=(c.c_uint8*4)();api('u_getVersion',None,c.POINTER(c.c_uint8))(version)
runs=[]
for text in sys.argv[2:]:
 encoded=text.encode('utf-16-le');data=(u*(len(encoded)//2)).from_buffer_copy(encoded);err=i(0)
 iterator=opened(2,(sys.argv[1]+'@lb=strict').encode(),data,len(data),c.byref(err));assert err.value<=0 and iterator
 breaks=[];first(iterator)
 while True:
  at=nxt(iterator)
  if at==-1:break
  breaks.append(at)
 close(iterator);runs.append({'text':text,'breaks':breaks})
print(json.dumps({'engine':'ICU','version':'.'.join(map(str,version)),'runs':runs},ensure_ascii=False))
