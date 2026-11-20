"""Deterministic fixtures for the non-executing CS3 DEX host-ABI scanner."""
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from inspect_cs3_abi import InvalidCS3, analyze_cs3, analyze_dex


def fixture_dex():
    # Minimal structured DEX sections; the parser reads identifiers, not method code.
    strings = ['Lcom/lagradost/cloudstream3/MainAPI;', 'Lcom/example/StreamPlayPlugin;',
               'Ljava/lang/String;', 'V', 'search', 'load', 'available']
    string_ids_off = 112
    type_ids_off = string_ids_off + len(strings)*4
    proto_ids_off = type_ids_off + 4*4
    field_ids_off = proto_ids_off + 12
    method_ids_off = field_ids_off + 8
    class_defs_off = method_ids_off + 8
    params_off = class_defs_off + 32
    data = bytearray(params_off + 6)
    struct.pack_into('<I', data, params_off, 1)
    struct.pack_into('<H', data, params_off+4, 2)
    for i, idx in enumerate((0, 1, 2, 3)):
        struct.pack_into('<I', data, type_ids_off + 4*i, idx)
    struct.pack_into('<III', data, proto_ids_off, 3, 3, params_off)
    struct.pack_into('<HHI', data, field_ids_off, 0, 2, 6)
    struct.pack_into('<HHI', data, method_ids_off, 0, 0, 4)
    struct.pack_into('<I', data, class_defs_off, 1)
    for i, word in enumerate(strings):
        struct.pack_into('<I', data, string_ids_off+4*i, len(data))
        data.extend(bytes((len(word),)) + word.encode('utf-8') + b'\0')
    data[:8] = b'dex\n035\0'
    struct.pack_into('<I', data, 32, len(data))
    struct.pack_into('<I', data, 36, 112)
    struct.pack_into('<I', data, 40, 0x12345678)
    for off, count, table_off in ((56,len(strings),string_ids_off),(64,4,type_ids_off),
                                  (72,1,proto_ids_off),(80,1,field_ids_off),
                                  (88,1,method_ids_off),(96,1,class_defs_off)):
        struct.pack_into('<II',data,off,count,table_off)
    return bytes(data)


class Cs3AbiTests(unittest.TestCase):
    def test_exact_classes_methods_and_fields(self):
        d = analyze_dex(fixture_dex())
        self.assertEqual(d['classes'], ['Lcom/lagradost/cloudstream3/MainAPI;'])
        self.assertEqual(d['methods'], ['Lcom/lagradost/cloudstream3/MainAPI;->search(Ljava/lang/String;)V'])
        self.assertEqual(d['fields'], ['Lcom/lagradost/cloudstream3/MainAPI;->available:Ljava/lang/String;'])

    def test_corrupt_dex_rejected(self):
        dex = bytearray(fixture_dex())
        dex[40] = 0
        with self.assertRaises(InvalidCS3):
            analyze_dex(bytes(dex))
        dex = bytearray(fixture_dex())
        struct.pack_into('<I', dex, 92, 0xffffff00)
        with self.assertRaises(InvalidCS3):
            analyze_dex(bytes(dex))

    def test_archive_sha_and_manifest_gate(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'mock.cs3'
            with zipfile.ZipFile(target, 'w') as arc:
                arc.writestr('manifest.json', '{"pluginClassName":"com.example.StreamPlayPlugin"}')
                arc.writestr('classes.dex', fixture_dex())
            with self.assertRaisesRegex(InvalidCS3, 'SHA-256 mismatch'):
                analyze_cs3(target)
            report = analyze_cs3(target, None)
            self.assertFalse(report['executionVerified'])
            self.assertEqual(report['counts'], {'classes':1,'methods':1,'fields':1})
            self.assertEqual(report['dexFiles'], ['classes.dex'])

    def test_archive_path_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'bad.cs3'
            with zipfile.ZipFile(target, 'w') as arc:
                arc.writestr('manifest.json', '{}')
                arc.writestr('classes.dex', fixture_dex())
                arc.writestr('../outside', 'x')
            with self.assertRaisesRegex(InvalidCS3, 'Unsafe archive entry path'):
                analyze_cs3(target, None)


if __name__ == '__main__':
    unittest.main()
