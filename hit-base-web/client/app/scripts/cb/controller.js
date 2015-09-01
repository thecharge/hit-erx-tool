'use strict';

angular.module('cb')
    .controller('CBTestingCtrl', ['$scope', '$window', '$rootScope', 'CB', function ($scope, $window, $rootScope, CB) {

        $scope.getTestType = function () {
            return CB.testCase.type;
        };

        $scope.init = function () {
            $rootScope.setSubActive('/cb_testcase');
        };

        $scope.disabled = function () {
            return CB.testCase == null || CB.testCase.id === null;
        };

    }]);


angular.module('cb')
    .controller('CBExecutionCtrl', ['$scope', '$window', '$rootScope', function ($scope, $window, $rootScope) {
        $scope.loading = true;
        $scope.error = null;
        $scope.tabs = new Array();
        $scope.testCase = null;
        $scope.setActiveTab = function (value) {
            $scope.tabs[0] = false;
            $scope.tabs[1] = false;
            $scope.tabs[2] = false;
            $scope.tabs[3] = false;
            $scope.activeTab = value;
            $scope.tabs[$scope.activeTab] = true;
        };

        $scope.getTestType = function () {
            return $scope.testCase != null ? $scope.testCase.type : '';
        };

        $scope.init = function () {
            $scope.error = null;
            $scope.loading = false;
            $scope.setActiveTab(0);
            $rootScope.$on('cb:testCaseLoaded', function (event, testCase) {
                $rootScope.setSubActive('/cb_execution');
                $scope.testCase = testCase;
                $rootScope.$broadcast('cb:profileLoaded', $scope.testCase.testContext.profile);
                $rootScope.$broadcast('cb:valueSetLibraryLoaded', $scope.testCase.testContext.vocabularyLibrary);
            });
        };

    }]);


angular.module('cb')
    .controller('CBTestCaseCtrl', ['$scope', '$window', '$rootScope', 'CB', 'ngTreetableParams', '$timeout', 'CBTestCaseListLoader','$filter', function ($scope, $window, $rootScope, CB, ngTreetableParams, $timeout, CBTestCaseListLoader,$filter) {
        $scope.selectedTestCase = CB.selectedTestCase;
        $scope.testCase = CB.testCase;
        $scope.testCases = [];
        $scope.loading = true;
        $scope.error = null;

        $scope.createTreeStruct = function (obj) {
            if (obj.testCases) {
                if (!obj["children"]) {
                    obj["children"] = obj.testCases;
                } else {
                    angular.forEach(obj.testCases, function (testCase) {
                        obj["children"].push(testCase);
                        $scope.createTreeStruct(testCase);
                    });
                }
                obj["children"] = $filter('orderBy')(obj["children"], 'position');
                delete obj.testCases;
            }

            if (obj.testCaseGroups) {
                if (!obj["children"]) {
                    obj["children"] = obj.testCaseGroups;
                } else {
                    angular.forEach(obj.testCaseGroups, function (testCaseGroup) {
                        obj["children"].push(testCaseGroup);
                        $scope.createTreeStruct(testCaseGroup);
                    });
                }
                obj["children"] = $filter('orderBy')(obj["children"], 'position');
                delete obj.testCaseGroups;
            }

            if (obj.testSteps) {
                if (!obj["children"]) {
                    obj["children"] = obj.testSteps;
                } else {
                    angular.forEach(obj.testSteps, function (testStep) {
                        obj["children"].push(testStep);
                        $scope.createTreeStruct(testStep);
                    });
                }
                obj["children"] = $filter('orderBy')(obj["children"], 'position');
                delete obj.testSteps;
            }

            if (obj.children) {
                angular.forEach(obj.children, function (child) {
                    $scope.createTreeStruct(child);
                });
            }
        };

        $scope.init = function () {
            $scope.error = null;
            $scope.loading = true;


            $scope.params = new ngTreetableParams({
                getNodes: function (parent) {
                    return parent && parent != null ? parent.children : $scope.testCases;
                },
                getTemplate: function (node) {
                    if(node.type  === 'TestCase'){
                        return 'CBTestCase.html';
                    }else if(node.type === 'TestStep'){
                        return  'CBTestStep.html';
                    }else if(node.type === 'TestPlan' || node.type === 'TestCaseGroup'){
                        return  'CBTestPlanOrTestCaseGroup.html';
                    }
                }
            });

            var tcLoader = new CBTestCaseListLoader();
            tcLoader.then(function (testCases) {
                $scope.error = null;
                angular.forEach(testCases, function (testPlan) {
                    $scope.createTreeStruct(testPlan);
                });
                $scope.testCases = testCases;
                $scope.params.refresh();
                $scope.loading = false;
            }, function (error) {
                $scope.loading = false;
                $scope.error = "Sorry,cannot load the test cases. Please refresh your page and try again.";
            });
        };

        $scope.refreshEditor = function () {
            $timeout(function () {
                if ($scope.editor) {
                    $scope.editor.refresh();
                }
            }, 1000);
        };

        $scope.selectTestCase = function (node) {
            $scope.selectedTestCase = node;
            $rootScope.$broadcast('cb:testCaseSelected',$scope.selectedTestCase);
        };

        $scope.loadTestCase = function () {
            CB.testCase = $scope.selectedTestCase;
            $scope.testCase = CB.testCase;
            $rootScope.$broadcast('cb:testCaseLoaded', $scope.testCase);
        };


    }]);

angular.module('cb')
    .controller('CBProfileViewerCtrl', ['$scope', 'CB', function ($scope, CB) {
        $scope.cb = CB;
    }]);


angular.module('cb')
    .controller('CBValidatorCtrl', ['$scope', '$http', 'CB', '$window', 'HL7EditorUtils', 'HL7CursorUtils', '$timeout', 'HL7TreeUtils', '$modal', 'NewValidationResult', '$rootScope', 'MessageValidator', 'MessageParser', function ($scope, $http, CB, $window, HL7EditorUtils, HL7CursorUtils, $timeout, HL7TreeUtils, $modal, NewValidationResult, $rootScope, MessageValidator, MessageParser) {

        $scope.cb = CB;
        $scope.testCase = CB.testCase;
        $scope.message = CB.message;
        $scope.selectedMessage = {};
        $scope.loading = true;
        $scope.error = null;
        $scope.vError = null;
        $scope.vLoading = true;
        $scope.mError = null;
        $scope.mLoading = true;

        $scope.counter = 0;
        $scope.type = "cb";
        $scope.loadRate = 4000;
        $scope.tokenPromise = null;
        $scope.editorInit = false;
        $scope.nodelay = false;

        $scope.resized = false;
        $scope.selectedItem = null;
        $scope.activeTab = 0;

        $scope.messageObject = [];
        $scope.tError = null;
        $scope.tLoading = false;
        $scope.hasContent = function () {
            return  $scope.cb.message.content != '' && $scope.cb.message.content != null;
        };

        $scope.refreshEditor = function () {
            $timeout(function () {
                $scope.editor.refresh();
            }, 1000);
        };

        $scope.options = {
//            acceptFileTypes: /(\.|\/)(txt|text|hl7|json)$/i,
            paramName: 'file',
            formAcceptCharset: 'utf-8',
            autoUpload: true,
            type: 'POST'
        };

        $scope.$on('fileuploadadd', function (e, data) {
            if (data.autoUpload || (data.autoUpload !== false &&
                $(this).fileupload('option', 'autoUpload'))) {
                data.process().done(function () {
                    var fileName = data.files[0].name;
                    data.url = 'api/hl7/message/upload';
                    var jqXHR = data.submit()
                        .success(function (result, textStatus, jqXHR) {
                            $scope.nodelay = true;
                            var tmp = angular.fromJson(result);
                            $scope.cb.message.name = fileName;
                            $scope.cb.editor.instance.doc.setValue(tmp.content);
                            $scope.mError = null;
                            $scope.execute();
                        })
                        .error(function (jqXHR, textStatus, errorThrown) {
                            $scope.cb.message.name = fileName;
                            $scope.mError = 'Sorry, Cannot upload file: ' + fileName + ", Error: " + errorThrown;
                        })
                        .complete(function (result, textStatus, jqXHR) {

                        });
                });

            }
        });

        $scope.loadMessage = function () {
            var testCase = $scope.cb.testCase;
            var testContext = testCase.testContext;
            var message = $scope.cb.testCase.testContext.message;
            var messageContent = message ? message.content : null;
            if (testContext.message != null && messageContent != null && messageContent != "") {
                $scope.nodelay = true;
                $scope.selectedMessage = $scope.cb.testCase.testContext.message;
                if ($scope.selectedMessage != null  && $scope.selectedMessage.content != null) {
                    $scope.editor.doc.setValue($scope.selectedMessage.content);
                } else {
                    $scope.editor.doc.setValue('');
                    $scope.cb.message.id = null;
                    $scope.cb.message.name = '';
                }
                $scope.execute();
            }
        };

        $scope.setLoadRate = function (value) {
            $scope.loadRate = value;
        };

        $scope.initCodemirror = function () {
            $scope.editor = CodeMirror.fromTextArea(document.getElementById("cb-textarea"), {
                lineNumbers: true,
                fixedGutter: true,
                theme: "elegant",
                mode: 'edi',
                readOnly: false,
                showCursorWhenSelecting: true
            });
            $scope.editor.setSize("100%", 350);

            $scope.editor.on("keyup", function () {
                $timeout(function () {
                    var msg = $scope.editor.doc.getValue();
                    $scope.error = null;
                    if ($scope.tokenPromise) {
                        $timeout.cancel($scope.tokenPromise);
                        $scope.tokenPromise = undefined;
                    }
                    CB.message.name = null;
                    if (msg.trim() !== '') {
                        $scope.tokenPromise = $timeout(function () {
                            $scope.execute();
                        }, $scope.loadRate);
                    } else {
                        $scope.execute();
                    }
                });
            });

            $scope.editor.on("dblclick", function (editor) {
                $timeout(function () {
                    var coordinate = HL7CursorUtils.getCoordinate($scope.editor);
                    $scope.cb.cursor.init(coordinate.line, coordinate.startIndex, coordinate.endIndex, coordinate.index, true);
                    HL7TreeUtils.selectNodeByIndex($scope.cb.tree.root, CB.cursor, CB.message.content);
                });
            });

            $scope.cb.editor.instance = $scope.editor;

            $scope.refreshEditor();

        };

        /**
         * Validate the content of the editor
         */
        $scope.validateMessage = function () {
            $scope.vLoading = true;
            $scope.vError = null;
            if ($scope.cb.testCase != null && $scope.cb.message.content !== "") {
                try {
                    var validator = new MessageValidator().validate($scope.cb.testCase.testContext.id, $scope.cb.message.content, $scope.cb.testCase.label);
                    validator.then(function (mvResult) {
                        $scope.vLoading = false;
                        $scope.loadValidationResult(mvResult);
                    }, function (error) {
                        $scope.vLoading = false;
                        $scope.vError = error;
                        $scope.loadValidationResult(null);
                    });
                } catch (e) {
                    $scope.vLoading = false;
                    $scope.vError = e;
                    $scope.loadValidationResult(null);
                }
            } else {
                $scope.loadValidationResult(null);
                $scope.vLoading = false;
                $scope.vError = null;
            }
        };

        $scope.hideAllFailures = function () {
            $scope.validResultHighlither.hideAllFailures();
        };

        $scope.showFailures = function (type, event) {
            $scope.validResultHighlither.showFailures(type, event);
        };

        $scope.isVFailureChecked = function (type) {
            return $scope.failuresConfig[type].checked;
        };

        $scope.loadValidationResult = function (mvResult) {
            $rootScope.$broadcast('cb:validationResultLoaded', mvResult);
        };

        $scope.select = function (element) {
            if (element != undefined && element.path != null && element.line != -1) {
                var node = HL7TreeUtils.selectNodeByPath($scope.cb.tree.root, element.line, element.path);
                var data = node != null ? node.data : null;
                $scope.cb.cursor.init(data != null ? data.lineNumber : element.line, data != null ? data.startIndex - 1 : element.column - 1, data != null ? data.endIndex - 1 : element.column - 1, data != null ? data.startIndex - 1 : element.column - 1, false)
                HL7EditorUtils.select($scope.editor, $scope.cb.cursor);
            }
        };

        $scope.clearMessage = function () {
            $scope.nodelay = true;
            $scope.mError = null;
            if ($scope.editor) {
                $scope.editor.doc.setValue('');
                $scope.execute();
            }

        };

        $scope.saveMessage = function () {
            $scope.cb.message.download();
        };

        $scope.parseMessage = function () {
            $scope.tLoading = true;
            if ($scope.cb.testCase != null && $scope.cb.message.content != '') {
                var parsed = new MessageParser().parse($scope.cb.testCase.testContext.id, $scope.cb.message.content, $scope.cb.testCase.label);
                parsed.then(function (value) {
                    $scope.tLoading = false;
                    $scope.messageObject = value;
                }, function (error) {
                    $scope.tLoading = false;
                    $scope.tError = error;
                });
            } else {
                $scope.messageObject = [];
                $scope.tError = null;
                $scope.tLoading = false;
            }
        };

        $scope.onNodeSelect = function (node) {
            var index = HL7TreeUtils.getEndIndex(node, $scope.cb.message.content);
            $scope.cb.cursor.init(node.data.lineNumber, node.data.startIndex - 1, index - 1, node.data.startIndex - 1, false);
            HL7EditorUtils.select($scope.editor, $scope.cb.cursor);
        };

        $scope.execute = function () {
            $scope.error = null;
            $scope.tError = null;
            $scope.mError = null;
            $scope.vError = null;
            $scope.cb.message.content = $scope.editor.doc.getValue();
            $scope.validateMessage();
            $scope.parseMessage();
        };

        $scope.init = function () {
            $scope.vLoading = false;
            $scope.tLoading = false;
            $scope.mLoading = false;
            $scope.error = null;
            $scope.tError = null;
            $scope.mError = null;
            $scope.vError = null;

            $scope.initCodemirror();
            $scope.loadValidationResult(null);

            $scope.$on('cb:refreshEditor', function (event) {
                $scope.refreshEditor();
                event.preventDefault();
            });

            $rootScope.$on('cb:testCaseLoaded', function (event) {
                $scope.refreshEditor();
                $scope.testCase = $scope.cb.testCase;
                if ($scope.testCase != null) {
                    $scope.clearMessage();
                }
            });
        };

    }])
;


angular.module('cb')
    .controller('CBReportCtrl', ['$scope', '$sce', '$http', 'CB', function ($scope, $sce, $http, CB) {
        $scope.cb = CB;
    }]);

angular.module('cb')
    .controller('CBVocabularyCtrl', ['$scope', 'CB', function ($scope, CB) {
        $scope.cb = CB;
    }]);

