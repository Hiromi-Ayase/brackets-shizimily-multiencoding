# Shizimily Multi-Encoding for Brackets
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

### Updates
[2015/03/02] 0.0.8 Added "Force" option to open the specified file forcibly

[2015/03/02] 0.0.7 Bug fix, tested on Brackets 1.2

[2015/03/02] 0.0.6 Bug fix;

[2015/03/01] 0.0.5 Bug fix;

[2015/03/01] 0.0.4 Bug fix;

[2015/03/01] 0.0.3 When the encoding is changed, the dialog to confirm to reload shows and many charsets are added.

[2015/03/01] 0.0.2 Encoding to save file select, bug fix

[2015/02/28] 0.0.1 First release

### License
MIT-licensed.

### Compatibility
Tested on Brackets Release 1.2.0 Windows.
