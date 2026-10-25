import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';
import UserAvatar from '../../components/ui/UserAvatar';

const LOGO   = require('../../assets/images/skillsphere-logo.png');
const ORANGE = '#F68B3C';

const getColors = (isDark) => ({
  bg:               isDark ? '#0F0F1E'                                                          : '#EEF0FF',
  webBg:            isDark ? 'linear-gradient(135deg,#0F0F1E 0%,#1A1A2E 50%,#0F1628 100%)'    : 'linear-gradient(135deg,#EEF0FF 0%,#F0F2FF 50%,#E8EEFF 100%)',
  cardBg:           isDark ? 'rgba(255,255,255,0.06)'   : '#FFFFFF',
  cardBorder:       isDark ? 'rgba(255,255,255,0.1)'    : 'rgba(26,26,46,0.08)',
  textPrimary:      isDark ? '#FFFFFF'                  : '#1A1A2E',
  textSecondary:    isDark ? 'rgba(255,255,255,0.55)'   : 'rgba(26,26,46,0.55)',
  inputBg:          isDark ? 'rgba(255,255,255,0.06)'   : 'rgba(26,26,46,0.04)',
  inputBorder:      isDark ? 'rgba(255,255,255,0.12)'   : 'rgba(26,26,46,0.1)',
  inputText:        isDark ? '#FFFFFF'                  : '#1A1A2E',
  inputPlaceholder: isDark ? 'rgba(255,255,255,0.3)'    : 'rgba(26,26,46,0.3)',
  inputIcon:        isDark ? 'rgba(255,255,255,0.4)'    : 'rgba(26,26,46,0.4)',
  skipBg:           isDark ? 'rgba(255,255,255,0.08)'   : 'rgba(26,26,46,0.06)',
  skipBorder:       isDark ? 'rgba(255,255,255,0.15)'   : 'rgba(26,26,46,0.12)',
  logoText:         isDark ? '#FFFFFF'                  : '#1A1A2E',
});

const AuthInput = ({ icon, placeholder, value, onChangeText, keyboardType = 'default', C }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[inp.wrap, {
      backgroundColor: C.inputBg,
      borderColor: focused ? ORANGE : C.inputBorder,
    }]}>
      <Icon name={icon} size={18} color={focused ? ORANGE : C.inputIcon} />
      <TextInput
        style={[inp.field, { color: C.inputText }]}
        placeholder={placeholder}
        placeholderTextColor={C.inputPlaceholder}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
};
const inp = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  field: { flex: 1, fontSize: 14, outlineStyle: 'none' },
});

const GoogleProfileCompletionScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const googleUser = params.user || {};

  const { finalizeGoogleProfile, isLoading } = useAuth();
  const { isDark } = useTheme();
  const C = getColors(isDark);

  const [phone, setPhone]               = useState('');
  const [age, setAge]                   = useState('');
  const [qualification, setQualification] = useState('');
  const [profilePicture, setProfilePicture] = useState(googleUser.profilePicture || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const isWeb = Platform.OS === 'web';
  const bg    = isWeb ? { background: C.webBg } : { backgroundColor: C.bg };

  const handlePickPhoto = () => {
    if (isWeb && fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingPhoto(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 256;
          const scale = Math.min(MAX / img.width, MAX / img.height, 1);
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image')); };
        img.src = objectUrl;
      });
      setProfilePicture(base64);
    } catch {}
    finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleContinue = async () => {
    await finalizeGoogleProfile(phone.trim() || null, age.trim() || null, qualification.trim() || null, profilePicture || null);
  };

  const handleSkip = async () => {
    await finalizeGoogleProfile(null, null, null, googleUser.profilePicture || null);
  };

  return (
    <View style={[s.container, bg]}>
      <View style={[s.glow1, { backgroundColor: ORANGE + '0C' }]} />
      <View style={[s.glow2, { backgroundColor: '#6366F1' + (isDark ? '0A' : '08') }]} />

      <View style={s.topBar}>
        <View style={{ width: 36 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={LOGO} style={s.logoImg} resizeMode="cover" />
          <Text style={[s.logoText, { color: C.logoText }]}>SKILL<Text style={{ color: ORANGE }}>SPHERE</Text></Text>
        </View>
        <ThemeToggle iconColor={C.textPrimary} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <View style={s.brandHeader}>
            {isWeb && (
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelected} />
            )}
            <TouchableOpacity style={s.avatarWrap} onPress={handlePickPhoto} activeOpacity={0.8}>
              {uploadingPhoto ? (
                <View style={[s.avatarLoadingCircle, { borderColor: ORANGE }]}>
                  <ActivityIndicator color={ORANGE} />
                </View>
              ) : (
                <UserAvatar user={{ name: googleUser.name, profilePicture }} size={84} borderColor={ORANGE} />
              )}
              <View style={s.avatarBadge}>
                <Icon name="camera" size={12} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text style={[s.title, { color: C.textPrimary }]}>One Last Step</Text>
            <Text style={[s.subtitle, { color: C.textSecondary }]}>
              Welcome, <Text style={{ color: ORANGE, fontWeight: '700' }}>{googleUser.name || 'there'}</Text>!{'\n'}
              Add your details to personalize your experience
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder, maxWidth: 440, alignSelf: 'center', width: '100%' }]}>

            <AuthInput C={C} icon="call-outline" placeholder="Phone number (optional)" value={phone}
              onChangeText={setPhone} keyboardType="phone-pad" />

            <AuthInput C={C} icon="calendar-outline" placeholder="Age (optional)" value={age}
              onChangeText={setAge} keyboardType="numeric" />

            <AuthInput C={C} icon="school-outline" placeholder="Qualification (optional)" value={qualification}
              onChangeText={setQualification} />

            <TouchableOpacity style={s.primaryBtn} onPress={handleContinue} disabled={isLoading} activeOpacity={0.85}>
              {isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={s.primaryBtnText}>Continue</Text>
                  </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[s.skipBtn, { backgroundColor: C.skipBg, borderColor: C.skipBorder }]}
              onPress={handleSkip} disabled={isLoading} activeOpacity={0.7}>
              <Text style={[s.skipBtnText, { color: C.textSecondary }]}>Skip for now</Text>
            </TouchableOpacity>

          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  container:    { flex: 1 },
  glow1:        { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -60, right: -50, zIndex: 0 },
  glow2:        { position: 'absolute', width: 220, height: 220, borderRadius: 110, bottom: 60, left: -70, zIndex: 0 },
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 12, zIndex: 10 },
  logoImg:      { width: 28, height: 28, borderRadius: 7 },
  logoText:     { fontFamily: Platform.OS === 'web' ? 'Fredoka' : 'Fredoka-Bold', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  scroll:       { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  brandHeader:  { alignItems: 'center', paddingVertical: 32 },
  avatarWrap:         { marginBottom: 18, position: 'relative' },
  avatarLoadingCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  avatarBadge:        { position: 'absolute', bottom: 0, right: 0, backgroundColor: ORANGE, borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: 26, fontWeight: '900', marginBottom: 10 },
  subtitle:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  card:         { borderRadius: 24, borderWidth: 1, padding: 24 },
  primaryBtn:   { paddingVertical: 13, paddingHorizontal: 28, borderRadius: 9999, backgroundColor: ORANGE, borderWidth: 1, borderColor: '#E77828', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', shadowColor: '#C96A24', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 6, elevation: 3, marginBottom: 12 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.12 },
  skipBtn:      { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 9999, borderWidth: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  skipBtnText:  { fontSize: 14, fontWeight: '600' },
});

export default GoogleProfileCompletionScreen;
