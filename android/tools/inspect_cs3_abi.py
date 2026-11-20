#!/usr/bin/env python3
"""Read a CS3 archive's referenced CloudStream DEX ABI without executing plugin code.

This inventory identifies classes, method descriptors and field descriptors that a
compatible host must provide. It is NOT evidence that a provider is executable.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile

STREAMPLAY_V715_SHA256 = '94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332'
MAX_ARCHIVE_BYTES = 48 * 1024 * 1024
MAX_EXPANDED_BYTES = 2 * MAX_ARCHIVE_BYTES
HOST_PREFIX = 'Lcom/lagradost/cloudstream3/'


class InvalidCS3(ValueError):
    pass


def u16(data, offset):
    if offset < 0 or offset + 2 > len(data):
        raise InvalidCS3('DEX offset outside file')
    return struct.unpack_from('<H', data, offset)[0]


def u32(data, offset):
    if offset < 0 or offset + 4 > len(data):
        raise InvalidCS3('DEX offset outside file')
    return struct.unpack_from('<I', data, offset)[0]


def table(data, count_offset, table_offset, width):
    count, offset = u32(data, count_offset), u32(data, table_offset)
    if count > (len(data) // width) or (count and (offset < 112 or offset + count * width > len(data))):
        raise InvalidCS3('Invalid DEX table range')
    return count, offset


def read_uleb128(data, start):
    value = 0
    for i in range(5):
        if start + i >= len(data):
            raise InvalidCS3('Truncated DEX string length')
        byte = data[start + i]
        value |= (byte & 0x7f) << (i * 7)
        if not byte & 0x80:
            return value, start + i + 1
    raise InvalidCS3('Invalid DEX string length')


def analyze_dex(data):
    if len(data) < 112 or not re.fullmatch(rb'dex\n0(?:3[5-9]|4[0-1])\x00', data[:8]):
        raise InvalidCS3('Invalid or unsupported DEX magic')
    if u32(data, 32) != len(data) or u32(data, 36) != 112 or u32(data, 40) != 0x12345678:
        raise InvalidCS3('Invalid DEX header size, byte count or byte order')

    string_count, string_offset = table(data, 56, 60, 4)
    type_count, type_offset = table(data, 64, 68, 4)
    proto_count, proto_offset = table(data, 72, 76, 12)
    field_count, field_offset = table(data, 80, 84, 8)
    method_count, method_offset = table(data, 88, 92, 8)
    class_count, class_offset = table(data, 96, 100, 32)

    strings = []
    for i in range(string_count):
        _, start = read_uleb128(data, u32(data, string_offset + 4*i))
        end = data.find(b'\0', start)
        if end < 0:
            raise InvalidCS3('Unterminated DEX string')
        # Java modified UTF-8 encodes NUL as c0 80. Class/method descriptors are ASCII.
        strings.append(data[start:end].replace(b'\xc0\x80', b'\x00').decode('utf-8', errors='replace'))

    def s(index):
        if index >= len(strings):
            raise InvalidCS3('Invalid DEX string index')
        return strings[index]

    types = [s(u32(data, type_offset + 4*i)) for i in range(type_count)]

    def typ(index):
        if index >= len(types):
            raise InvalidCS3('Invalid DEX type index')
        return types[index]

    prototypes = []
    for i in range(proto_count):
        offset = proto_offset + 12*i
        return_type, params_offset = u32(data, offset+4), u32(data, offset+8)
        params = []
        if params_offset:
            size = u32(data, params_offset)
            if size > (len(data) - params_offset - 4) // 2:
                raise InvalidCS3('Invalid DEX parameters')
            params = [typ(u16(data, params_offset+4+2*j)) for j in range(size)]
        prototypes.append('(' + ''.join(params) + ')' + typ(return_type))

    defined = {typ(u32(data, class_offset + i*32)) for i in range(class_count)}
    classes = {name for name in types if name.startswith(HOST_PREFIX) and name not in defined}
    methods = set()
    for i in range(method_count):
        offset = method_offset + i*8
        owner, proto, name = u16(data, offset), u16(data, offset+2), u32(data, offset+4)
        cls = typ(owner)
        if proto >= len(prototypes):
            raise InvalidCS3('Invalid DEX method prototype')
        method_name = s(name)
        if cls.startswith(HOST_PREFIX) and cls not in defined:
            methods.add(cls + '->' + method_name + prototypes[proto])
            classes.add(cls)

    fields = set()
    for i in range(field_count):
        offset = field_offset + i*8
        owner, type_idx, name = u16(data, offset), u16(data, offset+2), u32(data, offset+4)
        cls = typ(owner)
        if cls.startswith(HOST_PREFIX) and cls not in defined:
            fields.add(cls + '->' + s(name) + ':' + typ(type_idx))
            classes.add(cls)
    return {'classes': sorted(classes), 'methods': sorted(methods), 'fields': sorted(fields)}


def analyze_cs3(path, expected_sha256=STREAMPLAY_V715_SHA256):
    path = Path(path)
    if not path.is_file() or path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise InvalidCS3('Missing or oversized CS3 file')
    sha = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            sha.update(chunk)
    digest = sha.hexdigest()
    if expected_sha256 is not None and digest != expected_sha256.lower():
        raise InvalidCS3('CS3 SHA-256 mismatch: refusing to inventory a different binary')

    total = 0
    dex_files = []
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 256 or len({e.filename for e in entries}) != len(entries):
            raise InvalidCS3('Excessive or duplicate archive entries')
        if not {'manifest.json', 'classes.dex'} <= {e.filename for e in entries}:
            raise InvalidCS3('Missing CS3 manifest or classes.dex')
        for e in entries:
            name = e.filename
            if not name or name.startswith('/') or '\\' in name or any(ord(c) < 32 or ord(c) == 127 for c in name) or re.match(r'^[A-Za-z]:', name) or any(x in ('.', '..', '') for x in name.rstrip('/').split('/')):
                raise InvalidCS3('Unsafe archive entry path')
            total += e.file_size
            if e.file_size > MAX_ARCHIVE_BYTES or total > MAX_EXPANDED_BYTES:
                raise InvalidCS3('Oversized expanded CS3 content')
            if name == 'manifest.json' and e.file_size > 65536:
                raise InvalidCS3('Oversized CS3 manifest')
        manifest = json.loads(archive.read('manifest.json'))
        for name in sorted(e.filename for e in entries if re.fullmatch(r'classes(?:[2-9][0-9]*)?\.dex', e.filename)):
            dex_files.append((name, analyze_dex(archive.read(name))))

    if expected_sha256 == STREAMPLAY_V715_SHA256:
        if (manifest.get('pluginClassName') != 'com.phisher98.StreamPlayPlugin' or
                manifest.get('name') != 'StreamPlay' or manifest.get('version') != 715 or
                manifest.get('requiresResources') is not False):
            raise InvalidCS3('Pinned StreamPlay v715 manifest differs from verified metadata')
    result = {'sha256': digest, 'manifest': manifest, 'dexFiles': [name for name, _ in dex_files]}
    for key in ('classes', 'methods', 'fields'):
        result[key] = sorted({item for _, analysis in dex_files for item in analysis[key]})
    result['counts'] = {key: len(result[key]) for key in ('classes', 'methods', 'fields')}
    result['executionVerified'] = False
    return result


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('archive', type=Path, help='CS3 archive to inspect without executing code')
    cli.add_argument('--expected-sha256', default=STREAMPLAY_V715_SHA256,
                     help='expected digest (defaults to uploaded StreamPlay v715)')
    cli.add_argument('--output', type=Path, help='optional JSON inventory output')
    args = cli.parse_args()
    try:
        report = analyze_cs3(args.archive, args.expected_sha256)
        payload = json.dumps(report, indent=2, sort_keys=True) + '\n'
        if args.output:
            args.output.write_text(payload, encoding='utf-8')
        else:
            sys.stdout.write(payload)
    except (InvalidCS3, OSError, zipfile.BadZipFile, json.JSONDecodeError, RuntimeError) as error:
        cli.exit(2, f'CS3 ABI inventory failed: {error}\n')


if __name__ == '__main__':
    main()
