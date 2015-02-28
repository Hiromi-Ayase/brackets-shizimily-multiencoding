# Shizimily Multiencoding for Brackets
An extension for [Brackets](https://github.com/adobe/brackets/) to read and write non UTF-8 encoding file.

### How to Install
1. Select **Brackets > File > Extension Manager...**
2. Search for this extension.
3. Click on the **Install** button.

### How to Use Extension
1. Bring non UTF-8 file on your computer.
2. Open it!
3. Edit it!
4. Save it!

### Supported encodings
Document is encoded and decoded by iconv-lite.
  
1. All node.js native encodings: utf8, ucs2 / utf16-le, ascii, binary, base64, hex.
2. Additional unicode encodings: utf16, utf16-be, utf-7, utf-7-imap.
3. All widespread singlebyte encodings: Windows 125x family, ISO-8859 family, IBM/DOS codepages, Macintosh family, KOI8 family, all others supported by iconv library. Aliases like 'latin1', 'us-ascii' also supported.
4. All widespread multibyte encodings: CP932, CP936, CP949, CP950, GB2313, GBK, GB18030, Big5, Shift_JIS, EUC-JP.

### License
MIT-licensed.

### Compatibility
Tested on Brackets Release 1.1.0 Windows.
