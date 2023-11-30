import { CircleIconLink, ComplexTable, Grid, H2, IconLink, InputGroup, InputSelect, Link, Paragraph, Tabs } from "@lsg/components";
import * as React from "react";
import { ReactNode, useContext, useEffect, useState } from "react";
import { AppContext } from "../App";
import { getAccessList, getAnswerList, getCollectionList } from "../utils/api";
import { IAnswer, IAnswerItem, ICollectionItem, IQuestionItem } from "../utils/IApiProps";
import InlineWarning from "../components/banners/InlineWarning";
import { interaction___close, interaction___search } from "@lsg/icons";
import { hasCurrentUserPermission } from "../utils/helpers";
import Loading from "../components/banners/Loading";
import ErrorMsg from "../components/banners/ErrorMsg";
import styles from "../styles/App.module.scss";
import { useNavigate } from "react-router-dom";
import { NavigateFunction } from "react-router/dist/lib/hooks";

/* eslint-disable */

interface IStatisticsProps {}

interface IStatisticsData {
    number: string;
    text: string;
    statistics: string;
    rowStyle: { [key: string]: string };
    tdStyle: { [key: string]: string };
}

const Statistics: React.FC<IStatisticsProps> = () => {
    const appContext = useContext(AppContext);
    const config = JSON.parse(localStorage.getItem("obbConfiguration"));
    const navigate: NavigateFunction = useNavigate();
    const accessConfig: string[] = [
        "Title",
        "Name",
        //fire
        "Statistik_Brandschutz",
        //environment
        "Statistik_Umveltmngmt",
        //objcheck
        "Statistik_Gebaudecheck",
        //filfeedback
        "Statistik_Filialbegehung",
        //comfs
        "Statistik_ComFS"
    ];
    const [state, setState] = useState({
        errorState: false,
        errorMsg: null,
        dataLoaded: false,
        inspections: [],
        questions: [],
        possibleAnswers: [],
        questionsStatistics: [],
        reportCollections: [],
        regions: [],
        objectsWithRegions: [],
        filteredInspections: [],
        fromDate: new Date(new Date().getFullYear(), 0, 1),
        selectedYear: new Date().getFullYear().toString(),
        selectedDateFieldInvalid: false,
        toDate: new Date(),
        selectedRegion: null,
        fromDateFieldInvalid: false,
        toDateFieldInvalid: false,
        showWarning: false,
        warningText: "",
        availableYears: [],
        currentUserGroups: appContext.initialData.currentUser.Groups,
        componentPermissionMatrix: null,
        statisticsForVisualization: [],
        statisticsCalculated: false
    });

    useEffect(() => {
        const fetchComponentsData = async (): Promise<void> => {
            const componentPermission = await getAccessList(config.accessMatrixListName, accessConfig);
            const questionsSource = JSON.parse(JSON.stringify(appContext.initialData.questionList));
            const questions: IQuestionItem[] = [];
            questionsSource.forEach((question: IQuestionItem) => {
                if (question.Number !== null && question.Title !== "") {
                    question.Answer = question.Answer !== null && typeof question.Answer === "string" ? question.Answer.split(";") : [];
                    questions.push(question);
                }
            });
            const possibleAnswersList = preparePossibleAnswersList(questions);
            const aggregatedData: { value: string; label: string }[] = [];
            appContext.initialData.objectList.forEach((itm) => {
                if (aggregatedData.findIndex((obj) => obj.value === itm.STANDORT) === -1) {
                    aggregatedData.push({ value: itm.STANDORT, label: itm.STANDORT });
                }
            });
            const collections = await getCollectionList(
                config.collectionsListName[new Date().getFullYear()],
                config.queryList.collectionList,
                "COLTYPE eq 'Report'"
            );
            const availableYears: { [key: string]: string }[] = [];
            Object.keys(config.collectionsListName).forEach((itm) => {
                availableYears.push({
                    value: itm,
                    label: itm
                });
            });
            const enabledReports: ICollectionItem[] = [];
            for (const reportConfig of config.reports) {
                if (reportConfig.enabled === true && reportConfig.includedInStatistics === true) {
                    for (const itm of collections) {
                        if (itm.Title === reportConfig.collectionId) {
                            itm.accessMatrixId = reportConfig.statisticsAccessMatrixId;
                            enabledReports.push(itm);
                            break;
                        }
                    }
                }
            }
            setState((state) => ({
                ...state,
                componentPermissionMatrix: componentPermission,
                questions: questions,
                possibleAnswers: possibleAnswersList,
                reportCollections: enabledReports,
                availableYears: availableYears,
                regions: aggregatedData,
                objectsWithRegions: appContext.initialData.objectList
                // dataLoaded: true
            }));
        };
        fetchComponentsData().catch((err: Error) => {
            console.error("An error occurred during fetching objects data in Statistics component: ", err);
            setState({ ...state, dataLoaded: true, errorState: true, errorMsg: err.message });
        });
    }, []);

    useEffect(() => {
        const fetchComponentsData = async (): Promise<void> => {
            const selectedYearFilter = state.selectedYear !== "" ? `and startswith(Title, '${state.selectedYear}')` : "";

            const inspections = await getAnswerList(
                config.answersListName,
                config.queryList.answerList,
                `(STATUS eq '${config.BegehungStatus.FINISHED}' or STATUS eq '${config.BegehungStatus.CLOSED}') ${selectedYearFilter}`
            );
            const filteredInspections: IAnswerItem[] = [];
            if (state.selectedRegion) {
                if (checkSelectedDateInput() === true) {
                    const objectsInRegion: string[] = [];
                    appContext.initialData.objectList.forEach((itm) => {
                        if (state.selectedRegion === null) {
                            objectsInRegion.push(itm.OID);
                        } else if (itm.STANDORT === state.selectedRegion && objectsInRegion.findIndex((val) => val === itm.OID) === -1) {
                            objectsInRegion.push(itm.OID);
                        }
                    });
                    inspections.forEach((itm) => {
                        const OIDfromBID = itm.Title.trim().split("-")[2];
                        if (objectsInRegion.findIndex((val) => val === OIDfromBID) > -1) {
                            filteredInspections.push(itm);
                        }
                    });
                }
            }
            setState((state) => ({
                ...state,
                inspections: state.selectedRegion ? filteredInspections : inspections
            }));
        };
        if (!state.statisticsCalculated) {
            fetchComponentsData().catch((err: Error) => {
                console.error("An error occurred during fetching objects data in Statistics component: ", err);
                setState({ ...state, dataLoaded: true, errorState: true, errorMsg: err.message });
            });
        }
    }, [state.statisticsCalculated]);

    useEffect(() => {
        if (state.inspections.length > 0) {
            const tableStatistics = prepareStatistics();
            const statisticsForVisualization: {
                tabName: string;
                tabData: {
                    number: string;
                    text: string;
                    statistics: string;
                    rowStyle: { [key: string]: string };
                    tdStyle: { [key: string]: string };
                }[];
                accessMatrixId: string;
            }[] = [];
            tableStatistics.forEach((itm) => {
                statisticsForVisualization.push({
                    tabName: itm.title,
                    tabData: prepareTabDataForVisualization(itm.data),
                    accessMatrixId: itm.accessMatrixId
                });
            });
            setState({ ...state, statisticsForVisualization: statisticsForVisualization, statisticsCalculated: true, dataLoaded: true });
        }
    }, [state.inspections]);

    function preparePossibleAnswersList(questionList: IQuestionItem[]): string[] {
        const answers: string[] = [];
        questionList.forEach((itm) => {
            if (itm.Answer !== null && Array.isArray(itm.Answer)) {
                itm.Answer.forEach((answerItm: string) => {
                    if (answers.indexOf(answerItm) === -1) {
                        answers.push(answerItm);
                    }
                });
            }
        });
        return answers;
    }

    function prepareStatistics() {
        const stats = [];
        for (const group of state.reportCollections) {
            const content = prepareTable(group.DATA.split(";"));
            const statistic = {
                title: group.NAME,
                data: content,
                accessMatrixId: group.accessMatrixId
            };
            stats.push(statistic);
        }
        return stats;
    }

    function prepareTable(questions: string[]) {
        const table: { number: string; text: string; answers: { answer: string; count: string | number }[]; qtype: string }[] = [];
        questions.forEach((num: string) => {
            const questionIndex = state.questions.findIndex((itm) => itm.Number === num);
            const questionText = questionIndex > -1 ? state.questions[questionIndex].Title : "";
            const qType = questionIndex > -1 ? state.questions[questionIndex].qtype : "";
            const answers: { answer: string; count: string | number }[] = [];
            state.possibleAnswers.forEach((itm) => {
                let count: string | number = "-";
                const possibleAnswersForQuestion = questionIndex > -1 ? state.questions[questionIndex].Answer : null;
                if (possibleAnswersForQuestion && possibleAnswersForQuestion.findIndex((possibleItm: string) => possibleItm === itm) > -1) {
                    count = calculateStatistics(num, itm);
                }
                answers.push({ answer: itm, count: count });
            });
            if (questionIndex > -1) {
                const row = {
                    number: num,
                    text: questionText,
                    answers: answers,
                    qtype: qType
                };
                table.push(row);
            }
        });
        return table;
    }

    function calculateStatistics(number: string, answer: string): number {
        let count = 0;
        const source = state.filteredInspections.length > 0 ? state.filteredInspections : state.inspections;
        source.forEach((itm: IAnswerItem) => {
            const answersObj = typeof itm.ANSWERS === "string" ? JSON.parse(itm.ANSWERS) : itm.ANSWERS;
            answersObj.forEach((answerItm: IAnswer) => {
                if (answerItm.number === number && answerItm.answer === answer) {
                    count++;
                }
            });
        });
        return count;
    }

    function createApplicationContent(): ReactNode {
        const warning =
            state.showWarning === true ? (
                <Grid.Row>
                    <Grid.Column size={12}>
                        <InlineWarning message={state.warningText} />
                    </Grid.Column>
                </Grid.Row>
            ) : (
                ""
            );
        return (
            <Grid>
                <Grid.Row>
                    <Grid.Column size={12}>
                        <H2>Statistik</H2>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row verticalAlign={Grid.VerticalAlign.MIDDLE}>
                    <Grid.Column size={3}>
                        {/*hidden according to the new reqs*/}
                        {/* <InputDatepicker value={state.fromDate} label="Von"
                            invalid={state.fromDateFieldInvalid}
                            onChange={val => setState(() => ({ fromDate: val }))} /> */}
                        <InputSelect
                            label="Jahr"
                            options={state.availableYears}
                            invalid={state.selectedDateFieldInvalid}
                            value={state.selectedYear}
                            onChange={(value) => setState((state) => ({ ...state, selectedYear: value }))}
                        />
                    </Grid.Column>
                    {/*hidden according to the new reqs*/}
                    {/* <Grid.Column size={3}>
                        <InputDatepicker value={state.toDate} label="Bis"
                            invalid={state.toDateFieldInvalid}
                            onChange={val => setState(() => ({ toDate: val }))} />
                    </Grid.Column> */}
                    {/* <Grid.Column size={1} /> */}
                    <Grid.Column size={3}>
                        <InputSelect
                            label="Region"
                            options={state.regions}
                            value={state.selectedRegion}
                            onChange={(value) => setState({ ...state, selectedRegion: value })}
                        />
                    </Grid.Column>
                    <Grid.Column size={2}>
                        <InputGroup direction="horizontal">
                            <CircleIconLink
                                label=""
                                icon={interaction___search}
                                look="secondary"
                                onClick={() => {
                                    setState((state) => ({ ...state, statisticsCalculated: false, dataLoaded: false }));
                                }}
                            />
                            <CircleIconLink
                                label=""
                                icon={interaction___close}
                                look="secondary"
                                onClick={() => {
                                    setState({
                                        ...state,
                                        dataLoaded: false,
                                        statisticsCalculated: false,
                                        errorState: false,
                                        errorMsg: null,
                                        inspections: [],
                                        selectedYear: new Date().getFullYear().toString(),
                                        selectedDateFieldInvalid: false,
                                        selectedRegion: null,
                                        showWarning: false
                                    });
                                }}
                            />
                        </InputGroup>
                    </Grid.Column>
                </Grid.Row>
                {warning}
                <Grid.Row>
                    <Grid.Column size={12}>{createTabs(state.statisticsForVisualization)}</Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

    function prepareTabDataForVisualization(tabData: any[]): IStatisticsData[] {
        const data: IStatisticsData[] = [];
        tabData.forEach((itm) => {
            let stats = "";
            const itmAnswers = Array.isArray(itm.answers)
                ? itm.answers.filter((itemAnswer: { count: string }) => isNaN(itemAnswer.count as any) === false)
                : "";
            const reducer = (accumulator: number, currentValue: { count: string }) => accumulator + currentValue.count;
            const totalCount = itmAnswers.reduce(reducer, 0);
            itm.answers.forEach((answerItm: { answer: string; count: string }) => {
                if (isNaN(answerItm.count as any) === false) {
                    let percentile = (Number(answerItm.count) / totalCount) * 100;
                    percentile = isNaN(percentile) ? 0 : percentile;
                    stats += answerItm.answer + ": " + percentile.toFixed(0) + " % (" + answerItm.count + ");  ";
                }
            });
            const RowStyle =
                itm.qtype === "chapter"
                    ? {
                          borderTop: "solid",
                          borderBottom: "solid"
                      }
                    : { borderTop: "thin 2px", borderBottom: "thin 2px" };
            const TdStyle = itm.qtype === "chapter" ? { fontWeight: "bold" } : { fontWeight: "initial" };
            data.push({ number: itm.number, text: itm.text, statistics: stats, rowStyle: RowStyle, tdStyle: TdStyle });
        });
        data.sort((a, b) => a.number.localeCompare(b.number, "de", { numeric: true }));
        return data;
    }

    function checkSelectedDateInput(): boolean {
        setState((state) => ({ ...state, selectedDateFieldInvalid: false, showWarning: false }));
        if (state.selectedYear.length === 0) {
            setState((state) => ({ ...state, selectedDateFieldInvalid: true, showWarning: true, warningText: "Datum ist leer!" }));
            return false;
        }
        return true;
    }

    function createTabs(
        dataToShow: {
            tabName: string;
            tabData: { number: string; text: string; statistics: string; rowStyle: { [key: string]: string }; tdStyle: { [key: string]: string } }[];
            accessMatrixId: string;
        }[]
    ): ReactNode {
        const tabs = [];
        let idx = 0;
        for (const itm of dataToShow) {
            const component = accessConfig.includes(itm.accessMatrixId) ? itm.accessMatrixId : null;
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, component) === true) {
                tabs.push(
                    <Tabs.Tab label={itm.tabName} key={idx}>
                        {createTab(itm)}
                    </Tabs.Tab>
                );
                idx++;
            }
        }
        if (tabs.length > 0) {
            return <Tabs.Stateful>{tabs}</Tabs.Stateful>;
        } else {
            return (
                <Paragraph>
                    Sie sind für keine Statistik-Report autorisiert. Wenden Sie sich bitte bei Bedarf an die Mailbox{" "}
                    <Link href="mailto:strukturmanagementitflm@commerzbank.com">strukturmanagementitflm@commerzbank.com</Link>.
                </Paragraph>
            );
        }
    }

    function createTab(statItem: {
        tabName: string;
        tabData: { number: string; text: string; statistics: string; rowStyle: { [key: string]: string }; tdStyle: { [key: string]: string } }[];
        accessMatrixId: string;
    }): ReactNode {
        return (
            <ComplexTable.Stateful
                className={styles["inspection-statistics-table"]}
                numRowsPerPage={10}
                columnProperties={[
                    { title: "Nummer", name: "number" },
                    { title: "Frage", name: "question" },
                    { title: "Statistik", name: "stats" }
                ]}
                tableBodyData={statItem.tabData.map((entry, tabIdx) => ({
                    rowId: tabIdx.toString(),
                    rowData: [
                        <div key={tabIdx} style={entry.tdStyle}>
                            {entry.number}
                        </div>,
                        <div key={tabIdx} style={entry.tdStyle}>
                            {entry.text}
                        </div>,
                        createStatisticsLink(entry.number, entry.statistics, state.selectedYear)
                    ]
                }))}
            />
        );
    }

    function createStatisticsLink(number: string, statistics: string, year: string): ReactNode {
        const answers = statistics.split(";");
        const items: ReactNode[] = [];
        for (let i = 0; i < answers.length; i++) {
            const splitAnswer = answers[i].split(":");
            const separator = i <= answers.length - 2 ? ";  " : "";
            if (splitAnswer.length === 2 && parseInt(splitAnswer[1].trim()) > 0) {
                items.push(
                    <IconLink
                        look="no-icon"
                        htmlAttrs={{ target: "_blank" }}
                        onClick={() =>
                            navigate({
                                pathname: "/statisticsDetail",
                                search: `?number=${number}&answer=${encodeURI(splitAnswer[0].trim())}&year=${year}`
                            })
                        }>
                        {answers[i] + separator}
                    </IconLink>
                );
            } else {
                items.push(<IconLink look={"no-icon"}>{answers[i] + separator}</IconLink>);
            }
        }
        return <IconLink.Group direction={"horizontal"}>{items}</IconLink.Group>;
    }

    return (
        <Grid spacing="doublesubsection">
            {state.dataLoaded === false ? (
                <Loading />
            ) : state.errorState === true ? (
                <ErrorMsg message={state.errorMsg} />
            ) : (
                createApplicationContent()
            )}
        </Grid>
    );
};

export default Statistics;
