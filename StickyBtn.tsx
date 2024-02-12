import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@lsg/components";

interface IStickyButtonProps {
    buttonText: string;
    rightPosition: string;
    icon: unknown;
    disabled?: boolean;
    dataSaving?: boolean;
    onClick: (showMessage?: boolean) => void;
}

const StickyButton: React.FC<IStickyButtonProps> = (props) => {
    const scrolling = useRef(document.querySelector('[data-automation-id="contentScrollRegion"]'));
    const [showStickyBtn, setShowStickyBtn] = useState(false);

    useEffect(() => {
        if (scrolling.current) {
            const handleScroll = (): void => {
                const scrollY = scrolling.current.scrollTop;
                setShowStickyBtn(scrollY >= 160);
            };

            scrolling.current.addEventListener("scroll", handleScroll);
            //called when component unmounts to clean up the event listener
            return () => {
                scrolling.current.removeEventListener("scroll", handleScroll);
            };
        }
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                bottom: "0px",
                right: props.rightPosition,
                cursor: "pointer",
                transition: "opacity 0.2s linear, visibility 0.2s linear",
                zIndex: 30,
                opacity: showStickyBtn ? 1 : 0,
                visibility: showStickyBtn ? "visible" : "hidden"
            }}>
            <ActionButton
                id="stickySaveBtn"
                icon={props.icon}
                loading={props.dataSaving}
                disabled={props.disabled}
                onClick={() => props.onClick(true)}>
                {props.buttonText}
            </ActionButton>
        </div>
    );
};

export default StickyButton;
