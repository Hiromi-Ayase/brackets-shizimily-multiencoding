/*jslint vars: true, nomen: true, indent: 4 */
/*global define, brackets, console, $*/
define(function (require, exports, module) {
    "use strict";
    var File = brackets.getModule("filesystem/File"),
        FileSystemStats = brackets.getModule('filesystem/FileSystemStats'),
        FileSystemError = brackets.getModule('filesystem/FileSystemError'),
        NodeConnection = brackets.getModule('utils/NodeConnection'),
        ExtensionUtils = brackets.getModule('utils/ExtensionUtils'),
        FileUtils = brackets.getModule("file/FileUtils"),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        DefaultDialogs = brackets.getModule("widgets/DefaultDialogs"),
        StatusBar = brackets.getModule('widgets/StatusBar'),
        DropdownButton = brackets.getModule('widgets/DropdownButton'),
        EditorManager = brackets.getModule("editor/EditorManager");

    var modulePath = ExtensionUtils.getModulePath(module, 'node/shizimilyDomain'),
        selectorPath = ExtensionUtils.getModulePath(module, 'selector.html'),
        configPromise = ExtensionUtils.loadFile(module, 'config.json'),
        nodeConnection = new NodeConnection();

    var ERROR_MESSAGE_UNSUPPORTED_ENCODING = 'UnsupportedEncoding',
        APPLICATION_NAME = 'ShizimiyMultiencoding',
        DEFAULT_ENCODING = {
            read: 'UTF-8',
            write: 'UTF-8',
            auto: true
        };

    var firstQueue = [];
    var currentDocument = {};
    var force = false;

    /**
     * Log the message to the console
     * @param {String} message The message
     */
    var log = function (message) {
        console.log("[" + APPLICATION_NAME + "] " + message);
    };

    /**
     * Error Log the message to the console
     * @param {String} message The message
     */
    var errorLog = function (message) {
        console.error("[" + APPLICATION_NAME + "] " + message);
    };

    /**
     * Set the status bar text
     */
    var setStatusBarText = function () {
        var currentEncoding = "UTF-8";
        if (currentDocument.file !== undefined && currentDocument.file._encoding !== undefined) {
            currentEncoding = currentDocument.file._encoding.write;
        }
        $("#" + APPLICATION_NAME + " button").text("Encoding: " + currentEncoding);
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
            mtime: new Date(stats.mtime),
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
        var path = file._path;
        var cmd = nodeConnection.domains.shizimily;
        cmd.getFileStats(path).done(function (stats) {
            if (stats.encodingConfidence < 0.7) {
                if (!force) {
                    errorLog('Failed to read file - Cannot detect encoding: ' + stats.encodingConfidence * 100 + '%');
                    callback(ERROR_MESSAGE_UNSUPPORTED_ENCODING);
                    return;
                } else {
                    if (!stats.encoding) {
                        stats.encoding = "UTF-8";
                    }
                }
            }
            var fsStats = stats2fsStats(path, stats);
            var encoding;
            if (file._encoding.auto) {
                encoding = fsStats._encoding;
            } else {
                encoding = file._encoding.read;
            }
            cmd.readFile(path, encoding).done(function (data) {
                file._hash = fsStats._hash;
                file._encoding.read = encoding;
                file._encoding.write = encoding;
                if (file._isWatched()) {
                    file._stat = fsStats;
                    file._contents = data;
                }
                callback(null, data, fsStats);
                setStatusBarText();
            }).fail(function (err) {
                errorLog('Failed to read file - ' + err);
                callback(ERROR_MESSAGE_UNSUPPORTED_ENCODING);
            });
        }).fail(function (err) {
            errorLog('Failed to get stats - ' + err);
            callback(ERROR_MESSAGE_UNSUPPORTED_ENCODING);
        });
    };

    /**
     * Write content to the file with any encoding
     * @param {Object}   file     The the Brackets' original file object
     * @param {String}   data     The content of the file
     * @param {Object}   options  The file write option
     * @param {Function} callback The the Brackets' original read callback
     */
    var writeFile = function (file, data, options, callback) {
        var path = file._path;
        var cmd = nodeConnection.domains.shizimily;

        var _finishWrite = function (created, stat) {
            cmd.writeFile(path, data, file._encoding.write).done(function (data) {
                cmd.getFileStats(path).done(function (stat) {
                    stat = stats2fsStats(path, stat);
                    try {
                        file._hash = stat._hash;
                        if (file._isWatched()) {
                            file._stat = stat;
                            file._contents = data;
                        }
                        if (created) {
                            var parent = file._fileSystem.getDirectoryForPath(file.parentPath);
                            file._fileSystem._handleDirectoryChange(parent, function (added, removed) {
                                callback(null, stat);
                            });
                        } else {
                            callback(null, stat);
                        }
                    } finally {
                        file._encoding.read = file._encoding.write;
                    }
                });
            }).fail(function (err) {
                callback(err);
                errorLog('Failed to write to the file - ' + err);
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
    };

    /**
     * Alternative read function of Brackets to hook the unsupported encoding error
     * @param {Object}   options  Original argument
     * @param {Function} callback Original argument
     */
    var alternativeReadFunc = function (options, callback) {
        // If it is first call, the Shizimily domain is not prepared.
        if (!nodeConnection.domains || !nodeConnection.domains.shizimily) {
            firstQueue.push({"t": this, "options": options, "callback": callback});
        }

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
        if (file._encoding === undefined) {
            file._encoding = {
                read: DEFAULT_ENCODING.read,
                write: DEFAULT_ENCODING.write,
                auto: DEFAULT_ENCODING.auto
            };
        }

        if (file._contents && file._stat) {
            callback(null, file._contents, file._stat);
        } else if (file._encoding.auto) {
            this.originalRead(options, function (err, data, stats) {
                if (err === ERROR_MESSAGE_UNSUPPORTED_ENCODING) {
                    readFile(file, callback);
                } else if (err) {
                    callback(err);
                } else {
                    file._encoding.read = DEFAULT_ENCODING.read;
                    file._encoding.write = DEFAULT_ENCODING.write;
                    setStatusBarText();
                    callback(err, data, stats);
                }
            });
        } else {
            readFile(file, callback);
        }
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
        if (this._encoding === undefined) {
            this._encoding = {
                read: DEFAULT_ENCODING.read,
                write: DEFAULT_ENCODING.write,
                auto: DEFAULT_ENCODING.auto
            };
        }
        if (this._encoding.write !== DEFAULT_ENCODING.write) {
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
    var handleActiveEditorChange = function (event, editor) {
        if (editor) {
            currentDocument = editor.document;
            setStatusBarText();
        }
    };

    /**
     * Reload the current file
     * @param {String} message  Dialog message
     * @param {String} encoding Encoding
     */
    var reloadFile = function (message, encoding) {
        var dialog = Dialogs.showModalDialog(DefaultDialogs, "Reload?", message, [
            {
                className: Dialogs.DIALOG_BTN_CLASS_PRIMARY,
                id: Dialogs.DIALOG_BTN_OK,
                text: "OK"
            },
            {
                className: Dialogs.DIALOG_BTN_CLASS_NORMAL,
                id: Dialogs.DIALOG_BTN_CANCEL,
                text: "Cancel"
            }]);
        dialog.done(function (buttonId) {
            if (buttonId === Dialogs.DIALOG_BTN_OK) {
                currentDocument.file._encoding.auto = encoding === undefined;
                currentDocument.file._encoding.read = encoding;
                currentDocument.file._contents = null;
                FileUtils.readAsText(currentDocument.file)
                    .then(function (text) {
                        currentDocument.refreshText(text, new Date());
                    }).fail(function (err) {
                        console.errorLog("Error reloading contents of " + currentDocument.file.fullPath);
                        console.errorLog(err);
                    });
            }
        });
    };

    /**
     * Create the encodeing status dropdown button
     * @returns {Object} The dropdown button object
     */
    var createButton = function (encodings) {
        encodings.unshift("Force", "Auto", "---");
        var button = new DropdownButton.DropdownButton("Encoding:(none)", encodings, function (item, i) {
            var currentEncoding = currentDocument.file._encoding || DEFAULT_ENCODING,
                enabled = currentDocument.file._encoding !== undefined;
            var html;
            if (item === "---") {
                html = "---";
            } else if (item === "Force") {
                html = "Force to open";
                if (force) {
                    html = "<span class='checked-language'></span>" + html;
                }
            } else if (item === "Auto") {
                html = 'Auto Detect' + "<span class='default-language'>";
                if (currentEncoding.auto) {
                    html = "<span class='checked-language'></span>" + html;
                }
            } else {
                html = item.category + " (" + item.code + ")";
                if (item.code === currentEncoding.read) {
                    html = html + "<span class='default-language'>(Default)</span>";
                }
                if (item.code === currentEncoding.write) {
                    html = "<span class='checked-language'></span>" + html;
                }
            }
            return {
                html: html,
                enabled: enabled
            };
        });
        button.setChecked(2, true);
        button.dropdownExtraClasses = "dropdown-status-bar";
        button.on("select", function (e, encoding) {
            if (encoding === "Auto") {
                currentDocument.file._encoding.auto = !currentDocument.file._encoding.auto;
                if (currentDocument.file._encoding.auto) {
                    reloadFile("Reload the file? (Auto Detect encoding)");
                }
            } else if (encoding === "Force") {
                force = !force;
            } else {
                currentDocument.file._encoding.write = encoding.code;
                if (encoding.code !== currentDocument.file._encoding.read) {
                    reloadFile("Reload the file with new encodings? - " + encoding.code, encoding.code);
                }
            }
            setStatusBarText();
        });
        return button;
    };

    // init after load config
    configPromise.done(function (file) {
        var config = $.parseJSON(file);
        var button = createButton(config.encodings);
        /**
         * Resigster the event hander to to the Editor
         */
        $(EditorManager).on("activeEditorChange", handleActiveEditorChange);

        /**
         * Add dropdown button
         */
        var encodingMenu = $('<div id="' + APPLICATION_NAME + '"></div>').html(button.$button);
        $("button", encodingMenu).addClass("btn-status-bar");
        StatusBar.addIndicator(APPLICATION_NAME, encodingMenu, true);

        /**
         * Connect to node
         */
        nodeConnection.connect(true).done(function () {
            nodeConnection.loadDomains([modulePath], true).done(function () {
                log("Successfully loaded");
                // Load the file after the Shizimily domain is loaded.
                $.each(firstQueue, function (i, q) {
                    alternativeReadFunc.bind(q.t)(q.options, q.callback);
                });
            }).fail(function (err) {
                errorLog("Failed to load domain : " + err);
            });
        }).fail(function (err) {
            errorLog("Failed to establish a connection with Node : " + err);
        });

        /**
         * Replace the read function to the alternative one
         */
        File.prototype.originalRead = File.prototype.read;
        File.prototype.read = alternativeReadFunc;
        File.prototype.originalWrite = File.prototype.write;
        File.prototype.write = alternativeWriteFunc;
    });
});
