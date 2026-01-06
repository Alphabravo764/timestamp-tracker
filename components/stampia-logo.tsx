import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface StampiaLogoProps {
    size?: number;
    color?: string;
}

/**
 * STAMPIA Logo - "Focus Lock S"
 * Represents capturing verified time/location (Proof of Presence)
 * Primary Brand Color: #0055FF (Electric Blue)
 */
const StampiaLogo: React.FC<StampiaLogoProps> = ({
    size = 40,
    color = "#0055FF"
}) => {
    return (
        <Svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
        >
            {/* Top Left Bracket */}
            <Path
                d="M25 10H10V25"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Top Right Bracket */}
            <Path
                d="M75 10H90V25"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Bottom Right Bracket */}
            <Path
                d="M90 75V90H75"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Bottom Left Bracket */}
            <Path
                d="M25 90H10V75"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* The Central S */}
            <Path
                d="M65 30H40C34.4772 30 30 34.4772 30 40V45C30 50.5228 34.4772 55 40 55H60C65.5228 55 70 59.4772 70 65V70C70 75.5228 65.5228 80 60 80H35"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
};

export default StampiaLogo;

// Brand Constants
export const STAMPIA_BRAND = {
    name: "STAMPIA",
    tagline: "Proof of Presence",
    colors: {
        primary: "#0055FF",      // Electric Blue - Logo, Primary Actions
        background: "#FFFFFF",   // White
        backgroundAlt: "#F8F9FA", // Off-white for dashboard
        text: "#111827",         // Deep Charcoal for readability
    },
    fonts: {
        headline: "Rubik",       // Bold for brand name
        data: "JetBrains Mono",  // Monospaced for timestamps
    }
};
