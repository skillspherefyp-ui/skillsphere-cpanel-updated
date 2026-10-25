import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';

/**
 * StatCard — horizontal compact card with optional filter behaviour.
 *
 * Props:
 *   icon        string   Ionicons name
 *   color       string   Accent hex colour (tints bg, icon, value, bar)
 *   value       any      Main number / text to display
 *   label       string   Small label below the value
 *   ratio       number   0-1  — fills the thin progress bar (optional)
 *   onPress     fn       Makes card tappable (filter shortcut etc.)
 *   isActive    bool     Highlights card as currently-selected filter
 *   style       obj      Extra container overrides
 */
const StatsCard = ({
  icon,
  color,
  iconColor,
  value,
  label,
  ratio,
  onPress,
  isActive = false,
  style,
  change,
  variant,
}) => {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';

  // Compact mode when the card will be one of 3 in a narrow row
  const isMobile = width <= 480;

  const accent = color || iconColor || theme.colors.primary;
  const tint   = `${accent}18`;
  const tintMd = `${accent}30`;

  const cardStyle = [
    styles.container,
    {
      backgroundColor: isActive
        ? (isDark ? tintMd : `${accent}12`)
        : (isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF'),
      borderWidth: isActive ? 1.5 : 1,
      borderColor: isActive
        ? accent
        : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.08)'),
      paddingHorizontal: isMobile ? 10 : 14,
      paddingVertical:   isMobile ? 10 : 14,
      gap:               isMobile ? 8  : 12,
    },
    isWeb && !isDark && !isActive ? { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } : {},
    style,
  ];

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { activeOpacity: 0.75, onPress } : {};

  const fill = Math.min(1, Math.max(0, ratio ?? 0));

  const iconSize   = isMobile ? 16 : 20;
  const circleSize = isMobile ? 32 : 42;
  const valueSz    = isMobile ? 16 : 22;
  const labelSz    = isMobile ? 10 : 12;

  return (
    <Wrapper style={cardStyle} {...wrapperProps}>
      {/* Left: icon circle */}
      <View style={[
        styles.iconCircle,
        { backgroundColor: tint, width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
      ]}>
        <Icon name={icon} size={iconSize} color={accent} />
      </View>

      {/* Middle: value + label */}
      <View style={styles.textGroup}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.value, { color: accent, fontSize: valueSz, lineHeight: valueSz + 4 }]}
        >
          {value}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[styles.label, { color: theme.colors.textSecondary, fontSize: labelSz }]}
        >
          {label}
        </Text>

        {ratio !== undefined && (
          <View style={[styles.barTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,26,46,0.07)' }]}>
            <View style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: accent }]} />
          </View>
        )}
      </View>

      {/* Active filter chip — hide on mobile to save space */}
      {isActive && !isMobile && (
        <View style={[styles.activeChip, { backgroundColor: tint }]}>
          <Icon name="funnel" size={11} color={accent} />
        </View>
      )}
    </Wrapper>
  );
};

export const StatsGrid = ({ children, columns = 4, style }) => (
  <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, style]}>
    {React.Children.map(children, (child) => (
      <View style={{ flexBasis: `${100 / columns}%`, paddingHorizontal: 8, marginBottom: 16 }}>
        {child}
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  value: {
    fontWeight: '800',
  },
  label: {
    fontWeight: '500',
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  activeChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export default StatsCard;
