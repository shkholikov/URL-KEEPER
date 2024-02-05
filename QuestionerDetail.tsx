import * as React from "react";
import { ReactNode, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { useParams } from "react-router";
import { getAccessList, getAnswerList, getCollectionList, updateListItem } from "../utils/api";
import { IAnswer, IAnswerItem, INote, IObjectItem, IQuestion, IQuestionItem, ObjectCheck } from "../utils/IApiProps";
import {
    Accordion,
    ActionGroup,
    BarDiagram,
    Button,
    ComplexTable,
    Grid,
    H2Thin,
    Icon,
    IconLink,
    InputSelect,
    InputTextfield,
    Switch
} from "@lsg/components";
import {
    communication___news,
    interaction___add,
    interaction___checkmark,
    interaction___dashShort,
    interaction___share,
    interaction___trash,
    object___shieldCheckmark,
    object_document_checklist,
    object_document_document,
    symbols___error,
    symbols___infoCircle
} from "@lsg/icons";
import { checkObject, getDateFromBid, hasCurrentUserPermission, setObjectStatus } from "../utils/helpers";
import jsPDF from "jspdf";
import autoTable, { CellHookData } from "jspdf-autotable";
import "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import { NavigateFunction } from "react-router/dist/lib/hooks";
import Loading from "../components/banners/Loading";
import ErrorMsg from "../components/banners/ErrorMsg";
import InformationModal from "../components/dialogs/InformationModal";
import ConfirmationModal from "../components/dialogs/ConfirmationModal";
import InlineWarning from "../components/banners/InlineWarning";
import styles from "../styles/App.module.scss";
import { Tooltip } from "react-tooltip";
import InlineInfo from "../components/banners/InlineInfo";
import StickyButton from "../components/buttons/StickyButton";
import { IOptions } from "@lsg/components/dist/types/components/InputSelect/InputSelect";
import { tooltipStyle } from "../styles/tooltip-style";
import { useInterval } from "../hooks/useInterval";

interface IQuestionerDetailProps {}

export enum MultipleTextFieldAction {
    textChange = "TEXT-CHANGE",
    addField = "ADD-FIELD",
    removeField = "REMOVE-FIELD"
}

const QuestionerDetail: React.FC<IQuestionerDetailProps> = () => {
    const appContext = useContext(AppContext);
    const config = JSON.parse(localStorage.getItem("obbConfiguration"));
    const navigate: NavigateFunction = useNavigate();
    const { inspectionId } = useParams();
    const scrolling = useRef(document.querySelector('[data-automation-id="contentScrollRegion"]'));
    const scrollToElement = useRef(null);
    const timerId = useRef(null);
    // const isOnline = navigator.onLine;
    //component access matrix, Title and Name must be elements in this array!
    //btnNewInspection = StartBegehung
    const accessConfig: string[] = ["Title", "Name", "StartBegehung"];
    const [state, setState] = useState({
        errorState: false,
        errorMsg: null,
        dataLoaded: false,
        dataSaving: false,
        timer: null,
        inspectionNotOpened: false,
        allItemsLoaded: false,
        saveOkDialogOpen: false,
        moveNextDialogOpen: false,
        fillAllAnswersWarningOpen: false,
        ignoredQuestions: [],
        deleteInspectionConfirmationOpen: false,
        offlineMode: false,
        showOfflineConfirmation: false,
        showOnlineConfirmation: false,
        triggeredQuestions: [],
        skipQuestionary: [],
        BIDyear: inspectionId.split("-")[0].substring(0, 4),
        questionDescriptionWindowOpen: false,
        openAccordionIndex: null,
        accordionMultipleOpening: true,
        questionnaireStatistics: {
            totalQuestions: 0,
            notAnsweredQuestions: 0,
            answeredQuestions: 0,
            completedPercentage: 0,
            notAnsweredChapters: []
        },
        componentPermissionMatrix: null,
        answerItem: null,
        chaptersData: null,
        answerCollectionItem: null,
        buildingData: null,
        currentUserGroups: appContext.initialData.currentUser.Groups,
        qdescText: "",
        qdescLink: "",
        noteText: "",
        triggerStatisticsRecalculation: false,
        showOnlyUnanswered: false,
        showOnlyUnansweredConfirmation: false,
        showAllQuestionsConfirmation: false,
        answerItemWithUnanswered: null,
        highlightRequiredFields: false,
        showOfflineWarning: false,
        showOnlineWarning: false,
        changePerformed: false
    });

    useEffect(() => {
        const fetchComponentsData = async (): Promise<void> => {
            const componentPermission = await getAccessList(config.accessMatrixListName, accessConfig);
            const inspection = await getAnswerList(config.answersListName, config.queryList.answerList, `Title eq '${inspectionId}'`);
            inspection[0].ANSWERS =
                typeof inspection[0].ANSWERS === "string"
                    ? JSON.parse(inspection[0].ANSWERS.trim()).sort((a: IAnswer, b: IAnswer) =>
                          a.number.localeCompare(b.number, "de", { numeric: true })
                      )
                    : inspection[0].ANSWERS.sort((a: IAnswer, b: IAnswer) => a.number.localeCompare(b.number, "de", { numeric: true }));
            inspection[0].ANSWERS = addQuestionDataToAnswerObject(appContext.initialData.questionList, inspection[0].ANSWERS);
            inspection[0].NOTES = typeof inspection[0].NOTES === "string" ? JSON.parse(inspection[0].NOTES.trim()) : inspection[0].NOTES;
            addNotesDataToAnswerObject(inspection[0]);
            const chapters = inspection[0].ANSWERS.filter((item: IAnswer) => item.questionType === "chapter");
            const collection = appContext.initialData.collectionList.find((collection) => collection.Title === inspectionId.split("-")[1]);
            const object = appContext.initialData.objectList.find((object) => object.OID === inspectionId.split("-")[2]);
            const ignoredQuestions = await getCollectionList(
                config.collectionsListName[new Date().getFullYear()],
                config.queryList.collectionList,
                "NAME eq 'novalidation'"
            );
            if (inspection[0].STATUS === config.BegehungStatus.OPENED) {
                setState({
                    ...state,
                    componentPermissionMatrix: componentPermission,
                    ignoredQuestions: ignoredQuestions[0].DATA.split(";"),
                    triggeredQuestions: loadTriggeredQuestions(),
                    skipQuestionary: loadSkipQuestionary(),
                    answerItem: inspection[0],
                    chaptersData: chapters,
                    answerCollectionItem: collection,
                    buildingData: object,
                    triggerStatisticsRecalculation: !state.triggerStatisticsRecalculation,
                    dataLoaded: true
                });
            } else {
                setState({
                    ...state,
                    inspectionNotOpened: true,
                    dataLoaded: true
                });
            }
        };
        fetchComponentsData().catch((err: Error) => {
            console.error("An error occurred during fetching objects data in NewQuestionary component: ", err);
            setState({
                ...state,
                dataLoaded: true,
                errorState: true,
                errorMsg: err.message
            });
        });
    }, []);

    useEffect(() => {
        calculateQuestionnaireStatistics();
    }, [state.triggerStatisticsRecalculation]);

    useInterval(state.dataLoaded && config.autoSaveTime ? autoSaveCallback : null, config.autoSaveTime);
    // eslint-disable-next-line no-void
    // useTimeout(state.triggerSave ? () => autoSaveCallback : null, 3000);

    function autoSaveCallback(): void {
        if (!state.offlineMode && state.changePerformed) {
            // eslint-disable-next-line no-void
            void saveData(false);
        }
    }

    useEffect(() => {
        if (state.dataLoaded) {
            const handleOffline = (): void => {
                console.info("Internet connection has been lost!");
                setState((state) => ({ ...state, offlineMode: true, showOfflineWarning: true }));
            };

            const handleOnline = (): void => {
                console.info("Internet connection has been restored!");
                setState((state) => ({ ...state, offlineMode: false, showOnlineWarning: true }));
            };

            window.addEventListener("offline", handleOffline);
            window.addEventListener("online", handleOnline);
            //called when component unmounts to clean up the event listener
            return () => {
                window.removeEventListener("offline", handleOffline);
                window.removeEventListener("online", handleOnline);
            };
        }
    }, [state.dataLoaded]);

    useEffect(() => {
        return () => {
            //to clear timeId when component unmounts
            clearTimeout(timerId.current);
        };
    }, []);

    function loadTriggeredQuestions(): IQuestion[] {
        const triggerQuestionString = config.triggerQuestionNegativeAnswer;
        let triggerQuestions: IQuestion[] = [];
        if (triggerQuestionString.indexOf(";") > -1) {
            const questionCollection = triggerQuestionString.split(";");
            triggerQuestions = questionCollection.map((itm: string) => cleanQuestionConditionalAnswer(itm));
        } else {
            triggerQuestions.push(cleanQuestionConditionalAnswer(triggerQuestionString));
        }
        return triggerQuestions;
    }

    function loadSkipQuestionary(): IQuestion[] {
        const skipQuestionaryString = config.skipQuestionary;
        let skippingQuestions: IQuestion[] = [];
        if (skipQuestionaryString.indexOf(",") > -1) {
            const questionCollection = skipQuestionaryString.split(",");
            questionCollection.map((itm: string) => cleanQuestionConditionalAnswer(itm));

            skippingQuestions = questionCollection;
        } else {
            skippingQuestions.push(cleanQuestionConditionalAnswer(skipQuestionaryString));
        }
        return skippingQuestions;
    }

    function cleanQuestionConditionalAnswer(itm: string): IQuestion {
        const qData = itm.split(":");
        return { Number: qData[0], Answer: qData[1] };
    }

    function addQuestionDataToAnswerObject(allQuestions: IQuestionItem[], specifiedList: string | IAnswer[]): IAnswer[] {
        const data: IAnswer[] = [];
        if (typeof specifiedList !== "string") {
            specifiedList.forEach((specifiedQuestion) => {
                for (const question of allQuestions) {
                    if (specifiedQuestion.number === question.Number) {
                        let negAnswerString = "";
                        const filterTriggeredQuestions = state.triggeredQuestions.filter(
                            (negAnswer: IQuestion) => negAnswer.Number === specifiedQuestion.number
                        );
                        negAnswerString = filterTriggeredQuestions.length > 0 ? filterTriggeredQuestions[0].Answer : question.NegativeA;
                        specifiedQuestion = {
                            number: specifiedQuestion.number,
                            answer: specifiedQuestion.answer,
                            description: question.Title,
                            possibleAnswers: question.Answer !== null && typeof question.Answer === "string" ? question.Answer.split(";") : [],
                            negativeAnswer: negAnswerString,
                            childQuestions: question.parentquestion,
                            qdesc: question.qdesc,
                            separatorNum: question.SeparatorN,
                            issueState:
                                specifiedQuestion.answer && negAnswerString
                                    ? negAnswerString.indexOf(";") > -1
                                        ? question.NegativeA.split(";").some((negAnswer) => negAnswer === specifiedQuestion.answer)
                                        : specifiedQuestion.answer === negAnswerString
                                    : false,
                            questionType: question.qtype
                        };
                        data.push(specifiedQuestion);
                        break;
                    }
                }
            });
        }
        return data;
    }

    function addNotesDataToAnswerObject(inspection: IAnswerItem): void {
        if (inspection.NOTES && typeof inspection.NOTES !== "string") {
            if (inspection.NOTES.length > 0) {
                if (typeof inspection.ANSWERS !== "string") {
                    inspection.ANSWERS.forEach((answer) => {
                        answer.note = "";
                        answer.rooms = [""];
                        if (typeof inspection.NOTES !== "string") {
                            inspection.NOTES.forEach((note) => {
                                if (note.number === answer.number) {
                                    answer.note = note.text;
                                    if (note.rooms) {
                                        answer.rooms = note.rooms;
                                    }
                                }
                            });
                        }
                    });
                }
            } else {
                if (typeof inspection.ANSWERS !== "string") {
                    inspection.ANSWERS.forEach((answer) => {
                        answer.note = "";
                        answer.rooms = [""];
                    });
                }
            }
        } else {
            if (typeof inspection.ANSWERS !== "string") {
                inspection.ANSWERS.forEach((answer) => {
                    answer.note = "";
                    answer.rooms = [""];
                });
            }
        }
    }

    function calculateQuestionnaireStatistics(): void {
        if (state.answerItem) {
            const questions = state.answerItem.ANSWERS.filter(
                (item: IAnswer) => item.questionType === "question" && !item.number.startsWith(config.notIncludedInQuestionnaireInStatistics)
            );
            // let questions = state.answerItem.ANSWERS.filter((item) => item.questionType === "question");
            const chapters = state.answerItem.ANSWERS.filter((item: IAnswer) => item.questionType === "chapter");
            const notAnsweredQuestions = questions.filter((item: IAnswer) => !item.answer).length;
            const answeredQuestions = questions.filter((item: IAnswer) => !!item.answer).length;
            const notAnsweredChapters = getNotAnsweredChapters(chapters, questions);
            setState((prevState) => {
                const copyOfState = { ...prevState };
                copyOfState.questionnaireStatistics.totalQuestions = questions.length;
                copyOfState.questionnaireStatistics.notAnsweredQuestions = notAnsweredQuestions;
                copyOfState.questionnaireStatistics.answeredQuestions = answeredQuestions;
                copyOfState.questionnaireStatistics.completedPercentage = Math.round((answeredQuestions / questions.length) * 100);
                copyOfState.questionnaireStatistics.notAnsweredChapters = notAnsweredChapters;
                return copyOfState;
            });
        }
    }

    function getNotAnsweredChapters(chapters: IAnswer[], questions: IAnswer[]): string[] {
        const notAnsweredChapters: string[] = [];
        let chapterDescription;
        questions.forEach((question) => {
            if (!question.answer) {
                chapters.forEach((chapter) => {
                    if (question.number.split(".")[0] === chapter.number.split(".")[0]) {
                        chapterDescription = chapter.number + " " + chapter.description;
                        if (!(notAnsweredChapters.indexOf(chapterDescription) > -1)) {
                            notAnsweredChapters.push(chapterDescription);
                        }
                    }
                });
            }
        });
        return notAnsweredChapters;
    }

    function generateMultipleTextFields(entry: IAnswer): ReactNode {
        return (
            <>
                {entry.rooms.map((value: string, idx: number) => (
                    <InputTextfield.Stateful
                        key={`${entry.number}-${idx}`}
                        textArea={true}
                        defaultValue={value}
                        onBlur={(event) =>
                            handleMultipleTextFieldsChange(MultipleTextFieldAction.textChange, entry, (event.target as HTMLInputElement).value, idx)
                        }
                    />
                ))}
                <IconLink.Group direction="horizontal">
                    <span data-tooltip-id={`addNoteFieldBtn-${entry.number}`}>
                        <IconLink
                            key={`add-${entry.number}`}
                            look="no-text"
                            icon={interaction___add}
                            disabled={entry.rooms.length === config.multipleTextFieldsLimit}
                            iconColor={entry.rooms.length < 6 ? "secondary" : "disabled"}
                            onClick={() => handleMultipleTextFieldsChange(MultipleTextFieldAction.addField, entry)}>
                            Weitere
                        </IconLink>
                    </span>
                    <Tooltip id={`addNoteFieldBtn-${entry.number}`} float={true} style={tooltipStyle}>
                        Feld hinzufügen
                    </Tooltip>
                    <span data-tooltip-id={`removeNoteFieldBtn-${entry.number}`}>
                        <IconLink
                            key={`remove-${entry.number}`}
                            look="no-text"
                            icon={interaction___dashShort}
                            disabled={entry.rooms.length === 1}
                            iconColor={entry.rooms.length > 1 ? "secondary" : "disabled"}
                            onClick={() => handleMultipleTextFieldsChange(MultipleTextFieldAction.removeField, entry)}>
                            Entfernen
                        </IconLink>
                    </span>
                    <Tooltip id={`removeNoteFieldBtn-${entry.number}`} float={true} style={tooltipStyle}>
                        Feld löschen
                    </Tooltip>
                </IconLink.Group>
            </>
        );
    }

    function handleMultipleTextFieldsChange(type: string, entry: IAnswer, value?: string, index?: number): void {
        const currentAnswerItem = state.showOnlyUnanswered ? "answerItemWithUnanswered" : "answerItem";
        switch (type) {
            case MultipleTextFieldAction.textChange:
                setState((prevState) => ({
                    ...prevState,
                    changePerformed: true,
                    [currentAnswerItem]: {
                        ...prevState[currentAnswerItem],
                        ANSWERS: prevState[currentAnswerItem].ANSWERS.map((answer: IAnswer) => {
                            if (answer.number === entry.number) {
                                const rooms = [...answer.rooms];
                                rooms[index] = value;
                                return { ...answer, rooms: rooms };
                            }
                            return answer;
                        })
                    }
                }));
                break;
            case MultipleTextFieldAction.addField:
                setState((prevState) => ({
                    ...prevState,
                    changePerformed: true,
                    [currentAnswerItem]: {
                        ...prevState[currentAnswerItem],
                        ANSWERS: prevState[currentAnswerItem].ANSWERS.map((answer: IAnswer) => {
                            if (answer.number === entry.number) {
                                const rooms = [...answer.rooms];
                                rooms.push("");
                                return { ...answer, rooms: rooms };
                            }
                            return answer;
                        })
                    }
                }));
                break;
            case MultipleTextFieldAction.removeField:
                setState((prevState) => ({
                    ...prevState,
                    changePerformed: true,
                    [currentAnswerItem]: {
                        ...prevState[currentAnswerItem],
                        ANSWERS: prevState[currentAnswerItem].ANSWERS.map((answer: IAnswer) => {
                            if (answer.number === entry.number) {
                                const rooms = [...answer.rooms];
                                rooms.pop();
                                return { ...answer, rooms: rooms };
                            }
                            return answer;
                        })
                    }
                }));
                break;
        }
    }

    function createApplicationContent(): ReactNode {
        const data = state.showOnlyUnanswered ? state.answerItemWithUnanswered.ANSWERS : state.answerItem.ANSWERS;
        let childQuestions;
        const pdf =
            state.answerItem.STATUS === config.BegehungStatus.OPENED ? (
                <IconLink icon={object_document_document} onClick={() => generatePDFBlanket(data)}>
                    PDF Blanko-Checkliste
                </IconLink>
            ) : (
                ""
            );
        const deleteBtn =
            hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "StartBegehung") === true ? (
                <Grid.Row verticalAlign="middle">
                    <Grid.Column size={2}>
                        <div style={{ textAlign: "center" }}>
                            <IconLink
                                icon={interaction___trash}
                                iconColor="error"
                                disabled={state.offlineMode === true}
                                onClick={() =>
                                    setState({
                                        ...state,
                                        deleteInspectionConfirmationOpen: true
                                    })
                                }>
                                <span style={state.offlineMode === true ? { color: "#c1c1c1" } : { color: "#ef3340" }}>Begehung Löschen</span>
                            </IconLink>
                        </div>
                    </Grid.Column>
                </Grid.Row>
            ) : (
                ""
            );
        return (
            <>
                <Grid spacing="doublesubsection">
                    <Grid.Row>
                        <Grid.Column size={8}>
                            <H2Thin>
                                {state.answerCollectionItem.NAME} für {state.buildingData?.STRASSE + " " + state.buildingData?.ORT}
                            </H2Thin>
                        </Grid.Column>
                        <Grid.Column size={2}>{config.exportToBlankPDF === true ? pdf : ""}</Grid.Column>
                        <Grid.Column size={2}>
                            <Switch.Group direction="vertical">
                                <Switch
                                    label="Offline Modus"
                                    value={state.offlineMode}
                                    onChange={() => {
                                        // eslint-disable-next-line no-unused-expressions
                                        state.offlineMode
                                            ? setState({ ...state, showOnlineConfirmation: true })
                                            : setState({ ...state, showOfflineConfirmation: true });
                                    }}
                                />
                                <Switch
                                    label="Unbeantwortet anzeigen"
                                    value={state.showOnlyUnanswered}
                                    onChange={() => {
                                        // eslint-disable-next-line no-unused-expressions
                                        state.showOnlyUnanswered
                                            ? setState({ ...state, showAllQuestionsConfirmation: true })
                                            : setState({ ...state, showOnlyUnansweredConfirmation: true });
                                    }}
                                />
                            </Switch.Group>
                        </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                        <Grid.Column size={12}>{createBuildingInfo()}</Grid.Column>
                    </Grid.Row>
                    <Grid.Row verticalAlign="middle">
                        <Grid.Column size={5}>
                            <BarDiagram
                                label={"Gesamtanzahl Fragen: " + state.questionnaireStatistics.totalQuestions}
                                valueLabel={state.questionnaireStatistics.completedPercentage + "%"}
                                labelSubline={state.questionnaireStatistics.answeredQuestions + " beantwortet"}
                                valueLabelSubline={state.questionnaireStatistics.notAnsweredQuestions + " nicht beantwortet"}
                                percent={state.questionnaireStatistics.completedPercentage}
                            />
                        </Grid.Column>
                        <Grid.Column size={1}>
                            <div data-tooltip-id="diagramInfoIcon">
                                <IconLink
                                    icon={symbols___infoCircle}
                                    look="no-text"
                                    disabled={state.questionnaireStatistics.notAnsweredChapters.length === 0}
                                />
                            </div>
                            <Tooltip
                                id="diagramInfoIcon"
                                float={true}
                                style={{ fontFamily: "'Gotham', sans-serif", backgroundColor: "#EBF0F0", color: "#00333D", zIndex: 100 }}>
                                <div>
                                    <b>Kapitel mit offenen Fragen:</b>
                                </div>
                                {state.questionnaireStatistics.notAnsweredChapters.map((chapter, index) => {
                                    return <div key={index}>{chapter}</div>;
                                })}
                            </Tooltip>
                        </Grid.Column>
                        <Grid.Column size={6}>
                            <ActionGroup left={true}>
                                <Button
                                    disabled={state.offlineMode || state.dataSaving}
                                    onClick={() =>
                                        checkAnswerQuestions() === true
                                            ? setState((state) => ({ ...state, moveNextDialogOpen: true }))
                                            : setState((state) => ({ ...state, fillAllAnswersWarningOpen: true }))
                                    }>
                                    Filialcheck abschließen
                                </Button>
                                <Button look="secondary" loading={state.dataSaving} disabled={state.offlineMode} onClick={() => saveData(true)}>
                                    Speichern
                                </Button>
                            </ActionGroup>
                        </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                        <Grid.Column size={12}>
                            <Accordion.Group
                                multiple={state.accordionMultipleOpening}
                                openIndex={state.openAccordionIndex}
                                onChange={() => setState({ ...state, accordionMultipleOpening: true, openAccordionIndex: null })}>
                                {state.chaptersData?.map((chapter: IAnswer, index: number) => {
                                    childQuestions = data.filter((ques: IAnswer) => {
                                        if (chapter.separatorNum) {
                                            return (
                                                ques.number.split(".")[0] === chapter.number.split(".")[0] &&
                                                parseInt(ques.number.split(".")[1]) > parseInt(chapter.separatorNum.split("-")[0]) &&
                                                parseInt(ques.number.split(".")[1]) < parseInt(chapter.separatorNum.split("-")[1])
                                            );
                                        } else {
                                            return ques.number.split(".")[0] === chapter.number.split(".")[0] && ques.questionType !== "chapter";
                                        }
                                    });
                                    if (childQuestions.length > 0) {
                                        return (
                                            <Accordion key={index} title={chapter.number + " " + chapter.description}>
                                                <ComplexTable.Stateful
                                                    className={styles["inspection-table"]}
                                                    columnProperties={[
                                                        { title: "Nummer", name: "number" },
                                                        { title: "Frage", name: "question" },
                                                        { title: "Antwort", name: "answer" },
                                                        { title: "Raum", name: "room" },
                                                        { title: "Beschreibung", name: "note" }
                                                    ]}
                                                    tableBodyData={childQuestions.map((entry: IAnswer, idx: number) => {
                                                        const isChapter = entry.questionType !== null && entry.questionType === "chapter";
                                                        const RowStyle = isChapter === true ? { fontWeight: "bold", fontSize: "17px" } : {};
                                                        const ignored = state.ignoredQuestions.includes(entry.number);
                                                        const isRequired = state.highlightRequiredFields && !entry.answer && !ignored;
                                                        const isNoteRequired = entry.issueState && !entry.note;
                                                        return {
                                                            rowId: idx.toString(),
                                                            rowData: [
                                                                <div key={idx} style={RowStyle}>
                                                                    {entry.number}
                                                                </div>,
                                                                !entry.qdesc ? (
                                                                    <div style={RowStyle}>{entry.description}</div>
                                                                ) : (
                                                                    <>
                                                                        <div>{entry.description}</div>
                                                                        <span data-tooltip-id={`infoIcon-${entry.number}`}>
                                                                            <IconLink
                                                                                icon={symbols___infoCircle}
                                                                                onClick={() => createQdescWindow(entry.qdesc)}>
                                                                                Ergänzende Information
                                                                            </IconLink>
                                                                        </span>
                                                                        <Tooltip
                                                                            id={`infoIcon-${entry.number}`}
                                                                            float={true}
                                                                            style={{
                                                                                fontFamily: "'Gotham', sans-serif",
                                                                                backgroundColor: "#EBF0F0",
                                                                                color: "#00333D",
                                                                                zIndex: 100
                                                                            }}>
                                                                            Ergänzende Information
                                                                        </Tooltip>
                                                                    </>
                                                                ),
                                                                isChapter === false ? (
                                                                    <InputSelect
                                                                        value={entry.answer}
                                                                        invalid={isRequired}
                                                                        errorText={isRequired ? "Dieses Feld ist erforderlich" : ""}
                                                                        options={generateOptions(entry.possibleAnswers)}
                                                                        onChange={(selectedAnswer) =>
                                                                            answerChangedActionPerformed(entry.number, selectedAnswer)
                                                                        }
                                                                    />
                                                                ) : (
                                                                    ""
                                                                ),
                                                                isChapter === false ? generateMultipleTextFields(entry) : "",
                                                                isChapter === false ? (
                                                                    <InputTextfield.Stateful
                                                                        key={entry.number}
                                                                        textArea={true}
                                                                        defaultValue={entry.note}
                                                                        clearIcon={true}
                                                                        errorText={isNoteRequired ? "Dieses Feld ist erforderlich" : ""}
                                                                        // onBlur={(event) =>
                                                                        //     noteChanged(entry.number, (event.target as HTMLInputElement).value)
                                                                        // }
                                                                        onChange={(value) => noteChanged(entry.number, value)}
                                                                    />
                                                                ) : (
                                                                    ""
                                                                )
                                                            ]
                                                        };
                                                    })}
                                                />
                                            </Accordion>
                                        );
                                    }
                                })}
                            </Accordion.Group>
                            {state.showOnlyUnanswered && data.length === 0 ? <InlineInfo message="Alle Fragen wurden beantwortet." /> : ""}
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
                <Grid spacing="subsection" centeredLayout={true}>
                    {deleteBtn}
                </Grid>
            </>
        );
    }

    function checkAnswerQuestions(): boolean {
        if (config.forceFillAnswers === false) {
            return true;
        } else {
            let skipCheck = false;
            for (const skipQuestion of state.skipQuestionary) {
                state.answerItem.ANSWERS.map((itm: IAnswer) => {
                    if (skipQuestion.Number === itm.number && skipQuestion.Answer === itm.answer) {
                        skipCheck = true;
                    }
                });
            }
            if (skipCheck) {
                return true;
            } else {
                let allFilled = true;
                for (const itm of state.answerItem.ANSWERS) {
                    // let negAnswerIsTriggered = false;
                    // state.triggeredQuestions.every((negAnswer) => {
                    //     negAnswerIsTriggered = negAnswer.Number === itm.number ? itm.answer === itm.negativeAnswer : false;
                    // });
                    if (
                        itm.questionType !== "chapter" &&
                        isIgnored(itm.number) === false &&
                        // (itm.answer === null || itm.answer === "" || (negAnswerIsTriggered && !itm.note))
                        (!itm.answer || (!itm.note && itm.issueState))
                    ) {
                        allFilled = false;
                        setState((state) => ({
                            ...state,
                            accordionMultipleOpening: false,
                            openAccordionIndex: getQuestionChapter(itm.number),
                            highlightRequiredFields: true
                        }));
                        // scrollToElement.current = document.getElementById(itm.number);
                        break;
                    } else if (itm.questionType === "chapter") {
                        scrollToElement.current = document.getElementById(itm.number);
                    }
                }
                return allFilled;
            }
        }
    }

    function getQuestionChapter(qNumber: string): number {
        return state.chaptersData.findLastIndex((chapter: IAnswer) => {
            if (chapter.number.split(".")[0] === qNumber.split(".")[0]) {
                if (chapter.separatorNum) {
                    const separators = chapter.separatorNum.split("-");
                    if (parseInt(qNumber.split(".")[1]) > parseInt(separators[0]) && parseInt(qNumber.split(".")[1]) < parseInt(separators[1])) {
                        return chapter;
                    }
                } else {
                    return chapter;
                }
            }
        });
    }

    function isIgnored(number: string): boolean {
        if (state.ignoredQuestions.length === 0) {
            return false;
        } else {
            let ignored = false;
            for (const itm of state.ignoredQuestions) {
                if (itm === number) {
                    ignored = true;
                    break;
                }
            }
            return ignored;
        }
    }

    function generatePDFBlanket(data: IAnswer[]): void {
        const objectCols = [["Begehung ID", "WE", "FILHB", "Adresse", "GS-OS Standort", "Datum"]];
        const objectData = [
            [
                inspectionId,
                state.buildingData?.WE,
                state.buildingData?.FILHB,
                state.buildingData?.STRASSE + "\n" + state.buildingData?.PLZ + " " + state.buildingData?.ORT,
                state.buildingData?.STANDORT,
                getDateFromBid(inspectionId)
            ]
        ];
        const cols = ["Nr.", "Frage", "", "Antwort", "Beschreibung"];
        const rows = [];
        for (const itm of data) {
            rows.push(getRowData(itm));
        }
        // eslint-disable-next-line
        const doc = new jsPDF("landscape") as any;
        const totalPagesExp = "Seiten";
        doc.autoTableSetDefaults({
            headStyles: { fillColor: [255, 233, 0], textColor: [0, 65, 75] },
            styles: {
                textColor: [0, 65, 75],
                overflow: "linebreak",
                cellWidth: "wrap",
                rowPageBreak: "auto"
            },
            columnStyles: { text: { cellWidth: "linebreak" } }
        });
        doc.setTextColor(0, 65, 75);
        doc.text(state.answerCollectionItem.NAME, 14, 10);
        autoTable(doc, {
            head: objectCols,
            body: objectData,
            startY: 18
        });
        autoTable(doc, {
            head: [cols],
            body: rows,
            startY: doc.previousAutoTable.finalY + 10,
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: "auto" },
                2: { cellWidth: "auto" },
                3: { cellWidth: "auto" }
            },
            didDrawPage: function (data: CellHookData) {
                let str = "Seite " + doc.internal.getNumberOfPages();
                if (typeof doc.putTotalPages === "function") {
                    str = str + " von " + totalPagesExp;
                }
                doc.setFontSize(10);
                const pageSize = doc.internal.pageSize;
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                doc.text(str, data.settings.margin.left, pageHeight - 10);
                doc.text("Begehung ID: " + inspectionId, data.settings.margin.right * 15, pageHeight - 10);
            },
            didParseCell: function (data: CellHookData) {
                if (typeof data.cell.raw === "boolean") {
                    if (data.cell.raw === true) {
                        for (const key in data.row.cells) {
                            if (Object.prototype.hasOwnProperty.call(data.row.cells, key)) {
                                data.row.cells[key].styles.fontStyle = "bold";
                            }
                        }
                    }
                    data.cell.raw = "";
                    data.cell.text = [""];
                    data.cell.width = 0;
                }
            }
        });
        if (typeof doc.putTotalPages === "function") {
            doc.putTotalPages(totalPagesExp);
        }
        doc.save("Kontrollenblankett_" + inspectionId + ".pdf");
    }

    function getRowData(entry: IAnswer): (string | boolean)[] {
        const data: (string | boolean)[] = [entry.number, entry.description];
        let cross = "";
        let answers = "";
        for (const itm of entry.possibleAnswers) {
            answers += itm + "\n";
            if (entry.answer !== null && entry.answer !== "" && entry.answer === itm) {
                cross += "×\n";
            } else {
                cross += "\n";
            }
        }
        const isChapter = entry.questionType !== null && entry.questionType === "chapter";
        data.push(cross);
        data.push(answers);
        data.push(entry.note);
        data.push(isChapter);
        return data;
    }

    function createBuildingInfo(): ReactNode {
        return (
            <ComplexTable
                columnProperties={[
                    { title: "Begehung ID", name: "BID" },
                    { title: "WE", name: "we" },
                    { title: "FILHB", name: "filhb" },
                    { title: "Adresse", name: "address" },
                    { title: "GS-OS Standort", name: "place" },
                    { title: "", name: "link" }
                ]}
                tableBodyData={[state.buildingData].map((entry: IObjectItem, index: number) => ({
                    rowId: index.toString(),
                    rowData: [
                        inspectionId,
                        entry.WE,
                        entry.FILHB,
                        <div key={index}>
                            {entry.STRASSE}
                            <br />
                            {entry.PLZ} {entry.ORT}
                        </div>,
                        entry.STANDORT,
                        <IconLink
                            key={index}
                            icon={interaction___share}
                            disabled={state.offlineMode === true}
                            look="no-text"
                            onClick={(evt) => {
                                evt.stopPropagation();
                                evt.preventDefault();
                                navigate("/objects/" + entry.OID);
                            }}>
                            Weitere info
                        </IconLink>
                    ]
                }))}
            />
        );
    }

    async function saveData(showMessage: boolean): Promise<void> {
        setState((state) => ({ ...state, dataSaving: true }));
        const answerObjects = cleanUpAnswersForSave();
        await updateListItem(config.answersListName, state.answerItem.Id, {
            ANSWERS: JSON.stringify(answerObjects.answers),
            NOTES: JSON.stringify(answerObjects.notes)
        })
            .then(() => {
                console.info(`Answers have been saved. Inspection ID: ${inspectionId}`);
                if (showMessage && showMessage === true) {
                    setState((state) => ({
                        ...state,
                        saveOkDialogOpen: true,
                        changePerformed: false,
                        dataSaving: false,
                        triggerStatisticsRecalculation: !state.triggerStatisticsRecalculation
                    }));
                } else {
                    setState((state) => ({ ...state, changePerformed: false, dataSaving: false }));
                }
            })
            .catch((err) => {
                console.error("An error occurred during saving answers: " + err);
                setState({ ...state, errorState: true, errorMsg: err });
            });
    }

    async function moveNext(): Promise<void> {
        const answerObjects = cleanUpAnswersForSave();
        const answersToSolve = getAnswersToSolveAmount();
        if (answersToSolve === 0 && (await checkObject(config, inspectionId, state.buildingData, ObjectCheck.CHECK_FOR_CLOSE))) {
            await setObjectStatus(config.buildingListName, state.buildingData?.Id, config.ObjektStatus.CLOSED);
        }
        await updateListItem(config.answersListName, state.answerItem.Id, {
            ANSWERS: JSON.stringify(answerObjects.answers),
            NOTES: JSON.stringify(answerObjects.notes),
            STATUS: answersToSolve > 0 ? config.BegehungStatus.RESOLVING : config.BegehungStatus.FINISHED
        })
            .then((response) => {
                console.info("Answers have been saved and inspection has been finished. Data ID: " + response);
                navigate("/issueManagement/" + inspectionId);
            })
            .catch((err) => {
                console.error("An error occurred during saving and closing answers: " + err);
                setState({ ...state, errorState: true, errorMsg: err });
            });
    }

    function getAnswersToSolveAmount(): number {
        let amount = 0;
        for (const itm of state.answerItem.ANSWERS) {
            if (
                itm.answer && itm.negativeAnswer
                    ? itm.negativeAnswer.indexOf(";") > -1
                        ? itm.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === itm.answer)
                        : itm.answer === itm.negativeAnswer
                    : false
            ) {
                amount++;
            }
        }
        return amount;
    }

    function cleanUpAnswersForSave(): { answers: IAnswer[]; notes: INote[] } {
        const currentAnswerItem = JSON.parse(JSON.stringify(state.answerItem));
        if (state.showOnlyUnanswered) {
            //commented to optimize
            // currentAnswerItem.ANSWERS = currentAnswerItem.ANSWERS.filter((item: IAnswer) =>
            //     item.negativeAnswer?.indexOf(";") > -1
            //         ? item.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === item.answer)
            //             ? !item.answer || !item.note
            //             : !item.answer
            //         : item.negativeAnswer === item.answer
            //         ? !item.answer || !item.note
            //         : !item.answer
            // );
            currentAnswerItem.ANSWERS = [...state.answerItem.ANSWERS, ...state.answerItemWithUnanswered.ANSWERS].reduce((accumulator, current) => {
                const index = accumulator.findIndex((item: IAnswer) => item.number === current.number);
                if (index !== -1) {
                    accumulator[index] = current;
                } else {
                    accumulator.push(current);
                }
                return accumulator;
            }, []);
            const currentAnswerItemWithUnanswered = JSON.parse(JSON.stringify(state.answerItemWithUnanswered));
            currentAnswerItemWithUnanswered.ANSWERS = currentAnswerItemWithUnanswered.ANSWERS.filter((item: IAnswer) =>
                item.negativeAnswer?.indexOf(";") > -1
                    ? item.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === item.answer)
                        ? !item.answer || !item.note
                        : !item.answer
                    : item.negativeAnswer === item.answer
                    ? !item.answer || !item.note
                    : !item.answer
            );
            setState((state) => ({ ...state, answerItem: currentAnswerItem, answerItemWithUnanswered: currentAnswerItemWithUnanswered }));
        }
        const cleanedAnswers: IAnswer[] = [];
        const notes: INote[] = [];
        currentAnswerItem.ANSWERS.forEach((itm: IAnswer) => {
            cleanedAnswers.push({
                number: itm.number,
                answer: itm.answer
            });
            // if (itm.note && itm.note.toString() !== "") {
            itm.note = itm.note.replace(/"/g, "''");
            notes.push({
                number: itm.number ? itm.number : "",
                text: itm.note ? itm.note : "",
                dept: itm.dept ? itm.dept : "",
                subDept: itm.subDept ? itm.subDept : "",
                issueNr: itm.issueNr ? itm.issueNr : "",
                sendTo: itm.sendTo ? itm.sendTo : [],
                rooms: itm.rooms ? itm.rooms : [""]
            });
            // }
        });
        return { answers: cleanedAnswers, notes: notes };
    }

    function createQdescWindow(message: string): void {
        const text = message.split("link:")[0];
        const link = message.split("link:")[1];
        setState((prevState) => ({ ...prevState, questionDescriptionWindowOpen: true, qdescText: text, qdescLink: link }));
    }

    function answerChangedActionPerformed(questionNr: string, answer: string): void {
        const currentAnswerItem = state.showOnlyUnanswered ? "answerItemWithUnanswered" : "answerItem";
        setState((prevState) => {
            const newAnswerItem = { ...prevState[currentAnswerItem] };
            newAnswerItem.ANSWERS = newAnswerItem.ANSWERS.map((item: IAnswer) => {
                if (item.number === questionNr) {
                    const isNegative = item.negativeAnswer
                        ? item.negativeAnswer?.indexOf(";") > -1
                            ? item.negativeAnswer.split(";").some((negAnswer) => negAnswer === answer)
                            : answer === item.negativeAnswer
                        : false;
                    if (item.childQuestions && item.childQuestions.toString() !== "") {
                        prefillChildAnswers(newAnswerItem.ANSWERS, item.childQuestions, answer);
                    }
                    return { ...item, issueState: isNegative, answer: answer };
                }
                return item;
            });
            return { ...prevState, [currentAnswerItem]: newAnswerItem, changePerformed: true };
        });
    }

    function prefillChildAnswers(allAnswers: IAnswer[], childQuestions: string, selectedAnswer: string): void {
        const childQuestionsData = childQuestions.split("->");
        if (selectedAnswer === childQuestionsData[0]) {
            childQuestionsData[1].split(";").forEach((val) => {
                allAnswers.forEach((itm) => {
                    if (itm.number === val) {
                        return (itm.answer = childQuestionsData[2]);
                    }
                });
            });
        }
    }

    function generateOptions(list: string[]): IOptions[] {
        const options: IOptions[] = [];
        list.forEach((itm) => {
            options.push({ label: itm, value: itm });
        });
        return options;
    }

    function noteChanged(questionNr: string, value: string): void {
        clearTimeout(timerId.current);
        timerId.current = setTimeout(() => {
            const currentAnswerItem = state.showOnlyUnanswered ? "answerItemWithUnanswered" : "answerItem";
            setState((prevState) => ({
                ...prevState,
                changePerformed: true,
                [currentAnswerItem]: {
                    ...prevState[currentAnswerItem],
                    ANSWERS: prevState[currentAnswerItem].ANSWERS.map((item: IAnswer) => {
                        if (item.number === questionNr) {
                            return { ...item, note: value };
                        }
                        return item;
                    })
                }
            }));
        }, 500);
    }

    function showOnlyUnanswered(): void {
        // void saveData(false);
        //deep copy
        const currentAnswerItem = JSON.parse(JSON.stringify(state.answerItem));
        currentAnswerItem.ANSWERS = currentAnswerItem.ANSWERS.filter((item: IAnswer) =>
            item.negativeAnswer?.indexOf(";") > -1
                ? item.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === item.answer)
                    ? !item.answer || !item.note
                    : !item.answer
                : item.negativeAnswer === item.answer
                ? !item.answer || !item.note
                : !item.answer
        );
        setState({
            ...state,
            showOnlyUnanswered: true,
            answerItemWithUnanswered: currentAnswerItem,
            showOnlyUnansweredConfirmation: false
        });
    }

    function showAllAnswers(): void {
        const currentAnswerItem = JSON.parse(JSON.stringify(state.answerItem));
        //commented to optimize
        // currentAnswerItem.ANSWERS = currentAnswerItem.ANSWERS.filter((item: IAnswer) =>
        //     item.negativeAnswer?.indexOf(";") > -1
        //         ? item.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === item.answer)
        //             ? !item.answer || !item.note
        //             : !item.answer
        //         : item.negativeAnswer === item.answer
        //         ? !item.answer || !item.note
        //         : !item.answer
        // );
        currentAnswerItem.ANSWERS = [...state.answerItem.ANSWERS, ...state.answerItemWithUnanswered.ANSWERS].reduce((accumulator, current) => {
            const index = accumulator.findIndex((item: IAnswer) => item.number === current.number);
            if (index !== -1) {
                accumulator[index] = current;
            } else {
                accumulator.push(current);
            }
            return accumulator;
        }, []);
        const currentAnswerItemWithUnanswered = JSON.parse(JSON.stringify(state.answerItemWithUnanswered));
        currentAnswerItemWithUnanswered.ANSWERS = currentAnswerItemWithUnanswered.ANSWERS.filter((item: IAnswer) =>
            item.negativeAnswer?.indexOf(";") > -1
                ? item.negativeAnswer.split(";").some((negAnswer: string) => negAnswer === item.answer)
                    ? !item.answer || !item.note
                    : !item.answer
                : item.negativeAnswer === item.answer
                ? !item.answer || !item.note
                : !item.answer
        );
        setState((state) => ({
            ...state,
            showOnlyUnanswered: false,
            showAllQuestionsConfirmation: false,
            answerItem: currentAnswerItem,
            answerItemWithUnanswered: currentAnswerItemWithUnanswered
        }));
    }

    return (
        <>
            <InformationModal
                isOpen={state.showOfflineWarning}
                icon={<Icon icon={symbols___error} color="note" size="large" />}
                title="Internetverbindung unterbrochen"
                message="Der offline Modus wurde automatisch aktiviert, da Ihre Internetverbindung unterbrochen wurde."
                onClose={() => setState({ ...state, showOfflineWarning: false })}
            />
            <InformationModal
                isOpen={state.showOnlineWarning}
                icon={<Icon icon={object___shieldCheckmark} color="success" size="large" />}
                title="Internetverbindung wiederhergestellt"
                message="Der offline Modus wurde automatisch deaktiviert, da Ihre Internetverbindung wiederhergestellt wurde."
                onClose={() => {
                    setState({ ...state, showOnlineWarning: false });
                    // eslint-disable-next-line no-void
                    void saveData(false);
                }}
            />
            <InformationModal
                isOpen={state.saveOkDialogOpen}
                icon={<Icon icon={interaction___checkmark} color="success" size="large" />}
                title="Sicherung erfolgreich"
                message="Daten wurden erfolgreich gespeichert."
                onClose={() => setState({ ...state, saveOkDialogOpen: false })}
            />
            <InformationModal
                isOpen={state.questionDescriptionWindowOpen}
                icon={<Icon icon={communication___news} color="primary-2" size="large" />}
                title="Ergänzende Information"
                message={state.qdescText}
                link={state.qdescLink}
                onClose={() => setState({ ...state, questionDescriptionWindowOpen: false })}
            />
            <InformationModal
                isOpen={state.fillAllAnswersWarningOpen}
                icon={<Icon icon={symbols___error} color="note" size="large" />}
                title="Nicht alle Fragen beantwortet"
                message="Einige Fragen wurden nicht beantwortet. Bitte wählen Sie bei allen Fragen eine Antwort aus."
                onClose={() => {
                    setState((state) => ({ ...state, fillAllAnswersWarningOpen: false }));
                    if (scrollToElement) {
                        setTimeout(
                            () =>
                                scrolling.current.scrollTo({
                                    top: scrollToElement.current.getBoundingClientRect().top + scrolling.current.scrollTop,
                                    left: 0,
                                    behavior: "smooth"
                                }),
                            500
                        );
                    }
                }}
            />
            <InformationModal
                isOpen={state.deleteInspectionConfirmationOpen}
                icon={<Icon icon={symbols___error} color="note" size="large" />}
                title="Begehung löschen?"
                message="Sind Sie sicher, dass Sie die aktuelle Begehung löschen möchten? Senden Sie bitte eine Mail an strukturmanagementitflm@commerzbank.com"
                onClose={() => setState((state) => ({ ...state, deleteInspectionConfirmationOpen: false }))}
            />
            <ConfirmationModal
                isOpen={state.showOfflineConfirmation}
                title="Offline-Modus aktivieren?"
                message="Der Offline-Modus ist für die Verwendung an Orten ohne stabile Internetverbindung vorgesehen. Im Offline-Modus wird das automatische Speichern deaktiviert. Außerdem können Sie die Begehung nicht speichern und können auch nicht zur nächsten Phase übergehen. Im Offline-Modus klicken Sie bitte nicht auf einen anderen Menüpunkt oder aktualisieren die Seite, da sonst alle eingegebenen Daten verloren gehen."
                yesButtonText="Ja"
                noButtonText="Nein"
                onYes={() => {
                    // eslint-disable-next-line no-void
                    void saveData(false);
                    setState((state) => ({
                        ...state,
                        showOfflineConfirmation: false,
                        offlineMode: true
                    }));
                }}
                onNo={() => setState({ ...state, showOfflineConfirmation: false })}
            />
            <ConfirmationModal
                isOpen={state.showOnlineConfirmation}
                title="Wieder in online Modus wechseln?"
                message="Bevor Sie wieder online gehen, stellen Sie sicher, dass Sie über eine stabile Internetverbindung verfügen. Andernfalls wird das Speichern fehlschlagen und alle Einträge sind verloren."
                yesButtonText="Ja"
                noButtonText="Nein"
                onYes={() => {
                    // eslint-disable-next-line no-void
                    void saveData(false);
                    setState((state) => ({
                        ...state,
                        showOnlineConfirmation: false,
                        offlineMode: false
                    }));
                }}
                onNo={() => setState({ ...state, showOnlineConfirmation: false })}
            />
            <ConfirmationModal
                isOpen={state.moveNextDialogOpen}
                title="Filialcheck abschließen?"
                message="Möchten Sie den Filialcheck wirklich abschließen? Danach können Sie Ihre Antworten nicht mehr bearbeiten!"
                yesButtonText="Ja"
                noButtonText="Nein"
                onYes={() => {
                    setState({ ...state, moveNextDialogOpen: false });
                    // eslint-disable-next-line no-void
                    void moveNext();
                }}
                onNo={() => setState({ ...state, moveNextDialogOpen: false })}
            />
            <ConfirmationModal
                isOpen={state.showOnlyUnansweredConfirmation}
                title="Unbeantwortet anzeigen"
                message="Sind Sie damit einverstanden, dass nur unbeantwortete Fragen angezeigt werden?"
                yesButtonText="Ja"
                noButtonText="Nein"
                onYes={showOnlyUnanswered}
                onNo={() => setState({ ...state, showOnlyUnansweredConfirmation: false })}
            />
            <ConfirmationModal
                isOpen={state.showAllQuestionsConfirmation}
                title="Zeige alle Fragen"
                message="Sind Sie damit einverstanden, dass alle Fragen angezeigt werden?"
                yesButtonText="Ja"
                noButtonText="Nein"
                onYes={showAllAnswers}
                onNo={() => setState({ ...state, showAllQuestionsConfirmation: false })}
            />
            <StickyButton
                buttonText="Speichern"
                rightPosition="130px"
                icon={object_document_checklist}
                disabled={state.offlineMode}
                dataSaving={state.dataSaving}
                onClick={saveData}
            />
            {state.inspectionNotOpened === true ? <InlineWarning message="Die ausgewählte Prüfung wurde bereits bearbeitet." /> : ""}
            {state.dataLoaded === false ? (
                <Loading />
            ) : state.errorState === true ? (
                <ErrorMsg message={state.errorMsg} />
            ) : (
                createApplicationContent()
            )}
        </>
    );
};

export default React.memo(QuestionerDetail);
