import React from 'react';
import { View, StyleSheet, Platform, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/use-colors';

interface GradientBackgroundProps extends ViewProps {
    children?: React.ReactNode;
    variant?: 'primary' | 'success' | 'dark';
}

export function GradientBackground({ children, style, variant = 'primary', ...props }: GradientBackgroundProps) {
    const colors = useColors();

    const getGradientColors = (): [string, string, ...string[]] => {
        switch (variant) {
            case 'success':
                return ['#22c55e', '#15803d']; // Green gradient
            case 'dark':
                return ['#1f2937', '#111827']; // Dark gray gradient
            case 'primary':
            default:
                // Purple to violet (matching watcher portal)
                return ['#667eea', '#764ba2'];
        }
    };

    return (
        <LinearGradient
            colors={getGradientColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.container, style]}
            {...props}
        >
            {children}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
