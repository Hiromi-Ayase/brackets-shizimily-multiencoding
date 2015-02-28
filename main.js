/*jslint vars: true, nomen: true, indent: 4 */
/*global define, brackets, console, $*/
define(function (require, exports, module) {
    "use strict";
    var File = brackets.getModule("filesystem/File"),
        FileSystemStats = brackets.getModule('filesystem/FileSystemStats'),
        FileSystemError = brackets.getModule('filesystem/FileSystemError'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        StatusBar = brackets.getModule('widgets/StatusBar'),
        EditorManager = brackets.getModule("editor/EditorManager");

    var modulePath = ExtensionUtils.getModulePath(module, 'node/shizimilyDomain'),
        nodeConnection = new NodeConnection();

    var ERROR_MESSAGE_UNSUPPORTED_ENCODING = 'UnsupportedEncoding',
        APPLICATION_NAME = 'ShizimiyMultiencoding';

    /**
     * Log the message to the console
     * @param {String} message The message
     */
    var log = function (message) {
        console.log("[" + APPLICATION_NAME + "] " + message);
    };

    /**
     * Create FileSystemStats object from data
     * @param   {String} path The file path
     * @param   {Object} stats data by the node command
     * @returns {Object} The FileSystemStats object
     */
    var stats2fsStats = function (path, stats) {
        var options = {
            isFile: true,
            mtime: stats.mtime,
            size: stats.size,
            realPath: path,
            hash: stats.hash
        };
        var fsStats = new FileSystemStats(options);
        fsStats._encoding = stats.encoding;
        return fsStats;
    };

    /**
     * Read a file with any encoding
     * @param {Object}   file     The the Brackets' original file object
     * @param {Function} callback The the Brackets' original read callback
     */
    var readFile = function (file, callback) {
        if (nodeConnection.domains && nodeConnection.domains.shizimily) {
            var path = file._path;
            var cmd = nodeConnection.domains.shizimily;
            cmd.getFileStats(path).done(function (stats) {
                var fsStats = stats2fsStats(path, stats);
                cmd.readFile(path, fsStats._encoding).done(function (data) {
                    file._hash = fsStats._hash;
                    file._encoding = fsStats._encoding;
                    if (file._isWatched()) {
                        file._stat = fsStats;
                        file._contents = data;
                    }
                    callback(null, data, fsStats);
                }).fail(function (err) {
                    log('Failed to read file - ' + err);
                    callback(ERROR_MESSAGE_UNSUPPORTED_ENCODING);
                });
            }).fail(function (err) {
                log('Failed to get stats - ' + err);
                callback(ERROR_MESSAGE_UNSUPPORTED_ENCODING);
            });
        }
    };

    /**
     * Write content to the file with any encoding
     * @param {Object}   file     The the Brackets' original file object
     * @param {String}   data     The content of the file
     * @param {Object}   options  The file write option
     * @param {Function} callback The the Brackets' original read callback
     */
    var writeFile = function (file, data, options, callback) {
        if (nodeConnection.domains && nodeConnection.domains.shizimily) {
            var path = file._path;
            var cmd = nodeConnection.domains.shizimily;

            var _finishWrite = function (created, stat) {
                cmd.writeFile(path, data, file._encoding).done(function (data) {
                    try {
                        if (created) {
                            var parent = file._fileSystem.getDirectoryForPath(file.parentPath);
                            file._fileSystem._handleDirectoryChange(parent, function (added, removed) {
                                callback(null, stat);
                            });
                        } else {
                            callback(null, stat);
                        }
                    } finally {
                        file._fileSystem._fireChangeEvent(file);
                        file._fileSystem._endChange();
                    }
                }).fail(function (err) {
                    callback(err);
                    log('Failed to write to the file - ' + err);
                });
            };

            cmd.getFileStats(path).done(function (stats) {
                var fsStats = stats2fsStats(path, stats);

                if (options.hasOwnProperty("expectedHash") && options.expectedHash !== fsStats._hash) {
                    callback(FileSystemError.CONTENTS_MODIFIED);
                } else {
                    _finishWrite(false, fsStats);
                }
            }).fail(function (err) {
                _finishWrite(true);
            });
        }
    };

    /**
     * Alternative read function of Brackets to hook the unsupported encoding error
     * @param {Object}   options  Original argument
     * @param {Function} callback Original argument
     */
    var alternativeReadFunc = function (options, callback) {
        if (typeof (options) === "function") {
            callback = options;
            options = {};
        } else {
            if (options === undefined) {
                options = {};
            }
            callback = callback || function () {};
        }
        var file = this;
        this.originalRead(options, function (err, data, stats) {
            if (err === ERROR_MESSAGE_UNSUPPORTED_ENCODING) {
                readFile(file, callback);
            } else {
                callback(err, data, stats);
            }
        });
    };

    /**
     * Alternative write function of Brackets to hook the unsupported encoding error
     * @param {String}   data     Original argument
     * @param {Object}   options  Original argument
     * @param {Function} callback Original argument
     */
    var alternativeWriteFunc = function (data, options, callback) {
        if (typeof (options) === "function") {
            callback = options;
            options = {};
        }
        if (this._encoding !== undefined) {
            if (!options.blind) {
                options.expectedHash = this._hash;
                options.expectedContents = this._contents;
            }
            writeFile(this, data, options, callback);
        } else {
            this.originalWrite(data, options, callback);
        }
    };

    /**
     * Active editor change handler
     * @param {Object} event     An event object
     * @param {Object} newEditor The editor object
     */
    var handleActiveEditorChange = function (event, newEditor) {
        var encoding = newEditor.document.file._encoding || 'UTF-8';
        $("#" + APPLICATION_NAME).text("Encode: " + encoding);
    };

    /**
     * Replace the read function to the alternative one
     */
    File.prototype.originalRead = File.prototype.read;
    File.prototype.read = alternativeReadFunc;
    File.prototype.originalWrite = File.prototype.write;
    File.prototype.write = alternativeWriteFunc;

    /**
     * Resigster the event hander to to the Editor
     */
    $(EditorManager).on("activeEditorChange", handleActiveEditorChange);

    /**
     * Show the current encoding
     */
    StatusBar.addIndicator(APPLICATION_NAME, $("<div id='" + APPLICATION_NAME + "'>Encode: (none)</div>"), true);

    /**
     * Connect to node
     */
    nodeConnection.connect(true).done(function () {
        nodeConnection.loadDomains([modulePath], true).done(function () {
            log("Successfully loaded");
        }).fail(function (err) {
            log("Failed to load domain : " + err);
        });
    }).fail(function (err) {
        log("Failed to establish a connection with Node : " + err);
    });
});
