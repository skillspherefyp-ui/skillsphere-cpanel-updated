import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

const AppButton = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  glow = false,
}) => {
  const { theme, isDark } = useTheme();
  const isWeb = Platform.OS === 'web';

  // Size configurations — driven by theme.button.sizes
  const sizeConfig = {
    sm: { height: theme.button.sizes.sm.height, paddingHorizontal: theme.button.sizes.sm.paddingHorizontal, fontSize: theme.button.sizes.sm.fontSize, iconSize: 16 },
    md: { height: theme.button.sizes.md.height, paddingHorizontal: theme.button.sizes.md.paddingHorizontal, fontSize: theme.button.sizes.md.fontSize, iconSize: 18 },
    lg: { height: theme.button.sizes.lg.height, paddingHorizontal: theme.button.sizes.lg.paddingHorizontal, fontSize: theme.button.sizes.lg.fontSize, iconSize: 20 },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  const getButtonStyles = () => {
    const baseStyle = [
      styles.button,
      {
        height: currentSize.height,
        paddingHorizontal: currentSize.paddingHorizontal,
        borderRadius: theme.button.borderRadius, // pill shape from theme
      },
      fullWidth && styles.fullWidth,
      disabled && styles.disabled,
    ];

    if (variant === 'outline') {
      return [
        ...baseStyle,
        {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
        },
      ];
    }

    if (variant === 'ghost') {
      return [
        ...baseStyle,
        {
          backgroundColor: 'transparent',
        },
      ];
    }

    if (variant === 'secondary') {
      return [
        ...baseStyle,
        {
          backgroundColor: isDark ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      ];
    }

    if (variant === 'glass') {
      return [
        ...baseStyle,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,26,46,0.06)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,26,46,0.12)',
          ...(isWeb ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
        },
      ];
    }

    return baseStyle;
  };

  const getTextColor = () => {
    if (variant === 'outline' || variant === 'ghost') {
      return theme.colors.primary;
    }
    if (variant === 'secondary') {
      return theme.colors.textPrimary;
    }
    if (variant === 'danger') {
      return '#FFFFFF';
    }
    if (variant === 'glass') {
      return isDark ? '#FFFFFF' : '#1A1A2E';
    }
    return theme.colors.textInverse;
  };

  const getGradientColors = () => {
    if (variant === 'primary') {
      return [theme.colors.buttonGradientStart, theme.colors.buttonGradientEnd];
    }
    if (variant === 'danger') {
      return [theme.colors.error, theme.colors.errorDark];
    }
    if (variant === 'success') {
      return [theme.colors.success, theme.colors.successDark];
    }
    return [theme.colors.buttonGradientStart, theme.colors.buttonGradientEnd];
  };

  const getGlowStyle = () => {
    if (!glow || disabled) return {};

    const gradientColors = getGradientColors();

    if (isWeb) {
      return {
        boxShadow: `0 4px 16px ${gradientColors[0]}40`,
      };
    }

    if (isDark) {
      return theme.shadows.glow;
    }
    return {
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    };
  };

  // Hover effects for web (Section 8.3)
  const getWebHoverStyles = () => {
    if (!isWeb) return {};
    return {
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
    };
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' || variant === 'secondary'
            ? theme.colors.primary
            : theme.colors.textInverse}
          size="small"
        />
      );
    }

    return (
      <View style={styles.content}>
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>{icon}</View>
        )}
        <Text style={[
          styles.text,
          {
            color: getTextColor(),
            fontSize: currentSize.fontSize,
            fontFamily: theme.typography.fontFamily.semiBold,
          },
          textStyle
        ]}>
          {title}
        </Text>
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>{icon}</View>
        )}
      </View>
    );
  };

  // For gradient buttons (primary, danger, success)
  if (variant === 'primary' || variant === 'danger' || variant === 'success') {
    const gradientColors = getGradientColors();

    // Web gradient style (Section 6.1 - Linear 135 deg)
    const webGradientStyle = {
      background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
      backgroundColor: gradientColors[0],
      ...(isWeb && !disabled ? { boxShadow: `0 4px 18px ${gradientColors[0]}50` } : {}),
    };

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[getButtonStyles(), !isWeb ? getGlowStyle() : {}, getWebHoverStyles(), style]}
      >
        {isWeb ? (
          <View style={[styles.gradient, webGradientStyle, { borderRadius: theme.button.borderRadius }]}>
            {renderContent()}
          </View>
        ) : (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradient, { borderRadius: theme.button.borderRadius }]}
          >
            {renderContent()}
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  }

  // For non-gradient buttons (outline, ghost, secondary, glass)
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[getButtonStyles(), getGlowStyle(), getWebHoverStyles(), style]}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
});

export default AppButton;
