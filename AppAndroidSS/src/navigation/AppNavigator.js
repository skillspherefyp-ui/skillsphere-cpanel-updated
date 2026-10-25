import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import InstructorNavigator from './InstructorNavigator';
import StudentNavigator from './StudentNavigator';
import AdminNavigator from './AdminNavigator';
import LoadingScreen from '../screens/LoadingScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, isLoading, isInitialized } = useAuth();

  console.log('🔄 AppNavigator render - isInitialized:', isInitialized, 'isLoading:', isLoading);

  // Only show loading screen during initial app load, NOT during API calls
  // Each screen handles its own loading state (e.g., sendingOTP, verifying, etc.)
  if (!isInitialized) {
    console.log('⏳ Showing loading screen (initial load)');
    return <LoadingScreen />;
  }

  const getUserRole = () => {
    if (!user) {
      console.log('🚫 AppNavigator: No user found - will show Auth screens');
      return null;
    }

    console.log('👤 AppNavigator: User object:', JSON.stringify(user, null, 2));
    console.log('🔑 User role:', user.role);
    console.log('🔍 User role type:', typeof user.role);

    return user.role;
  };

  const role = getUserRole();
  console.log('🎯 AppNavigator routing decision - role:', role, 'typeof:', typeof role);

  if (role === 'admin') {
    console.log('✅ Routing to Admin Dashboard');
  } else if (role === 'instructor') {
    console.log('✅ Routing to Instructor Navigator');
  } else if (user && role) {
    console.log('✅ Routing to Student Navigator (default for authenticated user)');
  } else if (!user) {
    console.log('✅ Routing to Auth Navigator (no user)');
  } else {
    console.log('⚠️ WARNING: User exists but no valid role detected. User:', JSON.stringify(user, null, 2));
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : role === 'admin' ? (
        <Stack.Screen name="Admin" component={AdminNavigator} />
      ) : role === 'instructor' ? (
        <Stack.Screen name="Instructor" component={InstructorNavigator} />
      ) : (
        <Stack.Screen name="Student" component={StudentNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
