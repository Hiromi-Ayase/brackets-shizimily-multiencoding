/*jslint vars: true*/
/*global require, exports*/
(function () {
    'use strict';

    var fs = require('fs'),
        iconv = require('iconv-lite'),
        jschardet = require('jschardet'),
        path = require('path');

    /**
     * The node command to get the file stat
     * @param   {String} filePath The file path
     * @returns {Object} The file stats
     */

    var cmdGetFileStats = function (filePath) {
        if (fs.existsSync(filePath)) {
            var encoding = jschardet.detect(fs.readFileSync(filePath));
            var stats = fs.statSync(filePath);
            stats.encoding = encoding.encoding;
            stats.encodingConfidence = encoding.confidence;
            stats.name = path.basename(filePath);
            stats.path = filePath;
            stats.hash = stats.mtime.getTime();
            return stats;
        }
        throw new Error('Invalid file path');
    };

    /**
     * The node command to read the file
     * @param   {String} filePath The file path
     * @param   {String} encoding The encoding of the file
     * @returns {String} The content of the file
     */
    var cmdReadFile = function (filePath, encoding) {
        var data = fs.readFileSync(filePath);
        var str_dec = iconv.decode(data, encoding).toString();
        return str_dec;
    };

    /**
     * The node command to write the file
     * @param   {String} filePath The file path
     * @param   {String} data     The content of the file
     * @param   {String} encoding The encoding of the file
     * @returns {Number} The count of written byte
     */
    var cmdWriteFile = function (filePath, data, encoding) {
        var str_enc = iconv.encode(data, encoding);
        var count = fs.writeFileSync(filePath, str_enc);
        return count;
    };

    /**
     * The initialize function of node commands
     * @param {Object} DomainManager The domain manager
     */
    var init = function (DomainManager) {
        var domainName;
        domainName = 'shizimily';
        if (!DomainManager.hasDomain(domainName)) {
            DomainManager.registerDomain(domainName, {
                major: 0,
                minor: 1
            });
        }
        DomainManager.registerCommand(domainName, 'getFileStats', cmdGetFileStats, false, 'Return encoding file info', [{
            name: "filePath",
            type: "string",
            description: "The target file path"
        }], [{
            name: "fileInfo",
            type: "object",
            description: "The file information"
        }]);
        DomainManager.registerCommand(domainName, 'writeFile', cmdWriteFile, false, 'Write the file with the specified encoding', [{
            name: "filePath",
            type: "string",
            description: "The target file path"
        }, {
            name: "data",
            type: "string",
            description: "The content of file"
        }, {
            name: "encoding",
            type: "string",
            description: "The encoding of target file"
        }], [{
            name: "count",
            type: "number",
            description: "File written count"
        }]);
        DomainManager.registerCommand(domainName, 'readFile', cmdReadFile, false, 'Read the file with the specified encoding', [{
            name: "filePath",
            type: "string",
            description: "The target file path"
        }, {
            name: "encoding",
            type: "string",
            description: "The encoding of target file"
        }], [{
            name: "content",
            type: "string",
            description: "The content of file"
        }]);
    };
    exports.init = init;
}());
