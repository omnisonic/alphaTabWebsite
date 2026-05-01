import * as alphaTab from "@coderline/alphatab";
import { useAlphaTab } from "@site/src/hooks";
import { useEffect, useRef } from "react";

export interface AlphaTabPetalumaProps {
    children: string | React.ReactElement;
}

export const AlphaTabPetaluma: React.FC<AlphaTabPetalumaProps> = ({
    children,
}) => {
    const baseUrlRef = useRef('/');
    const [api, element] = useAlphaTab((s, baseUrl) => {
        baseUrlRef.current = baseUrl;
        s.core.tex = true;
        s.core.smuflFontSources = new Map<alphaTab.FontFileFormat, string>([
            [alphaTab.FontFileFormat.OpenType, `${baseUrl}files/petaluma/Petaluma.otf`]
        ])
    });

    useEffect(() => {
        if (api) {
            const request = new XMLHttpRequest();
            request.open('GET', `${baseUrlRef.current}files/petaluma/petaluma_metadata.json`, true);
            request.responseType = 'json';
            request.onload = () => {
                api.settings.display.resources.engravingSettings.fillFromSmufl(request.response);
                api.updateSettings();
                api.render();
            };
            request.send();

            return () => {
                request.abort();
            };
        }
    }, [api]);

    return (
        <div ref={element}>{children}</div>
    )
}