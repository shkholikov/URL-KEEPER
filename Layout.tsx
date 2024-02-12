import React, { useContext, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Footer, Icon, IconLink, Metabar, SimpleHeader } from "@lsg/components";
import { INavigationItem } from "@lsg/shared";
import { communication___envelope, interaction_arrows_arrowUp, location___globe, object___wrench, people___profile } from "@lsg/icons";
import { NavigateFunction } from "react-router/dist/lib/hooks";
import { AppContext } from "../App";
import InformationModal from "../components/dialogs/InformationModal";
import StickyButton from "../components/buttons/StickyButton";
import { hasCurrentUserPermission } from "../utils/helpers";
import { getAccessList } from "../utils/api";

interface ILayoutProps {}

const Layout: React.FC<ILayoutProps> = () => {
    const scrolling = useRef(document.querySelector('[data-automation-id="contentScrollRegion"]'));
    const [activeNav, setActiveNav] = useState<string>("");
    const [showUserAccount, setShowUserAccount] = useState(false);
    const config = JSON.parse(localStorage.getItem("obbConfiguration"));
    const appContext = useContext(AppContext);
    const location = useLocation();
    const navigate: NavigateFunction = useNavigate();
    const spAppBar = useRef(document.getElementById("sp-appBar"));
    const spLeftNav = useRef(document.getElementById("spLeftNav"));
    const spSiteHeader = useRef(document.getElementById("spSiteHeader"));
    const spCommandBar = useRef(document.getElementById("spCommandBar"));
    const spNavHeader = useRef(document.getElementById("SuiteNavWrapper"));
    //component access matrix, Title and Name must be elements in this array!
    const accessConfig: string[] = ["Title", "Name", "SeiteBegehungen", "SeiteObjektliste", "SeiteStatistik", "SeiteReports", "SeiteAdmin"];
    const [state, setState] = useState({
        errorState: false,
        errorMsg: null,
        dataLoaded: false,
        componentPermissionMatrix: null,
        currentUserGroups: appContext.initialData.currentUser.Groups
    });

    useEffect(() => {
        const fetchComponentsData = async (): Promise<void> => {
            const componentPermission = await getAccessList(config.accessMatrixListName, accessConfig);
            setState((state) => ({
                ...state,
                componentPermissionMatrix: componentPermission,
                dataLoaded: true
            }));
        };
        fetchComponentsData().catch((err: Error) => {
            console.error("An error occurred during fetching components data in Layout component: ", err);
            setState({ ...state, dataLoaded: true, errorState: true, errorMsg: err.message });
        });
    }, []);

    useEffect(() => {
        const pathname =
            location.pathname === "/"
                ? location.pathname
                : location.pathname.split("/")[1].includes("statisticsDetail")
                ? "statisticsDetail"
                : location.pathname.split("/")[1];
        switch (pathname) {
            case "/":
                setActiveNav("home");
                break;
            case "issueManagement":
            case "inspectionOverview":
                setActiveNav("inspections");
                break;
            case "statisticsDetail":
                setActiveNav("statistics");
                break;
            default:
                setActiveNav(pathname);
                break;
        }
    }, [location.pathname]);

    function createNavigationObject(): INavigationItem[] {
        const navigationTree: INavigationItem[] = [{ name: "home", label: "Hauptseite" }];
        if (state.dataLoaded) {
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "SeiteBegehungen") === true) {
                navigationTree.push({ name: "inspections", label: "Begehungen" });
            }
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "SeiteObjektliste") === true) {
                navigationTree.push({ name: "objects", label: "Objektliste" });
            }
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "SeiteStatistik") === true) {
                navigationTree.push({ name: "statistics", label: "Statistik" });
            }
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "SeiteReports") === true) {
                navigationTree.push({ name: "reports", label: "Reports" });
            }
            if (hasCurrentUserPermission(state.currentUserGroups, state.componentPermissionMatrix, "SeiteAdmin") === true) {
                navigationTree.push({ name: "admin", label: "Admin-Seite" });
            }
            return navigationTree;
        }
    }

    function onNavigationChange(value: string): void {
        if (value === "home") {
            navigate("/");
        } else {
            navigate(`/${value}`);
        }
    }

    function resetSPStyle(): void {
        if (spAppBar.current) {
            spAppBar.current.style.cssText = "display:initial";
        }
        if (spLeftNav.current) {
            spLeftNav.current.style.cssText = "display:initial";
        }
        if (spSiteHeader.current) {
            spSiteHeader.current.style.cssText = "display:initial";
        }
        if (spCommandBar.current) {
            spCommandBar.current.style.cssText = "display:initial";
        }
        if (spNavHeader.current) {
            spNavHeader.current.style.cssText = "display:initial";
        }
        window.location.href = appContext.context.pageContext.site.absoluteUrl;
    }

    return (
        <>
            <SimpleHeader
                segmentLabel={
                    config.isInTestingEnvironment
                        ? ((
                              <p>
                                  Filialcheck | <b style={{ color: "#FFD700" }}>{config.testingEnvironmentLabel}</b>{" "}
                              </p>
                          ) as unknown as string)
                        : "Filialcheck"
                }
                navigationTree={createNavigationObject()}
                value={activeNav}
                onChange={(value) => onNavigationChange(value)}
                iconLinksInteraction={
                    <>
                        <IconLink icon={people___profile} onClick={() => setShowUserAccount(true)} badgeText="DEV">
                            {appContext.context.pageContext.user.loginName.split("@")[0].toUpperCase()}
                        </IconLink>
                        {config.maintenanceMode ? <IconLink icon={object___wrench} look="no-text" disabled={true} /> : ""}
                    </>
                }
            />
            {/*render router child elements */}
            <div style={{ margin: "2%" }}>
                <Outlet />
            </div>
            <Footer>
                <Metabar
                    navigationTree={[{ label: `Version: ${appContext.context.manifest.version}`, name: "version" }]}
                    socialLinks={
                        <>
                            <IconLink onClick={resetSPStyle} icon={location___globe}>
                                Zurück zum SharepointPortal
                            </IconLink>
                            <IconLink
                                icon={communication___envelope}
                                href={`mailto:${config.reportingProblemEmail.TO}?cc=${config.reportingProblemEmail.CC} &subject=${config.reportingProblemEmail.Subject}&body=${config.reportingProblemEmail.Body}`}>
                                ein Problem melden
                            </IconLink>
                        </>
                    }
                />
            </Footer>
            <StickyButton
                buttonText="Nach Oben"
                rightPosition="30px"
                icon={interaction_arrows_arrowUp}
                onClick={() => scrolling.current.scrollTo({ top: 0, left: 0, behavior: "smooth" })}
            />
            <InformationModal
                isOpen={showUserAccount}
                icon={<Icon icon={people___profile} size="large" />}
                title={`Hallo: ${appContext.context.pageContext.user.displayName}`}
                message={`Sie sind angemeldet unter: ${appContext.context.pageContext.user.loginName}`}
                onClose={() => setShowUserAccount(false)}
            />
        </>
    );
};

export default Layout;
