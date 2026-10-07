"""Test-only independent HarfBuzz oracle; no runtime provider/font installation."""
import ctypes as c
import ctypes.util
import json
import sys
import os


class Info(c.Structure):
    _fields_ = [(x, c.c_uint32) for x in ("codepoint", "mask", "cluster", "var1", "var2")]


class Position(c.Structure):
    _fields_ = [(x, c.c_int32) for x in ("x_advance", "y_advance", "x_offset", "y_offset", "var")]


hb = c.CDLL(ctypes.util.find_library("harfbuzz") or "libharfbuzz.so.0")


def api(name, returns, *args):
    fn = getattr(hb, name)
    fn.restype = returns
    fn.argtypes = list(args)
    return fn


ptr = c.c_void_p
blob_create = api("hb_blob_create", ptr, ptr, c.c_uint, c.c_int, ptr, ptr)
face_create = api("hb_face_create", ptr, ptr, c.c_uint)
face_upem = api("hb_face_get_upem", c.c_uint, ptr)
font_create = api("hb_font_create", ptr, ptr)
font_funcs = api("hb_ot_font_set_funcs", None, ptr)
buffer_create = api("hb_buffer_create", ptr)
buffer_add = api("hb_buffer_add_utf8", None, ptr, c.c_char_p, c.c_int, c.c_uint, c.c_int)
language_from_string=api("hb_language_from_string",ptr,c.c_char_p,c.c_int)
set_language=api("hb_buffer_set_language",None,ptr,ptr)
script_from_string=api("hb_script_from_string",c.c_uint,c.c_char_p,c.c_int)
set_script=api("hb_buffer_set_script",None,ptr,c.c_uint)
guess = api("hb_buffer_guess_segment_properties", None, ptr)
shape = api("hb_shape", None, ptr, ptr, ptr, c.c_uint)
infos = api("hb_buffer_get_glyph_infos", c.POINTER(Info), ptr, c.POINTER(c.c_uint))
positions = api("hb_buffer_get_glyph_positions", c.POINTER(Position), ptr, c.POINTER(c.c_uint))
version = api("hb_version_string", c.c_char_p)

font_bytes = c.create_string_buffer(open(sys.argv[1], "rb").read())
blob = blob_create(font_bytes, len(font_bytes) - 1, 0, None, None)  # duplicate trusted bytes
face = face_create(blob, 0)
units = face_upem(face)
font = font_create(face)
font_funcs(font)
result = []
for text in sys.argv[2:]:
    buf = buffer_create()
    encoded = text.encode("utf-8")
    buffer_add(buf, encoded, len(encoded), 0, len(encoded))
    guess(buf)
    if os.environ.get("TEST_HB_LANGUAGE"):
        language=os.environ["TEST_HB_LANGUAGE"].encode();set_language(buf,language_from_string(language,len(language)))
    if os.environ.get("TEST_HB_SCRIPT"):
        script=os.environ["TEST_HB_SCRIPT"].encode();set_script(buf,script_from_string(script,len(script)))
    shape(font, buf, None, 0)
    size = c.c_uint()
    glyphs = infos(buf, c.byref(size))
    pos = positions(buf, c.byref(size))
    result.append({"text": text, "glyphs": [
        {"id": glyphs[i].codepoint, "advance": pos[i].x_advance,
         "xOffset": pos[i].x_offset, "yOffset": pos[i].y_offset}
        for i in range(size.value)
    ]})
    api("hb_buffer_destroy", None, ptr)(buf)
for kind, value in (("font", font), ("face", face), ("blob", blob)):
    api("hb_" + kind + "_destroy", None, ptr)(value)
print(json.dumps({"engine": "HarfBuzz", "version": version().decode(), "unitsPerEm": units, "runs": result}, ensure_ascii=False))
