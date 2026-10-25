import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, setUnauthorizedHandler } from '../services/apiClient';

const normalizeUser = (payload, fallbackRole) => {
  if (!payload) return null;

  // Map legacy role names to current role names
  const roleMap = { superadmin: 'admin', superinstructor: 'admin' };
  const rawRole =
    payload.role ||
    fallbackRole ||
    'student';
  const inferredRole = roleMap[rawRole] || rawRole;

  return { ...payload, role: inferredRole };
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [additionalUsers, setAdditionalUsers] = useState([]);

  useEffect(() => {
    checkAuthStatus();
    loadAdditionalUsers();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('@skillsphere:token');
      const userData = await AsyncStorage.getItem('@skillsphere:user');

      if (token && userData) {
        const parsedUser = normalizeUser(JSON.parse(userData));
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      console.log('🔐 Attempting login for:', email);
      const response = await authAPI.login(email, password);
      console.log('📡 Login API response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('🔍 Raw user from response:', JSON.stringify(response.user, null, 2));
        console.log('🔍 Raw instructor from response:', JSON.stringify(response.instructor, null, 2));
        console.log('🔍 Will normalize:', response.user || response.instructor);

        const userPayload = normalizeUser(response.user || response.instructor, 'student');
        console.log('✅ User payload after normalization:', JSON.stringify(userPayload, null, 2));
        console.log('✅ Role specifically:', userPayload?.role);

        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));

        // Verify what was stored
        const storedUser = await AsyncStorage.getItem('@skillsphere:user');
        console.log('💾 Stored user in AsyncStorage:', storedUser);

        setUser(userPayload);
        console.log('✅ User set in context, role:', userPayload.role);
        setIsLoading(false);
        return { success: true, user: userPayload };
      }

      console.log('❌ Login failed - response.success is false');
      setIsLoading(false);
      return { success: false, error: response.error || 'Login failed' };
    } catch (error) {
      console.log('❌ Login error caught:', error.message);
      console.error('Full error:', error);
      setIsLoading(false);
      return { success: false, error: error.message || 'Login failed. Please check your credentials.' };
    }
  };

  const signup = async (name, email, password, role = 'instructor', phone = null) => {
    setIsLoading(true);
    try {
      const response = await authAPI.register({ name, email, password, role, phone });

      if (response.success) {
        const userPayload = normalizeUser(response.user || response.instructor, role || 'instructor');
        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));
        setUser(userPayload);
        setIsLoading(false);
        return { success: true, user: userPayload };
      }

      setIsLoading(false);
      return { success: false, error: response.error || 'Signup failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Signup failed. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@skillsphere:token');
      await AsyncStorage.removeItem('@skillsphere:user');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Register logout as the 401 handler so any expired-token API response
  // automatically clears the session and sends the user back to login.
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  const updateProfile = async (data) => {
    setIsLoading(true);
    try {
      const response = await authAPI.updateProfile(data);

      if (response.success) {
        const updatedUser = normalizeUser({ ...user, ...response.user }, user?.role);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setIsLoading(false);
        return { success: true, user: updatedUser };
      }

      setIsLoading(false);
      return { success: false, error: response.error || 'Update failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Update failed' };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    setIsLoading(true);
    try {
      const response = await authAPI.changePassword({ currentPassword, newPassword });
      setIsLoading(false);

      if (response.success) {
        return { success: true, message: 'Password changed successfully' };
      }

      return { success: false, error: response.error || 'Password change failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Password change failed' };
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      if (response.success) {
        const updatedUser = normalizeUser(response.user || response.instructor, user?.role);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        return { success: true, user: updatedUser };
      }
      return { success: false };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const loadAdditionalUsers = async () => {
    try {
      const storedUsers = await AsyncStorage.getItem('@skillsphere:additionalUsers');
      if (storedUsers) {
        setAdditionalUsers(JSON.parse(storedUsers));
      }
    } catch (error) {
      console.error('Load additional users error:', error);
    }
  };

  const createAccount = async (email, password, name, role) => {
    try {
      // Check if user already exists
      if (additionalUsers.find(u => u.email === email)) {
        return { success: false, error: 'Email already exists' };
      }

      // Create new user via backend
      const response = await authAPI.register({ name, email, password, role });

      if (response.success) {
        const newUser = {
          id: response.instructor?.id || Date.now().toString(),
          email,
          name,
          role,
          createdAt: new Date().toISOString(),
        };

        const updatedUsers = [...additionalUsers, newUser];
        setAdditionalUsers(updatedUsers);
        await AsyncStorage.setItem('@skillsphere:additionalUsers', JSON.stringify(updatedUsers));

        return { success: true, user: newUser };
      }

      return { success: false, error: response.error || 'Account creation failed' };
    } catch (error) {
      console.error('Create account error:', error);
      return { success: false, error: error.message || 'Account creation failed' };
    }
  };

  const deleteAccount = async (userId) => {
    try {
      const updatedUsers = additionalUsers.filter(u => u.id !== userId);
      setAdditionalUsers(updatedUsers);
      await AsyncStorage.setItem('@skillsphere:additionalUsers', JSON.stringify(updatedUsers));
      return { success: true };
    } catch (error) {
      console.error('Delete account error:', error);
      return { success: false, error: error.message };
    }
  };

  // OTP Authentication Methods
  const sendOTP = async (email, name) => {
    setIsLoading(true);
    try {
      const response = await authAPI.sendOTP(email, name);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to send OTP' };
    }
  };

  const verifyOTP = async (email, otp) => {
    setIsLoading(true);
    try {
      const response = await authAPI.verifyOTP(email, otp);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  };

  const resendOTP = async (email) => {
    setIsLoading(true);
    try {
      const response = await authAPI.resendOTP(email);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to resend OTP' };
    }
  };

  const completeRegistration = async (email, password, name, phone, age, qualification, profilePicture) => {
    setIsLoading(true);
    try {
      const response = await authAPI.completeRegistration({ email, password, name, phone, age, qualification, profilePicture });

      if (response.success) {
        const userPayload = normalizeUser(response.user, 'student');
        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));
        setUser(userPayload);
        setIsLoading(false);
        return { success: true, user: userPayload };
      }

      setIsLoading(false);
      return { success: false, error: response.error || 'Registration failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  // OTP Login Methods (for existing users)
  const sendLoginOTP = async (email) => {
    setIsLoading(true);
    try {
      const response = await authAPI.sendLoginOTP(email);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to send verification code' };
    }
  };

  const loginWithOTP = async (email, otp) => {
    setIsLoading(true);
    try {
      const response = await authAPI.loginWithOTP(email, otp);

      if (response.success) {
        const userPayload = normalizeUser(response.user, 'student');
        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));
        setUser(userPayload);
        setIsLoading(false);
        return { success: true, user: userPayload };
      }

      setIsLoading(false);
      return { success: false, error: response.error || 'Login failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  // Forgot Password - Send OTP for password reset
  const forgotPassword = async (email) => {
    setIsLoading(true);
    try {
      const response = await authAPI.forgotPassword(email);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to send reset code' };
    }
  };

  // Reset Password - Verify OTP and update password
  const resetPassword = async (email, otp, newPassword) => {
    setIsLoading(true);
    try {
      const response = await authAPI.resetPassword(email, otp, newPassword);
      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to reset password' };
    }
  };

  // Verify Signup OTP
  const verifySignupOTP = async (email, otp) => {
    setIsLoading(true);
    try {
      const response = await authAPI.verifySignupOTP(email, otp);

      if (response.success && response.token) {
        const userPayload = normalizeUser(response.user, 'student');
        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));
        setUser(userPayload);
        setIsLoading(false);
        return { success: true, user: userPayload };
      }

      setIsLoading(false);
      return response;
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  };

  // Google OAuth Authentication
  const googleSignIn = async (idToken) => {
    setIsLoading(true);
    try {
      const response = await authAPI.googleAuth(idToken);

      if (response.success) {
        const userPayload = normalizeUser(response.user, 'student');
        await AsyncStorage.setItem('@skillsphere:token', response.token);
        await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(userPayload));

        if (!response.isNewUser) {
          // Existing user — log in immediately
          setUser(userPayload);
        }
        // New user — token stored but user not set yet; caller navigates to profile completion

        setIsLoading(false);
        return { success: true, isNewUser: response.isNewUser || false, user: userPayload };
      }

      setIsLoading(false);
      return { success: false, error: response.error || 'Google sign in failed' };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Google sign in failed' };
    }
  };

  // Finalize Google sign-up profile (all optional)
  const finalizeGoogleProfile = async (phone, age, qualification, profilePicture) => {
    setIsLoading(true);
    try {
      const storedUserStr = await AsyncStorage.getItem('@skillsphere:user');
      const pendingUser = storedUserStr ? JSON.parse(storedUserStr) : null;

      if (phone || age || qualification || profilePicture) {
        const response = await authAPI.updateProfile({
          phone: phone || null,
          age: age ? parseInt(age, 10) : null,
          qualification: qualification || null,
          profilePicture: profilePicture || null,
        });
        if (response.success) {
          const updatedUser = normalizeUser({ ...pendingUser, ...response.user }, 'student');
          await AsyncStorage.setItem('@skillsphere:user', JSON.stringify(updatedUser));
          setUser(updatedUser);
          setIsLoading(false);
          return { success: true };
        }
      }

      // Skip or update failed — set the pending user as-is
      if (pendingUser) setUser(pendingUser);
      setIsLoading(false);
      return { success: true };
    } catch (error) {
      setIsLoading(false);
      try {
        const storedUserStr = await AsyncStorage.getItem('@skillsphere:user');
        if (storedUserStr) setUser(JSON.parse(storedUserStr));
      } catch {}
      return { success: true };
    }
  };

  const value = {
    user,
    isLoading,
    isInitialized,
    login,
    signup,
    logout,
    updateProfile,
    changePassword,
    refreshProfile,
    additionalUsers,
    createAccount,
    deleteAccount,
    // OTP methods (for signup)
    sendOTP,
    verifyOTP,
    resendOTP,
    completeRegistration,
    // OTP login methods (for existing users)
    sendLoginOTP,
    loginWithOTP,
    // Password reset
    forgotPassword,
    resetPassword,
    verifySignupOTP,
    // Google OAuth
    googleSignIn,
    finalizeGoogleProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
