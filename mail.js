//Global Base URL, needs to be used for dynamic URLs.
var baseUrl = _spPageContextInfo.webAbsoluteUrl;

var EMAIL_FROM_SYSTEM = "SharePointSystem@commerzbank.com";

var IS_TEST = baseUrl.indexOf("training") > -1; // has to changed to DYNAMIC

var SEND_EMAIL = true; // if true, email sending is ENABLED
var TEST_RULES = null; // null >>> uses the selected recipients rules | "UM-T01 UM-T02"; // "UM-OV1"; // "UM-T01 UM-T02";

var DEBUG = IS_TEST ? true : getValByKey(window.location, "mode") === "debug"; // if true, console.log output is enabled

// if null, then current user email is used
var email_1 = null; // "BetriebsratZentraleFrankfurt@commerzbank.com"; // "payroll@ceri.pl; Bert.Wiegand@commerzbank.com"; // "Ota.Vaclavik@commerzbank.com"; // "Dirk.Tomaschek@commerzbank.com" //  "Oskar.Naumann@commerzbank.com;"
// always send a CC to the user who clicked the button for email distribution
var currentUserEmail = null;
// email which contains rules for forwarding to destination group emails based on forward string
var distributionEmail = "NoReplyGSOSGCS@commerzbank.com";

var mailToBetriebsarzt = false;
var mailToIntern = false;
var mailToSchwerBehinVertr = false;
var ausdruckVBG = false;
var ausdruckASB = false;
var bsgMitarbeiteremail = "";
var targetListItem = null;

var itemId = null;

// we need to call some function from fncViewSendEmailDialog.js

function MailJs() {
    var that = this;

    that.generateHtml = function (_disabledStatus, _linkToItemEditMode, _userObj, _recordObj) {
        var disabledStatus = IstUndefiniert(_disabledStatus) ? false : _disabledStatus;
        // var showDisabledStatus = !IstUndefiniert(_disabledStatus);
        var linkToItemEditMode = IstUndefiniert(_linkToItemEditMode) ? null : _linkToItemEditMode;
        var userObj = IstUndefiniert(_userObj) ? null : _userObj;
        // var recordObj = IstUndefiniert(_recordObj) ? null : _recordObj; // for IS_TEST

        var sHtml = "";
        sHtml += "<div style='text-align: left;'>";
        sHtml += "<div style='display: inline-block;'>";
        sHtml += "<button type='button' id='MailIntern' " + disabledStatus + " >✉️ Versand INTERN</button>"
        sHtml += "<button type='button' id='MailBetriebsarzt' " + disabledStatus + " >✉️ Versand an Betriebsarzt</button>"

        if (linkToItemEditMode !== null) {
            // MessageBox
            sHtml += "<a style='padding-left: 10px;' href='" + linkToItemEditMode + "'>🖊️ Datensatz bearbeiten</a>"
        }

        // different text due to IE11 vs EDGE functionality - see IE11 comment later in code
        var tooltipPdf = typeof navigator.msSaveOrOpenBlob !== 'undefined' ?
            "Erzeugen eines pdf-Dokumentes" : "Nach Öffnen des pdf-Dokumentes können sie mit der Tastenkombination STRG-S das Dokument speichern bzw. mit STRG-P drucken.";

        sHtml += "<div style='padding: 5px'></div>"
        sHtml += "<button type='button' title='" + tooltipPdf + "' id='ausdruckVBG' " + disabledStatus + " >📋 Ausdruck für papierhaften Versand VBG</button>"
        sHtml += "<button type='button' title='" + tooltipPdf + "' id='ausdruckASB' " + disabledStatus + " >📋 Ausdruck für papierhaften Versand Arbeitsschutzbehörde</button>"
        sHtml += "</div>";


        sHtml += "<div style='padding: 10px; font-size: 12px; color: #00414b'>";
        sHtml += "<b>Versand INTERN:</b> Immer erforderlich<br />";
        sHtml += "<b>Versand an Betriebsarzt und VBG:</b> Zusätzlich erforderlich bei erwarteter oder tatsächlicher Arbeitsunfähigkeit ab 4 Tagen<br />	";
        sHtml += "<b>Versand Arbeitsschutzbehörde:</b> Entfällt bei Dienstsitz im Ausland! Nur erforderlich bei Arbeitsunfällen (nicht Wegeunfälle) mit erwarteter oder tatsächlicher Arbeitsunfähigkeit ab 4 Tagen";
        sHtml += "</div>";
        // DEBUG and TEST messages
        if (DEBUG || IS_TEST) {
            sHtml += "<div id='IS_TEST_holder' style='border: solid red 1px; margin: 0 0 5px 0; padding: 5px; height: 50px; color: red'></div>";
        }

        if (disabledStatus === "disabled") {
            // user has to change the status from entwurf to ausfheren
            sHtml += "<div class='info-box-red'>Bitte denken Sie daran, die Unfallanzeige noch fertigzustellen und den Bearbeitungsstatus auf \"<b>ausführen!</b>\" zu setzen.</div>";
        } else {
            if (userObj !== null) {
                // MessageBox
                sHtml += "<div class='info-box-green'>";
                sHtml += "<span>Zum Abschluss des Vorgangs bitte in der nachfolgenden Ansicht </span>";
                sHtml += "<span>den Button \"<b>Versandlink</b>\" betätigen und die Unfallanzeige mittels der Buttons entsprechend den Vorgaben versenden.</span>";
                sHtml += "</div>";
            }
        }
        // }  // else {
        // DispForm.aspx
        // }

        // if (userObj !== null && IS_TEST) {
        // MessageBox
        // sHtml += "<div id='recordId' style='font-size: 8px; color: grey'><i>The last record of user: <span title='User Id:"+ userObj.Id +"'>" + userObj.Title + "</span> is list item record Id: " + recordObj.Id + ", created: " + recordObj.Created + ".</i></div>"
        // }

        sHtml += "<div class='email-msg-container'>";
        sHtml += "<div id='emailSentOkId' class='email-msg-content email-msg-content-ok'></div>";
        sHtml += "<div id='emailSentErrorId' class='email-msg-content email-msg-content-error'></div>";
        sHtml += "</div>";

        sHtml += "</div>";
        return sHtml;
    }

    that.generateHtmlButtons = function (buttonsStatus) {
        var htmlCodeAsStr = that.generateHtml(buttonsStatus);
        var htmlAsDom = $(htmlCodeAsStr).get(0);
        $("#mailHtmlHolder").append(htmlAsDom);
        that.attachButtonsEvent();
        that.attachTestMail();
    }

    that.urlAuslesen = function (listItemId) {
        if (IS_TEST) {
            console.log("---current user email: ", currentUserEmail);
        }

        var listItemIdExists = !IstUndefiniert(listItemId);
        //ItemID aus der URL holen und an die funktion zum holen des Listitems �bergeben
        if (listItemIdExists) {
            that.getListItem(listItemId);
        } else {
            var urlListItemId = getValByKey(window.location, "ID");
            if (urlListItemId !== null) {
                that.getListItem(urlListItemId);
            }
        }
    }

    // can be called from fncViewSendEmailDialog.js
    that.getListItem = function (listItemId) {
        // Listitem Lesen
        var clientContext = new SP.ClientContext.get_current();
        var targetList = clientContext.get_web().get_lists().getByTitle("Unfallanzeige / Verbandbuch");
        var view = targetList.get_views().getByTitle("VBG");
        targetListItem = targetList.getItemById(listItemId);
        listFields = targetList.get_fields();
        viewFields = view.get_viewFields();
        clientContext.load(targetListItem);
        clientContext.load(listFields);
        clientContext.load(viewFields);
        clientContext.executeQueryAsync(onQuerySucceeded, onQueryFailed);

        function onQuerySucceeded() {
            var bsgMitarbeiter = targetListItem.get_item("BSG_x0020_Mitarbeiter");
            if (!IstUndefiniert(bsgMitarbeiter)) {
                // Mitarbeiter is filled
                var bsgMitarbeiterId = clientContext.get_web().ensureUser(bsgMitarbeiter.get_lookupValue());
                clientContext.load(bsgMitarbeiterId);
                clientContext.executeQueryAsync(function () { // successfully ensured user from user name
                    bsgMitarbeiteremail = bsgMitarbeiterId.get_email();
                    if (DEBUG) {
                        console.log("---bsgMitarbeiteremail", bsgMitarbeiteremail);
                    }
                    //Listitem an die Mailfunktion �bergeben
                    generateMail(targetListItem, listFields, viewFields);

                }, function (sender, args) { // on error
                    alert(args.get_message());
                }
                );
            } else {
                //Listitem an die Mailfunktion �bergeben
                generateMail(targetListItem, listFields, viewFields);
            }
        }

        function onQueryFailed(sender, args) {
            alert('Request failed. \nError: ' + args.get_message() + '\nStackTrace: ' + args.get_stackTrace());
        }

    }

    that.getCurrentUserId = function () {
        var requestUri = baseUrl + "/_api/web/CurrentUser";
        var requestHeaders = {
            "accept": "application/json;odata=verbose"
        };
        return $.ajax({
            url: requestUri,
            contentType: "application/json;odata=verbose",
            headers: requestHeaders
        });
    }

    that.getGuidByTitle = function (listTitleName) {
        var requestUri = baseUrl + "/_api/web/lists?$filter=Title eq '" + listTitleName + "'&$select=Id";
        var requestHeaders = {
            "accept": "application/json;odata=verbose"
        };
        return $.ajax({
            url: requestUri,
            contentType: "application/json;odata=verbose",
            headers: requestHeaders,
        });
    }

    that.isItemDraft = function (itemId) {
        var deferred = $.Deferred();
        var listTitleName = "Unfallanzeige / Verbandbuch";
        that.getGuidByTitle(listTitleName).done(function (data) {
            if (data.d.results.length > 0) {
                var listGuid = data.d.results[0].Id;
                // get list by GUID
                var requestUri = _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists(guid'" + listGuid + "')/items(" + itemId + ")?$select=Id,Unfallmeldung_x0020_ausf_x00fc_h";

                var requestHeaders = {
                    "accept": "application/json;odata=verbose"
                };
                $.ajax({
                    url: requestUri,
                    contentType: "application/json;odata=verbose",
                    headers: requestHeaders,
                    success: function (res) {
                        if (res.d) {
                            if (IS_TEST) {
                                console.log("---form", res.d);
                            }
                            // NOTE check if the form is completed
                            var isDraft = res.d["Unfallmeldung_x0020_ausf_x00fc_h"] === "Entwurf";
                            deferred.resolve(isDraft);
                        }
                    },
                    error: function (err) {
                        console.warn(err);
                        return deferred.reject
                    }
                });
            }
        });
        return deferred.promise();
    }

    that.setCurrentUserEmail = function () {
        that.getCurrentUserId().done(function (data) {
            if (data.d) {
                currentUserEmail = data.d.Email;
                if (IS_TEST) {
                    console.log("---currentUserEmail just arrived: ", currentUserEmail);
                }
            }
        }).fail(function (err) {
            console.warn("---unable to get users email", err);
        });
    }

    that.attachTestMail = function () {
        // show message only for editting a form
        if (DEBUG) {
            if ($("#IS_TEST_holder").length > 0) {
                $("#IS_TEST_holder").append("<div><b>DEBUG</b> mode active. Verbose information provided</div>");
            }
        }
        if ((DEBUG || IS_TEST) && SEND_EMAIL) {
            if ($("#IS_TEST_holder").length > 0) {
                $("#IS_TEST_holder").append("<div><b>SEND_EMAIL</b> mode active. Emails are sent to the recipients.</div>");
            }
        }
        if (IS_TEST && email_1 === null) {
            // only if we don't want to send it to a specific test mail.
            that.getCurrentUserId().done(function (data) {
                if (data.d) {
                    email_1 = data.d.Email;
                    var infoEmailTo = "<div><b>TEST</b> site => Email will be sent also to: " + email_1 + "</div>"
                    if ($("#IS_TEST_holder").length > 0) {
                        $("#IS_TEST_holder").append(infoEmailTo);
                    }
                }
            }).fail(function (err) {
                console.warn(err);
            });
        }
    }

    that.attachMailJsEvents = function (listItemId) {
        try {
            itemId = IstUndefiniert(listItemId) ? null : listItemId;
        } catch (err) {
            // using a form to edit the list record
        }

        if (itemId === null) {
            // ViewForm.aspx
            var urlListItemId = getValByKey(window.location, "ID");
            if (urlListItemId !== null) {
                var buttonsStatus = "";
                that.isItemDraft(urlListItemId).then(function (isDraf) {
                    // fetch item id to disable buttons if saved as draft (Entwurf)
                    buttonsStatus = isDraf ? "disabled" : "";
                    that.generateHtmlButtons(buttonsStatus);
                }, function (err) {
                    alert("Unable to get current record id.");
                    // show form but enabled buttons
                    that.generateHtmlButtons(buttonsStatus);
                });
            }
        }
    }

    that.attachButtonsEvent = function () {
        // Versand INTERN
        $('#MailIntern').on("click", function (self) {
            disableForMoment(self);

            mailToBetriebsarzt = false;
            mailToIntern = true;
            mailToSchwerBehinVertr = false;
            ausdruckVBG = false;
            ausdruckASB = false;
            MailJs().urlAuslesen(itemId);
        });
        // Versand an BEtriebsarzt
        $('#MailBetriebsarzt').on("click", function (self) {
            disableForMoment(self);

            mailToBetriebsarzt = true;
            mailToIntern = false;
            mailToSchwerBehinVertr = false;
            ausdruckVBG = false;
            ausdruckASB = false;
            MailJs().urlAuslesen(itemId);
        });

        $('#MailSchwerBehinVertr').on("click", function () {
            mailToBetriebsarzt = false;
            mailToIntern = false;
            mailToSchwerBehinVertr = true;
            ausdruckVBG = false;
            ausdruckASB = false;
            MailJs().urlAuslesen(itemId);
        });

        $('#ausdruckVBG').on("click", function () {
            mailToBetriebsarzt = false;
            mailToIntern = false;
            mailToSchwerBehinVertr = false;
            ausdruckVBG = true;
            ausdruckASB = false;
            MailJs().urlAuslesen(itemId);
        });

        $('#ausdruckASB').on("click", function () {
            mailToBetriebsarzt = false;
            mailToIntern = false;
            mailToSchwerBehinVertr = false;
            ausdruckVBG = false;
            ausdruckASB = true;
            MailJs().urlAuslesen(itemId);
        });
    }

    function generateMail(listItem, listFields, viewFields) {

        var temp;
        var alleFeldNamen = {};
        var feldNamen = {};
        var formularMatrix = {};

        var e = listFields.getEnumerator();
        while (e.moveNext()) {
            var fieldName = e.get_current().get_internalName();
            var shownFieldName = e.get_current().get_title();
            var fieldType = e.get_current().get_typeAsString();

            alleFeldNamen[fieldName] = [shownFieldName, fieldType];
        }

        var e = viewFields.getEnumerator();
        while (e.moveNext()) {
            // Nummer(beginnend mit 0)      Feldtyp                               Feldname                     interner Feldname      Fedinhalt     
            feldNamen[e.$M_0] = [alleFeldNamen[e.get_current()][1], alleFeldNamen[e.get_current()][0], e.get_current(), listItem.get_item(e.get_current())];
        }

        var emailTo = "";
        var emailCC = "";
        var forwardRules = []; // for redirecting to requested groups
        var emailBCC = "";
        var distributeEmail = {
            To: [distributionEmail],
            CC: [currentUserEmail]
        }
        var emailFrom = EMAIL_FROM_SYSTEM;
        var sub1 = "";
        var sub2 = "";
        if (!IstUndefiniert(listItem.get_item("_x0030_2_x0020_Unternehmensnumme"))) { sub1 = listItem.get_item("_x0030_2_x0020_Unternehmensnumme").$2e_1 }
        if (!IstUndefiniert(listItem.get_item("Name_x002c__x0020_Vorname"))) { sub2 = listItem.get_item("Name_x002c__x0020_Vorname").$2e_1 }
        var emailSub = sub1 + ", Unfallmeldung: " + sub2;
        var emailBody = "";
        var emailBodyLink = "";
        var umbruch = "<br>\n";
        var emlMail = "";
        var abgeschnitteneFelder = "";

        $.each(feldNamen, function (key, value) {
            //console.log(key + " - " + value[0] + " - " + value[1] + " - " + value[2] + " - " + value[3]);
            emailBody = emailBody + "<b>" + value[1] + ": </b>";
            if (!IstUndefiniert(value[3])) {
                switch (value[0]) {
                    case 'DateTime':
                        emailBody += Date2String(value[3]) + umbruch;
                        formularMatrix[value[2]] = Date2String(value[3]);
                        break;
                    case 'User':
                        emailBody += value[3].$2e_1 + umbruch;
                        formularMatrix[value[2]] = value[3].$2e_1;
                        break;
                    case 'UserMulti':
                        formularMatrix[value[2]] = "";
                        for (i = 0; i < value[3].length; i++) {
                            emailBody += (value[3][i].$2e_1);
                            formularMatrix[value[2]] += (value[3][i].$2e_1);
                            if (i < value[3].length - 1) emailBody = emailBody + "; ";
                        }
                        emailBody += umbruch;
                        break;
                    case 'Note':
                        temp = value[3].replace(/<\/p>/g, "\n</p>");
                        temp = temp.replace(/<\/div>/g, "\n</div>");
                        temp = temp.replace(/<ul>/g, "\n<ul>");
                        temp = temp.replace(/<ol>/g, "\n<ol>");
                        temp = temp.replace(/<\/li>/g, "\n</li>");
                        temp = temp.replace(/<li>/g, "  - <li>");
                        temp = jQuery(temp).text();
                        temp = temp.replace(/[^\u000A\u00DF\u00D6\u00F6\u00DC\u00FC\u00C4\u00E4\u0020-\u007E]/g, '');
                        temp = temp.replace(/\n\n\n/g, "\n");
                        temp = temp.replace(/\n\n/g, "\n");
                        temp = temp.replace(/\n/g, "<br>\n");
                        emailBody += temp + umbruch;
                        temp = temp.replace(/<br>\n/g, " ");
                        formularMatrix[value[2]] = temp;
                        break;
                    case 'Lookup':
                        emailBody += value[3].$2e_1 + umbruch;
                        formularMatrix[value[2]] = value[3].$2e_1;
                        break;
                    default:
                        emailBody += value[3].toString() + umbruch;
                        formularMatrix[value[2]] = value[3].toString();
                }
            } else {
                emailBody += " " + umbruch;
                formularMatrix[value[2]] = " ";
            }

        });


        // var linkToItemEditMode = baseUrl + "/Lists/UA/EditForm.aspx?ID=";
        // linkToItemEditMode += listItem.get_item("ID");
        // linkToItemEditMode += baseUrl.indexOf("training") > -1
        //     ? "&Source=https%3A%2F%2Fcollab%2Demea%2Ecollaboration%2Eintranet%2Ecommerzbank%2Ecom%2Ftraining%2FUm"
        //     : "&Source=https%3A%2F%2Fcollab%2Demea%2Ecollaboration%2Eintranet%2Ecommerzbank%2Ecom%2Fsites%2FSSC%5FSL%2FUm";

        var linkToItem = baseUrl + "/Lists/UA/DispForm.aspx?ID=";
        linkToItem += listItem.get_item("ID");
        linkToItem += baseUrl.indexOf("training") > -1
            ? "&Source=https%3A%2F%2Fcollab%2Demea%2Ecollaboration%2Eintranet%2Ecommerzbank%2Ecom%2Ftraining%2FUm"
            : "&Source=https%3A%2F%2Fcollab%2Demea%2Ecollaboration%2Eintranet%2Ecommerzbank%2Ecom%2Fsites%2FSSC%5FSL%2FUm";
        //linkToItem oder linkToItemEditMode - je nachdem welcher Link in der mail verwendet werden soll

        if (IS_TEST || DEBUG) {
            emailBodyLink += "<p><hr><h1 style='color: red;'> >>>TEST EMAIL<<< </h1><p>Do not reply.</p></p><hr>";
        }
        //Hier wird der neue alternative EmailBody generiert:
        //the URLs below are made dynamic because they shouldn't depend on ShaarePoint 
        emailBodyLink += "Sehr geehrte Damen und Herren," + umbruch + umbruch;

        emailBodyLink += "folgende Unfallanzeige wurde erfasst." + umbruch + umbruch;

        emailBodyLink += "<a href=" + linkToItem + ">Link zur Unfallanzeige</a>" + umbruch + umbruch;

        emailBodyLink += "Die  Kenntnisnahme durch  die zust\u00e4ndigen Gremien gem\u00e4\u00df SGB VII und  den einzubindenden Funktionstr\u00e4ger ist zu dokumentieren." + umbruch;
        emailBodyLink += "\u00d6ffnen Sie hierf\u00fcr die Sie betreffende Liste. In der Rubrik <b>\"aktuelle Vorg\u00e4nge\"</b> nehmen Sie die Bearbeitung \u00fcber <b>\"diese Liste bearbeiten\"</b> vor." + umbruch + umbruch;
        emailBodyLink += "<ul>"
        emailBodyLink += "<li><a href=\"" + baseUrl + "/_layouts/15/start.aspx#/SitePages/Arbeitssicherheit%20-%20Leitung.aspx\">Arbeitssicherheit</a></li>";
        emailBodyLink += "<li><a href=\"" + baseUrl + "/SitePages/CP%20Insurance.aspx\">CP Insurance</a></li>";
        emailBodyLink += "<li><a href=\"" + baseUrl + "/SitePages/GM-HR%20SSC%20Operations%20Payroll.aspx\">GM-HR</a></li>";
        emailBodyLink += "<li><a href=\"" + baseUrl + "/SitePages/Betriebsrat.aspx\">Betriebsrat</a></li>";
        emailBodyLink += "</ul>"

        emailBodyLink += "Vielen Dank f&uuml;r Ihre Unterst&uuml;tzung." + umbruch + umbruch;

        // emailBodyLink += "Mit freundlichen Gr&uuml;&szlig;en" + umbruch;
        //emailBodyLink += "Team Arbeitssicherheit" + umbruch;


        // Mailadressen holen - emailTo

        // Vorgesetzter des UnfallOpfers
        var oUnfallopferManagerField = listItem.get_item("Vorgesetzter_x0020_des_x0020_Unf");
        var iSPUserIndex = parseInt(oUnfallopferManagerField.$1E_1);
        var sEmailUnfallopferManager = "";
        // email Adresse anhand des SPIndex des Vorgesetzten ermitteln
        getUserInfoEMail(iSPUserIndex.toString(),
            function (userEntry) {
                sEmailUnfallopferManager = userEntry.toString().toLowerCase();
            }
        );

        // Button Versand am Betriebsartz
        if (mailToBetriebsarzt) {
            // production
            //mail an VBG
            if (!IstUndefiniert(listItem.get_item('email_x0020_VBG'))) { emailTo += parseEmailOrRule(listItem.get_item('email_x0020_VBG')).email + "; "; }
            if (!IstUndefiniert(listItem.get_item('email_x0020_Betriebsarzt'))) { emailTo += parseEmailOrRule(listItem.get_item('email_x0020_Betriebsarzt')).email + "; "; }

            // emailCC
            emailCC += currentUserEmail + "; ";
            // string rule
            if (!IstUndefiniert(listItem.get_item('email_x0020_Betriebsarzt'))) { forwardRules.push(parseEmailOrRule(listItem.get_item('email_x0020_Betriebsarzt')).rule) }

            buildEmlMail();
        }

        // Button Versand Intern
        if (mailToIntern) {
            // production - for forwarding by Exchange
            // if (!IstUndefiniert(listItem.get_item("Betriebsratsbereich_x003a_GrupeRuleNa"))) {
            //     if (!IstUnderfinier(listItem.get_item("Betriebsratsbereich_x003a_RuleNa"))) {
            //         var rule = listItem.get_item("Betriebsratsbereich_x003a_RuleNa");
            //         console.log("---rule", rule);
            //         forwardRules.push(parseEmailOrRule(listItem.get_item("Betriebsratsbereich_x003a_RuleNa").$2e_1).rule)
            //     }
            //  }

            //mail an interne Adressen
            if (!IstUndefiniert(listItem.get_item('BSG_x0020_Mitarbeiter'))) { emailTo += bsgMitarbeiteremail + "; "; }
            if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe'))) { emailTo += listItem.get_item('Betriebsratsbereich_x003a_Gruppe').$2e_1 + "; "; }

            // emails
            if (!IstUndefiniert(listItem.get_item('email_x0020_CERI'))) { emailTo += parseEmailOrRule(listItem.get_item('email_x0020_CERI')).email + "; "; }
            if (!IstUndefiniert(listItem.get_item('email_x0020_Arbeitssicherzeit'))) { emailTo += parseEmailOrRule(listItem.get_item('email_x0020_Arbeitssicherzeit')).email + "; "; }
            if (!IstUndefiniert(listItem.get_item('email_x0020_Incurance'))) { emailTo += parseEmailOrRule(listItem.get_item('email_x0020_Incurance')).email + "; "; }

            // string rules
            if (!IstUndefiniert(listItem.get_item('email_x0020_CERI'))) { forwardRules.push(parseEmailOrRule(listItem.get_item('email_x0020_CERI')).rule); }
            if (!IstUndefiniert(listItem.get_item('email_x0020_Arbeitssicherzeit'))) { forwardRules.push(parseEmailOrRule(listItem.get_item('email_x0020_Arbeitssicherzeit')).rule) }
            if (!IstUndefiniert(listItem.get_item('email_x0020_Incurance'))) { forwardRules.push(parseEmailOrRule(listItem.get_item('email_x0020_Incurance')).rule); }

            // Vorgesetzten hinzuf�gen ...
            if (!IstUndefiniert(sEmailUnfallopferManager)) {
                // production
                emailCC += sEmailUnfallopferManager + "; ";
                emailCC += currentUserEmail + "; ";
                distributeEmail.CC.push(sEmailUnfallopferManager);
            }

            // 2018-07-10: Udo Burgsm�ller
            // Wenn "Schwerbehindert oder gleichgestellt? == "Ja",
            // dann analog "mailToSchwerBehinVertr" als zus�tzlichen Empf�nger 
            // "listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1" hinzuf�gen ...
            if (!IstUndefiniert(listItem.get_item('Schwerbehindertenvertretung_x002'))) {
                var bAddMailReceiverSBV = false;
                bAddMailReceiverSBV = (listItem.get_item('Schwerbehindertenvertretung_x002') == "Ja");

                if (bAddMailReceiverSBV) {
                    if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0'))) {
                        if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1)) {
                            // production - for forwarding by Exchange
                            // if (!IstUndefiniert(listItem.get_item("Betriebsratsbereich_x003a_RuleNa0"))) { 
                            //     forwardRules.push(parseEmailOrRule(listItem.get_item("Betriebsratsbereich_x003a_RuleNa0").$2e_1).rule); 
                            // }
                            emailTo += listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1 + "; ";
                            // buildEmlMail(); // auskommentiert s. u. Betriebsratsbereich_x003a_Gruppe muss erst gepr�ft werden !                        
                        }
                        else {
                            temp = "Versand nicht m\u00f6glich!\n";
                            temp += "F\u00fcr den zust\u00e4ndigen Bereich der Schwerbehindertenvertretung liegt keine E-Mailadresse vor.\n\n";
                            temp += "Bitte wenden Sie sich direkt an die zust\u00e4ndige Schwerbehindertenvertretung.";
                            alert(temp);
                        } // if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1))
                    }
                    else {
                        temp = "Versand nicht m\u00f6glich!\n";
                        temp += "Bitte pflegen Sie das Feld \"Betriebsratsbereich\" und versuchen es anschlie\u00dfend erneut.";
                        alert(temp);
                    } // if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0')))
                } // (bAddMailReceiverSBV)
            } //  if (!IstUndefiniert(listItem.get_item('Schwerbehindertenvertretung_x002')))


            //Betriebsrat pr�fen - Versand nur wenn vorhanden!
            if (!IstUndefiniert(targetListItem.get_item('Betriebsratsbereich_x003a_Gruppe'))) {
                buildEmlMail();
            } else {
                temp = "Versand nicht m\u00f6glich!\n";
                temp += "Bitte pflegen Sie das Feld \"Betriebsratsbereich\" und versuchen es anschlie\u00dfend erneut.";
                alert(temp);
            }
        }

        // 2018-07-19: GS-OS SSC Burgsm�ller: deaktiviert, da oben in "Versand Intern" integriert
        //		if (mailToSchwerBehinVertr){
        //			//mail an Schwerbehindertenvertretung
        //			if (listItem.get_item('Schwerbehindertenvertretung_x002') == "Ja"){
        //				if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0'))) {
        //					if (!IstUndefiniert(listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1)) {
        //						emailTo += listItem.get_item('Betriebsratsbereich_x003a_Gruppe0').$2e_1 + "; ";
        //						buildEmlMail();
        //					}else{
        //						temp = "Versand nicht m\u00f6glich!\n";
        //						temp += "F\u00fcr den zust\u00e4ndigen Bereich der Schwerbehindertenvertretung liegt keine E-Mailadresse vor.\n\n";
        //						temp += "Bitte wenden Sie sich direkt an die zust\u00e4ndige Schwerbehindertenvertretung.";
        //						alert(temp);
        //					}
        //				}else{
        //					temp = "Versand nicht m\u00f6glich!\n";
        //					temp += "Bitte pflegen Sie das Feld \"Betriebsratsbereich\" und versuchen es anschlie\u00dfend erneut.";
        //					alert(temp);
        //				}
        //			}else{
        //				temp = "Versand nicht m\u00f6glich!\n";
        //				temp += "Bitte pflegen Sie das Feld \"Schwerbehindertenvertretung informieren\" und versuchen es anschlie\u00dfend erneut.";
        //				alert(temp);
        //			}
        //		}

        if (ausdruckVBG || ausdruckASB) {

            //pdf Formular generieren

            //�    �    �    �    �    �    �    �
            //ß   ü   Ü   ä   Ä   ö   Ö   €
            //g

            var doc = new jsPDF();
            //doc.setFont("verdana");

            // Logo	Standard ==> Commerzbank		
            //var imgData = 'data:image/png;base64,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';
            //doc.addImage(imgData, 'PNG', 127, 7);

            // Logo	Image-Base64 String	
            var imgData = '';

            if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Unternehmensnumme'))) {
                var sEntity = listItem.get_item('_x0030_2_x0020_Unternehmensnumme').$2e_1; // Achtung: Lookup-Value auslesen !
                // Image-Base64 String einf�gen und Position anpassen !
                switch (sEntity) {
                    case "Commerzbank AG":
                        {
                            imgData = "data:image/png;base64,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";
                            doc.addImage(imgData, 'PNG', 127, 7);
                            break;
                        }

                    case "Commerz Business Consulting GmbH (CBC)":
                        {
                            imgData = "data:image/png;base64,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";
                            doc.addImage(imgData, 'PNG', 95, 7);
                            break;
                        }

                    default:
                        {
                            if (sEntity.startsWith("ComTS")) // ComTS Mitte GmbH, ComTS Nord GmbH, ComTS Ost  GmbH usw...
                            {
                                imgData = "data:image/png;base64,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";
                                doc.addImage(imgData, 'PNG', 100, 0);
                            } // if (sEntity.startsWith("ComTS"))

                            break;
                        }

                } // switch (sEntity)
            } // if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Unternehmensnumme')))

            //Rahmen
            doc.line(21, 21, 198, 21);
            doc.line(21, 274, 198, 274);
            doc.line(21, 21, 21, 274);
            doc.line(198, 21, 198, 274);
            //waagerecht
            doc.line(21, 94, 198, 94);
            doc.line(21, 102.5, 198, 102.5);
            doc.line(21, 110, 198, 110);
            doc.line(21, 118.5, 198, 118.5);
            doc.line(21, 127, 198, 127);
            doc.line(21, 135.5, 198, 135.5);
            doc.line(21, 147.5, 198, 147.5);
            doc.line(21, 199, 198, 199);
            doc.line(21, 206.5, 198, 206.5);
            doc.line(21, 214.5, 198, 214.5);
            doc.line(21, 225.5, 198, 225.5);
            doc.line(21, 233, 198, 233);
            doc.line(21, 241, 198, 241);
            doc.line(21, 249.5, 198, 249.5);
            doc.line(21, 257.5, 198, 257.5);
            doc.line(21, 270, 198, 270);
            //senkrecht
            doc.line(54, 135.5, 54, 147.5);
            doc.line(62, 110, 62, 127);
            doc.line(75.5, 127, 75.5, 135.5);
            doc.line(95, 102.5, 95, 110);
            doc.line(110, 199, 110, 206.5);
            doc.line(116, 225.5, 116, 233);
            doc.line(125, 94, 125, 118.5);
            doc.line(127, 135.5, 127, 147.5);
            doc.line(127, 214.5, 127, 225.5);
            //K�stchen
            doc.rect(21.5, 115, 3, 3);
            doc.rect(36.5, 115, 3, 3);
            doc.rect(50.5, 115, 3, 3);
            doc.rect(126, 115, 3, 3);
            doc.rect(146, 115, 3, 3);
            doc.rect(22, 123.5, 3, 3);
            doc.rect(43, 123.5, 3, 3);
            doc.rect(96, 119.5, 3, 3);
            doc.rect(96, 123.5, 3, 3);
            doc.rect(146, 119.5, 3, 3);
            doc.rect(146, 123.5, 3, 3);
            doc.rect(39, 131.5, 12, 3.5);
            doc.rect(22, 141, 3, 3);
            doc.rect(43, 141, 3, 3);
            doc.rect(85, 195, 3, 3);
            doc.rect(123, 195, 3, 3);
            doc.rect(153, 211, 3, 3);
            doc.rect(174, 211, 3, 3);
            doc.rect(89, 242, 3, 3);
            doc.rect(110, 242, 3, 3);
            doc.rect(110, 250, 3, 3);
            doc.rect(131, 250, 3, 3);
            //�berschrift
            doc.setFontSize(15);
            doc.setFontType("bold");
            // doc.text(123, 27, 'U N F A L L A N Z E I G E');
            doc.text(86, 27, 'U N F A L L A N Z E I G E');
            doc.setFontType("normal");

            setzeBezeichner(23, 33, 'Name und Anschrift der Filiale / Zentralbereich', '1');
            // setzeBezeichner(123, 33, 'Unternehmensnummer des Unfallversicherungsträgers', '2');
            setzeBezeichner(86, 33, 'Unternehmensnummer des Unfallversicherungsträgers', '2');

             // new fields
             doc.rect(86, 34, 7, 7);
             doc.rect(93, 34, 7, 7);
             doc.rect(100, 34, 7, 7);
             doc.rect(107, 34, 7, 7);
             doc.rect(114, 34, 7, 7);
             
            //K�stchen f�r Unternehmensnummer
            doc.rect(121, 34, 7, 7);
            doc.rect(128, 34, 7, 7);
            doc.rect(135, 34, 7, 7);
            doc.rect(142, 34, 7, 7);
            doc.rect(149, 34, 7, 7);
            doc.rect(156, 34, 7, 7);
            doc.rect(163, 34, 7, 7);
            doc.rect(170, 34, 7, 7);
            doc.rect(177, 34, 7, 7);
            doc.rect(184, 34, 7, 7);
            doc.setDrawColor(255, 255, 255);
            // doc.line(121, 34, 191, 34);
            doc.line(86, 34, 191, 34);

            doc.setDrawColor(0, 0, 0);

            //Bezeichner
            setzeBezeichner(23, 55, 'Empfänger', '3');
            setzeBezeichner(23, 97, 'Name, Vorname des Versicherten', '4');
            setzeBezeichner(126, 97, 'Geburtsdatum', '5');
            setzeBezeichner(154, 97, 'Tag', '');
            setzeBezeichner(164, 97, 'Monat', '');
            setzeBezeichner(183, 97, 'Jahr', '');
            setzeBezeichner(23, 105.5, 'Straße, Hausnummer', '6');
            setzeBezeichner(96, 105.5, 'Postleitzahl', '', "Postleitzahl");
            setzeBezeichner(126, 105.5, 'Ort', '', "Ort");
            setzeBezeichner(23, 113, 'Geschlecht', '7');
            setzeBezeichner(25, 118, 'männlich', '');
            setzeBezeichner(40, 118, 'weiblich', '');
            setzeBezeichner(54, 118, 'divers', '');
            setzeBezeichner(64, 113, 'Staatsangehörigkeit', '8');
            setzeBezeichner(126, 113, 'Leiharbeitnehmer', '9');
            setzeBezeichner(131, 118, 'ja', '');
            setzeBezeichner(151, 118, 'nein', '');
            setzeBezeichner(23, 122, 'Auszubildender', '10');
            setzeBezeichner(26, 126.5, 'ja', '');
            setzeBezeichner(47, 126.5, 'nein', '');
            setzeBezeichner(64, 122, 'Ist der Versicherte', '11');
            setzeBezeichner(101, 122, 'Unternehmer', '');
            setzeBezeichner(101, 122, 'Unternehmer', '');
            setzeBezeichner(151, 122, 'Ehegatte des Unternehmers', '');
            setzeBezeichner(101, 126.5, 'mit dem Unternehmer verwandt', '');
            setzeBezeichner(151, 126.5, 'Gesellschafter/Geschäftsführer', '');
            setzeBezeichner(23, 130.5, 'Anspruch auf Entgeldfortzahlung', '12');
            setzeBezeichner(78, 130.5, 'Krankenkasse des Versicherten (Name, PLZ, Ort)', '13');
            setzeBezeichner(23, 134, 'besteht für', '');
            setzeBezeichner(52, 134, 'Wochen', '');
            setzeBezeichner(23, 139, 'Tödlicher Unfall?', '14');
            setzeBezeichner(56, 139, 'Unfallzeitpunkt', '15');
            setzeBezeichner(128, 139, 'Unfallort', '16');
            doc.setFontSize(7);
            doc.text(144, 139, '(genaue Orts- und Straßenangabe mit PLZ)');
            setzeBezeichner(26, 144, 'ja', '');
            setzeBezeichner(47, 144, 'nein', '');
            setzeBezeichner(58, 142.5, 'Tag', '');
            setzeBezeichner(68, 142.5, 'Monat', '');
            setzeBezeichner(88, 142.5, 'Jahr', '');
            setzeBezeichner(104, 142.5, 'Stunde', '');
            setzeBezeichner(116, 142.5, 'Minute', '');
            setzeBezeichner(23, 151, 'Ausführliche Schilderung des Unfallhergangs', '17');
            doc.setFontSize(7);
            doc.text(85, 151, '(Verlauf, Bezeichnung des Betriebsteils, ggf. Beteiligung von Maschinen, Anlagen, Gefahrstoffen)');
            setzeBezeichner(23, 198, 'Die Angaben beruhen auf der Schilderung', '');
            setzeBezeichner(90, 198, 'des Versicherten', '');
            setzeBezeichner(128, 198, 'anderer Personen', '');
            setzeBezeichner(23, 202.5, 'Verletzte Körperteile', '18');
            setzeBezeichner(115, 202.5, 'Art der Verletzung', '19');
            setzeBezeichner(23, 210, 'Wer hat von dem Unfall zuerst Kenntnis genommen?', '20');
            doc.setFontSize(7);
            doc.text(95, 210, '(Name, Anschrift des Zeugen)');
            setzeBezeichner(153, 210, 'War diese Person Augenzeuge?', '');
            setzeBezeichner(157, 214, 'ja', '');
            setzeBezeichner(178, 214, 'nein', '');
            setzeBezeichner(23, 218, 'Name des erstbehandelnden Arztes/Krankenhauses', '21');
            setzeBezeichner(129, 218, 'Beginn und Ende der Arbeitszeit des Versicherten', '22');
            setzeBezeichner(141, 221.5, 'Stunde', '');
            setzeBezeichner(153, 221.5, 'Minute', '');
            setzeBezeichner(176, 221.5, 'Stunde', '');
            setzeBezeichner(189, 221.5, 'Minute', '');
            setzeBezeichner(128, 224, 'Beginn', '');
            setzeBezeichner(165, 224, 'Ende', '');
            setzeBezeichner(23, 229, 'Zum Unfallzeitpunkt beschäftigt/tätig als', '23');
            setzeBezeichner(118, 229, 'Seit wann bei dieser Tätigkeit?', '24');
            setzeBezeichner(166, 229, 'Monat', '');
            setzeBezeichner(184, 229, 'Jahr', '');
            setzeBezeichner(23, 236, 'In welchem Teil des Unternehmens ist der Versicherte ständig tätig?', '25');
            setzeBezeichner(23, 245, 'Hat der Versicherte die Arbeit eingestellt?', '26');
            setzeBezeichner(93, 245, 'nein', '');
            setzeBezeichner(114, 245, 'sofort', '');
            setzeBezeichner(146, 245, 'später, am', '');
            setzeBezeichner(165, 244, 'Tag', '');
            setzeBezeichner(176, 244, 'Monat', '');
            setzeBezeichner(188, 244, 'Stunde', '');
            setzeBezeichner(23, 253, 'Hat der Versicherte die Arbeit wieder aufgenommen?', '27');
            setzeBezeichner(114, 253, 'nein', '');
            setzeBezeichner(136, 253, 'ja, am', '');
            setzeBezeichner(154, 252.5, 'Tag', '');
            setzeBezeichner(164, 252.5, 'Monat', '');
            setzeBezeichner(183, 252.5, 'Jahr', '');
            setzeBezeichner(23, 273, 'Datum', '28');
            setzeBezeichner(51, 273, 'Filial-/Abteilungsleitung', '');
            setzeBezeichner(114, 273, 'Betriebsrat', '');
            setzeBezeichner(140, 273, 'Telefon-Nr. für Rückfragen (Ansprechpartner)', '');

            //Formularnummer unten links hochkant
            doc.setFontSize(6);
            doc.setFontType("bold");
            doc.text(20, 273, '722/01/22 - HD0611', null, 90);

            // 2 - Unternehmensnummer
            doc.setFontSize(15);
            if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Unternehmensnumme0'))) {
                temp = listItem.get_item('_x0030_2_x0020_Unternehmensnumme0').$2e_1;
                // var x = 123; // 10 digit number
                var x = 88; // initial position for 15 digit number
                for (i = 0; i < temp.length; i++) {
                    doc.text(x, 39, temp.substring(i, i + 1));
                    x += 7;
                }
            }
            //doc.setFontType("normal");
            doc.setFontSize(9);

            // 3 - Empf�nger
            var fenster = [];
            if (ausdruckVBG) {
                fenster.push("Verwaltungs-Berufsgenossenschaft");
                if (!IstUndefiniert(listItem.get_item('_x0030_3_x003a_Name'))) { fenster.push(listItem.get_item('_x0030_3_x003a_Name').$2e_1); }
                if (!IstUndefiniert(listItem.get_item('_x0030_3_x003a_Stra_x00df_e_x002'))) { fenster.push(listItem.get_item('_x0030_3_x003a_Stra_x00df_e_x002').$2e_1); }
                if (!IstUndefiniert(listItem.get_item('_x0030_3_x003a_PLZ_x0020_Ort'))) { fenster.push(listItem.get_item('_x0030_3_x003a_PLZ_x0020_Ort').$2e_1); }
            }
            if (ausdruckASB) {
                temp = "";
                if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die3'))) { fenster.push(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die3').$2e_1); }
                if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die4'))) { fenster.push(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die4').$2e_1); }
                if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die5'))) { temp = (listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die5').$2e_1); }
                if (!IstUndefiniert(listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die6'))) { temp += " " + (listItem.get_item('_x0030_2_x0020_Adresse_x0020_Die6').$2e_1); }
                fenster.push(temp);
            }
            fenster = doc.splitTextToSize(fenster, 75);
            doc.text(25, 63, fenster);

            doc.setFontType("normal");
            doc.setFontSize(8);

            // 1 - Absender
            fenster = [];
            fenster.push(formularMatrix["_x0030_1_x0020_Filiale_x002f_Zen"]);
            fenster.push(formularMatrix["_x0030_2_x0020_Geb_x00e4_ude"]);
            fenster.push(formularMatrix["_x0030_2_x0020_Adresse_x0020_Die2"]);
            fenster.push(formularMatrix["_x0030_2_x0020_Adresse_x0020_Die0"] + " " + formularMatrix["_x0030_2_x0020_Adresse_x0020_Die1"]);
            doc.text(25, 37, schneideAbMulti(fenster, 75, "1", 5));


            //Felder ausf�llen
            // 4
            doc.text(23, 101, formularMatrix["Name_x002c__x0020_Vorname"]);
            // 5
            doc.text(155, 101, formularMatrix["Geburtsdatum"].substring(0, 2));
            doc.text(165, 101, formularMatrix["Geburtsdatum"].substring(3, 5));
            doc.text(184, 101, formularMatrix["Geburtsdatum"].substring(6, 10));
            // 6
            doc.text(23, 109, formularMatrix["Stra_x00df_e_x0020_Hausnummer"]);
            doc.text(96, 109, formularMatrix["Postleitzahl"]);
            doc.text(126, 109, formularMatrix["Ort"]);
            // 7
            if (formularMatrix["Geschlecht"] == "m\u00e4nnlich") { setzeKreuz(21.5, 115); }
            if (formularMatrix["Geschlecht"] == "weiblich") { setzeKreuz(36.5, 115); }
            if (formularMatrix["Geschlecht"] == "divers") { setzeKreuz(50.5, 115); }
            // 8
            doc.text(64, 117, schneideAbMulti(formularMatrix["Staatsangeh_x00f6_rigkeit"], 60, "8", 1));
            // 9
            if (formularMatrix["Leiharbeiter"] == "ja") { setzeKreuz(126, 115); }
            if (formularMatrix["Leiharbeiter"] == "nein") { setzeKreuz(146, 115); }
            // 10
            if (formularMatrix["Auszubildender"] == "ja") { setzeKreuz(22, 123.5); }
            if (formularMatrix["Auszubildender"] == "nein") { setzeKreuz(43, 123.5); }
            // 11
            if (formularMatrix["Ist_x0020_der_x0020_Versicherte"] == "Unternehmer") { setzeKreuz(96, 119.5); }
            if (formularMatrix["Ist_x0020_der_x0020_Versicherte"] == "mit dem Unternehmer verwandt") { setzeKreuz(96, 123.5); }
            if (formularMatrix["Ist_x0020_der_x0020_Versicherte"] == "Ehegatte des Unternehmers") { setzeKreuz(146, 119.5); }
            if (formularMatrix["Ist_x0020_der_x0020_Versicherte"] == "Gesellschafter/Gesch\u00e4ftsf\u00fchrer") { setzeKreuz(146, 123.5); }
            // 12	
            doc.text(41, 134.5, formularMatrix["Anspruch_x0020_auf_x0020_Entgelt"]);
            // 13
            doc.text(78, 134.5, schneideAbMulti(formularMatrix["Krankenkasse_x0020_des_x0020_Ver"], 115, "13", 1));
            // 14
            if (formularMatrix["T_x00f6_dlicher_x0020_Unfall"] == "ja") { setzeKreuz(22, 141); }
            if (formularMatrix["T_x00f6_dlicher_x0020_Unfall"] == "nein") { setzeKreuz(43, 141); }
            // 15
            doc.text(59, 146, formularMatrix["Unfallzeitpunkt"].substring(0, 2));
            doc.text(68, 146, formularMatrix["Unfallzeitpunkt"].substring(3, 5));
            doc.text(87, 146, formularMatrix["Unfallzeitpunkt"].substring(6, 10));
            doc.text(105, 146, formularMatrix["Unfallzeitpunkt"].substring(13, 15));
            doc.text(117, 146, formularMatrix["Unfallzeitpunkt"].substring(16, 18));
            // 16
            doc.text(128, 143, schneideAbMulti(formularMatrix["Unfallort"], 65, "16", 1));
            // 17
            doc.text(23, 155, schneideAbMulti(formularMatrix["Ausf_x00fc_hrliche_x0020_Schilde"], 170, "17", 12));
            if (formularMatrix["auf_x0020_wessen_x0020_Schilderu"] == "des Versicherten") { setzeKreuz(85, 195); }
            if (formularMatrix["auf_x0020_wessen_x0020_Schilderu"] == "anderer Personen") { setzeKreuz(123, 195); }
            // 18
            doc.text(23, 205.5, schneideAbMulti(formularMatrix["verletzte_x0020_K_x00f6_rperteil"], 83, "18", 1));
            // 19
            doc.text(115, 205.5, schneideAbMulti(formularMatrix["_x0031_9_x0020_Art_x0020_der_x00"], 80, "19", 1));
            // 20
            doc.text(23, 213.5, schneideAbMulti(formularMatrix["Zeugenanschrift"], 125, "20", 1));
            if (formularMatrix["Augenzeuge"] == "ja") { setzeKreuz(153, 211); }
            if (formularMatrix["Augenzeuge"] == "nein") { setzeKreuz(174, 211); }
            // 21
            doc.text(23, 222, schneideAbMulti(formularMatrix["erstbehandelnder_x0020_Arzt_x002"], 100, "21", 1));
            // 22
            doc.text(143, 224, formularMatrix["Arbeitszeitbeginn"].substring(0, 2));
            doc.text(154, 224, formularMatrix["Arbeitszeitbeginn"].substring(3, 5));
            doc.text(178, 224, formularMatrix["Arbeitszeitende"].substring(0, 2));
            doc.text(190, 224, formularMatrix["Arbeitszeitende"].substring(3, 5));
            // 23
            doc.text(23, 232, schneideAbMulti(formularMatrix["Art_x0020_der_x0020_Besch_x00e4_"], 90, "23", 1));
            // 24
            doc.text(167, 232, formularMatrix["seit"].substring(3, 5));
            doc.text(185, 232, formularMatrix["seit"].substring(6, 10));
            // 25
            doc.text(23, 240, schneideAbMulti(formularMatrix["st_x00e4_ndige_x0020_T_x00e4_tig"], 170, "25", 1));
            // 26
            if (formularMatrix["Hat_x0020_der_x0020_Versicherte_"] == "nein") { setzeKreuz(89, 242); }
            if (formularMatrix["Hat_x0020_der_x0020_Versicherte_"] == "sofort") { setzeKreuz(110, 242); }
            doc.text(165, 248, formularMatrix["Arbeit_x0020_eingestellt_x0020_a"].substring(0, 2));
            doc.text(176, 248, formularMatrix["Arbeit_x0020_eingestellt_x0020_a"].substring(3, 5));
            doc.text(189, 248, formularMatrix["Arbeit_x0020_eingestellt_x0020_a"].substring(13, 15));
            // 27
            if (formularMatrix["Hat_x0020_der_x0020_Versicherte_0"] == "nein") { setzeKreuz(110, 250); }
            if (formularMatrix["Hat_x0020_der_x0020_Versicherte_0"] == "ja, am") { setzeKreuz(131, 250); }
            doc.text(155, 256, formularMatrix["Arbeit_x0020_aufgenommen"].substring(0, 2));
            doc.text(165, 256, formularMatrix["Arbeit_x0020_aufgenommen"].substring(3, 5));
            doc.text(184, 256, formularMatrix["Arbeit_x0020_aufgenommen"].substring(6, 10));
            // R�ckfragen - Ansprechpartner
            doc.text(140, 268, schneideAbMulti(formularMatrix["Telefonnummer"], 55, "Ansprechpartner", 1));
            //Datum
            doc.text(23, 268, Date2String(new Date()).substring(0, 10));
            //Die folgenden Felder werden direkt aus dem Listitem geholt da sie in der Mail nicht vorhanden sind
            if (!IstUndefiniert(listItem.get_item("Betriebsratsbereich_NEU"))) { doc.text(114, 268, listItem.get_item("Betriebsratsbereich_NEU").$2e_1) }
            if (!IstUndefiniert(listItem.get_item("Vorgesetzter_x0020_des_x0020_Unf"))) { doc.text(50, 268, listItem.get_item("Vorgesetzter_x0020_des_x0020_Unf").$2e_1) }

            //wurden Feldinhalte gek�rzt?
            if (abgeschnitteneFelder != "") {
                var zeigeText = "Achtung!\nFolgende Felder beinhalten zu viel Text:\n";
                zeigeText += abgeschnitteneFelder;
                zeigeText += "\nDer Inhalt dieser Felder wurde gek\u00fcrzt um in das Formularfeld zu passen. ";
                zeigeText += "Bitte pr\u00fcfen Sie diese Felder vor dem Versand und bearbeiten ggf. den Datensatz ";
                zeigeText += "um dann erneut das Formular zu erstellen!";
                alert(zeigeText);
            }

            //pdf ausgeben
            var blob = doc.output("blob");

            //doc.output('save', 'Unfallanzeige.pdf');

            if (typeof navigator.msSaveOrOpenBlob !== 'undefined') {
                // IE11
                return window.navigator.msSaveOrOpenBlob(blob, 'Unfallanzeige.pdf');
            } else {
                // EDGE
                // saveAs(blob, 'Unfallanzeige.pdf'); // SAVE AS
                window.open(URL.createObjectURL(blob)); // PREVIEW PDF
            }


            function setzeBezeichner(x, y, text, nummer, inhalt) {
                if (nummer != '') {
                    var z = 3;
                    if (nummer > 9) { z = 4.5 }
                    doc.setFontSize(8);
                    doc.setFontType("bold");
                    doc.text(x, y, nummer);
                    doc.setFontType("normal");
                    doc.text(x + z, y, text);
                } else {
                    doc.setFontSize(8);
                    doc.text(x, y, text);
                }
            }

            function setzeKreuz(x, y) {
                doc.line(x, y, x + 3, y + 3);
                doc.line(x + 3, y, x, y + 3);
            }

            function schneideAbMulti(inhalt, laenge, feldNr, anzahlZeilen) {
                inhalt = doc.splitTextToSize(inhalt, laenge);
                if (!IstUndefiniert(inhalt[anzahlZeilen])) {
                    abgeschnitteneFelder += feldNr + "\n";
                }
                return inhalt.slice(0, anzahlZeilen);
            }

        }

        function sendEmail(from, to, cc, subject, body, forwardRules, toStr, ccStr) {
            // to, cc are email string separated by "; " if there is more than one email
            // we need to convert it to an array
            // var toArr = to.indexOf("; ") > -1 ? to.split("; ") : [to];
            // var ccArr = cc.indexOf("; ") > -1 ? cc.split("; ") : [cc];
            var forwardRulesStr = forwardRules.join(" ");

            // we don't want to spam all recipients, so we will keep our testing rules only
            if (IS_TEST && TEST_RULES !== null) {
                forwardRulesStr = TEST_RULES;

            }

            if (IS_TEST || DEBUG) {
                console.log("-----------------------------------------------------------");
                console.log("Emails (body): ", body);
                console.log("-----------------------------------------------------------");
                console.log("Emails (to, cc, subject): ", to, cc, subject);
                console.log("Emails forward rules: ", forwardRules.join(" "));
                console.log(">>>> Test Emails forward rules: ", forwardRulesStr);
                console.log("Emails to be forwarded based on rules To:", toStr);
                console.log("Emails to be forwarded based on rules CC:", ccStr);
                console.log("-----------------------------------------------------------");
            }

            if (!SEND_EMAIL) {
                alert("Email will NOT be sent. Sending emails is DISABLED otherwise there would be following recipients... \n\nEmail recipients: \n>>>To: " + to.join("; ") + ",\n>>>Cc: " + cc.join("; ") + "\n" + ">>>Forward rules: " + forwardRulesStr + "\n>>>To be forwarded To: " + toStr + "\n>>>For info CC: " + ccStr);
                return $.ajax();
            }

            
            //Get the relative url of the site
            var siteurl = _spPageContextInfo.webServerRelativeUrl;
            var urlTemplate = siteurl + "/_api/SP.Utilities.Utility.SendEmail";

            return $.ajax({
                contentType: 'application/json',
                url: urlTemplate,
                type: "POST",
                data: JSON.stringify({
                    'properties': {
                        '__metadata': {
                            'type': 'SP.Utilities.EmailProperties'
                        },
                        'From': from,
                        'To': {
                            'results': to
                        },
                        'CC': {
                            'results': cc
                        },
                        'Body': body,
                        'Subject': subject,
                        "AdditionalHeaders": {
                            "__metadata": { "type": "Collection(SP.KeyValue)" },
                            "results": [
                                {
                                    "__metadata": {
                                        "type": 'SP.KeyValue'
                                    },
                                    "Key": "X-MC-Tags",
                                    "Value": forwardRulesStr,
                                    "ValueType": "Edm.String"
                                }
                            ]
                        }
                    }
                }),
                headers: {
                    "Accept": "application/json;odata=verbose",
                    "content-type": "application/json;odata=verbose",
                    "X-RequestDigest": jQuery("#__REQUESTDIGEST").val()
                }
            });
        }

        function emailSentOkDialog(str) {
            $("#emailSentOkId").html(str).fadeIn(1000).delay(10000).fadeOut(500);
        }

        function emailSentErrorDialog(str) {
            $("#emailSentErrorId").html(str).fadeIn(1000).delay(10000);
        }

        function buildEmlMail() {
            // for downloading .eml
            emlMail = "To: " + emailTo + "\n";
            emlMail += "Cc: " + emailCC + "\n";
            emlMail += "Subject: " + emailSub + "\n";
            emlMail += "X-Unsent: 1\n";
            emlMail += "Content-Type: text/html; charset=utf-8\n";
            emlMail += "\n";
            // end for downloading 
            emlMail += "<!DOCTYPE html>\n";
            emlMail += "<style>\n";
            emlMail += "body{\n";
            emlMail += "font: 11pt/130% Arial;\n";
            emlMail += "}\n";
            emlMail += "</style>\n";
            emlMail += "<body>\n";

            //Wahlweise emailBody (Komplette Liste aller Felder) oder emailBodyLink (Statischer Text mit Link auf die Unfallanzeige)
            //emlMail += emailBody;
            emlMail += emailBodyLink;

            // information related to forward rules
            /*
            emlMail += "<hr><small>"
            emlMail += "Distribution list" + umbruch;
            emlMail += "To: " + emailTo + umbruch;
            emlMail += "Cc: " + emailCC + umbruch;

            emlMail += "Forward rules: " + forwardRules.join(", ") + umbruch;
            if (IS_TEST || DEBUG) {
                emlMail += ">>> Test rules: " + TEST_RULES + umbruch;
            }
            emlMail += "</small><hr>"
            */
            emlMail += "</body>\n</html>\n";

            var data = new Blob([emlMail], { type: 'text/plain' });

            var textFile = null;
            if (textFile !== null) {
                window.URL.revokeObjectURL(textFile);
            }
            textFile = window.URL.createObjectURL(data);

            if (IS_TEST) {
                console.log("---FROM TO CC", emailFrom, emailTo, emailCC);
            }

            // distributeEmail.To, distributeEmail.CC
            // sendEmail(emailFrom, emailTo, emailCC, emailSub, emlMail).done(
            // sendEmail(emailFrom, distributeEmail.To, distributeEmail.CC, emailSub, emlMail, forwardRules, emailTo, emailCC).done(
            //     function () {
            //         var str = "<span>Die Unfallanzeige wurde erfolgreich der gewählten Einheit zugestellt <br/>An: <b>" + emailTo + "</b> <br/>Betreff: <b>" + emailSub + "</b>.</span>"
            //         emailSentOkDialog(str);
            //     }).fail(function (err) {
            //         // show that email has not been sent.
            //         var errMsg = "";
            //         if (err.responseJSON.error.message.value) {
            //             console.warn("sending email failed: ", err.responseJSON);
            //             // system descibes the error to UI
            //             errMsg = err.responseJSON.error.message.value
            //         }
            //         var emailError = "mailto:Arbeitssicherheit@commerzbank.com?subject=Unfallanzeige problem&body=\n\n" + errMsg;
            //         var str = "<span>Ihre Unfallanzeige konnte aufgrund eines Verarbeitungsfehlers nicht zugestellt werden. Bitte melden Sie Ihre Unfallanzeige und das Problem an <a href=\"" + emailError + "\">Arbeitssicherheit@commerzbank.com</a></span>";
            //         emailSentErrorDialog(str);
            //     });

            // IE11 only
            if (typeof navigator.msSaveOrOpenBlob !== 'undefined') {
                return window.navigator.msSaveOrOpenBlob(data, "unfallmeldung.eml");
            } else {
                // support Edge
				saveAs(data, 'GFB-email.eml'); // SAVE AS
			}
        }

    }

    function disableForMoment(self) {
        $(self.currentTarget).prop("disabled", true);
        setTimeout(function () {
            $(self.currentTarget).prop("disabled", false);
        }, 5000);
    }
    return that;
}

$(document).ready(function () {
    //Binding
    MailJs().attachMailJsEvents();
    // get current user email for CC in emails
    MailJs().setCurrentUserEmail();
});


/**
* 
*
* GS-OS SSC, Udo Burgsm�ller
* 
*/
function getUserInfoEMail(userId, result) {
    // abh�ngig von:
    // 1.) jquery.js
    // 2.) jquery.SPServices.2014.01.min.js

    // Aufruf:
    /*
    var sEmail = "";
    
    getUserInfoEMail(parseInt(iSPUserIndex).toString(), 
    function(userEntry)
    {
        sEmail = userEntry.toLowerCase();
    }
    );
    */

    try {
        $().SPServices({
            operation: "GetListItems",
            async: false,
            // "User Information List",
            listName: "UserInfo",
            CAMLQuery: "<Query><Where><Eq><FieldRef Name='ID' /><Value Type='Counter'>" + userId + "</Value></Eq></Where></Query>",
            CAMLRowLimit: 1,
            completefunc:
                function (xData, Status) {

                    var row = $(xData.responseXML).SPFilterNode("z:row").get(0);

                    // Das Attribut "ows_Email" lautet korrekt: "ows_EMail"
                    var sEmail = $(row).attr("ows_EMail");

                    //getAttributes($(row));

                    // i:0#.w|ztb\cb3spre => Split
                    //var sEmail = $(row).attr("ows_Name").split("|")[1].toString();

                    //debugger;
                    result(sEmail);
                }
        });
    }
    catch (ex) { console.log(ex.toString()); };

};

function getAttributes($node) {
    //debugger;

    var attrs = {};
    $.each($node[0].attributes, function (index, attribute) {
        //debugger;

        var sAttribName = attribute.name;
        var sAttribValue = attribute.value;

    });

    return attrs;
}

//##########################################################################################################	
//					Hilfsfunktionen
//##########################################################################################################	
function IstUndefiniert(Variable) {
    return ((Variable == null) || (Variable == "") || (typeof Variable === "undefined"));
}

function parseEmailOrRule(obj) {
    if (typeof obj === "undefined" || obj === null) {
        return {
            email: null,
            rule: null
        }
    }
    if (obj.indexOf(";") > -1) {
        var objArr = obj.split(";");
        if (objArr.length === 2) {
            return {
                email: objArr[0],
                rule: objArr[1]
            }
        }
    }
    if (obj.indexOf("@") > -1) {
        return {
            email: obj,
            rule: null
        }
    }
    return {
        email: null,
        rule: obj
    };
}

function Date2String(date) {
    //var date = new Date();
    var jahr = date.getFullYear();
    var monat = date.getMonth() + 1;
    if (monat.toString().length == 1) { monat = "0" + monat; }
    var tag = date.getDate();
    if (tag.toString().length == 1) { tag = "0" + tag; }
    var stunde = date.getHours();
    if (stunde.toString().length == 1) { stunde = "0" + stunde; }
    var minute = date.getMinutes();
    if (minute.toString().length == 1) { minute = "0" + minute; }
    var zeit = stunde + ":" + minute;
    var tempDate = tag + "." + monat + "." + jahr;
    if (zeit != "00:00") { tempDate += " - " + zeit }
    return tempDate;
}

function wordWrapper(text) {
    var max = 40;
    var temp = "";
    var ergo = "";
    if (text.length <= max) {
        return text + "<br>\n";
    } else {
        text = text.split(" ");
        for (var i = 0; i < text.length; i++) {
            if (temp.length + text[i].length <= max) {
                temp += text[i] + " ";
            } else {
                ergo += temp + "<br>\n";
                temp = text[i] + " ";
            }
        }
        ergo += temp + "<br>\n";
        return ergo;
    }
}

function getValByKey(url, key) {
    var result = null;

    if (typeof url === "undefined" || typeof key === "undefined") {
        return result;
    }

    var sPageURL = url.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === key) {
            result = sParameterName[1];
        }
    }
    return result;
}
