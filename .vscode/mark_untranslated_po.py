#!/usr/bin/env python3
"""
Script to mark untranslated and fuzzy entries in Django .po files.
Adds '# UNTRANSLATED:' or '# FUZZY:' comments before entries that need attention.
"""
import re
import sys
from pathlib import Path

def mark_untranslated_entries(po_file_path):
    """Mark untranslated and fuzzy entries in a .po file."""
    po_file = Path(po_file_path)
    
    if not po_file.exists():
        print(f"❌ Error: File not found: {po_file_path}")
        return False
    
    with open(po_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Track which lines need markers
    untranslated_line_indices = []
    fuzzy_line_indices = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this is the start of a new entry (has #: comment)
        if line.startswith('#: '):
            source_line = i
            
            # Check for fuzzy flag
            is_fuzzy = False
            j = i
            while j < len(lines) and (lines[j].startswith('#') or lines[j].strip() == ''):
                if '#, fuzzy' in lines[j]:
                    is_fuzzy = True
                    break
                j += 1
            
            # Find msgid and msgstr
            msgid_start = None
            msgstr_start = None
            j = i
            while j < len(lines) and not (j > i and lines[j].startswith('#: ')):
                if lines[j].startswith('msgid '):
                    msgid_start = j
                elif lines[j].startswith('msgstr '):
                    msgstr_start = j
                    break
                j += 1
            
            if msgid_start is not None and msgstr_start is not None:
                # Check if msgstr is empty
                msgstr_line = lines[msgstr_start].strip()
                if msgstr_line == 'msgstr ""':
                    # Check if there are more quoted lines (multiline translation)
                    has_content = False
                    k = msgstr_start + 1
                    while k < len(lines) and lines[k].startswith('"'):
                        if lines[k].strip() not in ['""', '']:
                            has_content = True
                            break
                        k += 1
                    
                    # Check if next non-empty line is a new entry
                    if not has_content:
                        # Check if next line is blank or starts with #:
                        next_non_empty = msgstr_start + 1
                        while next_non_empty < len(lines) and lines[next_non_empty].strip() == '':
                            next_non_empty += 1
                        
                        if next_non_empty >= len(lines) or lines[next_non_empty].startswith('#:') or lines[next_non_empty].startswith('#~'):
                            # This is truly untranslated
                            if is_fuzzy:
                                fuzzy_line_indices.append(source_line)
                            else:
                                untranslated_line_indices.append(source_line)
        
        i += 1
    
    # Build final lines, removing existing markers and adding new ones
    final_lines = []
    i = 0
    skip_next = False
    
    while i < len(lines):
        # Skip existing markers
        if lines[i].startswith('# UNTRANSLATED:') or lines[i].startswith('# FUZZY:'):
            i += 1
            continue
        
        # If this is a line that needs a marker, add it
        if i in untranslated_line_indices:
            final_lines.append('# UNTRANSLATED: Needs German translation')
            final_lines.append(lines[i])
        elif i in fuzzy_line_indices:
            final_lines.append('# FUZZY: Needs review/update')
            final_lines.append(lines[i])
        else:
            final_lines.append(lines[i])
        
        i += 1
    
    # Write back to file
    with open(po_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(final_lines))
    
    print(f"✅ Added markers to {len(untranslated_line_indices)} untranslated entries")
    print(f"✅ Added markers to {len(fuzzy_line_indices)} fuzzy entries")
    print(f"\nYou can now search for '# UNTRANSLATED:' or '# FUZZY:' to find them easily!")
    
    return True


if __name__ == '__main__':
    # Default path to German .po file
    default_po_file = Path(__file__).parent.parent / 'backend' / 'locale' / 'de' / 'LC_MESSAGES' / 'django.po'
    
    # Allow custom path as command line argument
    po_file_path = sys.argv[1] if len(sys.argv) > 1 else str(default_po_file)
    
    success = mark_untranslated_entries(po_file_path)
    sys.exit(0 if success else 1)
